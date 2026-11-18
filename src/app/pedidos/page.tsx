'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { EscrowOrder } from '@/lib/types';

export default function PedidosPage() {
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<EscrowOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);

  const [selectedOrderForDoca, setSelectedOrderForDoca] = useState<EscrowOrder | null>(null);
  const [selectedDoca, setSelectedDoca] = useState('Doca 03A');
  const [selectedDate, setSelectedDate] = useState(() =>
    new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0]
  );
  const [selectedSlot, setSelectedSlot] = useState('10:00 - 11:00');
  const [placaCaminhao, setPlacaCaminhao] = useState('');
  const [nomeMotorista, setNomeMotorista] = useState('');
  const [docaSubmitting, setDocaSubmitting] = useState(false);
  const [docaError, setDocaError] = useState<string | null>(null);
  const [docaSuccess, setDocaSuccess] = useState(false);
  const [passeHash, setPasseHash] = useState<string | null>(null);
  const [releasingOrderId, setReleasingOrderId] = useState<string | null>(null);
  const [selectedOrderForTermo, setSelectedOrderForTermo] = useState<EscrowOrder | null>(null);
  const [orderNotice, setOrderNotice] = useState<string | null>(null);
  const [disputeOrder, setDisputeOrder] = useState<EscrowOrder | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<
    | 'todos'
    | 'aguardando_pagamento'
    | 'em_custodia_escrow'
    | 'em_disputa'
    | 'repasse_liquidado_d0'
    | 'estornado'
  >('todos');

  const loadOrders = useCallback(async () => {
    try {
      const [ordersRes, docasRes] = await Promise.all([
        fetch('/api/pedidos', { cache: 'no-store' }),
        fetch('/api/docas', { cache: 'no-store' }),
      ]);

      if (ordersRes.status === 401) {
        setAuthRequired(true);
        setOrders([]);
        return;
      }

      const ordersData = ordersRes.ok ? await ordersRes.json() : null;
      const docasData = docasRes.ok ? await docasRes.json() : null;
      const baseOrders: EscrowOrder[] = Array.isArray(ordersData?.orders) ? ordersData.orders : [];
      const appointments = Array.isArray(docasData?.appointments) ? docasData.appointments : [];

      setAuthRequired(false);
      setOrders(
        baseOrders.map((order) => {
          const apt = appointments.find(
            (a: { pedidoId?: string; orderId?: string }) =>
              a.pedidoId === order.codigoPedido || a.orderId === order.id
          );
          if (!apt) return order;
          return {
            ...order,
            docaAgendada: `${apt.docaNumero} • ${apt.cdOrigem} (${apt.dataAgendada} às ${apt.janelaHoraria} • Placa ${apt.placaVeiculo} • ${apt.passeEntradaHash})`,
            statusLogistica:
              order.statusLogistica === 'entregue' || order.statusLogistica === 'conferido_doca'
                ? order.statusLogistica
                : 'em_transito_fob',
          };
        })
      );
    } catch {
      // keep state on transient error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setAuthRequired(true);
      setLoading(false);
      setOrders([]);
      return;
    }
    void loadOrders();
  }, [user, authLoading, loadOrders]);

  const handleAgendarDoca = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderForDoca) return;

    setDocaError(null);
    setDocaSubmitting(true);

    try {
      const res = await fetch('/api/docas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pedidoId: selectedOrderForDoca.codigoPedido,
          docaNumero: selectedDoca,
          dataAgendada: selectedDate,
          janelaHoraria: selectedSlot,
          placaVeiculo: placaCaminhao,
          motoristaNome: nomeMotorista,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setDocaError(data?.error || 'Não foi possível confirmar o agendamento da doca.');
        setDocaSubmitting(false);
        return;
      }

      const apt = data.appointment;
      setPasseHash(apt?.passeEntradaHash || null);

      setOrders((prev) =>
        prev.map((o) =>
          o.id === selectedOrderForDoca.id
            ? {
                ...o,
                docaAgendada: `${apt.docaNumero} • ${apt.cdOrigem} (${apt.dataAgendada} às ${apt.janelaHoraria} • Placa ${apt.placaVeiculo} • ${apt.passeEntradaHash})`,
                statusLogistica: 'em_transito_fob',
              }
            : o
        )
      );
      setDocaSubmitting(false);
      setDocaSuccess(true);
      setTimeout(() => {
        setDocaSuccess(false);
        setPasseHash(null);
        setSelectedOrderForDoca(null);
      }, 2400);
    } catch {
      setDocaError('Falha de comunicação com o servidor WMS. Tente novamente.');
      setDocaSubmitting(false);
    }
  };

  const handleConfirmDelivery = async (order: EscrowOrder) => {
    setReleasingOrderId(order.id);
    setOrderNotice(null);
    try {
      const res = await fetch('/api/pedidos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, action: 'confirm_delivery' }),
      });
      const data = await res.json();
      if (res.ok && data?.order) {
        setOrders((prev) => prev.map((o) => (o.id === order.id ? data.order : o)));
        setOrderNotice(
          `Recebimento FOB confirmado para ${order.codigoPedido}. Custódia Escrow liquidada D+0 ao fornecedor!`
        );
      } else {
        setOrderNotice(data?.error || 'Não foi possível liquidar a custódia Escrow neste pedido.');
      }
    } catch {
      setOrderNotice('Não foi possível confirmar a liberação D+0. Tente novamente.');
    } finally {
      setReleasingOrderId(null);
    }
  };

  const handleOpenDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeOrder || disputeReason.trim().length < 5) return;
    setDisputeSubmitting(true);
    try {
      const res = await fetch('/api/pedidos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: disputeOrder.id,
          action: 'open_dispute',
          reason: disputeReason.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data?.order) {
        setOrders((prev) => prev.map((o) => (o.id === disputeOrder.id ? data.order : o)));
        setOrderNotice(
          `Divergência protocolada para ${disputeOrder.codigoPedido}. O saldo Escrow foi bloqueado preventivamente para mediação.`
        );
        setDisputeOrder(null);
        setDisputeReason('');
      } else {
        setOrderNotice(data?.error || 'Não foi possível registrar a divergência.');
      }
    } catch {
      setOrderNotice('Falha de comunicação ao registrar divergência Escrow.');
    } finally {
      setDisputeSubmitting(false);
    }
  };

  const filteredOrders = orders.filter((o) =>
    statusFilter === 'todos' ? true : o.statusPagamento === statusFilter
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <nav className="text-xs text-on-surface-variant flex items-center gap-1.5">
          <Link href="/" className="hover:text-primary">Início</Link>
          <span>/</span>
          <span className="font-bold text-primary">Histórico de Pedidos &amp; Agendamento de Docas FOB</span>
        </nav>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface">
              Histórico de Pedidos &amp; Retiradas FOB
            </h1>
            <p className="text-xs sm:text-sm text-on-surface-variant">
              Acompanhe a custódia fiduciária escrow e agende a doca de retirada no Centro de Distribuição.
            </p>
          </div>
          <Link
            href="/catalogo"
            className="bg-primary hover:bg-primary-container text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">search</span>
            <span>Explorar Mais Lotes</span>
          </Link>
        </div>
      </div>

      {orderNotice && (
        <div className="p-3.5 bg-secondary-container/30 border border-secondary text-secondary font-bold text-xs rounded-xl flex items-center justify-between gap-2">
          <span>{orderNotice}</span>
          <button
            type="button"
            onClick={() => setOrderNotice(null)}
            className="text-secondary hover:underline text-[11px]"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {(
          [
            { id: 'todos', label: 'Todos' },
            { id: 'aguardando_pagamento', label: 'Aguardando PIX' },
            { id: 'em_custodia_escrow', label: 'Custódia Ativa' },
            { id: 'em_disputa', label: 'Em Disputa' },
            { id: 'repasse_liquidado_d0', label: 'Liquidados D+0' },
            { id: 'estornado', label: 'Estornados' },
          ] as const
        ).map((tab) => {
          const count =
            tab.id === 'todos'
              ? orders.length
              : orders.filter((o) => o.statusPagamento === tab.id).length;
          const active = statusFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors whitespace-nowrap ${
                active
                  ? 'bg-primary text-white border-primary shadow-sm'
                  : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/30 hover:text-on-surface'
              }`}
            >
              {tab.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-surface-container-lowest p-10 rounded-2xl border border-outline-variant/30 text-center space-y-2">
            <div className="w-8 h-8 rounded-full border-4 border-primary/20 border-t-primary animate-spin mx-auto" />
            <p className="text-xs font-bold text-on-surface-variant">
              Carregando ordens Escrow e agendamentos de doca...
            </p>
          </div>
        ) : authRequired ? (
          <div className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/30 text-center space-y-3">
            <span className="material-symbols-outlined text-primary text-4xl">lock</span>
            <h3 className="text-sm font-extrabold text-on-surface">
              Autentique-se para gerenciar pedidos e docas FOB
            </h3>
            <p className="text-xs text-on-surface-variant max-w-md mx-auto">
              Acesse com seu CNPJ para visualizar termos de arremate, agendar retirada e liberar custódia Escrow.
            </p>
            <Link
              href="/login?redirect=/pedidos"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-container text-white text-xs font-bold"
            >
              Entrar na Conta B2B
            </Link>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/30 text-center space-y-2">
            <span className="material-symbols-outlined text-outline text-3xl">local_shipping</span>
            <p className="text-sm font-bold text-on-surface">
              Nenhum pedido Escrow encontrado nesta categoria.
            </p>
            <Link href="/catalogo" className="inline-block text-xs font-bold text-primary hover:underline">
              Explorar lotes para arremate imediato
            </Link>
          </div>
        ) : (
          filteredOrders.map((order) => (
            <div
              key={order.id}
              className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30 shadow-sm space-y-4"
            >
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-surface-container pb-3">
                <div>
                  <span className="text-[10px] uppercase font-bold text-on-surface-variant">
                    {order.codigoPedido} • Arrematado em {new Date(order.criadoEm).toLocaleDateString('pt-BR')}
                  </span>
                  <h3 className="font-extrabold text-base text-on-surface">
                    <Link href={`/leiloes/${order.loteId}`} className="hover:text-primary transition-colors">
                      {order.tituloLote}
                    </Link>
                  </h3>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
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
                      ? 'Custódia Escrow Ativa'
                      : order.statusPagamento === 'em_disputa'
                      ? 'Em Disputa / Bloqueado'
                      : order.statusPagamento === 'estornado'
                      ? 'Estornado ao Comprador'
                      : order.statusPagamento === 'aguardando_pagamento'
                      ? 'Aguardando PIX'
                      : 'Liquidado D+0'}
                  </span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                      order.statusLogistica === 'entregue' ||
                      order.statusLogistica === 'conferido_doca'
                        ? 'bg-secondary-fixed text-on-secondary-fixed'
                        : 'bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    {order.statusLogistica === 'entregue'
                      ? 'Retirada Concluída'
                      : order.statusLogistica === 'conferido_doca'
                      ? 'Conferência Cega OK'
                      : order.statusLogistica === 'em_transito_fob'
                      ? 'Doca Confirmada'
                      : 'Aguardando Agendamento'}
                  </span>
                </div>
              </div>

              {/* Financial & Logistics Info */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-surface-container-low p-4 rounded-xl text-xs">
                <div>
                  <span className="text-on-surface-variant block">Fornecedor / Indústria:</span>
                  <strong className="text-on-surface">{order.fornecedorNome}</strong>
                </div>
                <div>
                  <span className="text-on-surface-variant block">Valor Total Arremate:</span>
                  <strong className="text-primary font-extrabold text-sm">
                    R$ {order.valorTotalArremate.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </strong>
                </div>
                <div>
                  <span className="text-on-surface-variant block">Comissão ({order.percentualComissao}%):</span>
                  <strong className="text-on-surface">
                    R$ {order.valorComissaoPlataforma.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </strong>
                </div>
                <div>
                  <span className="text-on-surface-variant block">Repasse Líquido Fornecedor:</span>
                  <strong className="text-secondary font-bold">
                    R$ {order.valorRepasseLiquidoFornecedor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </strong>
                </div>
              </div>

              {/* Dock status banner */}
              <div className="p-3 bg-surface-container-low rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">warehouse</span>
                  <div>
                    <span className="font-bold text-on-surface block">Status da Doca FOB:</span>
                    <span className="text-on-surface-variant">{order.docaAgendada || 'Doca não agendada'}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {order.statusPagamento === 'aguardando_pagamento' && (
                    <Link
                      href={`/checkout?orderId=${encodeURIComponent(order.id)}`}
                      className="px-4 py-2 bg-secondary hover:bg-secondary-container text-white hover:text-on-secondary-container font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">qr_code_2</span>
                      <span>Finalizar Pagamento PIX</span>
                    </Link>
                  )}

                  {order.statusLogistica === 'agendamento_doca' &&
                    order.statusPagamento === 'em_custodia_escrow' && (
                      <button
                        type="button"
                        onClick={() => setSelectedOrderForDoca(order)}
                        className="px-4 py-2 bg-primary hover:bg-primary-container text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[16px]">schedule</span>
                        <span>Agendar Doca de Retirada</span>
                      </button>
                    )}

                  {order.statusPagamento === 'em_custodia_escrow' &&
                    (order.statusLogistica === 'em_transito_fob' ||
                      order.statusLogistica === 'conferido_doca' ||
                      order.statusLogistica === 'entregue') && (
                      <button
                        type="button"
                        disabled={releasingOrderId === order.id}
                        onClick={() => void handleConfirmDelivery(order)}
                        className="px-4 py-2 bg-secondary hover:bg-secondary-container text-white hover:text-on-secondary-container font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[16px]">verified</span>
                        <span>
                          {releasingOrderId === order.id
                            ? 'Liquidando SPI D+0...'
                            : 'Confirmar Retirada & Liberar Escrow (D+0)'}
                        </span>
                      </button>
                    )}

                  {order.statusPagamento === 'em_custodia_escrow' && (
                    <button
                      type="button"
                      onClick={() => {
                        setDisputeOrder(order);
                        setDisputeReason('');
                      }}
                      className="px-3.5 py-2 bg-error-container/70 hover:bg-error-container text-on-error-container font-bold text-xs rounded-xl transition-all flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">report_problem</span>
                      <span>Abrir Divergência</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setSelectedOrderForTermo(order)}
                    className="px-3.5 py-2 bg-white hover:bg-surface-container text-on-surface border border-outline-variant/40 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px] text-primary">description</span>
                    <span>Ver Termo / DANFE</span>
                  </button>
                </div>
              </div>

              {order.motivoDisputa && (
                <div className="p-3 bg-error-container/30 border border-error/30 rounded-xl text-xs text-on-error-container">
                  <strong>Registro de Mediação Escrow:</strong> {order.motivoDisputa}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modal de Agendamento de Doca FOB */}
      {selectedOrderForDoca && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-container-lowest rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-outline-variant/30 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-surface-container pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[24px]">local_shipping</span>
                <div>
                  <h3 className="font-extrabold text-base text-on-surface">Agendamento de Doca FOB</h3>
                  <p className="text-xs text-on-surface-variant">Centro de Distribuição Jundiaí - SP (Doca 03A)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrderForDoca(null)}
                className="text-on-surface-variant hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {docaSuccess ? (
              <div className="p-6 bg-secondary-container/20 rounded-xl text-center space-y-2 border border-secondary/30">
                <span className="material-symbols-outlined text-secondary text-4xl">check_circle</span>
                <h4 className="font-bold text-sm text-secondary">Doca Agendada com Sucesso no WMS!</h4>
                <p className="text-xs text-on-surface-variant">
                  Passe de entrada emitido para a placa <strong>{placaCaminhao}</strong> no horário <strong>{selectedSlot}</strong>.
                </p>
                {passeHash && (
                  <p className="text-[11px] font-mono font-bold text-primary bg-white/80 inline-block px-3 py-1 rounded-lg border border-outline-variant/40">
                    Passe: {passeHash}
                  </p>
                )}
              </div>
            ) : (
              <form onSubmit={handleAgendarDoca} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-on-surface uppercase mb-1">Data da Retirada:</label>
                    <input
                      type="date"
                      min={new Date().toISOString().split('T')[0]}
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-full bg-surface-container-low px-3 py-2.5 rounded-xl border border-outline-variant/30 font-bold text-on-surface"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-on-surface uppercase mb-1">Doca do CD:</label>
                    <select
                      value={selectedDoca}
                      onChange={(e) => setSelectedDoca(e.target.value)}
                      className="w-full bg-surface-container-low px-3 py-2.5 rounded-xl border border-outline-variant/30 cursor-pointer font-bold text-on-surface"
                    >
                      <option value="Doca 03A">Doca 03A (Paletizada Padrão)</option>
                      <option value="Doca 03B">Doca 03B (Paletizada Padrão)</option>
                      <option value="Doca 01">Doca 01 (Giro Rápido)</option>
                      <option value="Doca 02 Refrigerada">Doca 02 (Cadeia Fria / Frios)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-on-surface uppercase mb-1">Janela Horária de Retirada:</label>
                  <select
                    value={selectedSlot}
                    onChange={(e) => setSelectedSlot(e.target.value)}
                    className="w-full bg-surface-container-low px-3 py-2.5 rounded-xl border border-outline-variant/30 cursor-pointer font-bold text-on-surface"
                  >
                    <option value="08:00 - 09:00">08:00 às 09:00</option>
                    <option value="10:00 - 11:00">10:00 às 11:00 (Recomendado)</option>
                    <option value="14:00 - 15:00">14:00 às 15:00</option>
                    <option value="16:00 - 17:00">16:00 às 17:00</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-on-surface uppercase mb-1">Placa do Veículo (Mercosul):</label>
                    <input
                      type="text"
                      value={placaCaminhao}
                      onChange={(e) => setPlacaCaminhao(e.target.value)}
                      placeholder="Ex: BRA2E19"
                      className="w-full bg-surface-container-low px-3 py-2 rounded-xl border border-outline-variant/30 uppercase font-mono font-bold"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-on-surface uppercase mb-1">Nome do Motorista:</label>
                    <input
                      type="text"
                      value={nomeMotorista}
                      onChange={(e) => setNomeMotorista(e.target.value)}
                      placeholder="Nome completo do motorista"
                      className="w-full bg-surface-container-low px-3 py-2 rounded-xl border border-outline-variant/30"
                      required
                    />
                  </div>
                </div>

                <div className="p-3 bg-surface-container-low rounded-xl text-[11px] text-on-surface-variant space-y-1">
                  <span className="font-bold text-on-surface block">Requisitos de Segurança na Doca:</span>
                  <p>• Obrigatório uso de EPI (colete refletivo, bota com biqueira de aço).</p>
                  <p>• Apresentação de DANFE e MDF-e na cancela de acesso.</p>
                </div>

                {docaError && (
                  <div className="p-2.5 bg-error-container text-on-error-container rounded-lg text-xs font-bold">
                    {docaError}
                  </div>
                )}

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDocaError(null);
                      setSelectedOrderForDoca(null);
                    }}
                    className="px-4 py-2 border rounded-xl font-bold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={docaSubmitting}
                    className="px-5 py-2 bg-primary text-white font-bold rounded-xl shadow-md disabled:opacity-50"
                  >
                    {docaSubmitting ? 'Homologando no WMS...' : 'Confirmar Agendamento'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal do Termo de Arremate / Dossiê Fiscal DANFE */}
      {selectedOrderForTermo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-container-lowest rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-outline-variant/30 space-y-4">
            <div className="flex items-center justify-between border-b border-surface-container pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[24px]">verified</span>
                <div>
                  <h3 className="font-extrabold text-base text-on-surface">
                    Termo de Arremate &amp; Dossiê Escrow WORM
                  </h3>
                  <p className="text-xs text-on-surface-variant font-mono">
                    Protocolo {selectedOrderForTermo.codigoPedido}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrderForTermo(null)}
                className="text-on-surface-variant hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs bg-surface-container-low p-4 rounded-xl border border-surface-container">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Objeto / Lote Arrematado:</span>
                <strong className="text-on-surface text-right">{selectedOrderForTermo.tituloLote}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Comprador Varejista:</span>
                <strong className="text-on-surface">{selectedOrderForTermo.compradorNome}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Indústria / Fornecedor:</span>
                <strong className="text-on-surface">{selectedOrderForTermo.fornecedorNome}</strong>
              </div>
              <div className="flex justify-between border-t border-surface-container pt-2">
                <span className="text-on-surface-variant">Valor Bruto Homologado:</span>
                <strong className="text-primary font-extrabold">
                  R$ {selectedOrderForTermo.valorTotalArremate.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">
                  Take Rate Plataforma ({selectedOrderForTermo.percentualComissao}%):
                </span>
                <strong className="text-on-surface">
                  R$ {selectedOrderForTermo.valorComissaoPlataforma.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Repasse Líquido Indústria:</span>
                <strong className="text-secondary font-bold">
                  R$ {selectedOrderForTermo.valorRepasseLiquidoFornecedor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </strong>
              </div>
              <div className="pt-2 border-t border-surface-container">
                <span className="text-on-surface-variant block mb-1">Doca / Logística FOB:</span>
                <span className="font-semibold text-on-surface">
                  {selectedOrderForTermo.docaAgendada || 'Aguardando agendamento de Doca FOB'}
                </span>
              </div>
              <div className="pt-2 border-t border-surface-container">
                <span className="text-on-surface-variant block mb-1">Selo Criptográfico WORM (SHA-256):</span>
                <code className="block bg-white px-2.5 py-1.5 rounded border border-outline-variant/30 font-mono text-[11px] text-primary break-all">
                  {selectedOrderForTermo.termoArremateHash || `SHA256:${selectedOrderForTermo.codigoPedido}`}
                </code>
              </div>
              {selectedOrderForTermo.comprovantePix && (
                <div className="pt-2 border-t border-surface-container">
                  <span className="text-on-surface-variant block mb-1">Comprovante PIX / TXID:</span>
                  <code className="block bg-secondary-container/20 px-2.5 py-1.5 rounded border border-secondary/30 font-mono text-[11px] text-secondary break-all">
                    {selectedOrderForTermo.comprovantePix}
                  </code>
                </div>
              )}
              {selectedOrderForTermo.motivoDisputa && (
                <div className="pt-2 border-t border-surface-container">
                  <span className="text-on-surface-variant block mb-1">Ocorrência / Mediação Escrow:</span>
                  <p className="bg-error-container/30 px-2.5 py-1.5 rounded border border-error/30 text-[11px] text-on-error-container">
                    {selectedOrderForTermo.motivoDisputa}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-primary hover:bg-primary-container text-white font-bold rounded-xl text-xs flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">print</span>
                <span>Imprimir / Salvar PDF</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedOrderForTermo(null)}
                className="px-4 py-2 border border-outline-variant/40 rounded-xl text-xs font-bold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Abertura de Divergência / Disputa Escrow */}
      {disputeOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-container-lowest rounded-2xl max-w-md w-full p-6 shadow-2xl border border-outline-variant/30 space-y-4">
            <div className="flex items-center justify-between border-b border-surface-container pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-error text-[22px]">gavel</span>
                <div>
                  <h3 className="font-extrabold text-base text-on-surface">
                    Bloqueio Preventivo Escrow
                  </h3>
                  <p className="text-xs text-on-surface-variant font-mono">
                    {disputeOrder.codigoPedido}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDisputeOrder(null)}
                className="text-on-surface-variant hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleOpenDispute} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-on-surface uppercase mb-1">
                  Descreva a divergência na conferência / carga:
                </label>
                <textarea
                  rows={3}
                  required
                  minLength={5}
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  placeholder="Ex: Divergência de quantidade na doca, avaria em 2 paletes ou data de validade abaixo do anunciado..."
                  className="w-full bg-surface-container-low px-3 py-2 rounded-xl border border-outline-variant/40 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDisputeOrder(null)}
                  className="px-4 py-2 border border-outline-variant/40 rounded-xl font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={disputeSubmitting || disputeReason.trim().length < 5}
                  className="px-4 py-2 bg-error text-white font-bold rounded-xl shadow-sm disabled:opacity-50"
                >
                  {disputeSubmitting ? 'Registrando...' : 'Bloquear Custódia & Abrir Disputa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
