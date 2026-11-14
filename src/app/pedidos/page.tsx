'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { MOCK_ORDERS } from '@/lib/mock-data';
import { EscrowOrder } from '@/lib/types';

export default function PedidosPage() {
  const [orders, setOrders] = useState<EscrowOrder[]>(MOCK_ORDERS);
  const [selectedOrderForDoca, setSelectedOrderForDoca] = useState<EscrowOrder | null>(null);
  const [selectedSlot, setSelectedSlot] = useState('10:00 - 11:00');
  const [placaCaminhao, setPlacaCaminhao] = useState('BRA-2E19');
  const [nomeMotorista, setNomeMotorista] = useState('Carlos Eduardo Silva');
  const [docaSuccess, setDocaSuccess] = useState(false);

  const handleAgendarDoca = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderForDoca) return;

    setOrders((prev) =>
      prev.map((o) =>
        o.id === selectedOrderForDoca.id
          ? {
              ...o,
              docaAgendada: `Doca 03A • CD Jundiaí (17/11 às ${selectedSlot} - Placa ${placaCaminhao})`,
              statusLogistica: 'em_transito_fob',
            }
          : o
      )
    );
    setDocaSuccess(true);
    setTimeout(() => {
      setDocaSuccess(false);
      setSelectedOrderForDoca(null);
    }, 2000);
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
                <h4 className="font-bold text-sm text-secondary">Doca Agendada com Sucesso!</h4>
                <p className="text-xs text-on-surface-variant">
                  Passe de entrada emitido para a placa <strong>{placaCaminhao}</strong> no horário <strong>{selectedSlot}</strong>.
                </p>
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

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedOrderForDoca(null)}
                    className="px-4 py-2 border rounded-xl font-bold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-primary text-white font-bold rounded-xl shadow-md"
                  >
                    Confirmar Agendamento
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
