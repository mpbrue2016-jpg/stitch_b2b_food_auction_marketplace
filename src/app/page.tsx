'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MOCK_AUCTION_LOTS, MOCK_CATEGORIES } from '@/lib/mock-data';
import { AuctionCountdown } from '@/components/AuctionCountdown';
import { ShelfLifeBadge } from '@/components/ShelfLifeBadge';
import { BidModal } from '@/components/BidModal';
import { AIAssistantWidget } from '@/components/AIAssistantWidget';
import { AuctionLot } from '@/lib/types';

export default function HomePage() {
  const [lots, setLots] = useState<AuctionLot[]>(MOCK_AUCTION_LOTS);
  const [selectedLotForBid, setSelectedLotForBid] = useState<AuctionLot | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRadius, setSelectedRadius] = useState('300');
  const [selectedMode, setSelectedMode] = useState('todos');

  const handleBidSuccess = (lotId: string, newBidAmount: number) => {
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
          };
        }
        return lot;
      })
    );
  };

  const filteredLots = lots.filter((lot) => {
    const matchesSearch =
      !searchTerm ||
      lot.produto.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lot.produto.gtinEan.includes(searchTerm) ||
      lot.produto.marca.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesMode =
      selectedMode === 'todos' ||
      (selectedMode === 'leilao' && lot.tipoVenda === 'leilao') ||
      (selectedMode === 'imediata' && lot.tipoVenda === 'giro_rapido') ||
      (selectedMode === 'palete' && lot.tipoVenda === 'venda_direta');

    return matchesSearch && matchesMode;
  });

  const liveAuctions = filteredLots.filter(
    (l) => l.status === 'reta_final' || l.status === 'ativo'
  );

  return (
    <div className="w-full flex flex-col space-y-8 pb-16">
      {/* Dynamic Operational B2B Hero Ribbon */}
      <section className="relative w-full bg-surface-container-low px-4 sm:px-6 py-8 sm:py-12 border-b border-surface-container shadow-sm">
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
              68 lotes encerram nas próximas 4 horas
            </span>
          </div>

          {/* Hero Headline & Value Proposition */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-8 space-y-3">
              <h1 className="font-extrabold text-2xl sm:text-4xl lg:text-5xl text-on-surface tracking-tight leading-tight">
                O Maior Marketplace B2B de Estoque,{' '}
                <span className="text-primary underline decoration-secondary decoration-4 underline-offset-4">
                  Giro Rápido
                </span>{' '}
                e Leilões de Alimentos
              </h1>
              <p className="text-sm sm:text-base text-on-surface-variant max-w-2xl leading-relaxed">
                Conectamos indústrias, atacadistas e redes de varejo. Compre lotes fracionados ou fechados com até{' '}
                <strong className="text-secondary font-extrabold">70% de desconto</strong> ou liquide estoques excedentes de validade próxima com 100% de compliance fiscal e sanitário ANVISA/MAPA.
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
                onClick={() => setSearchTerm('Café')}
                className="bg-surface-container hover:bg-surface-container-high px-2.5 py-1 rounded-lg text-on-surface text-[11px] font-semibold transition-colors"
              >
                Cafés & Mercearia
              </button>
              <button
                type="button"
                onClick={() => setSearchTerm('Óleo')}
                className="bg-surface-container hover:bg-surface-container-high px-2.5 py-1 rounded-lg text-on-surface text-[11px] font-semibold transition-colors"
              >
                Óleo & Mercearia Básica
              </button>
              <button
                type="button"
                onClick={() => setSearchTerm('Leite')}
                className="bg-surface-container hover:bg-surface-container-high px-2.5 py-1 rounded-lg text-on-surface text-[11px] font-semibold transition-colors"
              >
                Laticínios &lt; 60 dias
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedMode('todos');
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
      <section className="max-w-7xl mx-auto px-4 sm:px-6 w-full space-y-5">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {liveAuctions.map((lot) => (
            <article
              key={lot.id}
              className="bg-surface-container-lowest rounded-2xl shadow-sm hover:shadow-xl border border-outline-variant/30 overflow-hidden flex flex-col transition-all duration-200"
            >
              {/* Card Top Badges Bar */}
              <div className="p-3 bg-surface-container-low flex items-center justify-between border-b border-surface-container">
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded bg-tertiary-fixed text-on-tertiary-fixed text-[10px] font-extrabold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px]">local_fire_department</span>
                    RETA FINAL
                  </span>
                  <span className="text-[11px] font-extrabold text-on-surface-variant">
                    {lot.codigoLote}
                  </span>
                </div>
                <AuctionCountdown terminaEm={lot.terminaEm} size="sm" />
              </div>

              {/* Product Media Placeholder */}
              <div className="relative h-44 w-full bg-surface-container overflow-hidden">
                <img
                  src={lot.produto.imagemUrl}
                  alt={lot.produto.titulo}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
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
                  <div className="flex items-center justify-between text-[11px] text-on-surface-variant mb-1">
                    <span>Indústria: <strong>{lot.produto.marca}</strong></span>
                    <span>Origem: <strong>{lot.produto.origem}</strong></span>
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
                    onClick={() => setSelectedLotForBid(lot)}
                    className="flex-1 py-2 rounded-xl bg-primary hover:bg-primary-container text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[16px]">gavel</span>
                    <span>Dar Lance</span>
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Categorias em Destaque */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 w-full space-y-4">
        <h2 className="text-lg font-bold text-on-surface tracking-tight">
          Navegue por Categorias de Alimentos
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {MOCK_CATEGORIES.map((cat) => (
            <Link
              key={cat.id}
              href={`/catalogo?categoria=${cat.slug}`}
              className="p-3 bg-surface-container-lowest rounded-xl border border-outline-variant/30 hover:border-primary transition-all text-center flex flex-col items-center gap-2 group shadow-sm hover:shadow-md"
            >
              <div className="w-10 h-10 rounded-lg bg-surface-container group-hover:bg-primary-fixed text-primary flex items-center justify-center transition-colors">
                <span className="material-symbols-outlined text-[22px]">{cat.icone}</span>
              </div>
              <div>
                <span className="text-xs font-bold text-on-surface block leading-tight">
                  {cat.nome}
                </span>
                <span className="text-[10px] text-on-surface-variant">{cat.totalLotes} lotes</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Bid Modal */}
      {selectedLotForBid && (
        <BidModal
          lot={selectedLotForBid}
          isOpen={true}
          onClose={() => setSelectedLotForBid(null)}
          onBidSuccess={(amount) => handleBidSuccess(selectedLotForBid.id, amount)}
        />
      )}

      {/* AI Assistant Widget */}
      <AIAssistantWidget />
    </div>
  );
}
