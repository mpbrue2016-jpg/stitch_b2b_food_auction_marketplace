'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { MOCK_ORDERS } from '@/lib/mock-data';
import { EscrowOrder } from '@/lib/types';

export default function PedidosPage() {
  const [orders, setOrders] = useState<EscrowOrder[]>(MOCK_ORDERS);
  const [selectedOrderForDoca, setSelectedOrderForDoca] = useState<EscrowOrder | null>(null);
  const [selectedSlot, setSelectedSlot] = useState('10:00 - 11:00');
  const [placaCaminhao, setPlacaCaminhao] = useState('BRA-2E19');
  const [nomeMotorista, setNomeMotorista] = useState('Carlos Eduardo Silva');
  const [docaSubmitting, setDocaSubmitting] = useState(false);
  const [docaError, setDocaError] = useState<string | null>(null);
  const [docaSuccess, setDocaSuccess] = useState(false);
  const [passeHash, setPasseHash] = useState<string | null>(null);
  const [releasingOrderId, setReleasingOrderId] = useState<string | null>(null);
  const [selectedOrderForTermo, setSelectedOrderForTermo] = useState<EscrowOrder | null>(null);
  const [orderNotice, setOrderNotice] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/pedidos').then((res) => (res.ok ? res.json() : null)),
      fetch('/api/docas').then((res) => (res.ok ? res.json() : null)),
    ])
      .then(([ordersData, docasData]) => {
        const baseOrders: EscrowOrder[] = ordersData?.orders?.length ? ordersData.orders : MOCK_ORDERS;
        const appointments = docasData?.appointments || [];
        setOrders(
          baseOrders.map((order) => {
            const apt = appointments.find(
              (a: { pedidoId: string }) => a.pedidoId === order.codigoPedido
            );
            if (!apt) return order;
            return {
              ...order,
              docaAgendada: `${apt.docaNumero} • ${apt.cdOrigem} (${apt.dataAgendada} às ${apt.janelaHoraria} • Placa ${apt.placaVeiculo} • ${apt.passeEntradaHash})`,
              statusLogistica: order.statusLogistica === 'entregue' ? 'entregue' : 'em_transito_fob',
            };
          })
        );
      })
      .catch(() => {});
  }, []);

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
      }
    } catch {
      setOrderNotice('Não foi possível confirmar a liberação D+0. Tente novamente.');
    } finally {
      setReleasingOrderId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <nav className="text-xs text-on-surface-variant flex items-center gap-1.5">
          <Link href="/" className="hover:text-primary">Início</Link>
          <span>/</span>
          <span className="font-bold text-primary">Histórico de Pedidos & Agendamento de Docas FOB</span>
        </nav>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface">
              Histórico de Pedidos & Retiradas FOB
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

      {/* Orders List */}
      <div className="space-y-4">
        {orders.map((order) => (
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
                <h3 className="font-extrabold text-base text-on-surface">{order.tituloLote}</h3>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                    order.statusPagamento === 'em_custodia_escrow'
                      ? 'bg-primary-fixed text-on-primary-fixed'
                      : 'bg-secondary-fixed text-on-secondary-fixed'
                  }`}
                >
                  {order.statusPagamento === 'em_custodia_escrow'
                    ? 'Custódia Escrow Ativa'
                    : 'Liquidado D+0'}
                </span>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                    order.statusLogistica === 'entregue'
                      ? 'bg-secondary-fixed text-on-secondary-fixed'
                      : 'bg-surface-container text-on-surface-variant'
                  }`}
                >
                  {order.statusLogistica === 'entregue'
                    ? 'Retirada Concluída'
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
                {order.statusLogistica === 'agendamento_doca' && (
                  <button
                    type="button"
                    onClick={() => setSelectedOrderForDoca(order)}
                    className="px-4 py-2 bg-primary hover:bg-primary-container text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">schedule</span>
                    <span>Agendar Doca de Retirada</span>
                  </button>
                )}

                {order.statusLogistica !== 'entregue' &&
                  order.statusPagamento === 'em_custodia_escrow' &&
                  order.statusLogistica === 'em_transito_fob' && (
                    <button
                      type="button"
                      disabled={releasingOrderId === order.id}
                      onClick={() => handleConfirmDelivery(order)}
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
          </div>
        ))}
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
                <div>
                  <label className="block font-bold text-on-surface uppercase mb-1">Janela Horária de Retirada:</label>
                  <select
                    value={selectedSlot}
                    onChange={(e) => setSelectedSlot(e.target.value)}
                    className="w-full bg-surface-container-low px-3 py-2.5 rounded-xl border border-outline-variant/30 cursor-pointer font-bold text-on-surface"
                  >
                    <option value="08:00 - 09:00">08:00 às 09:00 (Doca 03A - Livre)</option>
                    <option value="10:00 - 11:00">10:00 às 11:00 (Doca 03A - Recomendado)</option>
                    <option value="14:00 - 15:00">14:00 às 15:00 (Doca 03B - Livre)</option>
                    <option value="16:00 - 17:00">16:00 às 17:00 (Doca 01 - Giro Rápido)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-on-surface uppercase mb-1">Placa do Veículo (Mercosul):</label>
                    <input
                      type="text"
                      value={placaCaminhao}
                      onChange={(e) => setPlacaCaminhao(e.target.value)}
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
                    Termo de Arremate & Dossiê Escrow WORM
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
    </div>
  );
}
