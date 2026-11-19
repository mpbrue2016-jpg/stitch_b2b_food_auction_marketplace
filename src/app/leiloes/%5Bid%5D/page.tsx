'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { AuctionCountdown } from '@/components/AuctionCountdown';
import { ShelfLifeBadge } from '@/components/ShelfLifeBadge';
import { DemoBadge, DidacticHint } from '@/components/DemoBadge';
import { useEnvironment } from '@/components/EnvironmentProvider';
import { useAuth } from '@/components/AuthProvider';
import { addLotToCart } from '@/lib/cart-store';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { AuctionBid, AuctionLot, ProductCategory } from '@/lib/types';

export default function SalaLeilaoAoVivoPage() {
  const params = useParams();
  const router = useRouter();
  const lotId = params.id as string;
  const { user } = useAuth();
  const {
    envMode,
    isDemoMode,
    sandbox,
    simulateBid,
    simulateCreateProposal,
    simulateAddToCart,
  } = useEnvironment();

  const [lot, setLot] = useState<AuctionLot | null>(null);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loadingLot, setLoadingLot] = useState<boolean>(true);
  const [notFoundLot, setNotFoundLot] = useState<boolean>(false);
  const [bids, setBids] = useState<AuctionBid[]>([]);

  const [bidInput, setBidInput] = useState<number>(0);
  const [submittingBid, setSubmittingBid] = useState(false);
  const [lastBidFeedback, setLastBidFeedback] = useState<string | null>(null);
  const [bidError, setBidError] = useState<string | null>(null);
  const [requiresLogin, setRequiresLogin] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showProposalForm, setShowProposalForm] = useState(false);
  const [proposalBoxes, setProposalBoxes] = useState<number>(1);
  const [proposalUnitPrice, setProposalUnitPrice] = useState<number>(1);
  const [proposalMessage, setProposalMessage] = useState('');
  const [submittingProposal, setSubmittingProposal] = useState(false);
  const [proposalFeedback, setProposalFeedback] = useState<string | null>(null);
  const [proposalError, setProposalError] = useState<string | null>(null);
  const [addedToCart, setAddedToCart] = useState(false);
  const [isExpired, setIsExpired] = useState(false);

  const loadLotDetails = useCallback(
    async (isInitial = false) => {
      // Verifica primeiro lotes simulados mantidos no sandbox do Ambiente Modelo
      const sandboxMatch = isDemoMode
        ? sandbox.simulatedLots.find((l) => l.id === lotId)
        : undefined;
      if (sandboxMatch) {
        if (isInitial) {
          fetch(`/api/categorias?env=${envMode}`, { cache: 'no-store' })
            .then((r) => (r.ok ? r.json() : null))
            .then((catsData) => {
              if (Array.isArray(catsData?.categories)) {
                setCategories(catsData.categories);
              }
            })
            .catch(() => {});
          setProposalBoxes(
            Math.max(
              1,
              Math.min(
                sandboxMatch.produto.totalCaixas,
                Math.round(sandboxMatch.produto.totalCaixas / 2)
              )
            )
          );
          setProposalUnitPrice(
            Math.max(0.1, Number((sandboxMatch.precoUnitarioAtual * 0.95).toFixed(2)))
          );
        }
        const simBids = sandbox.simulatedBidsByLot[lotId] || [];
        setNotFoundLot(false);
        setLot(sandboxMatch);
        setBids(simBids);
        setIsExpired(
          sandboxMatch.status === 'encerrado' ||
            sandboxMatch.status === 'homologado' ||
            new Date(sandboxMatch.terminaEm).getTime() <= Date.now()
        );
        setBidInput(sandboxMatch.lanceAtual + sandboxMatch.incrementoMinimo);
        setLoadingLot(false);
        return;
      }

      try {
        const [bidsRes, catsRes] = await Promise.all([
          fetch(`/api/lances?loteId=${encodeURIComponent(lotId)}&env=${envMode}`, {
            cache: 'no-store',
          }),
          isInitial
            ? fetch(`/api/categorias?env=${envMode}`, { cache: 'no-store' })
            : Promise.resolve(null),
        ]);

        if (bidsRes.status === 404) {
          setNotFoundLot(true);
          setLoadingLot(false);
          return;
        }

        const data = bidsRes.ok ? await bidsRes.json() : null;
        if (catsRes && catsRes.ok) {
          const catsData = await catsRes.json().catch(() => null);
          if (Array.isArray(catsData?.categories)) {
            setCategories(catsData.categories);
          }
        }

        if (!data?.lot) {
          setNotFoundLot(true);
          setLoadingLot(false);
          return;
        }

        const fetchedLot: AuctionLot = data.lot;
        const baseBids: AuctionBid[] = Array.isArray(data.bids) ? data.bids : [];

        setNotFoundLot(false);
        setLot(fetchedLot);
        setIsExpired(
          fetchedLot.status === 'encerrado' ||
            fetchedLot.status === 'homologado' ||
            new Date(fetchedLot.terminaEm).getTime() <= Date.now()
        );
        setBidInput(fetchedLot.lanceAtual + fetchedLot.incrementoMinimo);

        if (isInitial) {
          setProposalBoxes(
            Math.max(
              1,
              Math.min(
                fetchedLot.produto.totalCaixas,
                Math.round(fetchedLot.produto.totalCaixas / 2)
              )
            )
          );
          setProposalUnitPrice(
            Math.max(0.1, Number((fetchedLot.precoUnitarioAtual * 0.95).toFixed(2)))
          );
        }

        setBids(baseBids);
      } catch {
        // keep existing state on transient error
      } finally {
        setLoadingLot(false);
      }
    },
    [lotId, envMode, isDemoMode, sandbox.simulatedLots, sandbox.simulatedBidsByLot]
  );

  useEffect(() => {
    void loadLotDetails(true);

    if (!isSupabaseConfigured || isDemoMode || lotId.startsWith('demo-') || lotId.startsWith('a1000000-')) {
      return;
    }
    const channel = supabase
      .channel(`auction-room-${lotId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bids', filter: `auction_id=eq.${lotId}` },
        () => {
          void loadLotDetails(false);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'auctions', filter: `id=eq.${lotId}` },
        () => {
          void loadLotDetails(false);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [lotId, loadLotDetails, isDemoMode]);

  if (loadingLot) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 text-center space-y-3">
        <div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin mx-auto" />
        <p className="text-xs font-bold text-on-surface-variant">
          Carregando livro de ofertas e ficha sanitária do lote...
        </p>
      </div>
    );
  }

  if (notFoundLot || !lot) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center space-y-4">
        <div className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/30 shadow-sm space-y-3">
          <span className="material-symbols-outlined text-outline text-4xl">inventory_2</span>
          <h1 className="text-xl font-extrabold text-on-surface">Lote não encontrado no pregão</h1>
          <p className="text-xs text-on-surface-variant">
            O código de lote solicitado não está disponível neste ambiente ({isDemoMode ? 'Ambiente Modelo' : 'Ambiente Original'}).
          </p>
          <Link
            href="/leiloes"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-container text-white text-xs font-bold transition-colors"
          >
            Ver Todos os Pregões
          </Link>
        </div>
      </div>
    );
  }

  const lotIsDemo = Boolean(lot.isDemo || isDemoMode || lot.id.startsWith('demo-') || lot.id.startsWith('a1000000-'));

  const galleryItems = [
    { label: 'Foto do Lote', src: lot.produto.imagemUrl },
    { label: 'Paletes PBR', src: '/images/lotes/inspecao-palete-pbr.webp' },
    { label: 'Etiqueta GS1', src: '/images/lotes/inspecao-etiqueta-gs1.webp' },
    { label: 'Laudo SIF', src: '/images/lotes/inspecao-laudo-sif.webp' },
  ];

  const handlePlaceBid = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isExpired) {
      setBidError('Pregão encerrado. Não são aceitos novos lances.');
      return;
    }
    if (bidInput <= lot.lanceAtual) {
      setBidError('Seu lance deve ser maior que o lance atual.');
      return;
    }
    setBidError(null);
    setRequiresLogin(false);

    // Simulação obrigatória no Ambiente Modelo — nunca envia operação real ao Supabase
    if (lotIsDemo) {
      const simResult = simulateBid(lot, bidInput);
      if (!simResult.ok) {
        setBidError(simResult.message);
        return;
      }
      setBidInput(bidInput + lot.incrementoMinimo);
      setLastBidFeedback(
        `SIMULAÇÃO — AMBIENTE MODELO: Lance simulado de R$ ${bidInput.toLocaleString('pt-BR')} registrado localmente (nenhuma operação real enviada).`
      );
      setTimeout(() => setLastBidFeedback(null), 5000);
      return;
    }

    if (!user) {
      setRequiresLogin(true);
      setBidError('Faça login com seu CPF ou CNPJ homologado para registrar lances reais.');
      return;
    }

    setSubmittingBid(true);
    try {
      const res = await fetch('/api/lances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loteId: lot.id,
          valorLance: bidInput,
        }),
      });
      const data = await res.json();

      if (res.status === 401) {
        setRequiresLogin(true);
        setBidError(data?.error || 'Autenticação obrigatória para enviar lances.');
        setSubmittingBid(false);
        return;
      }

      if (!res.ok) {
        setBidError(data?.error || 'Lance não aceito pelo motor do pregão.');
        setSubmittingBid(false);
        return;
      }

      const registeredBid: AuctionBid = data.bid;
      const updatedLot = data.lot;

      setBids((prev) => [registeredBid, ...prev.map((b) => ({ ...b, ehVencedor: false }))]);
      if (updatedLot) {
        setLot(updatedLot);
        setIsExpired(new Date(updatedLot.terminaEm).getTime() <= Date.now());
      }
      setBidInput(bidInput + (updatedLot?.incrementoMinimo || lot.incrementoMinimo));

      const antiSnipingNote = data.extendedDueToAntiSniping
        ? ' • Regra Anti-Sniping: +3 min adicionados'
        : '';
      const hashNote = data.transactionHash ? ` (${data.transactionHash.slice(0, 22)}...)` : '';
      setLastBidFeedback(
        `Lance de R$ ${bidInput.toLocaleString('pt-BR')} homologado!${hashNote}${antiSnipingNote}`
      );
      setTimeout(() => setLastBidFeedback(null), 4500);
    } catch {
      setBidError('Erro de conexão ao enviar lance ao pregão.');
    } finally {
      setSubmittingBid(false);
    }
  };

  const handleArrematarImediato = () => {
    if (isExpired) return;
    router.push(`/checkout?loteId=${lot.id}&valor=${lot.precoArremateImediato || lot.lanceAtual}`);
  };

  const handleSendProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    setProposalError(null);
    if (isExpired) {
      setProposalError('Este pregão já foi encerrado e não aceita novas propostas.');
      return;
    }
    if (
      !Number.isFinite(proposalBoxes) ||
      proposalBoxes < 1 ||
      proposalBoxes > lot.produto.totalCaixas
    ) {
      setProposalError(`Informe entre 1 e ${lot.produto.totalCaixas} caixas para sua proposta.`);
      return;
    }
    if (!Number.isFinite(proposalUnitPrice) || proposalUnitPrice < 0.1) {
      setProposalError('Informe um preço unitário ofertado de no mínimo R$ 0,10.');
      return;
    }

    if (lotIsDemo) {
      simulateCreateProposal({
        lot,
        quantidadeCaixas: proposalBoxes,
        precoUnitarioOfertado: proposalUnitPrice,
        mensagem:
          proposalMessage.trim() ||
          `Simulação de proposta para ${proposalBoxes} caixas com retirada FOB em ${lot.produto.origem}.`,
      });
      setProposalFeedback(
        'SIMULAÇÃO — AMBIENTE MODELO: Proposta simulada adicionada na Mesa de Negociações.'
      );
      setShowProposalForm(false);
      setProposalMessage('');
      return;
    }

    if (!user) {
      setRequiresLogin(true);
      setProposalError('Faça login para enviar uma proposta direta ao vendedor.');
      return;
    }

    setSubmittingProposal(true);
    try {
      const res = await fetch('/api/propostas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newProposal: {
            loteId: lot.id,
            tituloProduto: lot.produto.titulo,
            fornecedorNome: lot.produto.fabricante,
            quantidadeCaixas: proposalBoxes,
            precoUnitarioOfertado: proposalUnitPrice,
            unidadesPorCaixa: lot.produto.unidadesPorEmbalagem,
            mensagem:
              proposalMessage.trim() ||
              `Proposta direta para ${proposalBoxes} caixas com retirada FOB em ${lot.produto.origem}.`,
          },
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 401) {
        setRequiresLogin(true);
        setProposalError(data?.error || 'Autenticação obrigatória para enviar propostas.');
        return;
      }
      if (res.ok) {
        setProposalFeedback('Proposta enviada! Acompanhe na Mesa de Negociações.');
        setShowProposalForm(false);
        setProposalMessage('');
      } else {
        setProposalError(data?.error || 'Não foi possível registrar a proposta.');
      }
    } catch {
      setProposalError('Falha de comunicação ao enviar a oferta comercial.');
    } finally {
      setSubmittingProposal(false);
    }
  };

  const categoryInfo = categories.find(
    (c) => c.id === lot.produto.categoriaId || c.slug === lot.produto.categoriaId
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {lotIsDemo && (
        <DidacticHint
          title="Sala de Pregão Demonstrativa — Teste lances e propostas sem risco"
          description="Este lote pertence ao Ambiente Modelo. Você pode enviar lances simulados, gerar uma proposta fracionada ou simular o arremate para aprender todo o fluxo antes de criar sua conta."
        />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-container pb-4">
        <div>
          <nav className="text-xs text-on-surface-variant flex flex-wrap items-center gap-1.5 mb-1">
            <Link href="/" className="hover:text-primary">Início</Link>
            <span>/</span>
            <Link href="/leiloes" className="hover:text-primary">Leilões</Link>
            {categoryInfo && (
              <>
                <span>/</span>
                <Link href={`/leiloes?categoria=${categoryInfo.slug}`} className="hover:text-primary">
                  {categoryInfo.nome}
                </Link>
              </>
            )}
            <span>/</span>
            <span className="font-bold text-primary">{lot.codigoLote}</span>
          </nav>
          <div className="flex flex-wrap items-center gap-2">
            {lotIsDemo && <DemoBadge />}
            {isExpired ? (
              <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant text-[10px] font-extrabold">
                ENCERRADO
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded bg-tertiary text-white text-[10px] font-extrabold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                {lotIsDemo ? 'PREGÃO DEMONSTRATIVO' : 'PREGÃO AO VIVO'}
              </span>
            )}
            <h1 className="text-xl sm:text-2xl font-extrabold text-on-surface">
              {lot.codigoLote} • {lot.produto.titulo}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-surface-container-low p-2 rounded-xl border border-outline-variant/30">
          <div className="text-right">
            <span className="text-[10px] text-on-surface-variant uppercase font-bold block">
              Encerramento Previsto:
            </span>
            <AuctionCountdown
              terminaEm={lot.terminaEm}
              size="md"
              onExpire={() => setIsExpired(true)}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 overflow-hidden shadow-sm">
            <div className="relative aspect-[4/3] w-full bg-surface-container overflow-hidden">
              <Image
                src={galleryItems[activeImageIndex]?.src || lot.produto.imagemUrl}
                alt={`${lot.produto.titulo} - ${galleryItems[activeImageIndex]?.label}`}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 58vw"
                quality={95}
                referrerPolicy="no-referrer"
                className="object-cover img-sharp"
              />
              <div className="absolute top-3 left-3 bg-inverse-surface/80 backdrop-blur text-white text-xs px-2.5 py-1 rounded-lg font-mono">
                GTIN/EAN: {lot.produto.gtinEan}
              </div>
              <div className="absolute top-3 right-3 bg-secondary text-white text-xs font-extrabold px-3 py-1 rounded-lg shadow-sm">
                Margem Est. Revenda: {lot.margemEstimadaRevenda}%
              </div>
            </div>

            <div className="p-3 grid grid-cols-4 gap-2.5 bg-surface-container-lowest border-t border-surface-container">
              {galleryItems.map((item, idx) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setActiveImageIndex(idx)}
                  className={`relative aspect-[4/3] rounded-xl overflow-hidden border-2 transition-all ${
                    activeImageIndex === idx
                      ? 'border-primary ring-2 ring-primary/20'
                      : 'border-outline-variant/40 opacity-80 hover:opacity-100'
                  }`}
                >
                  <Image
                    src={item.src}
                    alt={item.label}
                    fill
                    sizes="(max-width: 1024px) 25vw, 14vw"
                    quality={92}
                    referrerPolicy="no-referrer"
                    className="object-cover img-sharp"
                  />
                  <span className="absolute bottom-1 inset-x-1 bg-black/70 text-white text-[10px] font-bold py-0.5 rounded text-center">
                    {item.label}
                  </span>
                </button>
              ))}
            </div>

            <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-surface-container-low border-t border-surface-container text-xs">
              <div>
                <span className="text-[10px] text-on-surface-variant font-bold uppercase block">Indústria:</span>
                <span className="font-bold text-on-surface">{lot.produto.marca}</span>
              </div>
              <div>
                <span className="text-[10px] text-on-surface-variant font-bold uppercase block">Origem:</span>
                <span className="font-bold text-on-surface">{lot.produto.origem}</span>
              </div>
              <div>
                <span className="text-[10px] text-on-surface-variant font-bold uppercase block">Volume Total:</span>
                <span className="font-bold text-primary">
                  {lot.produto.totalCaixas} cxs ({lot.produto.totalUnidades.toLocaleString('pt-BR')} un)
                </span>
              </div>
              <div>
                <span className="text-[10px] text-on-surface-variant font-bold uppercase block">Paletes PBR:</span>
                <span className="font-bold text-on-surface">{lot.produto.paletes} paletes</span>
              </div>
            </div>
          </div>

          <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-surface-container pb-2">
              <h3 className="text-sm font-extrabold text-on-surface uppercase tracking-wide flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[18px]">fact_check</span>
                Ficha Técnica de Homologação Sanitária e Logística
              </h3>
              {lotIsDemo && <DemoBadge compact />}
            </div>

            <div className="space-y-2">
              <ShelfLifeBadge
                status={lot.produto.statusShelfLife}
                diasRestantes={lot.produto.diasRestantesValidade}
                dataValidade={lot.produto.dataValidade}
              />
              <p className="text-xs text-on-surface-variant leading-relaxed">
                {lot.produto.descricao}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
              <div className="p-3 bg-surface-container-low rounded-xl space-y-1">
                <span className="font-bold text-on-surface block">Códigos Oficiais GS1:</span>
                <p className="text-on-surface-variant">EAN-13: <strong className="font-mono text-on-surface">{lot.produto.gtinEan}</strong></p>
                <p className="text-on-surface-variant">DUN-14: <strong className="font-mono text-on-surface">{lot.produto.dun14}</strong></p>
              </div>

              <div className="p-3 bg-surface-container-low rounded-xl space-y-1">
                <span className="font-bold text-on-surface block">Logística &amp; Retirada:</span>
                <p className="text-on-surface-variant">
                  Modalidade:{' '}
                  <strong className="text-primary font-bold">
                    {lot.tipoFrete === 'CIF'
                      ? 'CIF (Entrega pela Indústria)'
                      : 'FOB (Retirada em CD)'}
                  </strong>
                </p>
                <p className="text-on-surface-variant">
                  {lot.tipoFrete === 'CIF' ? 'Prazo de Despacho:' : 'Agendamento de Doca:'}{' '}
                  <strong className="text-secondary font-bold">Livre em até 48h</strong>
                </p>
              </div>
            </div>

            <div className="p-3 bg-secondary-container/20 rounded-xl border border-secondary/30 flex items-center gap-2 text-xs text-secondary font-bold">
              <span className="material-symbols-outlined text-[18px]">verified</span>
              <span>100% Homologado ANVISA / MAPA com custódia fiduciária auditada pelo BACEN.</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <div className="bg-surface-container-lowest p-6 rounded-2xl border-2 border-primary/20 shadow-md space-y-5">
            {lotIsDemo && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-[11px] font-bold text-amber-950 flex items-center justify-between gap-2">
                <span>SIMULAÇÃO — AMBIENTE MODELO</span>
                <Link href="/cadastro" className="text-primary underline">
                  Criar conta oficial
                </Link>
              </div>
            )}

            <div className="bg-surface-container-low p-4 rounded-xl space-y-2 border border-outline-variant/30">
              <div className="flex justify-between items-baseline text-xs text-on-surface-variant">
                <span className="font-semibold">Maior Lance Registrado:</span>
                <span className="line-through text-outline">
                  Ref Mercado: R$ {lot.produto.precoReferenciaMercado.toLocaleString('pt-BR')}
                </span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-2xl sm:text-3xl font-extrabold text-primary">
                  R$ {lot.lanceAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
                <div className="text-right">
                  <span className="text-base font-extrabold text-secondary block">
                    R$ {lot.precoUnitarioAtual.toFixed(2)} / un
                  </span>
                  <span className="text-[10px] text-on-surface-variant">
                    {lot.totalLances} lances na disputa
                  </span>
                </div>
              </div>
              <div className="text-[11px] text-on-surface-variant flex items-center gap-1 pt-1 border-t border-surface-container">
                <span className="material-symbols-outlined text-secondary text-[16px]">military_tech</span>
                <span>Líder Atual: <strong>{lot.ultimoLanceEmpresa}</strong></span>
              </div>
            </div>

            {lastBidFeedback && (
              <div className="p-2.5 bg-secondary-container/30 border border-secondary text-secondary font-bold text-xs rounded-xl flex items-center gap-2 animate-in fade-in">
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                <span>{lastBidFeedback}</span>
              </div>
            )}

            {bidError && (
              <div className="p-2.5 bg-error-container text-on-error-container font-bold text-xs rounded-xl flex items-center justify-between gap-2">
                <span>{bidError}</span>
                {requiresLogin && (
                  <Link href={`/login?redirect=${encodeURIComponent(`/leiloes/${lotId}`)}`} className="underline shrink-0 text-primary font-extrabold">
                    Entrar agora
                  </Link>
                )}
              </div>
            )}

            <form onSubmit={handlePlaceBid} className="space-y-3">
              <label className="block text-xs font-bold text-on-surface uppercase">
                {lotIsDemo ? 'Simular Incremento de Lance:' : 'Incrementar Lance no Pregão:'}
              </label>

              <div className="flex items-center bg-surface-container rounded-xl px-3 py-2 border-2 border-primary/30 focus-within:border-primary">
                <span className="text-base font-extrabold text-primary mr-2">R$</span>
                <input
                  type="number"
                  step="50"
                  min={lot.lanceAtual + lot.incrementoMinimo}
                  value={bidInput}
                  disabled={isExpired}
                  onChange={(e) => {
                    const parsed = Number(e.target.value);
                    setBidInput(Number.isFinite(parsed) ? parsed : 0);
                  }}
                  className="w-full bg-transparent text-xl font-extrabold text-on-surface focus:outline-none disabled:opacity-50"
                  required
                />
              </div>

              <div className="flex items-center gap-2">
                {[500, 1000, 2500].map((inc) => (
                  <button
                    key={inc}
                    type="button"
                    disabled={isExpired}
                    onClick={() => setBidInput((prev) => prev + inc)}
                    className="flex-1 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary font-bold text-xs transition-colors disabled:opacity-45"
                  >
                    + R$ {inc}
                  </button>
                ))}
              </div>

              <button
                type="submit"
                disabled={submittingBid || isExpired}
                className="w-full py-3.5 bg-primary hover:bg-primary-container text-white font-extrabold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isExpired ? (
                  <span>Pregão Encerrado para Novos Lances</span>
                ) : submittingBid ? (
                  <span>Registrando Lance no Livro de Ofertas...</span>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[20px]">gavel</span>
                    <span>
                      {lotIsDemo
                        ? `Simular Lance de R$ ${bidInput.toLocaleString('pt-BR')}`
                        : `Confirmar Lance de R$ ${bidInput.toLocaleString('pt-BR')}`}
                    </span>
                  </>
                )}
              </button>
            </form>

            {lot.precoArremateImediato && (
              <div className="pt-2 border-t border-surface-container space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-on-surface uppercase">Arremate Imediato (Buy-Now):</span>
                  <span className="font-extrabold text-secondary text-sm">
                    R$ {lot.precoArremateImediato.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={isExpired}
                  onClick={handleArrematarImediato}
                  className="w-full py-2.5 bg-secondary hover:bg-secondary-container text-white hover:text-on-secondary-container font-extrabold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-45"
                >
                  <span className="material-symbols-outlined text-[18px]">bolt</span>
                  <span>
                    {isExpired
                      ? 'Pregão Encerrado'
                      : lotIsDemo
                      ? 'Simular Arremate Imediato (Modelo)'
                      : 'Arrematar Imediatamente com Custódia Escrow'}
                  </span>
                </button>
              </div>
            )}

            <button
              type="button"
              disabled={isExpired}
              onClick={() => {
                if (lotIsDemo) {
                  simulateAddToCart(lot, 1);
                } else {
                  const unitPrice = lot.precoArremateImediato || lot.lanceAtual;
                  addLotToCart(lot, unitPrice);
                }
                setAddedToCart(true);
                setTimeout(() => setAddedToCart(false), 3000);
              }}
              className="w-full py-2 bg-surface-container-low hover:bg-surface-container border border-outline-variant/40 text-on-surface font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 disabled:opacity-45"
            >
              <span className="material-symbols-outlined text-[16px]">
                {addedToCart ? 'check_circle' : 'add_shopping_cart'}
              </span>
              <span>
                {addedToCart
                  ? lotIsDemo
                    ? 'Simulado no Carrinho (Modelo)!'
                    : 'Adicionado ao Carrinho B2B!'
                  : lotIsDemo
                  ? 'Simular Adição ao Carrinho'
                  : 'Adicionar Lote ao Carrinho'}
              </span>
            </button>

            <div className="pt-3 border-t border-surface-container space-y-2.5">
              <button
                type="button"
                disabled={isExpired}
                onClick={() => {
                  setProposalError(null);
                  setShowProposalForm((prev) => !prev);
                }}
                className="w-full py-2 bg-surface-container hover:bg-surface-container-high text-primary font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 disabled:opacity-45"
              >
                <span className="material-symbols-outlined text-[16px]">handshake</span>
                <span>
                  {showProposalForm
                    ? 'Fechar Proposta Direta'
                    : lotIsDemo
                    ? 'Simular Proposta Fracionada (Modelo)'
                    : 'Fazer Proposta Fracionada ao Vendedor'}
                </span>
              </button>

              {proposalFeedback && (
                <div className="p-2.5 bg-secondary-container/30 border border-secondary/40 rounded-xl text-xs text-secondary font-bold flex items-center justify-between gap-2">
                  <span>{proposalFeedback}</span>
                  <Link href="/negociacoes" className="underline shrink-0">
                    Ver Mesa
                  </Link>
                </div>
              )}

              {proposalError && (
                <div className="p-2.5 bg-error-container text-on-error-container rounded-xl text-xs font-bold flex items-center justify-between gap-2">
                  <span>{proposalError}</span>
                  {requiresLogin && (
                    <Link href={`/login?redirect=${encodeURIComponent(`/leiloes/${lotId}`)}`} className="underline shrink-0 text-primary font-extrabold">
                      Entrar agora
                    </Link>
                  )}
                </div>
              )}

              {showProposalForm && (
                <form onSubmit={handleSendProposal} className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/30 space-y-2.5 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-on-surface-variant mb-1">
                        Qtd. Caixas
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={lot.produto.totalCaixas}
                        value={proposalBoxes}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setProposalBoxes(Number.isFinite(v) ? v : 1);
                        }}
                        className="w-full bg-white px-2.5 py-1.5 rounded-lg border border-outline-variant/40 font-bold"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-on-surface-variant mb-1">
                        Preço/Un (R$)
                      </label>
                      <input
                        type="number"
                        step="0.05"
                        min="0.10"
                        value={proposalUnitPrice}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setProposalUnitPrice(Number.isFinite(v) ? v : 0);
                        }}
                        className="w-full bg-white px-2.5 py-1.5 rounded-lg border border-outline-variant/40 font-bold text-primary"
                        required
                      />
                    </div>
                  </div>
                  <input
                    type="text"
                    value={proposalMessage}
                    onChange={(e) => setProposalMessage(e.target.value)}
                    placeholder="Condição comercial / janela FOB..."
                    className="w-full bg-white px-2.5 py-1.5 rounded-lg border border-outline-variant/40"
                  />
                  <button
                    type="submit"
                    disabled={submittingProposal}
                    className="w-full py-2 bg-primary hover:bg-primary-container text-white font-bold rounded-lg transition-colors disabled:opacity-50"
                  >
                    {submittingProposal
                      ? 'Enviando...'
                      : lotIsDemo
                      ? 'Simular Proposta no Ambiente Modelo'
                      : 'Enviar Oferta Comercial'}
                  </button>
                </form>
              )}
            </div>
          </div>

          <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-surface-container pb-2">
              <h4 className="text-xs font-extrabold text-on-surface uppercase tracking-wide flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-[16px]">history</span>
                Trilha de Lances do Pregão
              </h4>
              {lotIsDemo ? (
                <DemoBadge compact />
              ) : (
                <span className="text-[10px] text-secondary font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                  Auditado BACEN
                </span>
              )}
            </div>

            {bids.length === 0 ? (
              <div className="p-5 rounded-xl bg-surface-container-low border border-outline-variant/20 text-center space-y-1.5">
                <span className="material-symbols-outlined text-outline text-2xl">gavel</span>
                <p className="text-xs font-bold text-on-surface">
                  Nenhum lance registrado neste lote ainda
                </p>
                <p className="text-[11px] text-on-surface-variant">
                  Envie o primeiro lance acima para abrir o livro de ofertas deste pregão.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {bids.map((bid) => (
                  <div
                    key={bid.id}
                    className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-all ${
                      bid.ehVencedor
                        ? 'bg-secondary-container/20 border-secondary/40 shadow-sm'
                        : 'bg-surface-container-low border-surface-container'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-on-surface">{bid.empresaNome}</span>
                        {bid.ehVencedor && (
                          <span className="text-[9px] bg-secondary text-white font-extrabold px-1.5 py-0.2 rounded">
                            LÍDER
                          </span>
                        )}
                        {(bid.isDemo || lotIsDemo) && <DemoBadge compact />}
                      </div>
                      <span className="text-[10px] text-on-surface-variant font-mono">
                        CNPJ: {bid.cnpjAnonimizado} •{' '}
                        {bid.criadoEm.includes('T')
                          ? new Date(bid.criadoEm).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })
                          : bid.criadoEm}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="font-extrabold text-sm text-primary block">
                        R$ {bid.valorLance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[10px] text-secondary font-bold">
                        R$ {bid.valorUnitario.toFixed(2)}/un
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
