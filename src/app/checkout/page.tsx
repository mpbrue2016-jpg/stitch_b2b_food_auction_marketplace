'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { QRCodeSVG } from 'qrcode.react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { CartItem, clearCart, removeLotFromCart, syncCartFromServer } from '@/lib/cart-store';
import { calculateSplit, SplitCalculationResult } from '@/lib/commission-engine';
import { AuctionLot, EscrowOrder } from '@/lib/types';

interface PendingPixCharge {
  orderIds: string[];
  orderCodes: string[];
  orderHashes: string[];
  pixCopiaCola: string;
  txid: string;
}

function CheckoutContent() {
  const searchParams = useSearchParams();
  const { user, profile, loading: authLoading } = useAuth();

  const fromCart = searchParams.get('fromCart') === '1';
  const orderIdParam = searchParams.get('orderId') || '';
  const loteId = searchParams.get('loteId') || '';
  const proposalId = searchParams.get('proposalId') || '';
  const sourceTypeParam = searchParams.get('sourceType');
  const valorParam = searchParams.get('valor');

  const [cartCheckoutItems, setCartCheckoutItems] = useState<CartItem[]>([]);
  const [lot, setLot] = useState<AuctionLot | null>(null);
  const [resumedAmount, setResumedAmount] = useState<number | null>(null);
  const [resumedOrderLoaded, setResumedOrderLoaded] = useState(false);
  const [loadingLot, setLoadingLot] = useState<boolean>(true);
  const [notFoundError, setNotFoundError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadTarget() {
      if (orderIdParam && authLoading) return;
      setLoadingLot(true);
      setNotFoundError(null);
      try {
        if (orderIdParam) {
          if (!user) {
            setLoadingLot(false);
            return;
          }
          const orderRes = await fetch(
            `/api/pedidos?orderId=${encodeURIComponent(orderIdParam)}`,
            { cache: 'no-store' }
          );
          const orderData = orderRes.ok ? await orderRes.json() : await orderRes.json().catch(() => null);
          if (!active) return;

          if (!orderRes.ok || !orderData?.order) {
            setNotFoundError(orderData?.error || 'Pedido Escrow não localizado.');
            setLoadingLot(false);
            return;
          }

          const resumedOrder = orderData.order as EscrowOrder;
          setResumedAmount(resumedOrder.valorTotalArremate);
          setOrderCode(resumedOrder.codigoPedido);
          if (resumedOrder.termoArremateHash) setOrderHash(resumedOrder.termoArremateHash);
          setSplit({
            valorBrutoTotal: resumedOrder.valorTotalArremate,
            percentualComissao: resumedOrder.percentualComissao,
            valorComissaoPlataforma: resumedOrder.valorComissaoPlataforma,
            valorRepasseLiquidoFornecedor: resumedOrder.valorRepasseLiquidoFornecedor,
            taxaEscrowBancaria: 0,
            valorDisponivelCustodia: resumedOrder.valorTotalArremate,
          });
          setCommissionReady(true);

          if (
            resumedOrder.statusPagamento === 'em_custodia_escrow' ||
            resumedOrder.statusPagamento === 'repasse_liquidado_d0'
          ) {
            setConfirmed(true);
          } else if (
            resumedOrder.statusPagamento === 'aguardando_pagamento' &&
            orderData?.pix?.pixCopiaCola
          ) {
            setPendingCharge({
              orderIds: [resumedOrder.id],
              orderCodes: [resumedOrder.codigoPedido],
              orderHashes: resumedOrder.termoArremateHash ? [resumedOrder.termoArremateHash] : [],
              pixCopiaCola: orderData.pix.pixCopiaCola,
              txid: orderData.pix.txid || '',
            });
          } else {
            setCheckoutError(
              resumedOrder.statusPagamento === 'em_disputa'
                ? 'Este pedido está em disputa. Consulte Meus Pedidos para acompanhar a resolução.'
                : resumedOrder.statusPagamento === 'estornado'
                  ? 'Este pedido foi estornado e não está aguardando pagamento.'
                  : 'Não há uma cobrança pendente disponível para este pedido.'
            );
          }
          setResumedOrderLoaded(true);

          const lotRes = await fetch(`/api/lotes?id=${encodeURIComponent(resumedOrder.loteId)}`, {
            cache: 'no-store',
          });
          const lotData = lotRes.ok ? await lotRes.json() : null;
          if (!active) return;
          if (lotData?.lot) {
            setLot(lotData.lot);
          } else {
            setNotFoundError('Lote vinculado ao pedido não encontrado.');
          }
          setLoadingLot(false);
          return;
        }

        if (fromCart) {
          const items = await syncCartFromServer();
          if (!active) return;
          if (items.length > 0) {
            setCartCheckoutItems(items);
            setLot(items[0].lot);
          } else {
            setCartCheckoutItems([]);
            setLot(null);
            setNotFoundError('Seu carrinho B2B está vazio.');
          }
          setLoadingLot(false);
          return;
        }

        if (!loteId) {
          setNotFoundError('Nenhum lote selecionado para checkout Escrow.');
          setLoadingLot(false);
          return;
        }

        const res = await fetch(`/api/lotes?id=${encodeURIComponent(loteId)}`, {
          cache: 'no-store',
        });
        const data = res.ok ? await res.json() : null;
        if (!active) return;
        if (data?.lot) {
          setLot(data.lot);
        } else {
          setNotFoundError('Lote solicitado não encontrado ou já removido.');
        }
      } catch {
        if (active) setNotFoundError('Não foi possível carregar os dados do lote.');
      } finally {
        if (active) setLoadingLot(false);
      }
    }

    void loadTarget();
    return () => {
      active = false;
    };
  }, [loteId, fromCart, orderIdParam, user, authLoading]);

  const parsedValorParam = valorParam ? Number(valorParam) : NaN;
  const isMultiLotCart = fromCart && cartCheckoutItems.length > 1;
  const totalAmount =
    resumedAmount !== null
      ? resumedAmount
      : isMultiLotCart
      ? cartCheckoutItems.reduce((acc, item) => acc + item.precoTotal, 0)
      : Number.isFinite(parsedValorParam) && parsedValorParam > 0
      ? parsedValorParam
      : fromCart && cartCheckoutItems[0]
      ? cartCheckoutItems[0].precoTotal
      : lot?.precoArremateImediato || lot?.lanceAtual || 0;
  const modalidade = lot?.tipoVenda || 'leilao';

  const resolvedSourceType: 'buy_now' | 'auction' | 'proposal' =
    sourceTypeParam === 'proposal' || proposalId
      ? 'proposal'
      : sourceTypeParam === 'auction'
      ? 'auction'
      : lot &&
        lot.tipoVenda === 'leilao' &&
        Number.isFinite(parsedValorParam) &&
        parsedValorParam === lot.lanceAtual &&
        (!lot.precoArremateImediato || parsedValorParam < lot.precoArremateImediato)
      ? 'auction'
      : 'buy_now';

  const [split, setSplit] = useState<SplitCalculationResult>(() =>
    calculateSplit(totalAmount, 0)
  );
  const [commissionReady, setCommissionReady] = useState(false);
  const [commissionError, setCommissionError] = useState<string | null>(null);

  useEffect(() => {
    if (resumedOrderLoaded) return;
    if (totalAmount <= 0) {
      setSplit(calculateSplit(0, 0));
      setCommissionReady(false);
      setCommissionError('Não foi possível calcular a comissão para um valor inválido.');
      return;
    }
    let active = true;
    setCommissionReady(false);
    setCommissionError(null);
    fetch(
      `/api/comissoes?amount=${encodeURIComponent(totalAmount)}&modalidade=${encodeURIComponent(modalidade)}`
    )
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.split) {
          throw new Error(data?.error || 'Não foi possível carregar a regra de comissão.');
        }
        if (active) {
          setSplit(data.split);
          setCommissionReady(true);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setCommissionError(
            error instanceof Error ? error.message : 'Erro ao consultar a regra de comissão.'
          );
        }
      });
    return () => {
      active = false;
    };
  }, [totalAmount, modalidade, resumedOrderLoaded]);

  const [pendingCharge, setPendingCharge] = useState<PendingPixCharge | null>(null);
  const [generatingCharge, setGeneratingCharge] = useState(false);
  const [pixCopied, setPixCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [orderHash, setOrderHash] = useState<string>('');
  const [orderCode, setOrderCode] = useState<string | null>(null);

  const checkoutCacheKey = lot
    ? `vo_pix_charge_provider_v2_${user?.id || 'anon'}_${isMultiLotCart ? cartCheckoutItems.map((i) => i.lot.id).join('_') : lot.id}_${totalAmount}_${resolvedSourceType}`
    : '';

  useEffect(() => {
    if (orderIdParam || resumedOrderLoaded || authLoading || loadingLot || !user || !lot || confirmed) return;
    if (profile?.role === 'fornecedor') return;

    if (typeof window !== 'undefined' && checkoutCacheKey) {
      const cached = window.sessionStorage.getItem(checkoutCacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as PendingPixCharge;
          if (parsed?.orderIds?.length && parsed?.pixCopiaCola) {
            setPendingCharge(parsed);
            if (parsed.orderHashes[0]) setOrderHash(parsed.orderHashes[0]);
            if (parsed.orderCodes.length) setOrderCode(parsed.orderCodes.join(' • '));
            if (isMultiLotCart) clearCart();
            else removeLotFromCart(lot.id);
            return;
          }
        } catch {
          // ignore corrupted session cache
        }
      }
    }

    let active = true;
    async function issuePixCharge() {
      setGeneratingCharge(true);
      setCheckoutError(null);
      try {
        const itemsToOrder = isMultiLotCart
          ? cartCheckoutItems.map((i) => ({ loteId: i.lot.id }))
          : [{ loteId: lot!.id }];

        const orderIds: string[] = [];
        const orderCodes: string[] = [];
        const orderHashes: string[] = [];
        let firstPix = '';
        let firstTxid = '';

        for (const item of itemsToOrder) {
          const res = await fetch('/api/pedidos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              loteId: item.loteId,
              sourceType: resolvedSourceType,
              proposalId: proposalId || undefined,
              mode: 'charge_only',
            }),
          });
          const data = await res.json();
          if (!active) return;
          if (!res.ok) {
            setCheckoutError(data?.error || 'Não foi possível gerar a cobrança PIX Escrow.');
            return;
          }
          if (data?.order?.id) orderIds.push(data.order.id);
          if (data?.order?.codigoPedido) orderCodes.push(data.order.codigoPedido);
          if (data?.order?.termoArremateHash) orderHashes.push(data.order.termoArremateHash);
          if (!firstPix && data?.pix?.pixCopiaCola) firstPix = data.pix.pixCopiaCola;
          if (!firstTxid && data?.pix?.txid) firstTxid = data.pix.txid;
          if (data?.split && !isMultiLotCart) setSplit(data.split);
        }

        if (orderIds.length > 0 && firstPix) {
          const charge: PendingPixCharge = {
            orderIds,
            orderCodes,
            orderHashes,
            pixCopiaCola: firstPix,
            txid: firstTxid,
          };
          setPendingCharge(charge);
          if (orderHashes[0]) setOrderHash(orderHashes[0]);
          if (orderCodes.length) setOrderCode(orderCodes.join(' • '));
          if (typeof window !== 'undefined' && checkoutCacheKey) {
            window.sessionStorage.setItem(checkoutCacheKey, JSON.stringify(charge));
          }
          if (isMultiLotCart) clearCart();
          else removeLotFromCart(lot!.id);
        }
      } catch {
        if (active) {
          setCheckoutError('Falha ao gerar código EMV PIX junto ao servidor Escrow.');
        }
      } finally {
        if (active) setGeneratingCharge(false);
      }
    }

    void issuePixCharge();
    return () => {
      active = false;
    };
  }, [
    orderIdParam,
    resumedOrderLoaded,
    authLoading,
    loadingLot,
    user,
    profile?.role,
    lot,
    confirmed,
    isMultiLotCart,
    cartCheckoutItems,
    resolvedSourceType,
    proposalId,
    checkoutCacheKey,
  ]);

  const pixCopiaCola = pendingCharge?.pixCopiaCola || '';
  const handleCopyPix = async () => {
    if (!pixCopiaCola) return;
    try {
      await navigator.clipboard.writeText(pixCopiaCola);
      setPixCopied(true);
      setTimeout(() => setPixCopied(false), 3000);
    } catch {
      setPixCopied(false);
    }
  };

  if (loadingLot) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 text-center space-y-3">
        <div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin mx-auto" />
        <p className="text-xs font-bold text-on-surface-variant">
          Carregando termos e split fiduciário Escrow...
        </p>
      </div>
    );
  }

  if (orderIdParam && !authLoading && !user) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-14 text-center space-y-4">
        <div className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/30 shadow-sm space-y-3">
          <span className="material-symbols-outlined text-primary text-4xl">lock</span>
          <h1 className="text-xl font-extrabold text-on-surface">
            Autentique-se para consultar o pedido
          </h1>
          <p className="text-xs text-on-surface-variant">
            Entre com a conta compradora titular do pedido para visualizar seu status de pagamento.
          </p>
          <div className="pt-2">
            <Link
              href={`/login?redirect=${encodeURIComponent(`/checkout?${searchParams.toString()}`)}`}
              className="inline-flex px-5 py-2.5 bg-primary hover:bg-primary-container text-white text-xs font-bold rounded-xl"
            >
              Entrar na Conta B2B
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (notFoundError || !lot) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-14 text-center space-y-4">
        <div className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/30 shadow-sm space-y-3">
          <span className="material-symbols-outlined text-outline text-4xl">receipt_long</span>
          <h1 className="text-xl font-extrabold text-on-surface">
            {notFoundError || 'Nenhum lote encontrado para checkout'}
          </h1>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href="/leiloes"
              className="px-5 py-2.5 bg-primary hover:bg-primary-container text-white text-xs font-bold rounded-xl"
            >
              Ver Pregões Ativos
            </Link>
            <Link
              href="/carrinho"
              className="px-5 py-2.5 bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-bold rounded-xl"
            >
              Ir para Carrinho
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Title */}
      <div className="space-y-1">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed text-xs font-bold">
          <span className="material-symbols-outlined text-[16px]">lock</span>
          Checkout de pedido
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface">
          Checkout B2B
        </h1>
        <p className="text-xs sm:text-sm text-on-surface-variant">
          A confirmação do pagamento depende de uma notificação autenticada do provedor configurado.
        </p>
      </div>

      {!authLoading && !user && (
        <div className="p-4 rounded-2xl bg-primary-fixed/40 border border-primary/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">login</span>
            <span className="font-bold text-on-surface">
              Entre com sua conta compradora para consultar o pedido e gerar uma cobrança, se o provedor estiver configurado.
            </span>
          </div>
          <Link
            href={`/login?redirect=${encodeURIComponent(
              `/checkout?${searchParams.toString()}`
            )}`}
            className="px-4 py-2 bg-primary text-white font-bold rounded-xl text-xs shrink-0 text-center"
          >
            Entrar Agora
          </Link>
        </div>
      )}

      {confirmed ? (
        <div className="bg-surface-container-lowest p-8 rounded-2xl border border-secondary/40 shadow-xl text-center space-y-5 animate-in fade-in zoom-in-95">
          <div className="w-16 h-16 rounded-full bg-secondary-container text-secondary flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-4xl">verified</span>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-bold text-secondary uppercase tracking-widest">
              {orderCode
                ? `PEDIDO ${orderCode} • PAGAMENTO CONFIRMADO PELO PROVEDOR`
                  : 'PAGAMENTO CONFIRMADO PELO PROVEDOR'}
            </span>
            <h2 className="text-2xl font-extrabold text-on-surface">Pagamento confirmado</h2>
            <p className="text-xs text-on-surface-variant max-w-lg mx-auto">
              O provedor confirmou o pagamento do pedido. A confirmação de entrega não executa repasses bancários; acompanhe o status em Meus Pedidos.
            </p>
          </div>

          <div className="p-4 bg-surface-container-low rounded-xl text-xs max-w-md mx-auto text-left space-y-2 border border-outline-variant/30">
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Hash do Termo:</span>
              <span className="font-mono text-[10px] text-primary truncate max-w-[200px]">
                {orderHash}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">
                {lot.tipoFrete === 'CIF' ? 'Entrega CIF:' : 'Retirada FOB:'}
              </span>
              <strong className="text-on-surface">
                {lot.tipoFrete === 'CIF' ? `Despacho direto de ${lot.produto.origem}` : lot.produto.origem}
              </strong>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Janela de Agendamento:</span>
              <strong className="text-secondary">Consulte em Meus Pedidos</strong>
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
                  : 'Dados do lote'}
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
                  Estimativa de valores
                </h3>
                <span className="text-[10px] text-outline font-bold">Valores estimados</span>
              </div>

              {commissionError && (
                <p className="rounded-lg bg-error-container px-3 py-2 text-xs font-semibold text-on-error-container">
                  {commissionError}
                </p>
              )}

              <div className="space-y-3">
                <div className="flex justify-between py-1 border-b border-surface-container">
                  <span className="text-on-surface-variant">Valor Total do Arremate (GMV):</span>
                  <strong className="text-sm font-extrabold text-on-surface">
                    {commissionReady
                      ? `R$ ${split.valorBrutoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                      : 'Indisponível'}
                  </strong>
                </div>

                <div className="flex justify-between py-1 border-b border-surface-container">
                  <div className="space-y-0.5">
                    <span className="text-on-surface-variant block">
                      Taxa Administrativa da Plataforma
                      {commissionReady ? ` (${split.percentualComissao}%)` : ''}:
                    </span>
                    <span className="text-[10px] text-outline">
                      Intermediação tecnológica, compliance e trava antifraude
                    </span>
                  </div>
                  <strong className="text-sm font-extrabold text-primary">
                    {commissionReady
                      ? `- R$ ${split.valorComissaoPlataforma.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                      : 'Indisponível'}
                  </strong>
                </div>

                <div className="flex justify-between py-1 bg-secondary-container/20 p-3 rounded-xl border border-secondary/30">
                  <div className="space-y-0.5">
                    <span className="font-bold text-secondary block">
                      Repasse Líquido à Indústria Fornecedora:
                    </span>
                    <span className="text-[10px] text-on-surface-variant">
                      Valor estimado; não representa transferência bancária
                    </span>
                  </div>
                  <strong className="text-base font-extrabold text-secondary">
                    {commissionReady
                      ? `R$ ${split.valorRepasseLiquidoFornecedor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                      : 'Indisponível'}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Payment Methods & Escrow Deposition */}
          <div className="lg:col-span-5 bg-surface-container-lowest p-6 rounded-2xl border-2 border-primary/20 shadow-lg space-y-5 text-xs">
            <h3 className="font-extrabold text-sm text-on-surface uppercase border-b border-surface-container pb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[18px]">account_balance</span>
              Pagamento do pedido
            </h3>

            <div className="space-y-3 bg-surface-container-low p-4 rounded-xl border border-outline-variant/30 text-center">
                    <div className="w-36 h-36 mx-auto bg-white p-2 rounded-xl border border-outline-variant/40 flex items-center justify-center shadow-sm">
                      {pixCopiaCola ? (
                        <QRCodeSVG value={pixCopiaCola} size={124} level="M" includeMargin />
                      ) : (
                        <div className="text-[11px] text-on-surface-variant font-semibold px-2">
                          {generatingCharge
                            ? 'Gerando cobrança PIX...'
                            : 'PIX indisponível: confirme a configuração do provedor.'}
                        </div>
                      )}
                    </div>
                    <div>
                      <span className="text-[10px] text-on-surface-variant font-bold uppercase block">
                        Valor da cobrança:
                      </span>
                      <span className="text-xl font-extrabold text-primary">
                        R$ {totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                      {pendingCharge?.txid && (
                        <span className="text-[10px] font-mono text-on-surface-variant block mt-0.5">
                          TXID: {pendingCharge.txid}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyPix}
                      disabled={!pixCopiaCola}
                      className="w-full py-2 bg-white hover:bg-surface-container border border-outline-variant text-on-surface font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[16px]">content_copy</span>
                      <span>{pixCopied ? 'Código PIX copiado!' : 'Copiar Código PIX Copia e Cola'}</span>
                    </button>
                    <p className="text-[11px] text-on-surface-variant">
                      O pagamento não pode ser confirmado por leitura de QR ou envio de comprovante. A confirmação depende do webhook autenticado do provedor.
                    </p>
            </div>

            {checkoutError && (
              <div className="p-3 rounded-xl bg-error-container text-on-error-container text-xs font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">error</span>
                <span>{checkoutError}</span>
              </div>
            )}

            <Link
              href="/pedidos"
              className="w-full py-3.5 bg-primary hover:bg-primary-container text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              Acompanhar status em Meus Pedidos
            </Link>
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
