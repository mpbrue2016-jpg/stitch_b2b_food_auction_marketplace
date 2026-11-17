'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { MOCK_AUCTION_LOTS, MOCK_ORDERS, MOCK_CATEGORIES } from '@/lib/mock-data';
import { AuctionLot, EscrowOrder } from '@/lib/types';

export default function PainelFornecedorPage() {
  const [supplierLots, setSupplierLots] = useState<AuctionLot[]>(MOCK_AUCTION_LOTS);
  const [orders, setOrders] = useState<EscrowOrder[]>(MOCK_ORDERS);
  const [selectedSegment, setSelectedSegment] = useState<string>('todos');

  useEffect(() => {
    Promise.all([
      fetch('/api/lotes').then((res) => (res.ok ? res.json() : null)),
      fetch('/api/pedidos').then((res) => (res.ok ? res.json() : null)),
    ])
      .then(([lotesData, pedidosData]) => {
        if (lotesData?.lots?.length) setSupplierLots(lotesData.lots);
        if (pedidosData?.orders?.length) setOrders(pedidosData.orders);
      })
      .catch(() => {});
  }, []);

  const activeOrders = orders.filter((o) => o.statusPagamento !== 'estornado');
  const totalRepassesLiquidados = activeOrders.reduce((acc, o) => acc + o.valorRepasseLiquidoFornecedor, 0);
  const totalCaixasOfertadas = supplierLots.reduce((acc, l) => acc + l.produto.totalCaixas, 0);
  const avgDiasValidade =
    supplierLots.length > 0
      ? Math.round(supplierLots.reduce((acc, l) => acc + l.produto.diasRestantesValidade, 0) / supplierLots.length)
      : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-container pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-secondary animate-pulse" />
            <span className="text-[10px] uppercase font-bold text-secondary">
              COCKPIT DA INDÚSTRIA & FABRICANTE B2B
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface">
            Distribuidora & Indústria Nacional S/A
          </h1>
          <p className="text-xs text-on-surface-variant font-mono mt-0.5">
            CNPJ: 14.892.108/0001-44 • Conta Escrow Segregada Ativa • Liquidação D+0 SPI
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/produtos/novo"
            className="bg-secondary hover:bg-secondary-container text-white hover:text-on-secondary-container px-4 py-2.5 rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            <span>Criar Novo Pregão</span>
          </Link>
          <Link
            href="/produtos/novo?modelo=pequeno_mercado"
            className="bg-tertiary/10 hover:bg-tertiary/20 text-tertiary border border-tertiary/30 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]">storefront</span>
            <span>Liquidar Estoque Parado</span>
          </Link>
          <Link
            href="/negociacoes"
            className="bg-surface-container hover:bg-surface-container-high text-on-surface px-4 py-2.5 rounded-xl text-xs font-bold transition-colors"
          >
            Propostas Recebidas
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs font-bold uppercase">Repasses Líquidos D+0</span>
            <span className="material-symbols-outlined text-secondary text-[22px]">payments</span>
          </div>
          <span className="text-2xl font-extrabold text-secondary block">
            R$ {totalRepassesLiquidados.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[11px] text-outline block">{activeOrders.length} pedidos em custódia/SPI</span>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs font-bold uppercase">Pregões Ativos</span>
            <span className="material-symbols-outlined text-primary text-[22px]">gavel</span>
          </div>
          <span className="text-2xl font-extrabold text-primary block">{supplierLots.length} lotes</span>
          <span className="text-[11px] text-on-surface-variant block">Disputa aberta em São Paulo</span>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs font-bold uppercase">Volume em Oferta</span>
            <span className="material-symbols-outlined text-primary text-[22px]">inventory_2</span>
          </div>
          <span className="text-2xl font-extrabold text-on-surface block">
            {totalCaixasOfertadas.toLocaleString('pt-BR')} cxs
          </span>
          <span className="text-[11px] text-on-surface-variant block">Estoque paletizado homologado</span>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs font-bold uppercase">Shelf Life Médio</span>
            <span className="material-symbols-outlined text-secondary text-[22px]">speed</span>
          </div>
          <span className="text-2xl font-extrabold text-secondary block">{avgDiasValidade} dias</span>
          <span className="text-[11px] text-on-surface-variant block">Zero perda por vencimento</span>
        </div>
      </div>

      {/* Lot Management Table */}
      <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-surface-container pb-3">
          <h3 className="font-extrabold text-base text-on-surface">
            Gestão dos Meus Lotes em Pregão
          </h3>
          <Link href="/produtos/novo" className="text-xs text-primary font-bold hover:underline">
            + Adicionar Lote
          </Link>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSelectedSegment('todos')}
            className={`px-3 py-1 rounded-lg text-[11px] font-bold border transition-colors whitespace-nowrap shrink-0 ${
              selectedSegment === 'todos'
                ? 'bg-primary text-white border-primary'
                : 'bg-surface-container-low text-on-surface-variant border-outline-variant/30 hover:text-on-surface'
            }`}
          >
            Todos ({supplierLots.length})
          </button>
          {MOCK_CATEGORIES.map((cat) => {
            const count = supplierLots.filter((l) => l.produto.categoriaId === cat.id).length;
            const active = selectedSegment === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedSegment(cat.id)}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold border transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-primary text-white border-primary'
                    : 'bg-surface-container-low text-on-surface-variant border-outline-variant/30 hover:text-on-surface'
                }`}
              >
                {cat.nome} ({count})
              </button>
            );
          })}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-surface-container-low text-on-surface-variant uppercase font-bold text-[10px]">
              <tr>
                <th className="p-3">Código</th>
                <th className="p-3">Produto / SKU</th>
                <th className="p-3">Volume</th>
                <th className="p-3">Validade (Shelf Life)</th>
                <th className="p-3">Lance Atual</th>
                <th className="p-3">Lances</th>
                <th className="p-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container">
              {supplierLots
                .filter((l) => (selectedSegment === 'todos' ? true : l.produto.categoriaId === selectedSegment))
                .map((lot) => {
                const catName =
                  MOCK_CATEGORIES.find((c) => c.id === lot.produto.categoriaId)?.nome || 'Geral B2B';
                return (
                  <tr key={lot.id} className="hover:bg-surface-container-low/50">
                    <td className="p-3 font-mono font-bold text-primary">{lot.codigoLote}</td>
                    <td className="p-3">
                      <span className="font-bold text-on-surface block">{lot.produto.titulo}</span>
                      <span className="text-[10px] text-on-surface-variant block">
                        {catName} • GTIN: {lot.produto.gtinEan}
                      </span>
                    </td>
                    <td className="p-3 font-medium text-on-surface">
                      {lot.produto.totalCaixas} cxs ({lot.produto.paletes} paletes)
                    </td>
                    <td className="p-3">
                      <span className="font-bold text-on-surface">{lot.produto.dataValidade}</span>
                      <span className="text-[10px] text-secondary block font-semibold">
                        {lot.produto.diasRestantesValidade} dias restantes
                      </span>
                    </td>
                    <td className="p-3 font-extrabold text-primary text-sm">
                      R$ {lot.lanceAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-secondary-fixed text-on-secondary-fixed font-bold text-[10px]">
                        {lot.totalLances} lances
                      </span>
                    </td>
                    <td className="p-3">
                      <Link
                        href={`/leiloes/${lot.id}`}
                        className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-container text-white font-bold text-[11px] inline-block transition-colors"
                      >
                        Monitorar
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
