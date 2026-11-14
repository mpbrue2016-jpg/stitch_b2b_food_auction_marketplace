'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { MOCK_AUCTION_LOTS } from '@/lib/mock-data';
import { AuctionCountdown } from '@/components/AuctionCountdown';
import { ShelfLifeBadge } from '@/components/ShelfLifeBadge';
import { BidModal } from '@/components/BidModal';
import { AuctionLot } from '@/lib/types';

export default function LeiloesPage() {
  const [lots, setLots] = useState<AuctionLot[]>(MOCK_AUCTION_LOTS);
  const [selectedLotForBid, setSelectedLotForBid] = useState<AuctionLot | null>(null);
  const [activeTab, setActiveTab] = useState<'ao_vivo' | 'todos' | 'finalizados'>('ao_vivo');

  const displayedLots = lots.filter((lot) => {
    if (activeTab === 'ao_vivo') return lot.status === 'reta_final' || lot.status === 'ativo';
    if (activeTab === 'finalizados') return lot.status === 'encerrado' || lot.status === 'homologado';
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Breadcrumb & Header */}
      <div className="space-y-1">
        <nav className="text-xs text-on-surface-variant flex items-center gap-1.5">
          <Link href="/" className="hover:text-primary">Início</Link>
          <span>/</span>
          <span className="font-bold text-primary">Sala de Pregões Eletrônicos & Leilões ao Vivo</span>
        </nav>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface flex items-center gap-2">
              <span>Pregões Eletrônicos em Tempo Real</span>
              <span className="w-2.5 h-2.5 rounded-full bg-tertiary animate-pulse" />
            </h1>
            <p className="text-xs sm:text-sm text-on-surface-variant">
              Dispute lotes industriais com cronômetro regressivo auditado e custódia BACEN.
            </p>
          </div>

          {/* Tab Filter */}
          <div className="flex bg-surface-container-low p-1 rounded-xl border border-outline-variant/30 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('ao_vivo')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'ao_vivo'
                  ? 'bg-surface-container-lowest text-tertiary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              🔥 Disputa Aberta ({lots.filter((l) => l.status === 'reta_final' || l.status === 'ativo').length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('todos')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'todos'
                  ? 'bg-surface-container-lowest text-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Todos os Lotes ({lots.length})
            </button>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayedLots.map((lot) => (
          <article
            key={lot.id}
            className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-sm hover:shadow-xl transition-all overflow-hidden flex flex-col"
          >
            {/* Top Bar */}
            <div className="p-3 bg-surface-container-low flex items-center justify-between border-b border-surface-container">
              <span className="text-xs font-bold text-on-surface-variant">{lot.codigoLote}</span>
              <AuctionCountdown terminaEm={lot.terminaEm} size="sm" />
            </div>

            {/* Imagem */}
            <div className="relative h-44 w-full bg-surface-container">
              <img
                src={lot.produto.imagemUrl}
                alt={lot.produto.titulo}
                className="w-full h-full object-cover"
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
                  {lot.produto.marca} • {lot.produto.origem}
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
                  <span className="text-base font-extrabold text-primary">
                    R$ {lot.lanceAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-on-surface-variant">Preço Unitário:</span>
                  <span className="font-extrabold text-secondary text-sm">
                    R$ {lot.precoUnitarioAtual.toFixed(2)} / un
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-outline pt-1 border-t border-surface-container">
                  <span>Último: {lot.ultimoLanceEmpresa}</span>
                  <span className="text-secondary font-bold">{lot.totalLances} lances</span>
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

      {/* Bid Modal */}
      {selectedLotForBid && (
        <BidModal
          lot={selectedLotForBid}
          isOpen={true}
          onClose={() => setSelectedLotForBid(null)}
          onBidSuccess={(amount) => {
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
                      ultimoLanceEmpresa: 'Supermercado Central Ltda (Você)',
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
