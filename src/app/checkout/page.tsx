'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { MOCK_AUCTION_LOTS } from '@/lib/mock-data';
import { calculateSplit } from '@/lib/commission-engine';

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const loteId = searchParams.get('loteId') || 'lote-418';
  const valorParam = searchParams.get('valor');

  const lot = MOCK_AUCTION_LOTS.find((l) => l.id === loteId) || MOCK_AUCTION_LOTS[0];
  const totalAmount = valorParam ? Number(valorParam) : lot.lanceAtual;

  const split = calculateSplit(totalAmount, 'leilao');

  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'ted'>('pix');
  const [pixCopied, setPixCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const mockPixKey =
    '00020101021226880014br.gov.bcb.pix2566spi.varejistaonline.com.br/qr/v2/escrow_9041_88325204000053039865802BR5925VAREJISTA ONLINE ESCROW6009SAO PAULO62070503***6304E8A1';

  const handleCopyPix = () => {
    navigator.clipboard.writeText(mockPixKey);
    setPixCopied(true);
    setTimeout(() => setPixCopied(false), 3000);
  };

  const handleConfirmPayment = () => {
    setConfirming(true);
    setTimeout(() => {
      setConfirming(false);
      setConfirmed(true);
    }, 1000);
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
              PAGAMENTO CONFIRMADO EM CUSTÓDIA ESCROW
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
                SHA256:e3b0c44298fc1c149afbf4c8996fb92427ae
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Retirada FOB:</span>
              <strong className="text-on-surface">CD Jundiaí - SP (Doca 03A)</strong>
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
                Dados do Lote Homologado
              </h3>

              <div className="flex items-center gap-4 text-xs">
                <img
                  src={lot.produto.imagemUrl}
                  alt={lot.produto.titulo}
                  className="w-20 h-20 rounded-xl object-cover shrink-0"
                />
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-on-surface-variant">
                    {lot.codigoLote} • {lot.produto.marca}
                  </span>
                  <h4 className="font-bold text-sm text-on-surface">{lot.produto.titulo}</h4>
                  <p className="text-on-surface-variant">
                    Volume: {lot.produto.totalCaixas} caixas ({lot.produto.totalUnidades.toLocaleString('pt-BR')} unidades)
                  </p>
                  <p className="text-secondary font-bold">
                    Origem: {lot.produto.origem} (Frete FOB)
                  </p>
                </div>
              </div>
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
                <div className="w-36 h-36 mx-auto bg-white p-2 rounded-xl border border-outline-variant/40 flex items-center justify-center shadow-sm">
                  <img
                    src="https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=https://varejistaonline.com.br/escrow"
                    alt="QR Code PIX Escrow"
                    className="w-full h-full object-contain"
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

            {/* Confirm Payment CTA */}
            <button
              type="button"
              onClick={handleConfirmPayment}
              disabled={confirming}
              className="w-full py-3.5 bg-secondary hover:bg-secondary-container text-white hover:text-on-secondary-container font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              {confirming ? (
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
