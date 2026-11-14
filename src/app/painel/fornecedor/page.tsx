'use client';

import React from 'react';
import Link from 'next/link';
import { MOCK_AUCTION_LOTS } from '@/lib/mock-data';

export default function PainelFornecedorPage() {
  const supplierLots = MOCK_AUCTION_LOTS;

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

        <div className="flex items-center gap-3">
          <Link
            href="/produtos/novo"
            className="bg-secondary hover:bg-secondary-container text-white hover:text-on-secondary-container px-4 py-2.5 rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            <span>Criar Novo Pregão</span>
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
            <span className="text-xs font-bold uppercase">Repasses Liquidados D+0</span>
            <span className="material-symbols-outlined text-secondary text-[22px]">payments</span>
          </div>
          <span className="text-2xl font-extrabold text-secondary block">R$ 840.000,00</span>
          <span className="text-[11px] text-outline block">100% recebido via SPI Bancário</span>
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
            <span className="text-xs font-bold uppercase">Caixas Despachadas</span>
            <span className="material-symbols-outlined text-primary text-[22px]">inventory_2</span>
          </div>
          <span className="text-2xl font-extrabold text-on-surface block">14.200 cxs</span>
          <span className="text-[11px] text-on-surface-variant block">Mês de Novembro/2026</span>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs font-bold uppercase">Giro Médio FEFO</span>
            <span className="material-symbols-outlined text-secondary text-[22px]">speed</span>
          </div>
          <span className="text-2xl font-extrabold text-secondary block">18 dias</span>
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
              {supplierLots.map((lot) => (
                <tr key={lot.id} className="hover:bg-surface-container-low/50">
                  <td className="p-3 font-mono font-bold text-primary">{lot.codigoLote}</td>
                  <td className="p-3">
                    <span className="font-bold text-on-surface block">{lot.produto.titulo}</span>
                    <span className="text-[10px] text-on-surface-variant">GTIN: {lot.produto.gtinEan}</span>
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
