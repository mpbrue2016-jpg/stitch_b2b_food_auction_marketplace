'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { CommissionCalculator } from '@/components/CommissionCalculator';
import { useEnvironment } from '@/components/EnvironmentProvider';
import { DemoBadge, DidacticHint } from '@/components/DemoBadge';
import { generateFinancialSummary } from '@/lib/commission-engine';
import { EscrowOrder } from '@/lib/types';

export default function PainelComissoesPage() {
  const { isDemoMode, sandbox } = useEnvironment();
  const [orders, setOrders] = useState<EscrowOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isDemoMode) {
      setOrders(sandbox.simulatedOrders);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch('/api/pedidos?env=original', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setOrders(Array.isArray(data?.orders) ? data.orders : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isDemoMode, sandbox.simulatedOrders]);

  const visibleOrders = isDemoMode ? sandbox.simulatedOrders : orders;
  const summary = generateFinancialSummary(visibleOrders);

  const handleExportCsv = () => {
    const header = [
      'Pedido',
      'Lote',
      'Comprador',
      'Fornecedor',
      'ValorBruto',
      'TaxaPercentual',
      'ComissaoPlataforma',
      'RepasseLiquido',
      'StatusPagamento',
      'SeloWORM',
    ];
    const rows = visibleOrders.map((o) => [
      o.codigoPedido,
      `"${o.tituloLote.replace(/"/g, '""')}"`,
      `"${o.compradorNome.replace(/"/g, '""')}"`,
      `"${o.fornecedorNome.replace(/"/g, '""')}"`,
      o.valorTotalArremate.toFixed(2),
      o.percentualComissao.toFixed(2),
      o.valorComissaoPlataforma.toFixed(2),
      o.valorRepasseLiquidoFornecedor.toFixed(2),
      o.statusPagamento,
      o.termoArremateHash || '',
    ]);
    const csvContent = '\uFEFF' + [header.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `conciliacao-escrow-varejista-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setExportNotice(`Conciliação exportada (${orders.length} registros) em formato CSV.`);
    setTimeout(() => setExportNotice(null), 3500);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <nav className="text-xs text-on-surface-variant flex items-center gap-1.5">
          <Link href="/" className="hover:text-primary">Início</Link>
          <span>/</span>
          <Link href="/painel/admin" className="hover:text-primary">Painel Admin</Link>
          <span>/</span>
          <span className="font-bold text-primary">Gestão de Comissões &amp; Take-Rate</span>
        </nav>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            {isDemoMode && (
              <div className="mb-1 flex items-center gap-2 flex-wrap">
                <DemoBadge compact />
              </div>
            )}
            <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface">
              Central de Comissões, Regras de Take-Rate &amp; Split
            </h1>
            <p className="text-xs sm:text-sm text-on-surface-variant">
              Parametrização dinâmica das alíquotas administrativas da plataforma (6%, 20% ou taxas customizadas).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/painel/admin#gestao-banners"
              className="px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary-container text-white text-xs font-bold transition-colors"
            >
              Gerenciar Banners &amp; Admin Master
            </Link>
            <span className="text-xs font-bold text-secondary bg-secondary-fixed/50 px-3 py-1.5 rounded-full flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">verified</span>
              Motor BACEN Regulado
            </span>
          </div>
        </div>
      </div>

      {isDemoMode && (
        <DidacticHint
          title="Indicadores e Relatórios Demonstrativos"
          text="Os números financeiros abaixo pertencem exclusivamente ao Ambiente Modelo para demonstrar como a plataforma calcula Take Rate e Split D+0."
        />
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 shadow-sm space-y-1">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-bold uppercase text-on-surface-variant block">GMV Transacionado</span>
            {isDemoMode && <DemoBadge compact />}
          </div>
          <span className="text-2xl font-extrabold text-primary block">
            R$ {summary.gmvTotalTransacionado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[11px] text-outline block">{summary.quantidadeTransacoes} arremates liquidados</span>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 shadow-sm space-y-1">
          <span className="text-xs font-bold uppercase text-on-surface-variant block">Receita de Comissões</span>
          <span className="text-2xl font-extrabold text-secondary block">
            R$ {summary.receitaTotalComissoes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[11px] text-secondary font-bold block">Take-Rate Efetivo: {summary.takeRateMedioEfetivo}%</span>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 shadow-sm space-y-1">
          <span className="text-xs font-bold uppercase text-on-surface-variant block">Repasses Líquidos à Indústria</span>
          <span className="text-2xl font-extrabold text-on-surface block">
            R$ {summary.totalRepassesFornecedores.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[11px] text-outline block">Via SPI / PIX Instantâneo D+0</span>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 shadow-sm space-y-1">
          <span className="text-xs font-bold uppercase text-on-surface-variant block">Saldo Retido em Escrow</span>
          <span className="text-2xl font-extrabold text-primary block">
            R$ {summary.totalEmCustodiaEscrow.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[11px] text-outline block">Aguardando conferência na doca</span>
        </div>
      </div>

      {/* Interactive Commission Engine Component */}
      <CommissionCalculator />

      {/* Financial Transactions & Commission Audit Table */}
      <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30 shadow-sm space-y-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-container pb-3">
          <div>
            <h3 className="font-extrabold text-base text-on-surface">
              Relatório Analítico de Comissões por Transação
            </h3>
            <span className="text-outline text-[11px]">Auditoria Fiduciária em Tempo Real</span>
          </div>
          <div className="flex items-center gap-2">
            {exportNotice && (
              <span className="text-[11px] font-bold text-secondary bg-secondary-container/30 px-2.5 py-1 rounded-lg">
                {exportNotice}
              </span>
            )}
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3.5 py-2 bg-primary hover:bg-primary-container text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              <span>Exportar Conciliação (.CSV)</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-surface-container-low text-on-surface-variant uppercase font-bold text-[10px]">
              <tr>
                <th className="p-3">Pedido</th>
                <th className="p-3">Lote / Descrição</th>
                <th className="p-3">Comprador</th>
                <th className="p-3">Fornecedor</th>
                <th className="p-3">Valor Bruto</th>
                <th className="p-3">Taxa (%)</th>
                <th className="p-3">Comissão Plataforma</th>
                <th className="p-3">Repasse Líquido</th>
                <th className="p-3">Custódia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-on-surface-variant">
                    Carregando transações conciliadas...
                  </td>
                </tr>
              ) : visibleOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-on-surface-variant">
                    Nenhuma transação registrada para apuração de comissão ainda.
                  </td>
                </tr>
              ) : (
                visibleOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-surface-container-low/50">
                    <td className="p-3 font-mono font-bold text-primary">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {(isDemoMode || order.isDemo) && <DemoBadge compact />}
                        <span>{order.codigoPedido}</span>
                      </div>
                    </td>
                    <td className="p-3 font-medium text-on-surface">
                      <Link href={`/leiloes/${order.loteId}`} className="hover:text-primary transition-colors">
                        {order.tituloLote}
                      </Link>
                    </td>
                    <td className="p-3 text-on-surface-variant">{order.compradorNome}</td>
                    <td className="p-3 text-on-surface-variant">{order.fornecedorNome}</td>
                    <td className="p-3 font-extrabold text-on-surface">
                      R$ {order.valorTotalArremate.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 font-extrabold text-primary">{order.percentualComissao}%</td>
                    <td className="p-3 font-extrabold text-secondary">
                      R$ {order.valorComissaoPlataforma.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 font-extrabold text-on-surface">
                      R$ {order.valorRepasseLiquidoFornecedor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          order.statusPagamento === 'em_custodia_escrow'
                            ? 'bg-primary-fixed text-on-primary-fixed'
                            : order.statusPagamento === 'em_disputa'
                            ? 'bg-tertiary-fixed text-on-tertiary-fixed'
                            : order.statusPagamento === 'estornado'
                            ? 'bg-error-container text-on-error-container'
                            : order.statusPagamento === 'aguardando_pagamento'
                            ? 'bg-surface-container-high text-on-surface'
                            : 'bg-secondary-fixed text-on-secondary-fixed'
                        }`}
                      >
                        {order.statusPagamento === 'em_custodia_escrow'
                          ? 'Retido Escrow'
                          : order.statusPagamento === 'em_disputa'
                          ? 'Em Disputa'
                          : order.statusPagamento === 'estornado'
                          ? 'Estornado'
                          : order.statusPagamento === 'aguardando_pagamento'
                          ? 'Aguardando PIX'
                          : 'Liquidado D+0'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
