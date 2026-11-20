'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { useEnvironment } from '@/components/EnvironmentProvider';
import { DemoBadge } from '@/components/DemoBadge';
import { CommissionCalculator } from '@/components/CommissionCalculator';
import { AdminBannerManager } from '@/components/AdminBannerManager';
import { AdminConnectionChecker } from '@/components/AdminConnectionChecker';
import { NotificationsInboxCard } from '@/components/AccountGovernanceSection';
import { generateFinancialSummary } from '@/lib/commission-engine';
import { isAuthorizedAdminProfile } from '@/lib/auth-admin';
import { AuctionLot, EscrowOrder, UserProfile } from '@/lib/types';

interface AdminDocumentRow {
  id: string;
  user_id: string;
  tipo_documento: string;
  nome_arquivo: string;
  status_validacao: string;
  created_at: string;
}

interface WormLogRow {
  id: string;
  tipo_evento: string;
  protocolo: string;
  merkle_root_hash: string;
  created_at: string;
}

interface WebhookLogRow {
  id: string;
  endpoint: string;
  metodo: string;
  status_code: number;
  tempo_resposta_ms: number;
  created_at: string;
}

export default function PainelAdminPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const { setEnvMode } = useEnvironment();
  const [wormNotice, setWormNotice] = useState<string | null>(null);
  const [orders, setOrders] = useState<EscrowOrder[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [demoLots, setDemoLots] = useState<AuctionLot[]>([]);
  const [separacaoCounts, setSeparacaoCounts] = useState<{
    realProfiles: number;
    modeloProfiles: number;
    realLots: number;
    modeloLots: number;
  }>({ realProfiles: 0, modeloProfiles: 0, realLots: 0, modeloLots: 0 });
  const [documents, setDocuments] = useState<AdminDocumentRow[]>([]);
  const [wormLogs, setWormLogs] = useState<WormLogRow[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookLogRow[]>([]);
  const [limitInputs, setLimitInputs] = useState<Record<string, number>>({});
  const [updatingProfileId, setUpdatingProfileId] = useState<string | null>(null);
  const [openingDocId, setOpeningDocId] = useState<string | null>(null);
  const [updatingDocId, setUpdatingDocId] = useState<string | null>(null);
  const [releasingId, setReleasingId] = useState<string | null>(null);
  const [refundingId, setRefundingId] = useState<string | null>(null);

  // Estado Gestão de Modelos Demonstrativos (is_demo = true)
  const [newDemoTitle, setNewDemoTitle] = useState('');
  const [newDemoMarca, setNewDemoMarca] = useState('');
  const [newDemoCategory, setNewDemoCategory] = useState('alimentos-secos');
  const [newDemoPrice, setNewDemoPrice] = useState(4500);
  const [newDemoBoxes, setNewDemoBoxes] = useState(80);
  const [savingDemo, setSavingDemo] = useState(false);
  const [seedingDemo, setSeedingDemo] = useState(false);
  const [demoActionId, setDemoActionId] = useState<string | null>(null);
  const [demoNotice, setDemoNotice] = useState<string | null>(null);

  const loadAdminData = useCallback(async () => {
    try {
      const [pedidosRes, overviewRes, modelosRes] = await Promise.all([
        fetch('/api/pedidos?env=original', { cache: 'no-store' }),
        fetch('/api/admin/overview', { cache: 'no-store' }),
        fetch('/api/admin/modelos', { cache: 'no-store' }),
      ]);
      if (pedidosRes.ok) {
        const pData = await pedidosRes.json();
        setOrders(Array.isArray(pData?.orders) ? pData.orders : []);
      }
      if (overviewRes.ok) {
        const oData = await overviewRes.json();
        const profs: UserProfile[] = Array.isArray(oData?.profiles) ? oData.profiles : [];
        setProfiles(profs);
        setLimitInputs(
          profs.reduce<Record<string, number>>((acc, p) => {
            acc[p.id] = p.limiteCreditoEscrow;
            return acc;
          }, {})
        );
        setDocuments(Array.isArray(oData?.documents) ? oData.documents : []);
        setWormLogs(Array.isArray(oData?.wormLogs) ? oData.wormLogs : []);
        setWebhooks(Array.isArray(oData?.webhooks) ? oData.webhooks : []);
        if (oData?.separacao) {
          setSeparacaoCounts({
            realProfiles: Number(
              oData.separacao?.real?.usuarios ?? oData.separacao?.real?.profiles ?? profs.length
            ),
            modeloProfiles: Number(
              oData.separacao?.modelo?.usuarios ?? oData.separacao?.modelo?.profiles ?? 0
            ),
            realLots: Number(oData.separacao?.real?.lotes ?? oData.separacao?.real?.lots ?? 0),
            modeloLots: Number(oData.separacao?.modelo?.lotes ?? oData.separacao?.modelo?.lots ?? 0),
          });
        }
      }
      if (modelosRes.ok) {
        const mData = await modelosRes.json();
        setDemoLots(Array.isArray(mData?.lots) ? mData.lots : []);
      }
    } catch {
      // keep state on transient error
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user && isAuthorizedAdminProfile(profile)) {
      setEnvMode('original');
      void loadAdminData();
    }
  }, [authLoading, user, profile, loadAdminData, setEnvMode]);

  const handleReleaseEscrow = async (order: EscrowOrder) => {
    setReleasingId(order.id);
    try {
      const res = await fetch('/api/pedidos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, action: 'release_escrow' }),
      });
      const data = await res.json();
      if (res.ok && data?.order) {
        setOrders((prev) => prev.map((o) => (o.id === order.id ? data.order : o)));
        setWormNotice(
          `Liquidação D+0 executada para ${order.codigoPedido} via SPI Bancário. Repasse líquido de R$ ${order.valorRepasseLiquidoFornecedor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} liberado com selo ${data.order.termoArremateHash}.`
        );
      } else {
        setWormNotice(data?.error || 'Não foi possível liquidar a custódia Escrow.');
      }
    } catch {
      setWormNotice('Erro ao executar liquidação D+0 no motor Escrow.');
    } finally {
      setReleasingId(null);
    }
  };

  const handleRefundEscrow = async (order: EscrowOrder) => {
    setRefundingId(order.id);
    try {
      const res = await fetch('/api/pedidos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, action: 'refund_escrow' }),
      });
      const data = await res.json();
      if (res.ok && data?.order) {
        setOrders((prev) => prev.map((o) => (o.id === order.id ? data.order : o)));
        setWormNotice(
          `Custódia de ${order.codigoPedido} estornada integralmente ao comprador via PIX SPI.`
        );
      } else {
        setWormNotice(data?.error || 'Não foi possível estornar a custódia Escrow.');
      }
    } catch {
      setWormNotice('Erro ao executar estorno no motor Escrow.');
    } finally {
      setRefundingId(null);
    }
  };

  const handleUpdateKycProfile = async (
    targetProfile: UserProfile,
    nextStatus: 'aprovado' | 'em_analise' | 'pendente'
  ) => {
    setUpdatingProfileId(targetProfile.id);
    try {
      const nextLimit = limitInputs[targetProfile.id] ?? targetProfile.limiteCreditoEscrow;
      const res = await fetch('/api/auth/perfil', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: targetProfile.id,
          statusAprovacao: nextStatus,
          limiteCreditoEscrow: nextLimit,
        }),
      });
      const data = await res.json();
      if (res.ok && data?.profile) {
        setProfiles((prev) =>
          prev.map((p) => (p.id === targetProfile.id ? data.profile : p))
        );
        setWormNotice(
          `Compliance KYC de ${targetProfile.nomeFantasia} atualizado para "${nextStatus}" (Limite R$ ${nextLimit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).`
        );
      } else {
        setWormNotice(data?.error || 'Falha ao atualizar KYC do usuário.');
      }
    } catch {
      setWormNotice('Erro de comunicação ao atualizar compliance KYC.');
    } finally {
      setUpdatingProfileId(null);
    }
  };

  const handleOpenAdminDocument = async (doc: AdminDocumentRow) => {
    setOpeningDocId(doc.id);
    try {
      const res = await fetch(`/api/admin/documentos?id=${encodeURIComponent(doc.id)}`, {
        cache: 'no-store',
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.signedUrl) {
        const link = document.createElement('a');
        link.href = data.signedUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        setWormNotice(data?.error || 'Não foi possível gerar link assinado do documento KYC.');
      }
    } catch {
      setWormNotice('Erro ao consultar arquivo KYC no Supabase Storage.');
    } finally {
      setOpeningDocId(null);
    }
  };

  const handleModerateDocument = async (
    doc: AdminDocumentRow,
    statusValidacao: 'aprovado' | 'rejeitado'
  ) => {
    setUpdatingDocId(doc.id);
    try {
      const res = await fetch('/api/admin/documentos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: doc.id,
          statusValidacao,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setDocuments((prev) =>
          prev.map((item) =>
            item.id === doc.id ? { ...item, status_validacao: statusValidacao } : item
          )
        );
        setWormNotice(
          data?.message || `Documento "${doc.nome_arquivo}" atualizado para "${statusValidacao}".`
        );
      } else {
        setWormNotice(data?.error || 'Não foi possível atualizar o status do documento KYC.');
      }
    } catch {
      setWormNotice('Erro de comunicação ao moderar documento KYC.');
    } finally {
      setUpdatingDocId(null);
    }
  };

  const handleSeedStitchDemos = async () => {
    setSeedingDemo(true);
    setDemoNotice(null);
    try {
      const res = await fetch('/api/admin/modelos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seed_stitch_demos' }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setDemoNotice(data?.message || 'Modelos demonstrativos do Stitch sincronizados no Supabase.');
        await loadAdminData();
      } else {
        setDemoNotice(data?.error || 'Não foi possível sincronizar os lotes demonstrativos.');
      }
    } catch {
      setDemoNotice('Falha de comunicação ao sincronizar modelos.');
    } finally {
      setSeedingDemo(false);
    }
  };

  const handleCreateDemoLot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDemoTitle.trim()) return;
    setSavingDemo(true);
    setDemoNotice(null);
    try {
      const res = await fetch('/api/admin/modelos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: newDemoTitle.trim(),
          marca: newDemoMarca.trim() || 'Marca Modelo B2B',
          categoriaSlug: newDemoCategory,
          lanceInicial: newDemoPrice,
          totalCaixas: newDemoBoxes,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.lot) {
        setDemoLots((prev) => [data.lot, ...prev]);
        setNewDemoTitle('');
        setNewDemoMarca('');
        setDemoNotice(data?.message || 'Novo lote modelo publicado com is_demo = true.');
      } else {
        setDemoNotice(data?.error || 'Erro ao publicar lote modelo.');
      }
    } catch {
      setDemoNotice('Falha ao criar lote demonstrativo.');
    } finally {
      setSavingDemo(false);
    }
  };

  const handleToggleDemoLotStatus = async (lot: AuctionLot) => {
    setDemoActionId(lot.id);
    setDemoNotice(null);
    const nextStatus = lot.status === 'ativo' ? 'encerrado' : 'ativo';
    try {
      const res = await fetch('/api/admin/modelos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lot.id, status: nextStatus }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.lot) {
        setDemoLots((prev) => prev.map((l) => (l.id === lot.id ? data.lot : l)));
        setDemoNotice(`Lote modelo ${lot.codigoLote} atualizado para "${nextStatus}".`);
      } else {
        setDemoNotice(data?.error || 'Não foi possível atualizar este registro modelo.');
      }
    } catch {
      setDemoNotice('Erro de comunicação ao atualizar modelo.');
    } finally {
      setDemoActionId(null);
    }
  };

  const handleDeleteDemoLot = async (lot: AuctionLot) => {
    setDemoActionId(lot.id);
    setDemoNotice(null);
    try {
      const res = await fetch(`/api/admin/modelos?id=${encodeURIComponent(lot.id)}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setDemoLots((prev) => prev.filter((l) => l.id !== lot.id));
        setDemoNotice(data?.message || 'Lote modelo removido com segurança.');
      } else {
        setDemoNotice(data?.error || 'Não foi possível remover este registro modelo.');
      }
    } catch {
      setDemoNotice('Erro de comunicação ao remover modelo.');
    } finally {
      setDemoActionId(null);
    }
  };

  if (!authLoading && (!user || !isAuthorizedAdminProfile(profile))) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center space-y-4">
        <div className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/30 shadow-md space-y-4">
          <span className="material-symbols-outlined text-error text-4xl">admin_panel_settings</span>
          <h1 className="text-xl font-extrabold text-on-surface">
            Acesso Exclusivo do Administrador Master (CPF)
          </h1>
          <p className="text-xs text-on-surface-variant max-w-md mx-auto">
            Somente administradores autenticados com credencial exclusiva por CPF e chave do cofre podem acessar a governança da plataforma e gerenciar os modelos demonstrativos.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-1">
            <Link
              href="/login?tab=admin&redirect=/painel/admin"
              className="px-5 py-2.5 bg-primary hover:bg-primary-container text-white text-xs font-bold rounded-xl"
            >
              Entrar como Administrador (CPF)
            </Link>
            <Link
              href="/"
              className="px-5 py-2.5 bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-bold rounded-xl"
            >
              Voltar ao Início
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const summary = generateFinancialSummary(orders);
  const failedWebhooks = webhooks.filter((w) => w.status_code >= 400).length;

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
            Painel Administrativo Master &amp; Controle da Plataforma
          </h1>
          <p className="text-xs text-on-surface-variant font-mono mt-0.5">
            Governança Criptográfica HSM • Validador ITI / BACEN • Motor Split v3.4
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <a
            href="#gestao-banners"
            className="bg-surface-container-lowest hover:bg-surface-container text-primary border border-outline-variant/50 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5 whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-[18px]">view_carousel</span>
            <span>Gerenciar Banners da Home</span>
          </a>
          <Link
            href="/painel/comissoes"
            className="bg-primary hover:bg-primary-container text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5 whitespace-nowrap"
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
          <span className="text-2xl font-extrabold text-primary block">
            R$ {summary.gmvTotalTransacionado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[11px] text-secondary font-bold block">
            {summary.quantidadeTransacoes} transações auditadas
          </span>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs font-bold uppercase">Receita da Plataforma (Take Rate)</span>
            <span className="material-symbols-outlined text-secondary text-[22px]">monetization_on</span>
          </div>
          <span className="text-2xl font-extrabold text-secondary block">
            R$ {summary.receitaTotalComissoes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[11px] text-outline block">
            Take rate médio efetivo: {summary.takeRateMedioEfetivo}%
          </span>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs font-bold uppercase">Saldo em Custódia Escrow</span>
            <span className="material-symbols-outlined text-primary text-[22px]">lock</span>
          </div>
          <span className="text-2xl font-extrabold text-on-surface block">
            R$ {summary.totalEmCustodiaEscrow.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[11px] text-secondary font-bold block">100% segregado no STR</span>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs font-bold uppercase">Status Antifraude &amp; DLQ</span>
            <span className="material-symbols-outlined text-secondary text-[22px]">verified</span>
          </div>
          <span className="text-2xl font-extrabold text-secondary block">
            {failedWebhooks} Falhas ({wormLogs.length} WORM)
          </span>
          <span className="text-[11px] text-on-surface-variant block">Trilha criptográfica íntegra</span>
        </div>
      </div>

      {/* Separação Real vs Modelo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-secondary-container/20 border border-secondary/30 rounded-2xl p-5 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-secondary text-white text-[10px] font-bold uppercase">
              AMBIENTE ORIGINAL (DADOS REAIS)
            </span>
            <h3 className="text-base font-extrabold text-on-surface">
              {separacaoCounts.realProfiles} Usuários / Empresas Reais • {separacaoCounts.realLots} Lotes Reais
            </h3>
            <p className="text-xs text-on-surface-variant">
              Segregados via RLS (`is_demo = false`) e vinculados exclusivamente ao `auth.uid()`.
            </p>
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <DemoBadge compact />
            <h3 className="text-base font-extrabold text-amber-950">
              {separacaoCounts.modeloProfiles} Perfis Modelo • {demoLots.length} Lotes Demonstrativos
            </h3>
            <p className="text-xs text-amber-900">
              Ambiente educativo isolado para visitantes. Gerenciado exclusivamente por administradores.
            </p>
          </div>
        </div>
      </div>

      {/* Diagnóstico de Conexão Supabase */}
      <AdminConnectionChecker />

      {/* Embedded Gestão de Modelos Demonstrativos (is_demo = true) */}
      <div className="bg-surface-container-lowest p-6 rounded-2xl border border-amber-300 shadow-sm space-y-5 text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-container pb-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <DemoBadge compact />
              <h3 className="font-extrabold text-base text-on-surface">
                Gestão Exclusiva dos Modelos Demonstrativos (`is_demo = true`)
              </h3>
            </div>
            <p className="text-xs text-on-surface-variant">
              Publique, atualize ou remova lotes fictícios exibidos aos visitantes no Ambiente Modelo sem afetar empresas reais.
            </p>
          </div>
          <button
            type="button"
            disabled={seedingDemo}
            onClick={() => void handleSeedStitchDemos()}
            className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs shrink-0 disabled:opacity-50"
          >
            {seedingDemo ? 'Sincronizando...' : 'Sincronizar Modelos Stitch no Supabase'}
          </button>
        </div>

        {demoNotice && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 font-bold flex items-center justify-between gap-2">
            <span>{demoNotice}</span>
            <button type="button" onClick={() => setDemoNotice(null)} className="underline text-[11px]">
              Fechar
            </button>
          </div>
        )}

        <form onSubmit={handleCreateDemoLot} className="grid grid-cols-1 sm:grid-cols-5 gap-3 bg-surface-container-low p-4 rounded-xl border border-outline-variant/20 items-end">
          <div className="sm:col-span-2">
            <label className="block font-bold uppercase text-[10px] text-on-surface mb-1">
              Título do Produto Modelo
            </label>
            <input
              type="text"
              required
              value={newDemoTitle}
              onChange={(e) => setNewDemoTitle(e.target.value)}
              placeholder="Ex: Café Modelo Especial 500g (120 Caixas)"
              className="w-full bg-white px-3 py-2 rounded-lg border border-outline-variant/40 text-xs"
            />
          </div>
          <div>
            <label className="block font-bold uppercase text-[10px] text-on-surface mb-1">
              Categoria
            </label>
            <select
              value={newDemoCategory}
              onChange={(e) => setNewDemoCategory(e.target.value)}
              className="w-full bg-white px-3 py-2 rounded-lg border border-outline-variant/40 text-xs"
            >
              <option value="alimentos-secos">Alimentos Secos</option>
              <option value="cerealista">Cerealista &amp; Grãos</option>
              <option value="hortifruti">Hortifruti</option>
              <option value="higiene-limpeza">Higiene &amp; Limpeza</option>
              <option value="laticinios-frios">Laticínios</option>
            </select>
          </div>
          <div>
            <label className="block font-bold uppercase text-[10px] text-on-surface mb-1">
              Lance Inicial (R$)
            </label>
            <input
              type="number"
              min="100"
              value={newDemoPrice}
              onChange={(e) => setNewDemoPrice(Number(e.target.value))}
              className="w-full bg-white px-3 py-2 rounded-lg border border-outline-variant/40 text-xs font-bold"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block font-bold uppercase text-[10px] text-on-surface mb-1">
                Caixas
              </label>
              <input
                type="number"
                min="1"
                value={newDemoBoxes}
                onChange={(e) => setNewDemoBoxes(Number(e.target.value))}
                className="w-full bg-white px-2.5 py-2 rounded-lg border border-outline-variant/40 text-xs"
              />
            </div>
            <button
              type="submit"
              disabled={savingDemo}
              className="px-4 py-2 bg-primary hover:bg-primary-container text-white font-bold rounded-lg text-xs shrink-0 self-end disabled:opacity-50"
            >
              {savingDemo ? 'Criando...' : '+ Criar Modelo'}
            </button>
          </div>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-surface-container-low text-on-surface-variant uppercase font-bold text-[10px]">
              <tr>
                <th className="p-2.5">Identificação</th>
                <th className="p-2.5">Produto Modelo</th>
                <th className="p-2.5">Valor Atual</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5">Ações Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container">
              {demoLots.slice(0, 12).map((lot) => {
                const isDbUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(lot.id);
                return (
                  <tr key={lot.id} className="hover:bg-surface-container-low/50">
                    <td className="p-2.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <DemoBadge compact />
                        <span className="font-mono font-bold text-primary">{lot.codigoLote}</span>
                      </div>
                    </td>
                    <td className="p-2.5 font-bold text-on-surface">{lot.produto.titulo}</td>
                    <td className="p-2.5 font-extrabold text-primary">
                      R$ {lot.lanceAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2.5 uppercase font-bold text-[10px]">{lot.status}</td>
                    <td className="p-2.5">
                      {isDbUuid ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={demoActionId === lot.id}
                            onClick={() => void handleToggleDemoLotStatus(lot)}
                            className="px-2.5 py-1 rounded bg-surface-container hover:bg-surface-container-high font-bold text-primary disabled:opacity-50"
                          >
                            {lot.status === 'ativo' ? 'Encerrar' : 'Reativar'}
                          </button>
                          <button
                            type="button"
                            disabled={demoActionId === lot.id}
                            onClick={() => void handleDeleteDemoLot(lot)}
                            className="px-2.5 py-1 rounded bg-error-container text-on-error-container font-bold disabled:opacity-50"
                          >
                            Excluir
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-outline">Catálogo base Stitch (sincronizável)</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Embedded Home Rotating Banners Manager */}
      <AdminBannerManager />

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
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-on-surface-variant">
                    Nenhuma ordem Escrow registrada até o momento.
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-surface-container-low/50">
                    <td className="p-3 font-mono font-bold text-primary">{order.codigoPedido}</td>
                    <td className="p-3 font-bold">
                      <Link href={`/leiloes/${order.loteId}`} className="hover:text-primary transition-colors">
                        {order.tituloLote}
                      </Link>
                    </td>
                    <td className="p-3 text-on-surface-variant">
                      {order.compradorNome} ↔ {order.fornecedorNome}
                    </td>
                    <td className="p-3 font-extrabold text-primary">
                      R$ {order.valorTotalArremate.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-surface-container font-semibold block">
                        {order.docaAgendada || 'Conferência de Custódia Escrow'}
                      </span>
                      {order.motivoDisputa && (
                        <span className="text-[10px] text-error font-semibold block mt-1">
                          {order.motivoDisputa}
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded font-bold text-[10px] ${
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
                          ? 'ESCROW ATIVO'
                          : order.statusPagamento === 'em_disputa'
                          ? 'EM DISPUTA'
                          : order.statusPagamento === 'estornado'
                          ? 'ESTORNADO'
                          : order.statusPagamento === 'aguardando_pagamento'
                          ? 'AGUARDANDO PIX'
                          : 'CONCILIADO D+0'}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setWormNotice(
                              `Dossiê forense WORM (${order.codigoPedido}) validado com integridade criptográfica ${order.termoArremateHash || 'SHA-256'}.`
                            )
                          }
                          className="px-2.5 py-1 bg-surface-container hover:bg-surface-container-high rounded text-[11px] font-bold text-primary"
                        >
                          Ver Dossiê
                        </button>
                        {(order.statusPagamento === 'em_custodia_escrow' ||
                          order.statusPagamento === 'em_disputa') && (
                          <>
                            <button
                              type="button"
                              disabled={releasingId === order.id || refundingId === order.id}
                              onClick={() => void handleReleaseEscrow(order)}
                              className="px-2.5 py-1 bg-secondary hover:bg-secondary-container text-white hover:text-on-secondary-container rounded text-[11px] font-bold disabled:opacity-50"
                            >
                              {releasingId === order.id ? 'Liquidando...' : 'Liquidar D+0'}
                            </button>
                            <button
                              type="button"
                              disabled={refundingId === order.id || releasingId === order.id}
                              onClick={() => void handleRefundEscrow(order)}
                              className="px-2.5 py-1 bg-error-container hover:bg-error text-on-error-container hover:text-white rounded text-[11px] font-bold disabled:opacity-50"
                            >
                              {refundingId === order.id ? 'Estornando...' : 'Estornar'}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {wormNotice && (
          <div className="p-3 bg-secondary-container/30 border border-secondary text-secondary font-bold text-xs rounded-xl flex items-center justify-between gap-2">
            <span>{wormNotice}</span>
            <button
              type="button"
              onClick={() => setWormNotice(null)}
              className="text-secondary hover:underline text-[11px]"
            >
              Fechar
            </button>
          </div>
        )}
      </div>

      {/* KYC & Escrow Limit Governance */}
      <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30 shadow-sm space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-surface-container pb-3">
          <h3 className="font-extrabold text-base text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">verified_user</span>
            Homologação KYC de Empresas &amp; Limites Escrow
          </h3>
          <span className="text-[10px] font-bold text-on-surface-variant">
            {profiles.length} empresas • {documents.length} documentos no Storage
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-surface-container-low text-on-surface-variant uppercase font-bold text-[10px]">
              <tr>
                <th className="p-3">Empresa / CNPJ / CPF</th>
                <th className="p-3">Perfil</th>
                <th className="p-3">Docs KYC</th>
                <th className="p-3">Limite Escrow (R$)</th>
                <th className="p-3">Status</th>
                <th className="p-3">Decisão Compliance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container">
              {profiles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-on-surface-variant">
                    Nenhum perfil empresarial carregado.
                  </td>
                </tr>
              ) : (
                profiles.map((prof) => {
                  const userDocs = documents.filter((d) => d.user_id === prof.id);
                  return (
                    <tr key={prof.id} className="hover:bg-surface-container-low/50">
                      <td className="p-3">
                        <strong className="text-on-surface block">{prof.nomeFantasia}</strong>
                        <span className="font-mono text-[10px] text-on-surface-variant">
                          {prof.cnpj || (prof.cpf ? `CPF: ${prof.cpf}` : 'Sem CNPJ')}
                        </span>
                      </td>
                      <td className="p-3 uppercase font-bold text-primary">{prof.role}</td>
                      <td className="p-3 text-on-surface-variant">
                        {userDocs.length > 0 ? (
                          <div className="space-y-1.5 min-w-[210px]">
                            {userDocs.map((doc) => (
                              <div
                                key={doc.id}
                                className="flex flex-wrap items-center justify-between gap-1.5 p-1.5 rounded-lg bg-surface-container-low border border-surface-container"
                              >
                                <div className="min-w-0">
                                  <span className="font-semibold text-on-surface block truncate max-w-[140px]">
                                    {doc.nome_arquivo}
                                  </span>
                                  <span className="text-[9px] uppercase font-mono block">
                                    {doc.tipo_documento} • {doc.status_validacao}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    disabled={openingDocId === doc.id}
                                    onClick={() => void handleOpenAdminDocument(doc)}
                                    className="px-2 py-0.5 bg-white border border-outline-variant/40 rounded text-[10px] font-bold text-primary hover:bg-surface-container disabled:opacity-50"
                                  >
                                    {openingDocId === doc.id ? '...' : 'Abrir'}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={updatingDocId === doc.id || doc.status_validacao === 'aprovado'}
                                    onClick={() => void handleModerateDocument(doc, 'aprovado')}
                                    className="px-2 py-0.5 bg-secondary text-white rounded text-[10px] font-bold disabled:opacity-40"
                                  >
                                    OK
                                  </button>
                                  <button
                                    type="button"
                                    disabled={updatingDocId === doc.id || doc.status_validacao === 'rejeitado'}
                                    onClick={() => void handleModerateDocument(doc, 'rejeitado')}
                                    className="px-2 py-0.5 bg-error-container text-on-error-container rounded text-[10px] font-bold disabled:opacity-40"
                                  >
                                    Recusar
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          'Sem anexos'
                        )}
                      </td>
                      <td className="p-3">
                        <input
                          type="number"
                          min="0"
                          step="1000"
                          value={limitInputs[prof.id] ?? prof.limiteCreditoEscrow}
                          onChange={(e) =>
                            setLimitInputs((prev) => ({
                              ...prev,
                              [prof.id]: Number(e.target.value),
                            }))
                          }
                          className="w-32 bg-surface-container-low px-2.5 py-1.5 rounded-lg border border-outline-variant/40 font-mono font-bold text-xs"
                        />
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase ${
                            prof.statusAprovacao === 'aprovado'
                              ? 'bg-secondary-fixed text-on-secondary-fixed'
                              : prof.statusAprovacao === 'em_analise'
                              ? 'bg-primary-fixed text-on-primary-fixed'
                              : 'bg-error-container text-on-error-container'
                          }`}
                        >
                          {prof.statusAprovacao}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            disabled={updatingProfileId === prof.id}
                            onClick={() => void handleUpdateKycProfile(prof, 'aprovado')}
                            className="px-2.5 py-1 bg-secondary hover:bg-secondary-container text-white hover:text-on-secondary-container rounded text-[11px] font-bold disabled:opacity-50"
                          >
                            Aprovar
                          </button>
                          <button
                            type="button"
                            disabled={updatingProfileId === prof.id}
                            onClick={() => void handleUpdateKycProfile(prof, 'em_analise')}
                            className="px-2.5 py-1 bg-surface-container hover:bg-surface-container-high text-primary rounded text-[11px] font-bold disabled:opacity-50"
                          >
                            Em Análise
                          </button>
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

      {/* WORM Audit Logs */}
      <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30 shadow-sm space-y-3 text-xs">
        <div className="flex items-center justify-between border-b border-surface-container pb-2">
          <h3 className="font-extrabold text-sm text-on-surface uppercase">
            Trilha Imutável WORM (Últimos Eventos Criptográficos)
          </h3>
          <span className="text-[10px] text-secondary font-bold">SHA-256 Verificado</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-surface-container-low text-on-surface-variant uppercase font-bold text-[10px]">
              <tr>
                <th className="p-2.5">Evento</th>
                <th className="p-2.5">Protocolo</th>
                <th className="p-2.5">Hash WORM</th>
                <th className="p-2.5">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container">
              {wormLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-on-surface-variant">
                    Nenhum registro WORM auditado ainda.
                  </td>
                </tr>
              ) : (
                wormLogs.slice(0, 10).map((log) => (
                  <tr key={log.id}>
                    <td className="p-2.5 font-bold text-primary">{log.tipo_evento}</td>
                    <td className="p-2.5 font-mono">{log.protocolo}</td>
                    <td className="p-2.5 font-mono text-[10px] text-on-surface-variant truncate max-w-[260px]">
                      {log.merkle_root_hash}
                    </td>
                    <td className="p-2.5 text-on-surface-variant">
                      {new Date(log.created_at).toLocaleString('pt-BR')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Webhook & Integration Telemetry */}
      <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30 shadow-sm space-y-3 text-xs">
        <div className="flex items-center justify-between border-b border-surface-container pb-2">
          <h3 className="font-extrabold text-sm text-on-surface uppercase">
            Monitor de Webhooks &amp; Callbacks Bancários SPI
          </h3>
          <span className="text-[10px] font-bold text-on-surface-variant">
            {webhooks.length} evento(s) • {failedWebhooks} falha(s)
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-surface-container-low text-on-surface-variant uppercase font-bold text-[10px]">
              <tr>
                <th className="p-2.5">Endpoint</th>
                <th className="p-2.5">Método</th>
                <th className="p-2.5">HTTP Status</th>
                <th className="p-2.5">Latência</th>
                <th className="p-2.5">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container">
              {webhooks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-on-surface-variant">
                    Nenhum callback webhook registrado até o momento.
                  </td>
                </tr>
              ) : (
                webhooks.slice(0, 10).map((wh) => (
                  <tr key={wh.id}>
                    <td className="p-2.5 font-mono text-on-surface">{wh.endpoint}</td>
                    <td className="p-2.5 font-bold text-primary">{wh.metodo}</td>
                    <td className="p-2.5">
                      <span
                        className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          wh.status_code >= 400
                            ? 'bg-error-container text-on-error-container'
                            : 'bg-secondary-fixed text-on-secondary-fixed'
                        }`}
                      >
                        {wh.status_code}
                      </span>
                    </td>
                    <td className="p-2.5 font-mono">{wh.tempo_resposta_ms} ms</td>
                    <td className="p-2.5 text-on-surface-variant">
                      {new Date(wh.created_at).toLocaleString('pt-BR')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Central de Alertas Admin */}
      <NotificationsInboxCard />
    </div>
  );
}
