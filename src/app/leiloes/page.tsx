'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { AuctionCountdown } from '@/components/AuctionCountdown';
import { ShelfLifeBadge } from '@/components/ShelfLifeBadge';
import { BidModal } from '@/components/BidModal';
import { useAuth } from '@/components/AuthProvider';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { AuctionLot, ProductCategory } from '@/lib/types';

function LeiloesContent() {
  const searchParams = useSearchParams();
  const categoriaParam = searchParams.get('categoria') || '';
  const { profile } = useAuth();

  const [lots, setLots] = useState<AuctionLot[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLotForBid, setSelectedLotForBid] = useState<AuctionLot | null>(null);
  const [activeTab, setActiveTab] = useState<'ao_vivo' | 'todos' | 'finalizados'>('ao_vivo');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('todas');

  const loadAuctions = useCallback(async () => {
    try {
      const [bidsRes, catsRes] = await Promise.all([
        fetch('/api/lances', { cache: 'no-store' }),
        fetch('/api/categorias', { cache: 'no-store' }),
      ]);
      const [bidsData, catsData] = await Promise.all([
        bidsRes.ok ? bidsRes.json() : null,
        catsRes.ok ? catsRes.json() : null,
      ]);
      if (Array.isArray(bidsData?.auctions)) {
        setLots(bidsData.auctions);
      }
      if (Array.isArray(catsData?.categories)) {
        setCategories(catsData.categories);
      }
    } catch {
      // keep existing state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAuctions();
    if (!isSupabaseConfigured) return;
    const channel = supabase
      .channel('leiloes-list-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'auctions' },
        () => {
          void loadAuctions();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadAuctions]);

  useEffect(() => {
    if (!categoriaParam) {
      setSelectedCategoryId('todas');
      return;
    }
    const matched = categories.find(
      (c) => c.slug === categoriaParam || c.id === categoriaParam
    );
    setSelectedCategoryId(matched ? matched.id : categoriaParam);
  }, [categoriaParam, categories]);

  const statusFilteredLots = lots.filter((lot) => {
    if (activeTab === 'ao_vivo') return lot.status === 'reta_final' || lot.status === 'ativo';
    if (activeTab === 'finalizados') return lot.status === 'encerrado' || lot.status === 'homologado';
    return true;
  });

  const displayedLots = statusFilteredLots.filter((lot) => {
    if (selectedCategoryId === 'todas') return true;
    const catObj = categories.find(
      (c) => c.id === lot.produto.categoriaId || c.slug === lot.produto.categoriaId
    );
    return lot.produto.categoriaId === selectedCategoryId || catObj?.slug === selectedCategoryId;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Breadcrumb & Header */}
      <div className="space-y-3">
        <nav className="text-xs text-on-surface-variant flex items-center gap-1.5">
          <Link href="/" className="hover:text-primary">Início</Link>
          <span>/</span>
          <span className="font-bold text-primary">Sala de Pregões Eletrônicos &amp; Leilões ao Vivo</span>
        </nav>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface flex items-center gap-2">
              <span>Pregões Eletrônicos em Tempo Real</span>
              <span className="w-2.5 h-2.5 rounded-full bg-tertiary animate-pulse" />
            </h1>
            <p className="text-xs sm:text-sm text-on-surface-variant">
              Dispute lotes de alimentos, cerealista, hortifruti e higiene e limpeza com cronômetro auditado e custódia BACEN.
            </p>
          </div>

          {/* Tab Filter */}
          <div className="flex bg-surface-container-low p-1 rounded-xl border border-outline-variant/30 text-xs font-bold shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('ao_vivo')}
              className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                activeTab === 'ao_vivo'
                  ? 'bg-surface-container-lowest text-tertiary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Disputa Aberta ({lots.filter((l) => l.status === 'reta_final' || l.status === 'ativo').length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('todos')}
              className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                activeTab === 'todos'
                  ? 'bg-surface-container-lowest text-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Todos os Lotes ({lots.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('finalizados')}
              className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                activeTab === 'finalizados'
                  ? 'bg-surface-container-lowest text-secondary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Finalizados ({lots.filter((l) => l.status === 'encerrado' || l.status === 'homologado').length})
            </button>
          </div>
        </div>

        {/* Segment / Category Filter Strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSelectedCategoryId('todas')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors whitespace-nowrap shrink-0 ${
              selectedCategoryId === 'todas'
                ? 'bg-primary text-white border-primary shadow-sm'
                : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/30 hover:text-on-surface'
            }`}
          >
            Todos os Segmentos ({statusFilteredLots.length})
          </button>
          {categories.map((cat) => {
            const count = statusFilteredLots.filter((l) => l.produto.categoriaId === cat.id).length;
            const isSelected = selectedCategoryId === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategoryId(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-primary text-white border-primary shadow-sm'
                    : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/30 hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">{cat.icone}</span>
                <span>{cat.nome}</span>
                <span className={`tabular-nums text-[10px] ${isSelected ? 'text-white/90' : 'text-outline'}`}>
                  ({count})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="bg-surface-container-lowest p-10 rounded-2xl border border-outline-variant/30 text-center space-y-3">
          <div className="w-8 h-8 rounded-full border-4 border-primary/20 border-t-primary animate-spin mx-auto" />
          <p className="text-xs font-bold text-on-surface-variant">
            Carregando pregões eletrônicos ao vivo...
          </p>
        </div>
      ) : displayedLots.length === 0 ? (
        <div className="bg-surface-container-lowest p-10 rounded-2xl border border-outline-variant/30 text-center space-y-3">
          <span className="material-symbols-outlined text-outline text-4xl">gavel</span>
          <h3 className="font-bold text-base text-on-surface">
            Nenhum pregão encontrado neste filtro
          </h3>
          <p className="text-xs text-on-surface-variant">
            Altere o segmento ou visualize todos os lotes da rodada atual.
          </p>
          <button
            type="button"
            onClick={() => {
              setActiveTab('ao_vivo');
              setSelectedCategoryId('todas');
            }}
            className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl"
          >
            Ver Todos os Pregões ao Vivo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedLots.map((lot) => {
            const categoryLabel =
              categories.find((c) => c.id === lot.produto.categoriaId)?.nome || 'Geral B2B';

            return (
              <article
                key={lot.id}
                className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-sm hover:shadow-xl transition-all overflow-hidden flex flex-col"
              >
                {/* Top Bar */}
                <div className="p-3 bg-surface-container-low flex items-center justify-between border-b border-surface-container">
                  <span className="text-xs font-bold text-on-surface-variant">{lot.codigoLote}</span>
                  <AuctionCountdown
                    terminaEm={lot.terminaEm}
                    size="sm"
                    onExpire={() =>
                      setLots((prev) =>
                        prev.map((item) =>
                          item.id === lot.id && item.status !== 'encerrado' && item.status !== 'homologado'
                            ? { ...item, status: 'encerrado' }
                            : item
                        )
                      )
                    }
                  />
                </div>

                {/* Imagem */}
                <div className="relative aspect-[4/3] w-full bg-surface-container overflow-hidden">
                  <Image
                    src={lot.produto.imagemUrl}
                    alt={lot.produto.titulo}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    quality={92}
                    referrerPolicy="no-referrer"
                    className="object-cover img-sharp hover:scale-[1.03] transition-transform duration-300"
                  />
                  <span className="absolute bottom-2 left-2 bg-black/75 backdrop-blur text-white text-[10px] font-mono px-2 py-0.5 rounded">
                    EAN: {lot.produto.gtinEan}
                  </span>
                  <span className="absolute top-2 right-2 bg-secondary text-white text-[11px] font-extrabold px-2 py-0.5 rounded">
                    Margem: {lot.margemEstimadaRevenda}%
                  </span>
                </div>

                {/* Body */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <span className="text-[11px] text-on-surface-variant font-bold block mb-1">
                      {categoryLabel} · {lot.produto.marca} · {lot.produto.origem}
                    </span>
                    <h3 className="font-bold text-sm text-on-surface leading-snug">
                      <Link href={`/leiloes/${lot.id}`} className="hover:text-primary transition-colors">
                        {lot.produto.titulo}
                      </Link>
                    </h3>
                  </div>

                  <div>
                    <ShelfLifeBadge
                      status={lot.produto.statusShelfLife}
                      diasRestantes={lot.produto.diasRestantesValidade}
                      dataValidade={lot.produto.dataValidade}
                    />
                  </div>

                  {/* Pricing */}
                  <div className="bg-surface-container-low p-3 rounded-xl text-xs space-y-1">
                    <div className="flex justify-between items-baseline">
                      <span className="text-on-surface-variant">Lance Atual:</span>
                      <span className="text-base font-extrabold text-primary tabular-nums">
                        R$ {lot.lanceAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-on-surface-variant">Preço Unitário:</span>
                      <span className="font-extrabold text-secondary text-sm tabular-nums">
                        R$ {lot.precoUnitarioAtual.toFixed(2)} / un
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] text-outline pt-1 border-t border-surface-container">
                      <span>Último: {lot.ultimoLanceEmpresa}</span>
                      <span className="text-secondary font-bold tabular-nums">{lot.totalLances} lances</span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    <Link
                      href={`/leiloes/${lot.id}`}
                      className="flex-1 py-2 text-center rounded-xl bg-surface-container hover:bg-surface-container-high text-xs font-bold text-on-surface transition-colors"
                    >
                      Entrar na Sala
                    </Link>
                    <button
                      type="button"
                      disabled={lot.status === 'encerrado' || lot.status === 'homologado'}
                      onClick={() => setSelectedLotForBid(lot)}
                      className="flex-1 py-2 rounded-xl bg-primary hover:bg-primary-container text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1 disabled:opacity-45"
                    >
                      <span className="material-symbols-outlined text-[16px]">gavel</span>
                      <span>
                        {lot.status === 'encerrado' || lot.status === 'homologado'
                          ? 'Encerrado'
                          : 'Dar Lance'}
                      </span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Bid Modal */}
      {selectedLotForBid && (
        <BidModal
          lot={selectedLotForBid}
          isOpen={true}
          onClose={() => setSelectedLotForBid(null)}
          onBidSuccess={(amount, updatedTerminaEm) => {
            const bidderLabel = profile?.nomeFantasia || 'Você';
            setLots((prev) =>
              prev.map((l) =>
                l.id === selectedLotForBid.id
                  ? {
                      ...l,
                      lanceAtual: amount,
                      precoUnitarioAtual:
                        l.produto.totalUnidades > 0
                          ? Number((amount / l.produto.totalUnidades).toFixed(2))
                          : l.precoUnitarioAtual,
                      totalLances: l.totalLances + 1,
                      ultimoLanceEmpresa: `${bidderLabel} (Você)`,
                      terminaEm: updatedTerminaEm || l.terminaEm,
                      status: 'reta_final',
                    }
                  : l
              )
            );
          }}
        />
      )}
    </div>
  );
}

export default function LeiloesPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs">Carregando sala de pregões B2B...</div>}>
      <LeiloesContent />
    </Suspense>
  );
}
