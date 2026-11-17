'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { MOCK_AUCTION_LOTS } from '@/lib/mock-data';
import { CartItem, clearCart, getCartItems, removeLotFromCart } from '@/lib/cart-store';
import { calculateSplit, SplitCalculationResult } from '@/lib/commission-engine';
import { PixQrScanner } from '@/components/PixQrScanner';

function CheckoutContent() {
  const searchParams = useSearchParams();

  const fromCart = searchParams.get('fromCart') === '1';
  const loteId = searchParams.get('loteId') || 'lote-arroz-5kg';
  const valorParam = searchParams.get('valor');

  const matchedMockLot = MOCK_AUCTION_LOTS.find((l) => l.id === loteId);
  const [cartCheckoutItems, setCartCheckoutItems] = useState<CartItem[]>([]);
  const [lot, setLot] = useState(() => matchedMockLot || MOCK_AUCTION_LOTS[0]);
  const [loadingLot, setLoadingLot] = useState<boolean>(() => !fromCart && !matchedMockLot);

  useEffect(() => {
    let active = true;
    if (fromCart) {
      const items = getCartItems();
      if (items.length > 0) {
        setCartCheckoutItems(items);
        setLot(items[0].lot);
      }
      setLoadingLot(false);
    }
    fetch('/api/lotes', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        const matched = data?.lots?.find((l: { id: string }) => l.id === loteId);
        if (matched && !fromCart) setLot(matched);
        setLoadingLot(false);
      })
      .catch(() => {
        if (active) setLoadingLot(false);
      });
    return () => {
      active = false;
    };
  }, [loteId, fromCart]);

  const parsedValorParam = valorParam ? Number(valorParam) : NaN;
  const isMultiLotCart = fromCart && cartCheckoutItems.length > 1;
  const totalAmount = isMultiLotCart
    ? cartCheckoutItems.reduce((acc, item) => acc + item.precoTotal, 0)
    : Number.isFinite(parsedValorParam) && parsedValorParam > 0
    ? parsedValorParam
    : fromCart && cartCheckoutItems[0]
    ? cartCheckoutItems[0].precoTotal
    : lot.lanceAtual;
  const modalidade = lot.tipoVenda || 'leilao';

  const [split, setSplit] = useState<SplitCalculationResult>(() =>
    calculateSplit(totalAmount, modalidade)
  );

  useEffect(() => {
    let active = true;
    fetch(`/api/comissoes?amount=${encodeURIComponent(totalAmount)}&modalidade=${encodeURIComponent(modalidade)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.split) {
          setSplit(data.split);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [totalAmount, modalidade]);

  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'ted'>('pix');
  const [pixCopied, setPixCopied] = useState(false);
  const [downloadingQr, setDownloadingQr] = useState(false);
  const [qrDownloadStatus, setQrDownloadStatus] = useState<string | null>(null);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [scannedReceiptCode, setScannedReceiptCode] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [orderHash, setOrderHash] = useState<string>('SHA256:e3b0c44298fc1c149afbf4c8996fb92427ae');
  const [orderCode, setOrderCode] = useState<string | null>(null);

  const mockPixKey =
    '00020101021226880014br.gov.bcb.pix2566spi.varejistaonline.com.br/qr/v2/escrow_9041_88325204000053039865802BR5925VAREJISTA ONLINE ESCROW6009SAO PAULO62070503***6304E8A1';

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(
    `https://varejistaonline.com.br/escrow?lote=${lot.id}&valor=${totalAmount}`
  )}`;

  const handleCopyPix = async () => {
    try {
      await navigator.clipboard.writeText(mockPixKey);
      setPixCopied(true);
      setTimeout(() => setPixCopied(false), 3000);
    } catch {
      setPixCopied(false);
    }
  };

  const handleDownloadQrCode = async () => {
    if (downloadingQr) return;
    setDownloadingQr(true);
    setQrDownloadStatus(null);
    try {
      const response = await fetch(qrImageUrl);
      if (!response.ok) throw new Error('Falha ao baixar QR');
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `comprovante-pix-${lot.id}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
      setQrDownloadStatus('QR Code salvo! Envie este PNG no leitor abaixo para testar.');
      setTimeout(() => setQrDownloadStatus(null), 4000);
    } catch {
      setQrDownloadStatus('Não foi possível baixar o PNG do QR Code agora.');
    } finally {
      setDownloadingQr(false);
    }
  };

  const handleConfirmPayment = async (pixComprovanteCodigo?: string) => {
    if (confirming || confirmed) return;
    setConfirming(true);
    setCheckoutError(null);
    try {
      const itemsToOrder = isMultiLotCart
        ? cartCheckoutItems.map((i) => ({ loteId: i.lot.id, valorTotalArremate: i.precoTotal }))
        : [{ loteId: lot.id, valorTotalArremate: totalAmount }];

      const createdCodes: string[] = [];
      let lastHash: string | null = null;

      for (const item of itemsToOrder) {
        const res = await fetch('/api/pedidos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            loteId: item.loteId,
            valorTotalArremate: item.valorTotalArremate,
            compradorNome: 'Supermercado Central Ltda',
            pixComprovanteCodigo,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setCheckoutError(data?.error || 'Não foi possível homologar o pagamento em custódia Escrow.');
          setConfirming(false);
          return;
        }
        if (data?.order?.termoArremateHash) {
          lastHash = data.order.termoArremateHash;
        }
        if (data?.order?.codigoPedido) {
          createdCodes.push(data.order.codigoPedido);
        }
      }

      if (lastHash) setOrderHash(lastHash);
      if (createdCodes.length > 0) setOrderCode(createdCodes.join(' • '));

      if (isMultiLotCart) {
        clearCart();
      } else {
        removeLotFromCart(lot.id);
      }
      setConfirmed(true);
    } catch {
      setCheckoutError('Falha de comunicação com o servidor Escrow. Verifique a conexão e tente novamente.');
    } finally {
      setConfirming(false);
    }
  };

  const handleQrReceiptScanned = (decodedPayload: string) => {
    setScannedReceiptCode(decodedPayload);
    setShowQrScanner(false);
    handleConfirmPayment(decodedPayload);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Title */}
      <div className="space-y-1">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed text-xs font-bold">
          <span className="material-symbols-outlined text-[16px]">lock</span>
          Ambiente Fiduciário Seguro • BACEN Res. 4.656
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface">
          Checkout Escrow B2B & Split Fiduciário
        </h1>
        <p className="text-xs sm:text-sm text-on-surface-variant">
          Termo de arremate oficial, segregação de custódia e emissão de ordem de pagamento D+0.
        </p>
      </div>

      {confirmed ? (
        <div className="bg-surface-container-lowest p-8 rounded-2xl border border-secondary/40 shadow-xl text-center space-y-5 animate-in fade-in zoom-in-95">
          <div className="w-16 h-16 rounded-full bg-secondary-container text-secondary flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-4xl">verified</span>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-bold text-secondary uppercase tracking-widest">
              {orderCode
                ? `PEDIDO ${orderCode} • PAGAMENTO CONFIRMADO EM CUSTÓDIA ESCROW`
                : 'PAGAMENTO CONFIRMADO EM CUSTÓDIA ESCROW'}
            </span>
            <h2 className="text-2xl font-extrabold text-on-surface">Arremate Homologado com Sucesso!</h2>
            <p className="text-xs text-on-surface-variant max-w-lg mx-auto">
              O valor de <strong>R$ {totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong> foi depositado na conta de custódia fiduciária. O repasse líquido de R$ {split.valorRepasseLiquidoFornecedor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} será liberado à indústria após conferência de lacres na doca do CD.
            </p>
          </div>

          <div className="p-4 bg-surface-container-low rounded-xl text-xs max-w-md mx-auto text-left space-y-2 border border-outline-variant/30">
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Hash do Termo:</span>
              <span className="font-mono text-[10px] text-primary truncate max-w-[200px]">
                {orderHash}
              </span>
            </div>
            {scannedReceiptCode && (
              <div className="flex justify-between items-center gap-2">
                <span className="text-on-surface-variant shrink-0">Comprovante QR Lido:</span>
                <span className="font-mono text-[10px] text-secondary font-bold truncate max-w-[200px]">
                  {scannedReceiptCode}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-on-surface-variant">
                {lot.tipoFrete === 'CIF' ? 'Entrega CIF:' : 'Retirada FOB:'}
              </span>
              <strong className="text-on-surface">
                {lot.tipoFrete === 'CIF' ? `Despacho direto de ${lot.produto.origem}` : `${lot.produto.origem} (Doca 03A)`}
              </strong>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Janela de Agendamento:</span>
              <strong className="text-secondary">Liberada em 48 horas</strong>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/pedidos"
              className="w-full sm:w-auto px-6 py-3 bg-primary hover:bg-primary-container text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">event_available</span>
              <span>Agendar Doca de Retirada FOB</span>
            </Link>
            <Link
              href="/catalogo"
              className="w-full sm:w-auto px-6 py-3 bg-surface-container hover:bg-surface-container-high text-on-surface font-bold text-xs rounded-xl transition-colors"
            >
              Voltar ao Catálogo
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Lot Summary & Split Breakdown */}
          <div className="lg:col-span-7 space-y-6">
            {/* Lot Summary */}
            <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 shadow-sm space-y-4">
              <h3 className="font-extrabold text-sm text-on-surface uppercase border-b border-surface-container pb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[18px]">receipt_long</span>
                {isMultiLotCart
                  ? `Lotes Consolidados do Carrinho (${cartCheckoutItems.length})`
                  : 'Dados do Lote Homologado'}
              </h3>

              {isMultiLotCart ? (
                <div className="space-y-3">
                  {cartCheckoutItems.map((item) => (
                    <div
                      key={item.lot.id}
                      className="flex items-center justify-between gap-3 text-xs p-2.5 rounded-xl bg-surface-container-low border border-surface-container"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-surface-container shrink-0">
                          <Image
                            src={item.lot.produto.imagemUrl}
                            alt={item.lot.produto.titulo}
                            fill
                            sizes="56px"
                            quality={92}
                            referrerPolicy="no-referrer"
                            className="object-cover img-sharp"
                          />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[10px] font-bold text-on-surface-variant block">
                            {item.lot.codigoLote} • {item.quantidade}x
                          </span>
                          <h4 className="font-bold text-on-surface truncate">{item.lot.produto.titulo}</h4>
                        </div>
                      </div>
                      <strong className="text-primary font-extrabold shrink-0">
                        R$ {item.precoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </strong>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-4 text-xs">
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-surface-container shrink-0">
                    <Image
                      src={lot.produto.imagemUrl}
                      alt={lot.produto.titulo}
                      fill
                      sizes="80px"
                      quality={92}
                      referrerPolicy="no-referrer"
                      className="object-cover img-sharp"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-on-surface-variant">
                      {lot.codigoLote} • {lot.produto.marca}
                      {fromCart && cartCheckoutItems[0]?.quantidade
                        ? ` • ${cartCheckoutItems[0].quantidade}x no lote`
                        : ''}
                    </span>
                    <h4 className="font-bold text-sm text-on-surface">{lot.produto.titulo}</h4>
                    <p className="text-on-surface-variant">
                      Volume: {lot.produto.totalCaixas} caixas ({lot.produto.totalUnidades.toLocaleString('pt-BR')} unidades)
                    </p>
                    <p className="text-secondary font-bold">
                      Origem: {lot.produto.origem} (Frete {lot.tipoFrete})
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Split Breakdown Table */}
            <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30 shadow-sm space-y-4 text-xs">
              <div className="flex items-center justify-between border-b border-surface-container pb-2">
                <h3 className="font-extrabold text-sm text-on-surface uppercase flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[18px]">call_split</span>
                  Detalhamento do Split Fiduciário D+0
                </h3>
                <span className="text-[10px] text-secondary font-bold">Res. BACEN 4.656</span>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between py-1 border-b border-surface-container">
                  <span className="text-on-surface-variant">Valor Total do Arremate (GMV):</span>
                  <strong className="text-sm font-extrabold text-on-surface">
                    R$ {split.valorBrutoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </strong>
                </div>

                <div className="flex justify-between py-1 border-b border-surface-container">
                  <div className="space-y-0.5">
                    <span className="text-on-surface-variant block">
                      Taxa Administrativa da Plataforma ({split.percentualComissao}%):
                    </span>
                    <span className="text-[10px] text-outline">
                      Intermediação tecnológica, compliance e trava antifraude
                    </span>
                  </div>
                  <strong className="text-sm font-extrabold text-primary">
                    - R$ {split.valorComissaoPlataforma.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </strong>
                </div>

                <div className="flex justify-between py-1 bg-secondary-container/20 p-3 rounded-xl border border-secondary/30">
                  <div className="space-y-0.5">
                    <span className="font-bold text-secondary block">
                      Repasse Líquido à Indústria Fornecedora:
                    </span>
                    <span className="text-[10px] text-on-surface-variant">
                      Creditado via SPI/PIX D+0 após conferência na doca
                    </span>
                  </div>
                  <strong className="text-base font-extrabold text-secondary">
                    R$ {split.valorRepasseLiquidoFornecedor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Payment Methods & Escrow Deposition */}
          <div className="lg:col-span-5 bg-surface-container-lowest p-6 rounded-2xl border-2 border-primary/20 shadow-lg space-y-5 text-xs">
            <h3 className="font-extrabold text-sm text-on-surface uppercase border-b border-surface-container pb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[18px]">account_balance</span>
              Forma de Custódia Fiduciária
            </h3>

            {/* Payment Method Selector */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('pix')}
                className={`py-2 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                  paymentMethod === 'pix'
                    ? 'border-primary bg-primary text-white shadow-sm'
                    : 'border-outline-variant bg-surface-container-low text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">bolt</span>
                <span>PIX SPI Instantâneo</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('ted')}
                className={`py-2 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                  paymentMethod === 'ted'
                    ? 'border-primary bg-primary text-white shadow-sm'
                    : 'border-outline-variant bg-surface-container-low text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">account_balance</span>
                <span>TED Judicial / STR</span>
              </button>
            </div>

            {/* PIX Details */}
            {paymentMethod === 'pix' && (
              <div className="space-y-3 bg-surface-container-low p-4 rounded-xl border border-outline-variant/30 text-center">
                {!showQrScanner ? (
                  <>
                    <div className="w-36 h-36 mx-auto bg-white p-2 rounded-xl border border-outline-variant/40 flex items-center justify-center shadow-sm">
                      <Image
                        src={qrImageUrl}
                        alt="QR Code PIX Escrow"
                        width={140}
                        height={140}
                        quality={100}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-contain img-crisp-qr"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-on-surface-variant font-bold uppercase block">
                        Valor a Transferir para Conta Escrow:
                      </span>
                      <span className="text-xl font-extrabold text-primary">
                        R$ {totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyPix}
                      className="w-full py-2 bg-white hover:bg-surface-container border border-outline-variant text-on-surface font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[16px]">content_copy</span>
                      <span>{pixCopied ? 'Chave PIX Copiada!' : 'Copiar Código PIX Copia e Cola'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadQrCode}
                      disabled={downloadingQr}
                      className="w-full py-2 bg-white hover:bg-surface-container border border-outline-variant/70 text-on-surface-variant font-bold text-[11px] rounded-lg transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[15px]">download</span>
                      <span>{downloadingQr ? 'Gerando PNG...' : 'Baixar QR Code PIX (PNG para Teste)'}</span>
                    </button>

                    {qrDownloadStatus && (
                      <p className="text-[11px] font-semibold text-secondary">{qrDownloadStatus}</p>
                    )}

                    <button
                      type="button"
                      onClick={() => setShowQrScanner(true)}
                      disabled={confirming}
                      className="w-full py-2.5 bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary font-extrabold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[17px]">qr_code_scanner</span>
                      <span>Escanear Comprovante PIX (Confirmação Automática)</span>
                    </button>
                  </>
                ) : (
                  <PixQrScanner
                    onScanSuccess={handleQrReceiptScanned}
                    onClose={() => setShowQrScanner(false)}
                    disabled={confirming}
                  />
                )}
              </div>
            )}

            {/* TED Details */}
            {paymentMethod === 'ted' && (
              <div className="space-y-2 bg-surface-container-low p-4 rounded-xl border border-outline-variant/30 text-xs">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Banco Liquidante:</span>
                  <strong>001 - Banco do Brasil / STR BACEN</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Agência / Conta Escrow:</span>
                  <strong className="font-mono">1800-4 / 92040-1</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Titular:</span>
                  <strong>Varejista Online Custódia Fiduciária Ltda</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">CNPJ Custodiante:</span>
                  <strong className="font-mono">48.910.420/0001-88</strong>
                </div>
              </div>
            )}

            {checkoutError && (
              <div className="p-3 rounded-xl bg-error-container text-on-error-container text-xs font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">error</span>
                <span>{checkoutError}</span>
              </div>
            )}

            {/* Confirm Payment CTA */}
            <button
              type="button"
              onClick={() => handleConfirmPayment()}
              disabled={confirming || loadingLot}
              className="w-full py-3.5 bg-secondary hover:bg-secondary-container text-white hover:text-on-secondary-container font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loadingLot ? (
                <span>Carregando dados do lote...</span>
              ) : confirming ? (
                <span>Confirmando com o Banco Central...</span>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">verified_user</span>
                  <span>Confirmar Depósito e Homologar Arremate</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs">Carregando checkout fiduciário...</div>}>
      <CheckoutContent />
    </Suspense>
  );
}
