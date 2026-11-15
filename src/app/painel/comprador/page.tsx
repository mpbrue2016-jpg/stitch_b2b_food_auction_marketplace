'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { MOCK_USER_PROFILE, MOCK_AUCTION_LOTS, MOCK_ORDERS } from '@/lib/mock-data';
import { AuctionLot, EscrowOrder } from '@/lib/types';

export default function PainelCompradorPage() {
  const user = MOCK_USER_PROFILE;
  const [lots, setLots] = useState<AuctionLot[]>(MOCK_AUCTION_LOTS);
  const [orders, setOrders] = useState<EscrowOrder[]>(MOCK_ORDERS);

  useEffect(() => {
    Promise.all([
      fetch('/api/lotes').then((res) => (res.ok ? res.json() : null)),
      fetch('/api/pedidos').then((res) => (res.ok ? res.json() : null)),
    ])
      .then(([lotesData, pedidosData]) => {
        if (lotesData?.lots?.length) setLots(lotesData.lots);
        if (pedidosData?.orders?.length) setOrders(pedidosData.orders);
      })
      .catch(() => {});
  }, []);

  const totalVolumeArrematado = orders.reduce((acc, o) => acc + o.valorTotalArremate, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-container pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-secondary animate-pulse" />
            <span className="text-[10px] uppercase font-bold text-secondary">
              COCKPIT DO COMPRADOR B2B • CNPJ HOMOLOGADO
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface">
            {user.nomeFantasia}
          </h1>
          <p className="text-xs text-on-surface-variant font-mono mt-0.5">
            CNPJ: {user.cnpj} • I.E: {user.inscricaoEstadual} • {user.endereco?.cidade} - {user.endereco?.uf}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/leiloes"
            className="bg-primary hover:bg-primary-container text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]">gavel</span>
            <span>Participar de Pregões</span>
          </Link>
          <Link
            href="/pedidos"
            className="bg-surface-container hover:bg-surface-container-high text-on-surface px-4 py-2.5 rounded-xl text-xs font-bold transition-colors"
          >
            Meus Pedidos
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs font-bold uppercase">Limite Escrow Liberado</span>
            <span className="material-symbols-outlined text-secondary text-[22px]">verified_user</span>
          </div>
          <span className="text-2xl font-extrabold text-secondary block">
            R$ {user.limiteCreditoEscrow.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[11px] text-outline block">Regulado BACEN • Disponível D+0</span>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs font-bold uppercase">Pregões em Disputa</span>
            <span className="material-symbols-outlined text-tertiary text-[22px]">timer</span>
          </div>
          <span className="text-2xl font-extrabold text-primary block">{lots.length} lotes</span>
          <span className="text-[11px] text-tertiary font-bold block">
            {lots.filter((l) => l.status === 'reta_final').length} lotes em Reta Final
          </span>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs font-bold uppercase">Volume Total Arrematado</span>
            <span className="material-symbols-outlined text-primary text-[22px]">payments</span>
          </div>
          <span className="text-2xl font-extrabold text-on-surface block">
            R$ {totalVolumeArrematado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[11px] text-on-surface-variant block">{orders.length} pedidos homologados</span>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs font-bold uppercase">Economia Média Obtida</span>
            <span className="material-symbols-outlined text-secondary text-[22px]">trending_up</span>
          </div>
          <span className="text-2xl font-extrabold text-secondary block">48.2%</span>
          <span className="text-[11px] text-on-surface-variant block">Em relação à tabela industrial</span>
        </div>
      </div>

      {/* Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Active Bids */}
        <div className="lg:col-span-7 bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-surface-container pb-3">
            <h3 className="font-extrabold text-base text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">gavel</span>
              Meus Lances & Disputas Ativas
            </h3>
            <Link href="/leiloes" className="text-xs text-primary font-bold hover:underline">
              Ver todos os pregões
            </Link>
          </div>

          <div className="space-y-3">
            {lots.slice(0, 3).map((lot) => (
              <div
                key={lot.id}
                className="p-4 rounded-xl bg-surface-container-low border border-surface-container flex flex-col sm:flex-row items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-on-surface">{lot.codigoLote} • {lot.produto.titulo}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-secondary-fixed text-on-secondary-fixed font-bold">
                      SEU LANCE LÍDER
                    </span>
                  </div>
                  <span className="text-on-surface-variant block">
                    Lance Atual: <strong>R$ {lot.lanceAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong> (R$ {lot.precoUnitarioAtual.toFixed(2)}/un)
                  </span>
                </div>

                <Link
                  href={`/leiloes/${lot.id}`}
                  className="px-4 py-2 bg-primary hover:bg-primary-container text-white font-bold rounded-lg text-xs transition-colors shrink-0"
                >
                  Sala do Pregão
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Recent Orders & Dock pick-up */}
        <div className="lg:col-span-5 bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-surface-container pb-3">
            <h3 className="font-extrabold text-base text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">local_shipping</span>
              Retiradas FOB & Docas
            </h3>
            <Link href="/pedidos" className="text-xs text-primary font-bold hover:underline">
              Ver pedidos
            </Link>
          </div>

          <div className="space-y-3 text-xs">
            {orders.map((order) => (
              <div
                key={order.id}
                className="p-3.5 rounded-xl bg-surface-container-low border border-surface-container space-y-2"
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-on-surface">{order.codigoPedido}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-primary-fixed text-on-primary-fixed font-bold">
                    {order.statusPagamento === 'em_custodia_escrow' ? 'Escrow Retido' : 'Liquidado'}
                  </span>
                </div>
                <p className="text-on-surface-variant font-medium">{order.tituloLote}</p>
                <div className="text-[11px] text-on-surface bg-white p-2 rounded-lg border border-outline-variant/20">
                  <span className="font-bold text-primary block">Doca CD Jundiaí:</span>
                  <span>{order.docaAgendada || 'Aguardando agendamento'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
