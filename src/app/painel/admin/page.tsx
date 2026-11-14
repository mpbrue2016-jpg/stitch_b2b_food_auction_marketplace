'use client';

import React from 'react';
import Link from 'next/link';
import { CommissionCalculator } from '@/components/CommissionCalculator';

export default function PainelAdminPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-container pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-secondary animate-pulse" />
            <span className="text-[10px] uppercase font-bold text-secondary">
              CONSOLE DE INTERVENÇÃO SOBERANA • AUDITORIA FORENSE WORM
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface">
            Painel Administrativo Master & Controle da Plataforma
          </h1>
          <p className="text-xs text-on-surface-variant font-mono mt-0.5">
            Governança Criptográfica HSM • Validador ITI / BACEN • Motor Split v3.4
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/painel/comissoes"
            className="bg-primary hover:bg-primary-container text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]">tune</span>
            <span>Ajustar Taxas de Comissão</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs font-bold uppercase">GMV Total Transacionado</span>
            <span className="material-symbols-outlined text-primary text-[22px]">account_balance</span>
          </div>
          <span className="text-2xl font-extrabold text-primary block">R$ 4.280.950,00</span>
          <span className="text-[11px] text-secondary font-bold block">↑ +24.8% vs mês anterior</span>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs font-bold uppercase">Receita da Plataforma (Take Rate)</span>
            <span className="material-symbols-outlined text-secondary text-[22px]">monetization_on</span>
          </div>
          <span className="text-2xl font-extrabold text-secondary block">R$ 274.980,80</span>
          <span className="text-[11px] text-outline block">Take rate médio efetivo: 6.42%</span>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs font-bold uppercase">Saldo em Custódia Escrow</span>
            <span className="material-symbols-outlined text-primary text-[22px]">lock</span>
          </div>
          <span className="text-2xl font-extrabold text-on-surface block">R$ 894.200,00</span>
          <span className="text-[11px] text-secondary font-bold block">100% segregado no STR</span>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs font-bold uppercase">Status Antifraude & DLQ</span>
            <span className="material-symbols-outlined text-secondary text-[22px]">verified</span>
          </div>
          <span className="text-2xl font-extrabold text-secondary block">0 Falhas (DLQ Zerada)</span>
          <span className="text-[11px] text-on-surface-variant block">Trilha criptográfica íntegra</span>
        </div>
      </div>

      {/* Embedded Commission Calculator & Split Engine */}
      <CommissionCalculator />

      {/* Audit Log and Dispute Moderation Section */}
      <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30 shadow-sm space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-surface-container pb-3">
          <h3 className="font-extrabold text-base text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">security</span>
            Prevenção a Fraudes e Moderação de Disputas B2B
          </h3>
          <span className="text-[10px] bg-secondary-fixed text-on-secondary-fixed font-bold px-2 py-0.5 rounded">
            MOTOR ANTI-CARTEL ATIVO
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-surface-container-low text-on-surface-variant uppercase font-bold text-[10px]">
              <tr>
                <th className="p-3">Protocolo</th>
                <th className="p-3">Lote</th>
                <th className="p-3">Partes Envolvidas</th>
                <th className="p-3">Valor Escrow</th>
                <th className="p-3">Motivo / Tipo</th>
                <th className="p-3">Status</th>
                <th className="p-3">Ação Soberana</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container">
              <tr className="hover:bg-surface-container-low/50">
                <td className="p-3 font-mono font-bold text-primary">REC-2026-9041</td>
                <td className="p-3 font-bold">Lote #418 (Café Alvorada)</td>
                <td className="p-3 text-on-surface-variant">
                  Supermercado Central ↔ Moinho Alvorada
                </td>
                <td className="p-3 font-extrabold text-primary">R$ 38.500,00</td>
                <td className="p-3">
                  <span className="px-2 py-0.5 rounded bg-surface-container font-semibold">
                    Conferência de Doca (Palete 03)
                  </span>
                </td>
                <td className="p-3">
                  <span className="px-2 py-0.5 rounded bg-secondary-fixed text-on-secondary-fixed font-bold text-[10px]">
                    CONCILIADO D+0
                  </span>
                </td>
                <td className="p-3">
                  <button
                    type="button"
                    onClick={() => alert('Dossiê forense WORM validado com sucesso.')}
                    className="px-2.5 py-1 bg-surface-container hover:bg-surface-container-high rounded text-[11px] font-bold text-primary"
                  >
                    Ver Dossiê
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
