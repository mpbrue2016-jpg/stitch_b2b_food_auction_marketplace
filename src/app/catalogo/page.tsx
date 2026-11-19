'use client';

import React, { useState, useEffect, Suspense, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { ShelfLifeBadge } from '@/components/ShelfLifeBadge';
import { AuctionCountdown } from '@/components/AuctionCountdown';
import { BidModal } from '@/components/BidModal';
import { DemoBadge, DidacticHint } from '@/components/DemoBadge';
import { useEnvironment } from '@/components/EnvironmentProvider';
import { useAuth } from '@/components/AuthProvider';
import { addLotToCart } from '@/lib/cart-store';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { AuctionLot, ProductCategory } from '@/lib/types';

function CatalogoContent() {
  const searchParams = useSearchParams();
  const qParam = searchParams.get('q') || '';
  const categoriaSlugParam = searchParams.get('categoria') || '';
  const filtroParam = searchParams.get('filtro') || '';
  const { profile } = useAuth();
  const { envMode, isDemoMode, setEnvMode, sandbox, simulateAddToCart } = useEnvironment();

  const [lots, setLots] = useState<AuctionLot[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLotForBid, setSelectedLotForBid] = useState<AuctionLot | null>(null);
  const [search, setSearch] = useState(qParam);
  const [categoryFilter, setCategoryFilter] = useState('todas');
  const [shelfFilter, setShelfFilter] = useState<string>('todas');
  const [sortBy, setSortBy] = useState<'margem' | 'preco' | 'validade'>('margem');
  const [addedLotId, setAddedLotId] = useState<string | null>(null);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const [lotsRes, catsRes] = await Promise.all([
        fetch(`/api/lotes?env=${envMode}`, { cache: 'no-store' }),
        fetch(`/api/categorias?env=${envMode}`, { cache: 'no-store' }),
      ]);
      const [lotsData, catsData] = await Promise.all([
        lotsRes.ok ? lotsRes.json() : null,
        catsRes.ok ? catsRes.json() : null,
      ]);
      if (Array.isArray(lotsData?.lots)) setLots(lotsData.lots);
      else setLots([]);
      if (Array.isArray(catsData?.categories)) setCategories(catsData.categories);
    } catch {
      // keep existing state
    } finally {
      setLoading(false);
    }
  }, [envMode]);

  useEffect(() => {
    void loadCatalog();
    if (!isSupabaseConfigured || isDemoMode) return;
    const channel = supabase
      .channel('catalog-auctions-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'auctions' },
        () => {
          void loadCatalog();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadCatalog, isDemoMode]);

  useEffect(() => {
    setSearch(qParam);
  }, [qParam]);

  useEffect(() => {
    if (!categoriaSlugParam) {
      setCategoryFilter('todas');
      return;
    }
    const matched = categories.find(
      (c) => c.slug === categoriaSlugParam || c.id === categoriaSlugParam
    );
    setCategoryFilter(matched ? matched.id : categoriaSlugParam);
  }, [categoriaSlugParam, categories]);

  useEffect(() => {
    if (filtroParam === 'validade_proxima') {
      setShelfFilter('atencao_ou_curta');
      setSortBy('validade');
    } else if (filtroParam === 'giro_rapido') {
      setShelfFilter('giro_rapido');
      setSortBy('margem');
    } else {
      setShelfFilter('todas');
    }
  }, [filtroParam]);

  const effectiveLots = useMemo(() => {
    if (!isDemoMode) return lots;
    const byId = new Map<string, AuctionLot>();
    for (const lot of lots) byId.set(lot.id, lot);
    for (const simLot of sandbox.simulatedLots) byId.set(simLot.id, simLot);
    return Array.from(byId.values());
  }, [lots, isDemoMode, sandbox.simulatedLots]);

  const filteredLots = effectiveLots
    .filter((lot) => {
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        lot.produto.titulo.toLowerCase().includes(q) ||
        lot.produto.gtinEan.includes(q) ||
        lot.produto.dun14.includes(q) ||
        lot.produto.sku.toLowerCase().includes(q) ||
        lot.codigoLote.toLowerCase().includes(q) ||
        lot.produto.marca.toLowerCase().includes(q) ||
        lot.produto.fabricante.toLowerCase().includes(q);

      const catObj = categories.find(
        (c) => c.id === lot.produto.categoriaId || c.slug === lot.produto.categoriaId
      );
      const matchCat =
        categoryFilter === 'todas' ||
        lot.produto.categoriaId === categoryFilter ||
        catObj?.slug === categoryFilter ||
        catObj?.id === categoryFilter;

      const matchShelf =
        shelfFilter === 'todas' ||
        (shelfFilter === 'atencao_ou_curta'
          ? ['atencao', 'giro_rapido', 'critica'].includes(lot.produto.statusShelfLife)
          : lot.produto.statusShelfLife === shelfFilter ||
            (shelfFilter === 'giro_rapido' && lot.tipoVenda === 'giro_rapido'));

      return matchSearch && matchCat && matchShelf;
    })
    .sort((a, b) => {
      if (sortBy === 'margem') return b.margemEstimadaRevenda - a.margemEstimadaRevenda;
      if (sortBy === 'preco') return a.precoUnitarioAtual - b.precoUnitarioAtual;
      if (sortBy === 'validade') return a.produto.diasRestantesValidade - b.produto.diasRestantesValidade;
      return 0;
    });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="space-y-1">
        <nav className="text-xs text-on-surface-variant flex items-center gap-1.5">
          <Link href="/" className="hover:text-primary">Início</Link>
          <span>/</span>
          <span className="font-bold text-primary">Catálogo Geral de Alimentos &amp; Lotes B2B</span>
        </nav>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {isDemoMode && <DemoBadge />}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface">
              Catálogo Geral &amp; Validação EAN/GTIN
            </h1>
            <p className="text-xs sm:text-sm text-on-surface-variant">
              Lotes fechados e fracionados de alimentos, cerealista, hortifruti e higiene e limpeza com laudo sanitário ANVISA/MAPA.
            </p>
          </div>
          <Link
            href="/produtos/novo"
            className="self-start sm:self-auto bg-secondary hover:bg-secondary-container text-white hover:text-on-secondary-container px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            <span>{isDemoMode ? 'Simular Novo Lote' : 'Cadastrar Novo Lote'}</span>
          </Link>
        </div>
      </div>

      {isDemoMode && (
        <DidacticHint
          title="Aqui você explora produtos e filtros de catálogo"
          description="Filtre por EAN/SKU, categoria ou validade (FEFO). Você pode simular lances ou adicionar lotes modelo ao carrinho demonstrativo."
        />
      )}

      {/* Advanced Filter Toolbar */}
      <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/30 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="flex items-center bg-surface-container-low px-3 py-2 rounded-xl border border-outline-variant/30">
            <span className="material-symbols-outlined text-outline text-[18px] mr-2">search</span>
            <input
              type="text"
              placeholder="Buscar por SKU, EAN-13, marca..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent focus:outline-none text-xs text-on-surface"
            />
          </div>

          <div className="flex items-center bg-surface-container-low px-3 py-2 rounded-xl border border-outline-variant/30">
            <span className="material-symbols-outlined text-outline text-[18px] mr-2">category</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full bg-transparent focus:outline-none text-xs text-on-surface cursor-pointer"
            >
              <option value="todas">Todas as Categorias</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center bg-surface-container-low px-3 py-2 rounded-xl border border-outline-variant/30">
            <span className="material-symbols-outlined text-outline text-[18px] mr-2">timelapse</span>
            <select
              value={shelfFilter}
              onChange={(e) => setShelfFilter(e.target.value)}
              className="w-full bg-transparent focus:outline-none text-xs text-on-surface cursor-pointer"
            >
              <option value="todas">Todos os Shelf Lifes</option>
              <option value="longa">Validade Longa (&gt; 90 dias)</option>
              <option value="atencao_ou_curta">Validade Próxima (&lt; 90 dias)</option>
              <option value="atencao">Atenção FEFO (60-90 dias)</option>
              <option value="giro_rapido">Giro Rápido (30-60 dias)</option>
              <option value="critica">Crítico (&lt; 30 dias)</option>
            </select>
          </div>

          <div className="flex items-center bg-surface-container-low px-3 py-2 rounded-xl border border-outline-variant/30">
            <span className="material-symbols-outlined text-outline text-[18px] mr-2">sort</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'margem' | 'preco' | 'validade')}
              className="w-full bg-transparent focus:outline-none text-xs text-on-surface cursor-pointer"
            >
              <option value="margem">Maior Margem de Lucro (%)</option>
              <option value="preco">Menor Custo Unitário (R$)</option>
              <option value="validade">Menor Shelf Life (Urgente)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-on-surface-variant pt-1 border-t border-surface-container">
          <span>
            Mostrando <strong>{filteredLots.length} lotes</strong> ({isDemoMode ? 'Ambiente Modelo' : 'Ambiente Original'})
          </span>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setCategoryFilter('todas');
              setShelfFilter('todas');
            }}
            className="text-primary hover:underline font-bold"
          >
            Limpar todos os filtros
          </button>
        </div>
      </div>

      {/* Product Lots Grid */}
      {loading ? (
        <div className="bg-surface-container-lowest p-10 rounded-2xl border border-outline-variant/30 text-center space-y-3">
          <div className="w-8 h-8 rounded-full border-4 border-primary/20 border-t-primary animate-spin mx-auto" />
          <p className="text-xs font-bold text-on-surface-variant">
            Carregando catálogo ({isDemoMode ? 'Ambiente Modelo' : 'Ambiente Original'})...
          </p>
        </div>
      ) : filteredLots.length === 0 ? (
        <div className="bg-surface-container-lowest p-10 rounded-2xl border border-outline-variant/30 text-center space-y-3">
          <span className="material-symbols-outlined text-outline text-4xl">inventory_2</span>
          <h3 className="font-bold text-base text-on-surface">
            {isDemoMode ? 'Nenhum lote encontrado' : 'Nenhum lote verdadeiro publicado no Ambiente Original'}
          </h3>
          <p className="text-xs text-on-surface-variant max-w-md mx-auto">
            {isDemoMode
              ? 'Ajuste os filtros de categoria, validade FEFO ou busca por EAN para visualizar ofertas disponíveis.'
              : 'Os lotes reais cadastrados por empresas e anunciantes oficiais aparecerão aqui sem mistura com os modelos.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setCategoryFilter('todas');
                setShelfFilter('todas');
              }}
              className="px-4 py-2 bg-surface-container text-on-surface text-xs font-bold rounded-xl"
            >
              Limpar Filtros
            </button>
            {!isDemoMode && (
              <>
                <Link
                  href="/produtos/novo"
                  className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl"
                >
                  Cadastrar Lote Real
                </Link>
                <button
                  type="button"
                  onClick={() => setEnvMode('modelo')}
                  className="px-4 py-2 bg-amber-500 text-slate-950 text-xs font-extrabold rounded-xl"
                >
                  Ver Lotes Modelo
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLots.map((lot) => {
            const isLotDemo = Boolean(lot.isDemo || isDemoMode);
            const catLabel =
              categories.find((c) => c.id === lot.produto.categoriaId || c.slug === lot.produto.categoriaId)
                ?.nome || 'Geral B2B';

            return (
              <article
                key={lot.id}
                className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-sm hover:shadow-lg transition-all flex flex-col overflow-hidden"
              >
                <div className="p-3 bg-surface-container-low flex items-center justify-between gap-2 border-b border-surface-container">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-on-surface-variant">{lot.codigoLote}</span>
                    {isLotDemo && <DemoBadge compact />}
                  </div>
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
                  <span className="absolute top-2 right-2 bg-secondary text-white text-[11px] font-extrabold px-2 py-0.5 rounded shadow-sm">
                    Margem: {lot.margemEstimadaRevenda}%
                  </span>
                  <span className="absolute bottom-2 left-2 bg-black/75 backdrop-blur text-white text-[10px] font-mono px-2 py-0.5 rounded">
                    EAN: {lot.produto.gtinEan}
                  </span>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <span className="text-[11px] text-on-surface-variant font-bold block mb-1">
                      {catLabel} · {lot.produto.marca} • {lot.produto.origem}
                    </span>
                    <h3 className="font-bold text-sm text-on-surface leading-snug">
                      <Link href={`/leiloes/${lot.id}`} className="hover:text-primary transition-colors">
                        {lot.produto.titulo}
                      </Link>
                    </h3>
                    <p className="text-xs text-on-surface-variant mt-1 line-clamp-2">
                      {lot.produto.descricao}
                    </p>
                  </div>

                  <div>
                    <ShelfLifeBadge
                      status={lot.produto.statusShelfLife}
                      diasRestantes={lot.produto.diasRestantesValidade}
                      dataValidade={lot.produto.dataValidade}
                    />
                  </div>

                  <div className="bg-surface-container-low p-3 rounded-xl text-xs space-y-1">
                    <div className="flex justify-between items-baseline">
                      <span className="text-on-surface-variant">Lance Atual / Lote:</span>
                      <span className="text-base font-extrabold text-primary">
                        R$ {lot.lanceAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-on-surface-variant">Custo por Unidade:</span>
                      <span className="font-extrabold text-secondary text-sm">
                        R$ {lot.precoUnitarioAtual.toFixed(2)} / un
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] text-outline pt-1 border-t border-surface-container">
                      <span>Volume: {lot.produto.totalCaixas} caixas ({lot.produto.paletes} paletes)</span>
                      <span className="text-secondary font-bold">{lot.totalLances} lances</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <Link
                      href={`/leiloes/${lot.id}`}
                      className="flex-1 py-2 text-center rounded-xl bg-surface-container hover:bg-surface-container-high text-xs font-bold text-on-surface transition-colors"
                    >
                      Ver Sala
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
                          : isLotDemo
                          ? 'Simular Lance'
                          : 'Dar Lance'}
                      </span>
                    </button>
                    <button
                      type="button"
                      title={isLotDemo ? 'Simular no Carrinho Modelo' : 'Adicionar ao Carrinho B2B'}
                      aria-label="Adicionar lote ao carrinho"
                      disabled={lot.status === 'encerrado' || lot.status === 'homologado'}
                      onClick={() => {
                        if (isLotDemo) {
                          simulateAddToCart(lot, 1);
                        } else {
                          const unitPrice = lot.precoArremateImediato || lot.lanceAtual;
                          addLotToCart(lot, unitPrice);
                        }
                        setAddedLotId(lot.id);
                        setTimeout(() => setAddedLotId((cur) => (cur === lot.id ? null : cur)), 2000);
                      }}
                      className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-colors shrink-0 disabled:opacity-45 ${
                        addedLotId === lot.id
                          ? 'bg-secondary border-secondary text-white'
                          : 'bg-surface-container-low hover:bg-surface-container border-outline-variant/40 text-primary'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {addedLotId === lot.id ? 'check' : 'add_shopping_cart'}
                      </span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {selectedLotForBid && (
        <BidModal
          lot={selectedLotForBid}
          isOpen={true}
          onClose={() => setSelectedLotForBid(null)}
          onBidSuccess={(amount, updatedTerminaEm) => {
            const bidderLabel = profile?.nomeFantasia || (isDemoMode ? 'Visitante (Simulação)' : 'Você');
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
                      ultimoLanceEmpresa: bidderLabel,
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

export default function CatalogoPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs">Carregando catálogo B2B...</div>}>
      <CatalogoContent />
    </Suspense>
  );
}
