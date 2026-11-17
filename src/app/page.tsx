'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MOCK_AUCTION_LOTS, MOCK_CATEGORIES } from '@/lib/mock-data';
import { AuctionCountdown } from '@/components/AuctionCountdown';
import { ShelfLifeBadge } from '@/components/ShelfLifeBadge';
import { BidModal } from '@/components/BidModal';
import { AIAssistantWidget } from '@/components/AIAssistantWidget';
import { HomeBannerCarousel } from '@/components/HomeBannerCarousel';
import { AuctionLot } from '@/lib/types';

export default function HomePage() {
  const [lots, setLots] = useState<AuctionLot[]>(MOCK_AUCTION_LOTS);
  const [selectedLotForBid, setSelectedLotForBid] = useState<AuctionLot | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRadius, setSelectedRadius] = useState('300');
  const [selectedMode, setSelectedMode] = useState('todos');

  useEffect(() => {
    fetch('/api/lotes')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.lots?.length) {
          setLots(data.lots);
        }
      })
      .catch(() => {});
  }, []);

  const handleBidSuccess = (lotId: string, newBidAmount: number, updatedTerminaEm?: string) => {
    setLots((prev) =>
      prev.map((lot) => {
        if (lot.id === lotId) {
          const newUnitPrice =
            lot.produto.totalUnidades > 0
              ? Number((newBidAmount / lot.produto.totalUnidades).toFixed(2))
              : lot.precoUnitarioAtual;
          return {
            ...lot,
            lanceAtual: newBidAmount,
            precoUnitarioAtual: newUnitPrice,
            totalLances: lot.totalLances + 1,
            ultimoLanceEmpresa: 'Supermercado Central Ltda (Você)',
            terminaEm: updatedTerminaEm || lot.terminaEm,
            status: 'reta_final',
          };
        }
        return lot;
      })
    );
  };

  const filteredLots = lots.filter((lot) => {
    const q = searchTerm.trim().toLowerCase();
    const catName =
      MOCK_CATEGORIES.find((c) => c.id === lot.produto.categoriaId)?.nome.toLowerCase() || '';
    const matchesSearch =
      !q ||
      lot.produto.titulo.toLowerCase().includes(q) ||
      catName.includes(q) ||
      lot.produto.gtinEan.includes(q) ||
      lot.produto.dun14.includes(q) ||
      lot.produto.sku.toLowerCase().includes(q) ||
      lot.codigoLote.toLowerCase().includes(q) ||
      lot.produto.marca.toLowerCase().includes(q) ||
      lot.produto.fabricante.toLowerCase().includes(q);

    const matchesMode =
      selectedMode === 'todos' ||
      (selectedMode === 'leilao' && lot.tipoVenda === 'leilao') ||
      (selectedMode === 'imediata' && lot.tipoVenda === 'giro_rapido') ||
      (selectedMode === 'palete' && lot.tipoVenda === 'venda_direta');

    const matchesRadius =
      selectedRadius === 'br' || lot.raioKm <= Number(selectedRadius);

    return matchesSearch && matchesMode && matchesRadius;
  });

  const isFiltering =
    Boolean(searchTerm.trim()) || selectedMode !== 'todos' || selectedRadius !== '300';

  const liveAuctions = isFiltering
    ? filteredLots.slice(0, 6)
    : filteredLots
        .filter((l) => /^lote-86\d+$/.test(l.id) || l.status === 'reta_final' || l.id === 'lote-8512')
        .slice(0, 6);

  const flashDeals = lots
    .filter(
      (l) =>
        (l.tipoVenda === 'venda_direta' || l.tipoVenda === 'giro_rapido') &&
        l.id !== 'lote-8501' &&
        l.id !== 'lote-sbe-2026'
    )
    .slice(0, 4);

  const closingSoonCount = lots.filter((l) => {
    const diff = new Date(l.terminaEm).getTime() - Date.now();
    return diff > 0 && diff <= 4 * 3600 * 1000;
  }).length;

  const fefoLots = [...lots]
    .filter((l) => l.produto.diasRestantesValidade <= 120 || l.produto.statusShelfLife !== 'longa')
    .sort((a, b) => a.produto.diasRestantesValidade - b.produto.diasRestantesValidade)
    .slice(0, 4);

  return (
    <div className="w-full flex flex-col space-y-6 pb-16">
      {/* Rotating Responsive Campaign Banner Carousel */}
      <HomeBannerCarousel />

      {/* Dynamic Operational B2B Hero Ribbon */}
      <section className="relative w-full bg-surface-container-low px-4 sm:px-6 py-8 sm:py-10 border-y border-surface-container shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col gap-6 relative z-10">
          {/* Operational Badges & Urgência */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed shadow-sm">
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
              Pregão Diário Aberto • Rodada SP/Região Sudeste
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container text-on-surface-variant">
              <span className="material-symbols-outlined text-[16px] text-primary">verified</span>
              Emissão Automática de NF-e &amp; Manifestação Destinatário
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-tertiary-fixed text-on-tertiary-fixed">
              <span className="material-symbols-outlined text-[15px]">timer</span>
              {closingSoonCount} {closingSoonCount === 1 ? 'lote encerra' : 'lotes encerram'} nas próximas 4 horas
            </span>
          </div>

          {/* Hero Headline & Value Proposition */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-8 space-y-3">
              <h1 className="font-extrabold text-2xl sm:text-4xl lg:text-5xl text-on-surface tracking-tight leading-tight">
                O Maior Marketplace B2B de{' '}
                <span className="text-primary underline decoration-secondary decoration-4 underline-offset-4">
                  Pregões Atacadistas
                </span>
                , Cerealista, Hortifruti &amp; Higiene
              </h1>
              <p className="text-sm sm:text-base text-on-surface-variant max-w-2xl leading-relaxed">
                Conectamos indústrias, cerealistas, produtores de hortifruti, atacadistas e redes de varejo. Compre lotes de alimentos, bebidas e higiene e limpeza com até{' '}
                <strong className="text-secondary font-extrabold">70% de desconto</strong> ou liquide estoques excedentes com 100% de compliance fiscal e sanitário ANVISA/MAPA.
              </p>
            </div>

            {/* Metric Pulse Card */}
            <div className="lg:col-span-4 bg-surface-container-lowest p-5 rounded-2xl shadow-md border border-outline-variant/30 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-on-surface-variant font-bold">
                  Liquidez Instantânea
                </span>
                <span className="text-[10px] text-secondary font-bold bg-secondary-fixed/50 px-2 py-0.5 rounded-full">
                  Ao Vivo
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-primary">R$ 4.280.950</span>
                <span className="text-xs text-on-surface-variant">este mês</span>
              </div>
              <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                <div className="bg-secondary h-full rounded-full" style={{ width: '78%' }} />
              </div>
              <div className="flex justify-between items-center text-xs text-on-surface-variant pt-1 font-semibold">
                <span>Volume: <strong>18.420 caixas</strong></span>
                <span>Tempo Médio: <strong className="text-secondary">48h</strong></span>
              </div>
            </div>
          </div>

          {/* High-Conversion Dynamic Query Bar */}
          <div className="w-full bg-surface-container-lowest rounded-2xl p-4 shadow-md border border-outline-variant/30 mt-2">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
              {/* EAN/SKU Input */}
              <div className="md:col-span-5 flex items-center bg-surface-container-low px-3 py-2 rounded-xl border border-outline-variant/30">
                <span className="material-symbols-outlined text-outline mr-2 text-[20px]">
                  barcode_scanner
                </span>
                <div className="flex flex-col flex-1">
                  <label className="text-[10px] uppercase font-bold text-on-surface-variant">
                    EAN, Marca ou SKU
                  </label>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Ex: 7891000100412, Café Alvorada..."
                    className="bg-transparent text-xs sm:text-sm text-on-surface placeholder:text-outline focus:outline-none"
                  />
                </div>
              </div>

              {/* Raio Logístico */}
              <div className="md:col-span-3 flex items-center bg-surface-container-low px-3 py-2 rounded-xl border border-outline-variant/30">
                <span className="material-symbols-outlined text-outline mr-2 text-[20px]">
                  near_me
                </span>
                <div className="flex flex-col flex-1">
                  <label className="text-[10px] uppercase font-bold text-on-surface-variant">
                    Raio Logístico
                  </label>
                  <select
                    value={selectedRadius}
                    onChange={(e) => setSelectedRadius(e.target.value)}
                    className="bg-transparent text-xs sm:text-sm text-on-surface focus:outline-none cursor-pointer"
                  >
                    <option value="50">São Paulo • até 50 km</option>
                    <option value="150">Grande SP / Campinas • 150 km</option>
                    <option value="300">Raio SP Expandido • 300 km</option>
                    <option value="br">Todo o Brasil (Cargas Fechadas)</option>
                  </select>
                </div>
              </div>

              {/* Modo do Pregão */}
              <div className="md:col-span-2 flex items-center bg-surface-container-low px-3 py-2 rounded-xl border border-outline-variant/30">
                <div className="flex flex-col w-full">
                  <label className="text-[10px] uppercase font-bold text-on-surface-variant">
                    Tipo de Compra
                  </label>
                  <select
                    value={selectedMode}
                    onChange={(e) => setSelectedMode(e.target.value)}
                    className="bg-transparent text-xs sm:text-sm text-on-surface focus:outline-none cursor-pointer"
                  >
                    <option value="todos">Todos os Modos</option>
                    <option value="leilao">Apenas Leilões</option>
                    <option value="imediata">Giro Imediato</option>
                    <option value="palete">Cargas Fechadas</option>
                  </select>
                </div>
              </div>

              {/* Submit CTA */}
              <div className="md:col-span-2">
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('pregoes-ao-vivo');
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="w-full h-full min-h-[46px] bg-primary hover:bg-primary-container text-white text-xs font-bold rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">search</span>
                  <span>Filtrar Lotes</span>
                </button>
              </div>
            </div>

            {/* Quick Filter Tags */}
            <div className="flex flex-wrap items-center gap-2 pt-3 mt-1 text-xs text-on-surface-variant">
              <span className="text-[10px] uppercase font-bold text-outline">Atalhos rápidos:</span>
              <button
                type="button"
                onClick={() => setSearchTerm('Cerealista')}
                className="bg-surface-container hover:bg-surface-container-high px-2.5 py-1 rounded-lg text-on-surface text-[11px] font-semibold transition-colors"
              >
                Cerealista &amp; Grãos
              </button>
              <button
                type="button"
                onClick={() => setSearchTerm('Hortifruti')}
                className="bg-surface-container hover:bg-surface-container-high px-2.5 py-1 rounded-lg text-on-surface text-[11px] font-semibold transition-colors"
              >
                Hortifruti Fresco
              </button>
              <button
                type="button"
                onClick={() => setSearchTerm('Higiene')}
                className="bg-surface-container hover:bg-surface-container-high px-2.5 py-1 rounded-lg text-on-surface text-[11px] font-semibold transition-colors"
              >
                Higiene e Limpeza
              </button>
              <button
                type="button"
                onClick={() => setSearchTerm('Café')}
                className="bg-surface-container hover:bg-surface-container-high px-2.5 py-1 rounded-lg text-on-surface text-[11px] font-semibold transition-colors"
              >
                Cafés &amp; Mercearia
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedMode('todos');
                  setSelectedRadius('300');
                }}
                className="text-primary hover:underline text-[11px] font-bold ml-2"
              >
                Limpar filtros
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Live Stats Dashboard Ribbon */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 w-full">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-surface-container-low border border-surface-container">
            <div className="w-10 h-10 rounded-lg bg-primary-fixed flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[24px]">payments</span>
            </div>
            <div>
              <span className="text-base sm:text-lg font-extrabold text-on-surface block leading-tight">
                R$ 4.2M
              </span>
              <span className="text-[11px] text-on-surface-variant block">Transacionados este mês</span>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-surface-container-low border border-surface-container">
            <div className="w-10 h-10 rounded-lg bg-secondary-fixed flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-[24px]">inventory_2</span>
            </div>
            <div>
              <span className="text-base sm:text-lg font-extrabold text-on-surface block leading-tight">
                18.420 Cxs
              </span>
              <span className="text-[11px] text-on-surface-variant block">Despachadas hoje</span>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-surface-container-low border border-surface-container">
            <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[24px]">schedule</span>
            </div>
            <div>
              <span className="text-base sm:text-lg font-extrabold text-on-surface block leading-tight">
                48 Horas
              </span>
              <span className="text-[11px] text-on-surface-variant block">Tempo médio de giro</span>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-surface-container-low border border-surface-container">
            <div className="w-10 h-10 rounded-lg bg-secondary-fixed-dim/40 flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-[24px]">domain_verification</span>
            </div>
            <div>
              <span className="text-base sm:text-lg font-extrabold text-on-surface block leading-tight">
                3.140 CNPJs
              </span>
              <span className="text-[11px] text-on-surface-variant block">Compradores homologados</span>
            </div>
          </div>
        </div>
      </section>

      {/* SEÇÃO 1: 🔥 Leilões ao Vivo Terminando Hoje */}
      <section id="pregoes-ao-vivo" className="max-w-7xl mx-auto px-4 sm:px-6 w-full space-y-5 scroll-mt-40">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-surface-container pb-3">
          <div>
            <div className="flex items-center gap-1.5 text-tertiary text-xs uppercase tracking-widest font-extrabold">
              <span className="w-2.5 h-2.5 rounded-full bg-tertiary animate-ping" />
              PREGÃO ELETRÔNICO ATIVO • DISPUTA ABERTA
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-on-surface tracking-tight mt-1">
              🔥 Leilões ao Vivo Terminando Hoje
            </h2>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="text-on-surface-variant hidden md:block">
              Atualização em tempo real via websockets
            </span>
            <Link
              href="/leiloes"
              className="text-primary hover:underline font-bold flex items-center gap-1"
            >
              <span>Ver todos os {lots.length} pregões</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </Link>
          </div>
        </div>

        {/* Live Grid */}
        {liveAuctions.length === 0 ? (
          <div className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/30 text-center space-y-3">
            <span className="material-symbols-outlined text-outline text-4xl">search_off</span>
            <h3 className="font-bold text-base text-on-surface">
              Nenhum lote encontrado para os filtros aplicados
            </h3>
            <p className="text-xs text-on-surface-variant">
              Tente ampliar o raio logístico ou limpar a busca por EAN/produto.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setSelectedMode('todos');
                setSelectedRadius('300');
              }}
              className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl"
            >
              Limpar Filtros
            </button>
          </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {liveAuctions.map((lot) => {
            const isLotClosed = lot.status === 'encerrado' || lot.status === 'homologado';
            const catName =
              MOCK_CATEGORIES.find((c) => c.id === lot.produto.categoriaId)?.nome || 'Geral B2B';
            return (
            <article
              key={lot.id}
              className="bg-surface-container-lowest rounded-2xl shadow-sm hover:shadow-xl border border-outline-variant/30 overflow-hidden flex flex-col transition-all duration-200"
            >
              {/* Card Top Badges Bar */}
              <div className="p-3 bg-surface-container-low flex items-center justify-between border-b border-surface-container">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-extrabold flex items-center gap-1 ${
                      isLotClosed
                        ? 'bg-surface-container text-outline'
                        : lot.status === 'reta_final'
                        ? 'bg-tertiary-fixed text-on-tertiary-fixed'
                        : 'bg-secondary-fixed text-on-secondary-fixed'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[13px]">
                      {isLotClosed ? 'lock_clock' : lot.status === 'reta_final' ? 'local_fire_department' : 'gavel'}
                    </span>
                    {isLotClosed ? 'ENCERRADO' : lot.status === 'reta_final' ? 'RETA FINAL' : 'AO VIVO'}
                  </span>
                  <span className="text-[11px] font-extrabold text-on-surface-variant">
                    {lot.codigoLote}
                  </span>
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

              {/* Product Media */}
              <div className="relative aspect-[4/3] w-full bg-surface-container overflow-hidden">
                <Image
                  src={lot.produto.imagemUrl}
                  alt={lot.produto.titulo}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  quality={92}
                  priority={lot.id === 'lote-418' || lot.id === 'lote-8492' || lot.id === 'lote-8501'}
                  referrerPolicy="no-referrer"
                  className="object-cover img-sharp hover:scale-[1.03] transition-transform duration-300"
                />
                <div className="absolute bottom-2 left-2 bg-inverse-surface/80 backdrop-blur text-inverse-on-surface text-[10px] font-semibold px-2 py-0.5 rounded">
                  GTIN: {lot.produto.gtinEan}
                </div>
                <div className="absolute top-2 right-2 bg-surface-container-lowest/95 px-2 py-0.5 rounded text-[11px] font-extrabold text-secondary shadow-sm">
                  Margem Est.: {lot.margemEstimadaRevenda}%
                </div>
              </div>

              {/* Specs & Title */}
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between gap-2 text-[11px] text-on-surface-variant mb-1">
                    <span className="truncate">
                      <strong>{catName}</strong> • {lot.produto.marca}
                    </span>
                    <span className="shrink-0">Origem: <strong>{lot.produto.origem}</strong></span>
                  </div>
                  <h3 className="font-bold text-sm sm:text-base text-on-surface leading-snug">
                    <Link href={`/leiloes/${lot.id}`} className="hover:text-primary transition-colors">
                      {lot.produto.titulo}
                    </Link>
                  </h3>
                  <p className="text-xs text-on-surface-variant mt-1 line-clamp-2">
                    {lot.produto.descricao}
                  </p>
                </div>

                {/* Shelf Life Badge */}
                <div className="pt-1">
                  <ShelfLifeBadge
                    status={lot.produto.statusShelfLife}
                    diasRestantes={lot.produto.diasRestantesValidade}
                    dataValidade={lot.produto.dataValidade}
                  />
                </div>

                {/* Valuation Matrix */}
                <div className="bg-surface-container-low p-3 rounded-xl space-y-1 text-xs">
                  <div className="flex justify-between items-baseline text-on-surface-variant">
                    <span>Lance Atual (Lote Fechado):</span>
                    <span className="line-through text-outline">
                      Ref: R$ {lot.produto.precoReferenciaMercado.toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-lg font-extrabold text-primary">
                      R$ {lot.lanceAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    <div className="text-right">
                      <span className="text-sm font-extrabold text-secondary block">
                        R$ {lot.precoUnitarioAtual.toFixed(2)}{' '}
                        <span className="text-[10px] text-on-surface-variant font-normal">/ un</span>
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-on-surface-variant pt-1 border-t border-surface-container">
                    <span>Último: {lot.ultimoLanceEmpresa}</span>
                    <span className="text-secondary font-bold">{lot.totalLances} lances</span>
                  </div>
                </div>

                {/* Card CTA Group */}
                <div className="flex items-center gap-2 pt-1">
                  <Link
                    href={`/leiloes/${lot.id}`}
                    className="flex-1 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-bold text-center transition-colors"
                  >
                    Ver Pregão
                  </Link>
                  <button
                    type="button"
                    disabled={isLotClosed}
                    onClick={() => setSelectedLotForBid(lot)}
                    className="flex-1 py-2 rounded-xl bg-primary hover:bg-primary-container text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1 disabled:opacity-45"
                  >
                    <span className="material-symbols-outlined text-[16px]">gavel</span>
                    <span>{isLotClosed ? 'Encerrado' : 'Dar Lance'}</span>
                  </button>
                </div>
              </div>
            </article>
            );
          })}
        </div>
        )}
      </section>

      {/* SEÇÃO 2: ⏰ Oportunidades • Validade Próxima (Stitch) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 w-full space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-[11px] uppercase tracking-wider font-extrabold text-tertiary flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[15px]">verified_user</span>
              COMPLIANCE ANVISA • SHELF LIFE AUDITADO POR LAUDO
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-on-surface tracking-tight mt-0.5">
              ⏰ Oportunidades • Validade Próxima
            </h2>
            <p className="text-xs text-on-surface-variant">
              Lotes negociados diretamente por grandes redes e centros de distribuição com deságios de até 70% para giro ultra-rápido no varejo de vizinhança.
            </p>
          </div>
          <div className="self-start sm:self-auto px-3 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-xs flex items-center gap-2 shadow-sm">
            <span className="material-symbols-outlined text-secondary text-[18px]">health_and_safety</span>
            <div>
              <span className="font-bold text-on-surface block leading-tight">Risco Sanitário Zero</span>
              <span className="text-[10px] text-on-surface-variant block">Laudos rastreáveis no CNPJ</span>
            </div>
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-sm overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[760px]">
            <thead className="bg-surface-container-low text-on-surface-variant uppercase font-bold text-[10px] border-b border-surface-container">
              <tr>
                <th className="p-3.5">Produto &amp; GTIN/EAN</th>
                <th className="p-3.5">Fabricante / Origem</th>
                <th className="p-3.5">Volume Total</th>
                <th className="p-3.5">Data de Validade</th>
                <th className="p-3.5">Preço Sugerido</th>
                <th className="p-3.5">Preço B2B Lote</th>
                <th className="p-3.5">Desconto</th>
                <th className="p-3.5 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container">
              {fefoLots.map((lot) => {
                const refUnit =
                  lot.produto.totalUnidades > 0
                    ? lot.produto.precoReferenciaMercado / lot.produto.totalUnidades
                    : lot.precoUnitarioAtual * 1.4;
                const discountPct =
                  lot.produto.precoReferenciaMercado > 0
                    ? Math.max(
                        10,
                        Math.round(
                          ((lot.produto.precoReferenciaMercado - lot.lanceAtual) /
                            lot.produto.precoReferenciaMercado) *
                            100
                        )
                      )
                    : 40;
                const days = lot.produto.diasRestantesValidade;
                const urgencyClass =
                  days <= 40
                    ? 'bg-[#FFEBEE] text-[#C62828] border-[#EF9A9A]'
                    : days <= 75
                    ? 'bg-[#FFF3E0] text-[#E65100] border-[#FFCC80]'
                    : 'bg-[#E8F5E9] text-[#2E7D32] border-[#A5D6A7]';

                return (
                  <tr key={lot.id} className="hover:bg-surface-container-low/50">
                    <td className="p-3.5">
                      <Link href={`/leiloes/${lot.id}`} className="hover:text-primary transition-colors">
                        <strong className="text-on-surface block">{lot.produto.titulo.split('•')[0].trim()}</strong>
                      </Link>
                      <span className="text-[10px] font-mono text-outline">
                        EAN: {lot.produto.gtinEan} • {lot.produto.embalagem}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <strong className="text-on-surface block">{lot.produto.marca}</strong>
                      <span className="text-[10px] text-on-surface-variant">{lot.produto.origem}</span>
                    </td>
                    <td className="p-3.5">
                      <strong className="text-on-surface block">{lot.produto.totalCaixas} Caixas</strong>
                      <span className="text-[10px] text-on-surface-variant">
                        {lot.produto.totalUnidades.toLocaleString('pt-BR')} un
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border font-bold text-[11px] ${urgencyClass}`}
                      >
                        {days} dias restantes
                      </span>
                    </td>
                    <td className="p-3.5 line-through text-outline">
                      R$ {refUnit.toFixed(2).replace('.', ',')} / un
                    </td>
                    <td className="p-3.5">
                      <strong className="text-secondary text-sm block">
                        R$ {lot.precoUnitarioAtual.toFixed(2).replace('.', ',')} / un
                      </strong>
                      <span className="text-[10px] text-on-surface-variant">
                        Lote: R$ {lot.lanceAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-white font-extrabold text-[10px] ${
                          discountPct >= 50 ? 'bg-tertiary' : 'bg-secondary'
                        }`}
                      >
                        {discountPct}% OFF
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <Link
                        href={`/checkout?loteId=${lot.id}&valor=${lot.lanceAtual}`}
                        className="px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary-container text-white hover:text-on-secondary-container font-bold text-[11px] inline-block transition-colors"
                      >
                        Arrematar Lote
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* SEÇÃO 3: ⚡ Ofertas Relâmpago & Giro Rápido (Stitch 4-col WebP) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 w-full space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-surface-container pb-3">
          <div>
            <span className="text-[11px] uppercase tracking-widest font-extrabold text-secondary">
              VENDA DIRETA • SEM LEILÃO • PRONTA ENTREGA
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-on-surface tracking-tight mt-0.5">
              ⚡ Ofertas Relâmpago &amp; Giro Rápido
            </h2>
          </div>
          <Link
            href="/catalogo"
            className="text-primary hover:underline text-xs font-bold flex items-center gap-1"
          >
            <span>Explorar catálogo completo de pronta-entrega</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {flashDeals.map((deal) => (
            <article
              key={deal.id}
              className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-sm hover:shadow-lg transition-all overflow-hidden flex flex-col"
            >
              <div className="relative aspect-[4/3] w-full bg-surface-container overflow-hidden">
                <Image
                  src={deal.produto.imagemUrl}
                  alt={deal.produto.titulo}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  quality={92}
                  referrerPolicy="no-referrer"
                  className="object-cover img-sharp hover:scale-[1.03] transition-transform duration-300"
                />
                <span className="absolute top-2 left-2 bg-primary text-white text-[10px] font-extrabold px-2 py-0.5 rounded shadow-sm">
                  {deal.tipoVenda === 'venda_direta' ? 'Pallet Fechado' : 'Pronta Entrega'}
                </span>
              </div>

              <div className="p-4 flex-1 flex flex-col justify-between space-y-3 text-xs">
                <div>
                  <span className="text-[10px] text-outline font-mono uppercase block">
                    {deal.produto.marca} • EAN {deal.produto.gtinEan}
                  </span>
                  <h3 className="font-bold text-sm text-on-surface mt-0.5 leading-snug">
                    <Link href={`/leiloes/${deal.id}`} className="hover:text-primary transition-colors">
                      {deal.produto.titulo.split('•')[0].trim()}
                    </Link>
                  </h3>
                  <p className="text-[11px] text-on-surface-variant mt-1 line-clamp-2">
                    {deal.produto.descricao}
                  </p>
                </div>

                <div className="pt-2 border-t border-surface-container space-y-2">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-[10px] line-through text-outline block">
                        R${' '}
                        {(deal.produto.totalUnidades > 0
                          ? deal.produto.precoReferenciaMercado / deal.produto.totalUnidades
                          : deal.precoUnitarioAtual * 1.38
                        ).toFixed(2)}{' '}
                        / un
                      </span>
                      <span className="text-lg font-extrabold text-primary">
                        R$ {deal.precoUnitarioAtual.toFixed(2)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] font-extrabold text-secondary block">
                        Margem Varejo {deal.margemEstimadaRevenda}%
                      </span>
                      <span className="text-[10px] text-on-surface-variant">
                        Lote: R$ {deal.lanceAtual.toLocaleString('pt-BR')}
                      </span>
                    </div>
                  </div>

                  <Link
                    href={`/checkout?loteId=${deal.id}&valor=${deal.lanceAtual}`}
                    className="w-full py-2 rounded-xl bg-secondary hover:bg-secondary-container text-white hover:text-on-secondary-container font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[16px]">shopping_cart</span>
                    <span>Comprar Lote</span>
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* SEÇÃO 4: 🏭 Direto da Indústria, Cerealistas & Produtores (Stitch) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 w-full space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <span className="text-[11px] uppercase tracking-widest font-extrabold text-primary">
              ECOSSISTEMA HOMOLOGADO
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-on-surface tracking-tight mt-0.5">
              Direto da Indústria, Cerealistas &amp; Produtores
            </h2>
          </div>
          <span className="text-xs text-on-surface-variant">
            Acesso prioritário a pontas de lote, beneficiadoras de grãos, CEASA e higiene &amp; limpeza.
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { code: 'CR', name: 'Cerealista Sul & Camil', query: 'cerealista', isCat: true, desc: 'Arroz, Feijão Carioca & Grãos • Sacaria e fardos em leilão' },
            { code: 'HF', name: 'AgroVale Hortifruti', query: 'hortifruti', isCat: true, desc: 'Tomate, Batata, Cebola & Frutas • Giro rápido CEAGESP' },
            { code: 'HL', name: 'LimpMais & Ypê', query: 'higiene-limpeza', isCat: true, desc: 'Sabão em Pó, Detergentes & Papel • Paletes fechados FOB/CIF' },
            { code: 'NT', name: 'Nestlé & Piracanjuba', query: 'Nestlé', isCat: false, desc: 'Lácteos, Chocolates & Mercearia • Até 48% abaixo da tabela' },
          ].map((ind) => {
            const brandCount = lots.filter((l) =>
              ind.isCat
                ? MOCK_CATEGORIES.find((c) => c.id === l.produto.categoriaId)?.slug === ind.query
                : l.produto.marca.toLowerCase().includes(ind.query.toLowerCase()) ||
                  l.produto.fabricante.toLowerCase().includes(ind.query.toLowerCase())
            ).length;
            const targetHref = ind.isCat
              ? `/catalogo?categoria=${encodeURIComponent(ind.query)}`
              : `/catalogo?q=${encodeURIComponent(ind.query)}`;
            return (
              <Link
                key={ind.code}
                href={targetHref}
                className="p-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 hover:border-primary shadow-sm hover:shadow-md transition-all flex items-start gap-3"
              >
                <div className="w-10 h-10 rounded-xl bg-surface-container-low text-primary font-extrabold text-xs flex items-center justify-center shrink-0">
                  {ind.code}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <strong className="text-sm text-on-surface truncate">{ind.name}</strong>
                    <span className="px-2 py-0.5 rounded bg-secondary-fixed text-on-secondary-fixed text-[10px] font-bold shrink-0 tabular-nums">
                      {brandCount} {brandCount === 1 ? 'Lote' : 'Lotes'}
                    </span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant mt-1 leading-snug">{ind.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Categorias em Destaque */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 w-full space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-on-surface tracking-tight">
            Navegue por Segmentos de Pregão
          </h2>
          <Link href="/leiloes" className="text-xs font-bold text-primary hover:underline">
            Filtrar pregões por segmento
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {MOCK_CATEGORIES.map((cat) => {
            const catCount = lots.filter((l) => l.produto.categoriaId === cat.id).length;
            return (
              <Link
                key={cat.id}
                href={`/leiloes?categoria=${cat.slug}`}
                className="p-3.5 bg-surface-container-lowest rounded-xl border border-outline-variant/30 hover:border-primary transition-all text-center flex flex-col items-center gap-2 group shadow-sm hover:shadow-md"
              >
                <div className="w-10 h-10 rounded-lg bg-surface-container group-hover:bg-primary-fixed text-primary flex items-center justify-center transition-colors">
                  <span className="material-symbols-outlined text-[22px]">{cat.icone}</span>
                </div>
                <div>
                  <span className="text-xs font-bold text-on-surface block leading-tight">
                    {cat.nome}
                  </span>
                  <span className="text-[10px] text-on-surface-variant tabular-nums">
                    {catCount} {catCount === 1 ? 'lote' : 'lotes'}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* SEÇÃO 5: Como Funciona (Stitch) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 w-full space-y-6 pt-2">
        <div className="text-center space-y-1 max-w-2xl mx-auto">
          <span className="text-[10px] uppercase tracking-widest font-extrabold text-primary">
            TRANSPARÊNCIA E CONFORMIDADE TOTAL
          </span>
          <h2 className="text-xl sm:text-2xl font-extrabold text-on-surface">
            Como Funciona para Vender e Comprar com o Mesmo CNPJ
          </h2>
          <p className="text-xs text-on-surface-variant">
            Sem mensalidades ou taxas de adesão. A plataforma cobra comissão apenas sobre o êxito da transação, garantindo custódia fiduciária e liquidez imediata.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              step: '01',
              badge: 'Receita Federal + Sintegra',
              title: 'Cadastro & Validação Fiscal',
              desc: 'Validação automatizada de Inscrição Estadual, CNAE supermercadista/atacadista e situação cadastral para atuar como comprador e vendedor.',
              footer: 'Homologação em menos de 15 minutos',
            },
            {
              step: '02',
              badge: 'Pregão / Venda Direta',
              title: 'Anúncio ou Disputa de Lotes',
              desc: 'Vendedores cadastram lotes com data de validade, GTIN e fotos reais. Compradores dão lances ou arrematam imediatamente com escrow seguro.',
              footer: 'Custódia financeira até o aceite físico',
            },
            {
              step: '03',
              badge: 'NF-e & Logística Integrada',
              title: 'Faturamento e Coleta',
              desc: 'Emissão automatizada do espelho de NF-e, cálculo de ICMS-ST e coleta agendada FOB na doca do CD ou frete CIF com rastreio digital.',
              footer: 'Rastreio de frete e entrega digital',
            },
          ].map((item) => (
            <div key={item.step} className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 rounded-lg bg-primary text-white text-xs font-extrabold">{item.step}</span>
                <span className="text-[10px] font-bold text-primary bg-surface-container-low px-2.5 py-1 rounded-full">{item.badge}</span>
              </div>
              <h3 className="font-extrabold text-sm text-on-surface">{item.title}</h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">{item.desc}</p>
              <div className="pt-2 border-t border-surface-container text-[11px] font-semibold text-secondary">
                {item.footer}
              </div>
            </div>
          ))}
        </div>

        {/* Banner CTA Liquidez */}
        <div className="bg-primary text-white p-6 sm:p-8 rounded-2xl shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-widest font-bold text-primary-fixed">
              LIQUIDEZ COM 1 CLIQUE
            </span>
            <h3 className="text-xl sm:text-2xl font-extrabold">
              Possui estoque parado ou perto da validade?
            </h3>
            <p className="text-xs text-primary-fixed max-w-xl">
              Monetize agora mesmo antes de gerar perda contábil. Nossa mesa de negociação conecta seu estoque a mais de 3.000 supermercados prontos para arrematar.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link
              href="/produtos/novo?modelo=pequeno_mercado"
              className="px-5 py-2.5 rounded-xl bg-secondary hover:bg-secondary-container text-white hover:text-on-secondary-container text-xs font-extrabold transition-colors shadow-sm"
            >
              Liquidar Estoque (Pequeno Mercado)
            </Link>
            <Link
              href="/produtos/novo"
              className="px-5 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition-colors border border-white/25"
            >
              Cadastrar Lote Industrial
            </Link>
            <Link
              href="/negociacoes"
              className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors border border-white/20"
            >
              Mesa de Negociação B2B
            </Link>
          </div>
        </div>
      </section>

      {/* Bid Modal */}
      {selectedLotForBid && (
        <BidModal
          lot={selectedLotForBid}
          isOpen={true}
          onClose={() => setSelectedLotForBid(null)}
          onBidSuccess={(amount, updatedTerminaEm) =>
            handleBidSuccess(selectedLotForBid.id, amount, updatedTerminaEm)
          }
        />
      )}

      {/* AI Assistant Widget */}
      <AIAssistantWidget />
    </div>
  );
}
