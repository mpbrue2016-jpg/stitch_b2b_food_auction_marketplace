'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { MOCK_AUCTION_LOTS } from '@/lib/mock-data';
import { AuctionCountdown } from '@/components/AuctionCountdown';
import { ShelfLifeBadge } from '@/components/ShelfLifeBadge';
import { AuctionBid } from '@/lib/types';

export default function SalaLeilaoAoVivoPage() {
  const params = useParams();
  const router = useRouter();
  const lotId = params.id as string;

  const initialLot =
    MOCK_AUCTION_LOTS.find((l) => l.id === lotId) || MOCK_AUCTION_LOTS[0];

  const [lot, setLot] = useState(initialLot);
  const [bids, setBids] = useState<AuctionBid[]>([
    {
      id: 'bid-3',
      loteId: lot.id,
      compradorId: 'comp-1',
      empresaNome: 'Supermercado Vila Real Ltda',
      cnpjAnonimizado: '14.***.***/0001-22',
      valorLance: lot.lanceAtual,
      valorUnitario: lot.precoUnitarioAtual,
      criadoEm: 'Há 1 minuto',
      ehVencedor: true,
    },
    {
      id: 'bid-2',
      loteId: lot.id,
      compradorId: 'comp-2',
      empresaNome: 'Rede Econômica de Alimentos',
      cnpjAnonimizado: '09.***.***/0001-87',
      valorLance: lot.lanceAtual - lot.incrementoMinimo,
      valorUnitario: Number((lot.precoUnitarioAtual - 0.20).toFixed(2)),
      criadoEm: 'Há 3 minutos',
      ehVencedor: false,
    },
    {
      id: 'bid-1',
      loteId: lot.id,
      compradorId: 'comp-3',
      empresaNome: 'Supermercado Central Ltda (Você)',
      cnpjAnonimizado: '12.***.***/0001-90',
      valorLance: lot.lanceAtual - lot.incrementoMinimo * 2,
      valorUnitario: Number((lot.precoUnitarioAtual - 0.40).toFixed(2)),
      criadoEm: 'Há 6 minutos',
      ehVencedor: false,
    },
  ]);

  const [bidInput, setBidInput] = useState<number>(lot.lanceAtual + lot.incrementoMinimo);
  const [submittingBid, setSubmittingBid] = useState(false);
  const [lastBidFeedback, setLastBidFeedback] = useState<string | null>(null);

  const handlePlaceBid = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (bidInput <= lot.lanceAtual) {
      alert('Seu lance deve ser maior que o lance atual.');
      return;
    }

    setSubmittingBid(true);
    setTimeout(() => {
      setSubmittingBid(false);
      const newUnitPrice =
        lot.produto.totalUnidades > 0
          ? Number((bidInput / lot.produto.totalUnidades).toFixed(2))
          : lot.precoUnitarioAtual;

      const newBid: AuctionBid = {
        id: `bid-${Date.now()}`,
        loteId: lot.id,
        compradorId: 'user-varejista-01',
        empresaNome: 'Supermercado Central Ltda (Você)',
        cnpjAnonimizado: '12.***.***/0001-90',
        valorLance: bidInput,
        valorUnitario: newUnitPrice,
        criadoEm: 'Agora mesmo',
        ehVencedor: true,
      };

      setBids((prev) => [newBid, ...prev.map((b) => ({ ...b, ehVencedor: false }))]);
      setLot((prev) => ({
        ...prev,
        lanceAtual: bidInput,
        precoUnitarioAtual: newUnitPrice,
        totalLances: prev.totalLances + 1,
        ultimoLanceEmpresa: 'Supermercado Central Ltda (Você)',
      }));
      setBidInput(bidInput + lot.incrementoMinimo);
      setLastBidFeedback('Lance de R$ ' + bidInput.toLocaleString('pt-BR') + ' registrado com sucesso!');
      setTimeout(() => setLastBidFeedback(null), 3000);
    }, 500);
  };

  const handleArrematarImediato = () => {
    router.push(`/checkout?loteId=${lot.id}&valor=${lot.precoArremateImediato || lot.lanceAtual}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-container pb-4">
        <div>
          <nav className="text-xs text-on-surface-variant flex items-center gap-1.5 mb-1">
            <Link href="/" className="hover:text-primary">Início</Link>
            <span>/</span>
            <Link href="/leiloes" className="hover:text-primary">Leilões</Link>
            <span>/</span>
            <span className="font-bold text-primary">{lot.codigoLote}</span>
          </nav>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-tertiary text-white text-[10px] font-extrabold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
              PREGÃO AO VIVO
            </span>
            <h1 className="text-xl sm:text-2xl font-extrabold text-on-surface">
              {lot.codigoLote} • {lot.produto.titulo}
            </h1>
          </div>
        </div>

        {/* Live Timer */}
        <div className="flex items-center gap-3 bg-surface-container-low p-2 rounded-xl border border-outline-variant/30">
          <div className="text-right">
            <span className="text-[10px] text-on-surface-variant uppercase font-bold block">
              Encerramento Previsto:
            </span>
            <AuctionCountdown terminaEm={lot.terminaEm} size="md" />
          </div>
        </div>
      </div>

      {/* Main Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Product Photos & Technical Specifications */}
        <div className="lg:col-span-7 space-y-6">
          {/* Main Photo */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 overflow-hidden shadow-sm">
            <div className="relative h-72 sm:h-96 w-full bg-surface-container">
              <img
                src={lot.produto.imagemUrl}
                alt={lot.produto.titulo}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-3 left-3 bg-inverse-surface/80 backdrop-blur text-white text-xs px-2.5 py-1 rounded-lg font-mono">
                GTIN/EAN: {lot.produto.gtinEan}
              </div>
              <div className="absolute top-3 right-3 bg-secondary text-white text-xs font-extrabold px-3 py-1 rounded-lg shadow-sm">
                Margem Est. Revenda: {lot.margemEstimadaRevenda}%
              </div>
            </div>

            {/* Spec Highlights Ribbon */}
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

          {/* Technical Specs & Compliance */}
          <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-on-surface uppercase tracking-wide border-b border-surface-container pb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[18px]">fact_check</span>
              Ficha Técnica de Homologação Sanitária e Logística
            </h3>

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
                <span className="font-bold text-on-surface block">Logística & Retirada:</span>
                <p className="text-on-surface-variant">Modalidade: <strong className="text-primary font-bold">FOB (Retirada em CD)</strong></p>
                <p className="text-on-surface-variant">Agendamento de Doca: <strong className="text-secondary font-bold">Livre em até 48h</strong></p>
              </div>
            </div>

            <div className="p-3 bg-secondary-container/20 rounded-xl border border-secondary/30 flex items-center gap-2 text-xs text-secondary font-bold">
              <span className="material-symbols-outlined text-[18px]">verified</span>
              <span>100% Homologado ANVISA / MAPA com custódia fiduciária auditada pelo BACEN.</span>
            </div>
          </div>
        </div>

        {/* Right Column: Live Bidding Console & Offer History */}
        <div className="lg:col-span-5 space-y-6">
          {/* Bidding Console */}
          <div className="bg-surface-container-lowest p-6 rounded-2xl border-2 border-primary/20 shadow-md space-y-5">
            {/* Current Bid Display */}
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

            {/* Feedback notification */}
            {lastBidFeedback && (
              <div className="p-2.5 bg-secondary-container/30 border border-secondary text-secondary font-bold text-xs rounded-xl flex items-center gap-2 animate-in fade-in">
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                <span>{lastBidFeedback}</span>
              </div>
            )}

            {/* Fast Bid Buttons */}
            <form onSubmit={handlePlaceBid} className="space-y-3">
              <label className="block text-xs font-bold text-on-surface uppercase">
                Incrementar Lance no Pregão:
              </label>

              <div className="flex items-center bg-surface-container rounded-xl px-3 py-2 border-2 border-primary/30 focus-within:border-primary">
                <span className="text-base font-extrabold text-primary mr-2">R$</span>
                <input
                  type="number"
                  step="50"
                  min={lot.lanceAtual + lot.incrementoMinimo}
                  value={bidInput}
                  onChange={(e) => setBidInput(Number(e.target.value))}
                  className="w-full bg-transparent text-xl font-extrabold text-on-surface focus:outline-none"
                  required
                />
              </div>

              {/* Fast Increment Pills */}
              <div className="flex items-center gap-2">
                {[500, 1000, 2500].map((inc) => (
                  <button
                    key={inc}
                    type="button"
                    onClick={() => setBidInput((prev) => prev + inc)}
                    className="flex-1 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary font-bold text-xs transition-colors"
                  >
                    + R$ {inc}
                  </button>
                ))}
              </div>

              {/* Submit Bid Button */}
              <button
                type="submit"
                disabled={submittingBid}
                className="w-full py-3.5 bg-primary hover:bg-primary-container text-white font-extrabold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submittingBid ? (
                  <span>Registrando Lance no Livro de Ofertas...</span>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[20px]">gavel</span>
                    <span>Confirmar Lance de R$ {bidInput.toLocaleString('pt-BR')}</span>
                  </>
                )}
              </button>
            </form>

            {/* Buy Now Option */}
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
                  onClick={handleArrematarImediato}
                  className="w-full py-2.5 bg-secondary hover:bg-secondary-container text-white hover:text-on-secondary-container font-extrabold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[18px]">bolt</span>
                  <span>Arrematar Imediatamente com Custódia Escrow</span>
                </button>
              </div>
            )}
          </div>

          {/* Real-time Bid History Feed */}
          <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-surface-container pb-2">
              <h4 className="text-xs font-extrabold text-on-surface uppercase tracking-wide flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-[16px]">history</span>
                Trilha de Lances do Pregão
              </h4>
              <span className="text-[10px] text-secondary font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                Auditado BACEN
              </span>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {bids.map((bid, i) => (
                <div
                  key={bid.id}
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-all ${
                    bid.ehVencedor
                      ? 'bg-secondary-container/20 border-secondary/40 shadow-sm'
                      : 'bg-surface-container-low border-surface-container'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-on-surface">{bid.empresaNome}</span>
                      {bid.ehVencedor && (
                        <span className="text-[9px] bg-secondary text-white font-extrabold px-1.5 py-0.2 rounded">
                          LÍDER
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-on-surface-variant font-mono">
                      CNPJ: {bid.cnpjAnonimizado} • {bid.criadoEm}
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
          </div>
        </div>
      </div>
    </div>
  );
}
