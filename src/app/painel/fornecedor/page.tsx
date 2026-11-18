'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  CompanyProfileAndKycCard,
  NotificationsInboxCard,
} from '@/components/AccountGovernanceSection';
import { useAuth } from '@/components/AuthProvider';
import type { DockAppointment } from '@/lib/supabase/mappers';
import { AuctionLot, EscrowOrder, ProductCategory } from '@/lib/types';

export default function PainelFornecedorPage() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const [supplierLots, setSupplierLots] = useState<AuctionLot[]>([]);
  const [orders, setOrders] = useState<EscrowOrder[]>([]);
  const [appointments, setAppointments] = useState<DockAppointment[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [selectedSegment, setSelectedSegment] = useState<string>('todos');
  const [loading, setLoading] = useState(true);
  const [kycNotice, setKycNotice] = useState<string | null>(null);
  const [lotNotice, setLotNotice] = useState<string | null>(null);
  const [updatingLotId, setUpdatingLotId] = useState<string | null>(null);
  const [updatingDockId, setUpdatingDockId] = useState<string | null>(null);
  const [uploadingKyc, setUploadingKyc] = useState(false);
  const kycInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (authLoading) return;
    let active = true;

    const lotsUrl =
      user && profile?.role === 'fornecedor'
        ? `/api/lotes?fornecedorId=${encodeURIComponent(user.id)}`
        : '/api/lotes';

    Promise.all([
      fetch(lotsUrl, { cache: 'no-store' }).then((res) => (res.ok ? res.json() : null)),
      user
        ? fetch('/api/pedidos', { cache: 'no-store' }).then((res) => (res.ok ? res.json() : null))
        : Promise.resolve(null),
      user
        ? fetch('/api/docas', { cache: 'no-store' }).then((res) => (res.ok ? res.json() : null))
        : Promise.resolve(null),
      fetch('/api/categorias', { cache: 'no-store' }).then((res) => (res.ok ? res.json() : null)),
    ])
      .then(([lotesData, pedidosData, docasData, catsData]) => {
        if (!active) return;
        setSupplierLots(Array.isArray(lotesData?.lots) ? lotesData.lots : []);
        setOrders(Array.isArray(pedidosData?.orders) ? pedidosData.orders : []);
        setAppointments(Array.isArray(docasData?.appointments) ? docasData.appointments : []);
        setCategories(Array.isArray(catsData?.categories) ? catsData.categories : []);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user, profile?.role, authLoading]);

  const handleKycUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingKyc(true);
    setKycNotice(null);
    try {
      const formData = new FormData();
      formData.append('bucket', 'kyc-docs');
      formData.append('tipoDocumento', 'alvara_sanitario');
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        await refreshProfile();
        setKycNotice(`Alvará / Documento "${file.name}" enviado para validação sanitária no Storage.`);
      } else {
        setKycNotice(data?.error || 'Não foi possível enviar o documento KYC.');
      }
    } catch {
      setKycNotice('Falha ao enviar documento KYC.');
    } finally {
      setUploadingKyc(false);
      if (kycInputRef.current) kycInputRef.current.value = '';
    }
  };

  const handleLotAction = async (
    lot: AuctionLot,
    action: 'close_auction' | 'reactivate_auction' | 'extend_auction',
    extendHours?: number
  ) => {
    setUpdatingLotId(lot.id);
    setLotNotice(null);
    try {
      const res = await fetch('/api/lotes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loteId: lot.id,
          action,
          extendHours,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.lot) {
        setSupplierLots((prev) => prev.map((item) => (item.id === lot.id ? data.lot : item)));
        setLotNotice(data.message || `Lote ${lot.codigoLote} atualizado com sucesso.`);
      } else {
        setLotNotice(data?.error || 'Não foi possível atualizar o status do lote.');
      }
    } catch {
      setLotNotice('Falha de comunicação ao atualizar o lote.');
    } finally {
      setUpdatingLotId(null);
    }
  };

  const handleAdvanceDockStatus = async (
    apt: DockAppointment,
    nextStatus: 'em_doca' | 'conferido_cega' | 'liberado'
  ) => {
    setUpdatingDockId(apt.id);
    setLotNotice(null);
    try {
      const res = await fetch('/api/docas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId: apt.id,
          status: nextStatus,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.appointment) {
        setAppointments((prev) =>
          prev.map((item) => (item.id === apt.id ? data.appointment : item))
        );
        if (data.orderLogisticsStatus) {
          setOrders((prev) =>
            prev.map((o) =>
              o.codigoPedido === apt.pedidoId || o.id === apt.pedidoId
                ? { ...o, statusLogistica: data.orderLogisticsStatus }
                : o
            )
          );
        }
        setLotNotice(data.message || 'Status da doca FOB atualizado no WMS.');
      } else {
        setLotNotice(data?.error || 'Não foi possível atualizar o status da doca.');
      }
    } catch {
      setLotNotice('Falha de comunicação com o servidor WMS.');
    } finally {
      setUpdatingDockId(null);
    }
  };

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
              COCKPIT DA INDÚSTRIA &amp; FABRICANTE B2B
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface">
            {profile?.razaoSocial || profile?.nomeFantasia || 'Painel do Fornecedor B2B'}
          </h1>
          <p className="text-xs text-on-surface-variant font-mono mt-0.5">
            {profile
              ? `CNPJ: ${profile.cnpj} • Conta Escrow Segregada (${
                  profile.statusAprovacao === 'aprovado' ? 'Homologada' : 'Em Análise'
                }) • Liquidação D+0 SPI`
              : 'Faça login com conta fornecedora para gerir lotes e repasses.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {user && (
            <>
              <input
                ref={kycInputRef}
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                onChange={handleKycUpload}
                className="hidden"
              />
              <button
                type="button"
                disabled={uploadingKyc}
                onClick={() => kycInputRef.current?.click()}
                className="bg-surface-container-lowest hover:bg-surface-container border border-outline-variant/40 text-primary px-4 py-2.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">upload_file</span>
                <span>{uploadingKyc ? 'Enviando...' : 'Enviar Alvará / KYC'}</span>
              </button>
            </>
          )}
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

      {kycNotice && (
        <div className="p-3 rounded-xl bg-secondary-container/30 border border-secondary text-secondary text-xs font-bold flex items-center justify-between gap-2">
          <span>{kycNotice}</span>
          <button type="button" onClick={() => setKycNotice(null)} className="underline text-[11px]">
            Fechar
          </button>
        </div>
      )}

      {lotNotice && (
        <div className="p-3 rounded-xl bg-primary-fixed/30 border border-primary/40 text-primary text-xs font-bold flex items-center justify-between gap-2">
          <span>{lotNotice}</span>
          <button type="button" onClick={() => setLotNotice(null)} className="underline text-[11px]">
            Fechar
          </button>
        </div>
      )}

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
          <span className="text-[11px] text-on-surface-variant block">
            {profile?.endereco?.cidade || 'São Paulo'} • {profile?.endereco?.uf || 'SP'}
          </span>
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
          {categories.map((cat) => {
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
                <th className="p-3">Status</th>
                <th className="p-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-on-surface-variant">
                    Carregando lotes cadastrados...
                  </td>
                </tr>
              ) : supplierLots.filter((l) =>
                  selectedSegment === 'todos' ? true : l.produto.categoriaId === selectedSegment
                ).length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-on-surface-variant">
                    Nenhum lote encontrado para este filtro.{' '}
                    <Link href="/produtos/novo" className="text-primary font-bold hover:underline">
                      Publicar primeiro lote agora
                    </Link>
                  </td>
                </tr>
              ) : (
                supplierLots
                  .filter((l) => (selectedSegment === 'todos' ? true : l.produto.categoriaId === selectedSegment))
                  .map((lot) => {
                    const catName =
                      categories.find((c) => c.id === lot.produto.categoriaId)?.nome || 'Geral B2B';
                    const isHomologado = lot.status === 'homologado';
                    const isEncerrado = lot.status === 'encerrado';
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
                          <span className="text-[10px] text-on-surface-variant font-normal block">
                            {lot.totalLances} lance(s)
                          </span>
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase ${
                              isHomologado
                                ? 'bg-secondary-fixed text-on-secondary-fixed'
                                : isEncerrado
                                ? 'bg-surface-container-high text-outline'
                                : 'bg-primary-fixed text-on-primary-fixed'
                            }`}
                          >
                            {lot.status}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Link
                              href={`/leiloes/${lot.id}`}
                              className="px-2.5 py-1 rounded-lg bg-primary hover:bg-primary-container text-white font-bold text-[11px] inline-block transition-colors"
                            >
                              Monitorar
                            </Link>
                            {!isHomologado && (
                              <>
                                <button
                                  type="button"
                                  disabled={updatingLotId === lot.id}
                                  onClick={() => void handleLotAction(lot, 'extend_auction', 24)}
                                  className="px-2.5 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary font-bold text-[11px] disabled:opacity-50"
                                >
                                  +24h
                                </button>
                                {isEncerrado ? (
                                  <button
                                    type="button"
                                    disabled={updatingLotId === lot.id}
                                    onClick={() => void handleLotAction(lot, 'reactivate_auction')}
                                    className="px-2.5 py-1 rounded-lg bg-secondary hover:bg-secondary-container text-white hover:text-on-secondary-container font-bold text-[11px] disabled:opacity-50"
                                  >
                                    Reativar
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={updatingLotId === lot.id}
                                    onClick={() => void handleLotAction(lot, 'close_auction')}
                                    className="px-2.5 py-1 rounded-lg bg-error-container/70 hover:bg-error-container text-on-error-container font-bold text-[11px] disabled:opacity-50"
                                  >
                                    Encerrar
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Agenda de Retiradas FOB & Pedidos Escrow */}
      <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30 shadow-sm space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-surface-container pb-3">
          <h3 className="font-extrabold text-base text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">local_shipping</span>
            Agenda de Retiradas FOB &amp; Pedidos Escrow
          </h3>
          <Link href="/pedidos" className="text-xs text-primary font-bold hover:underline">
            Ver histórico completo
          </Link>
        </div>

        {orders.length === 0 ? (
          <p className="text-on-surface-variant py-6 text-center">
            Nenhum pedido Escrow ou agendamento de doca registrado para seus lotes ainda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-surface-container-low text-on-surface-variant uppercase font-bold text-[10px]">
                <tr>
                  <th className="p-3">Pedido</th>
                  <th className="p-3">Lote / Comprador</th>
                  <th className="p-3">Repasse Líquido</th>
                  <th className="p-3">Status Escrow</th>
                  <th className="p-3">Doca &amp; Veículo Agendado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container">
                {orders.map((order) => {
                  const apt = appointments.find(
                    (a) => a.pedidoId === order.codigoPedido || a.pedidoId === order.id
                  );
                  return (
                    <tr key={order.id} className="hover:bg-surface-container-low/50">
                      <td className="p-3 font-mono font-bold text-primary">{order.codigoPedido}</td>
                      <td className="p-3">
                        <strong className="text-on-surface block">{order.tituloLote}</strong>
                        <span className="text-[10px] text-on-surface-variant">
                          Comprador: {order.compradorNome}
                        </span>
                      </td>
                      <td className="p-3 font-extrabold text-secondary">
                        R$ {order.valorRepasseLiquidoFornecedor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase ${
                            order.statusPagamento === 'repasse_liquidado_d0'
                              ? 'bg-secondary-fixed text-on-secondary-fixed'
                              : order.statusPagamento === 'em_custodia_escrow'
                              ? 'bg-primary-fixed text-on-primary-fixed'
                              : order.statusPagamento === 'em_disputa'
                              ? 'bg-tertiary-fixed text-on-tertiary-fixed'
                              : order.statusPagamento === 'estornado'
                              ? 'bg-error-container text-on-error-container'
                              : 'bg-surface-container-high text-on-surface'
                          }`}
                        >
                          {order.statusPagamento}
                        </span>
                      </td>
                      <td className="p-3 text-on-surface-variant">
                        {apt ? (
                          <div className="space-y-1.5">
                            <div>
                              <strong className="text-on-surface block">
                                {apt.docaNumero} • {apt.dataAgendada} ({apt.janelaHoraria})
                              </strong>
                              <span className="text-[10px] font-mono block">
                                Placa {apt.placaVeiculo} • {apt.motoristaNome} • {apt.passeEntradaHash}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded bg-surface-container text-[10px] font-bold uppercase text-primary">
                                WMS: {apt.status.replace('_', ' ')}
                              </span>
                              {apt.status === 'agendado' && (
                                <button
                                  type="button"
                                  disabled={updatingDockId === apt.id}
                                  onClick={() => void handleAdvanceDockStatus(apt, 'em_doca')}
                                  className="px-2 py-0.5 rounded bg-primary text-white text-[10px] font-bold disabled:opacity-50"
                                >
                                  Check-in Doca
                                </button>
                              )}
                              {apt.status === 'em_doca' && (
                                <button
                                  type="button"
                                  disabled={updatingDockId === apt.id}
                                  onClick={() => void handleAdvanceDockStatus(apt, 'conferido_cega')}
                                  className="px-2 py-0.5 rounded bg-primary text-white text-[10px] font-bold disabled:opacity-50"
                                >
                                  Conferência Cega
                                </button>
                              )}
                              {apt.status === 'conferido_cega' && (
                                <button
                                  type="button"
                                  disabled={updatingDockId === apt.id}
                                  onClick={() => void handleAdvanceDockStatus(apt, 'liberado')}
                                  className="px-2 py-0.5 rounded bg-secondary text-white text-[10px] font-bold disabled:opacity-50"
                                >
                                  Liberar Portaria
                                </button>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span>{order.docaAgendada || 'Aguardando agendamento pelo comprador'}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Central de Alertas & Dados Cadastrais / KYC */}
      <NotificationsInboxCard />
      <CompanyProfileAndKycCard />
    </div>
  );
}

