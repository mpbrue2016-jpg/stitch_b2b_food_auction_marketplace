'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { AuctionCountdown } from '@/components/AuctionCountdown';
import {
  CompanyProfileAndKycCard,
  NotificationsInboxCard,
} from '@/components/AccountGovernanceSection';
import { useAuth } from '@/components/AuthProvider';
import { useEnvironment } from '@/components/EnvironmentProvider';
import { DemoBadge, DidacticHint } from '@/components/DemoBadge';
import { DEMO_ANALYTICS_INDICATORS, DEMO_CATEGORIES } from '@/lib/demo-data';
import { AuctionLot, EscrowOrder, ProductCategory } from '@/lib/types';

export default function PainelCompradorPage() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const { isDemoMode, sandbox } = useEnvironment();
  const [lots, setLots] = useState<AuctionLot[]>([]);
  const [orders, setOrders] = useState<EscrowOrder[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [kycStatusNotice, setKycStatusNotice] = useState<string | null>(null);
  const [uploadingKyc, setUploadingKyc] = useState(false);
  const kycInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isDemoMode) {
      setLots(sandbox.simulatedLots);
      setOrders(sandbox.simulatedOrders);
      setCategories(DEMO_CATEGORIES);
      setLoading(false);
      return;
    }

    if (authLoading) return;
    if (!user) {
      setLots([]);
      setOrders([]);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);

    Promise.all([
      fetch('/api/lotes?env=original', { cache: 'no-store' }).then((res) => (res.ok ? res.json() : null)),
      fetch('/api/pedidos?env=original', { cache: 'no-store' }).then((res) => (res.ok ? res.json() : null)),
      fetch('/api/categorias?env=original', { cache: 'no-store' }).then((res) => (res.ok ? res.json() : null)),
    ])
      .then(([lotesData, pedidosData, catsData]) => {
        if (!active) return;
        setLots(Array.isArray(lotesData?.lots) ? lotesData.lots : []);
        setOrders(Array.isArray(pedidosData?.orders) ? pedidosData.orders : []);
        setCategories(Array.isArray(catsData?.categories) ? catsData.categories : []);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isDemoMode, sandbox.simulatedLots, sandbox.simulatedOrders, user, authLoading]);

  const handleKycUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isDemoMode) return;
    setUploadingKyc(true);
    setKycStatusNotice(null);
    try {
      const formData = new FormData();
      formData.append('bucket', 'kyc-docs');
      formData.append('tipoDocumento', 'cartao_cnpj');
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        await refreshProfile();
        setKycStatusNotice(`Documento "${file.name}" enviado para validação KYC no Supabase Storage.`);
      } else {
        setKycStatusNotice(data?.error || 'Não foi possível enviar o documento KYC.');
      }
    } catch {
      setKycStatusNotice('Falha ao enviar documento KYC.');
    } finally {
      setUploadingKyc(false);
      if (kycInputRef.current) kycInputRef.current.value = '';
    }
  };

  if (!isDemoMode && !authLoading && !user) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-14 text-center space-y-4">
        <div className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/30 shadow-sm space-y-4">
          <span className="material-symbols-outlined text-primary text-4xl">lock</span>
          <h1 className="text-xl font-extrabold text-on-surface">
            Painel Original do Comprador — Autenticação Necessária
          </h1>
          <p className="text-xs text-on-surface-variant max-w-md mx-auto">
            Entre com sua conta oficial ou conclua o cadastro para acessar seu painel individual, limites e pedidos reais.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/login?redirect=/painel/comprador"
              className="px-5 py-2.5 bg-primary text-white text-xs font-bold rounded-xl"
            >
              Entrar na Conta
            </Link>
            <Link
              href="/cadastro"
              className="px-5 py-2.5 bg-secondary text-white text-xs font-bold rounded-xl"
            >
              Começar Agora (Cadastro)
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const displayLots = isDemoMode ? sandbox.simulatedLots : lots;
  const displayOrders = isDemoMode ? sandbox.simulatedOrders : orders;
  const activeOrders = displayOrders.filter((o) => o.statusPagamento !== 'estornado');
  const totalVolumeArrematado = activeOrders.reduce((acc, o) => acc + o.valorTotalArremate, 0);
  const avgEconomy =
    displayLots.length > 0
      ? (
          displayLots.reduce((acc, l) => {
            const ref = l.produto.precoReferenciaMercado || l.lanceAtual;
            return acc + Math.max(0, ((ref - l.lanceAtual) / ref) * 100);
          }, 0) / displayLots.length
        ).toFixed(1)
      : '0.0';

  const displayCompanyName = isDemoMode
    ? 'Supermercado Demo Ltda.'
    : profile?.nomeFantasia || profile?.razaoSocial || 'Painel do Comprador';

  const statusLabel = isDemoMode
    ? 'CONTA MODELO DEMONSTRATIVA'
    : profile?.statusAprovacao === 'aprovado'
    ? 'CADASTRO HOMOLOGADO'
    : profile?.statusAprovacao === 'em_analise'
    ? 'KYC EM ANÁLISE'
    : 'CADASTRO RECÉM-CRIADO';

  const escrowLimitDisplay = isDemoMode ? 500000 : (profile?.limiteCreditoEscrow ?? 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-container pb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            {isDemoMode && <DemoBadge compact />}
            <span className="w-2.5 h-2.5 rounded-full bg-secondary animate-pulse" />
            <span className="text-[10px] uppercase font-bold text-secondary">
              COCKPIT DO COMPRADOR B2B • {statusLabel}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface mt-1">
            {displayCompanyName}
          </h1>
          <p className="text-xs text-on-surface-variant font-mono mt-0.5">
            {isDemoMode
              ? 'CNPJ Modelo: 12.345.678/0001-90 • São Paulo - SP (Dados Fictícios)'
              : profile
              ? `${profile.cnpj ? `CNPJ: ${profile.cnpj}` : profile.cpf ? `CPF: ${profile.cpf}` : 'Perfil Comprador'} • ${
                  profile.inscricaoEstadual ? `I.E: ${profile.inscricaoEstadual} • ` : ''
                }${profile.endereco?.cidade || 'São Paulo'} - ${profile.endereco?.uf || 'SP'}`
              : 'Conta real autenticada'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {!isDemoMode && user && (
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
                <span>{uploadingKyc ? 'Enviando KYC...' : 'Enviar Doc. KYC'}</span>
              </button>
            </>
          )}
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

      {isDemoMode && (
        <DidacticHint
          title="Aqui você acompanha suas negociações e compras"
          text="Este é um painel demonstrativo de comprador varejista. Explore os indicadores fictícios, lances de exemplo e retiradas FOB antes de criar sua conta verdadeira."
        />
      )}

      {kycStatusNotice && (
        <div className="p-3 rounded-xl bg-secondary-container/30 border border-secondary text-secondary text-xs font-bold flex items-center justify-between gap-2">
          <span>{kycStatusNotice}</span>
          <button type="button" onClick={() => setKycStatusNotice(null)} className="underline text-[11px]">
            Fechar
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-on-surface-variant gap-1">
            <span className="text-xs font-bold uppercase">Limite Escrow Liberado</span>
            {isDemoMode ? <DemoBadge compact /> : <span className="material-symbols-outlined text-secondary text-[22px]">verified_user</span>}
          </div>
          <span className="text-2xl font-extrabold text-secondary block">
            R$ {escrowLimitDisplay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[11px] text-outline block">Regulado BACEN • Disponível D+0</span>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-on-surface-variant gap-1">
            <span className="text-xs font-bold uppercase">Pregões em Disputa</span>
            {isDemoMode ? <DemoBadge compact /> : <span className="material-symbols-outlined text-tertiary text-[22px]">timer</span>}
          </div>
          <span className="text-2xl font-extrabold text-primary block">{displayLots.length} lotes</span>
          <span className="text-[11px] text-tertiary font-bold block">
            {displayLots.filter((l) => l.status === 'reta_final').length} lotes em Reta Final
          </span>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-on-surface-variant gap-1">
            <span className="text-xs font-bold uppercase">Volume Total Arrematado</span>
            {isDemoMode ? <DemoBadge compact /> : <span className="material-symbols-outlined text-primary text-[22px]">payments</span>}
          </div>
          <span className="text-2xl font-extrabold text-on-surface block">
            R$ {totalVolumeArrematado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[11px] text-on-surface-variant block">{activeOrders.length} pedidos homologados</span>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-on-surface-variant gap-1">
            <span className="text-xs font-bold uppercase">Economia Média Obtida</span>
            {isDemoMode ? <DemoBadge compact /> : <span className="material-symbols-outlined text-secondary text-[22px]">trending_up</span>}
          </div>
          <span className="text-2xl font-extrabold text-secondary block">{avgEconomy}%</span>
          <span className="text-[11px] text-on-surface-variant block">Em relação à tabela industrial</span>
        </div>
      </div>

      {/* Demonstrative Chart strictly in Modelo Mode */}
      {isDemoMode && (
        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-amber-300 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <DemoBadge compact />
                <h3 className="font-extrabold text-base text-on-surface">
                  Gráfico Demonstrativo — Volume Simulado de Compras por Categoria
                </h3>
              </div>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Exemplo visual de como o painel apresenta indicadores de economia e compras reais após o cadastro.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {DEMO_ANALYTICS_INDICATORS.map((item) => (
              <div key={item.label} className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/20 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-on-surface truncate pr-2">{item.label}</span>
                  <span className="text-primary shrink-0">{item.valorFormatado}</span>
                </div>
                <div className="w-full h-2.5 bg-surface-container rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${item.percentualBarra}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Active Bids */}
        <div className="lg:col-span-7 bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-surface-container pb-3">
            <h3 className="font-extrabold text-base text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">gavel</span>
              <span>{isDemoMode ? 'Pregões Demonstrativos (Modelo)' : 'Pregões & Lotes Reais Ativos'}</span>
            </h3>
            <Link href="/leiloes" className="text-xs text-primary font-bold hover:underline">
              Ver todos os pregões
            </Link>
          </div>

          {loading ? (
            <p className="text-xs text-on-surface-variant py-6 text-center">
              Carregando pregões disponíveis...
            </p>
          ) : displayLots.length === 0 ? (
            <div className="py-6 text-center space-y-2 text-xs text-on-surface-variant">
              <p>Nenhum pregão real publicado no Ambiente Original até o momento.</p>
              <Link href="/catalogo" className="text-primary font-bold hover:underline inline-block">
                Explorar catálogo oficial
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {displayLots.slice(0, 6).map((lot) => {
                const catName =
                  categories.find((c) => c.id === lot.produto.categoriaId)?.nome || 'Geral B2B';
                const isLotClosed = lot.status === 'encerrado' || lot.status === 'homologado';
                const isUserLeader = Boolean(
                  !isDemoMode &&
                    profile?.nomeFantasia &&
                    lot.ultimoLanceEmpresa === profile.nomeFantasia
                );
                return (
                  <div
                    key={lot.id}
                    className="p-4 rounded-xl bg-surface-container-low border border-surface-container flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {(isDemoMode || lot.isDemo) && <DemoBadge compact />}
                        <span className="font-bold text-on-surface">{lot.codigoLote} • {lot.produto.titulo}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface-container font-bold text-on-surface-variant">
                          {catName}
                        </span>
                        {isLotClosed ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface-container-high text-outline font-bold">
                            ENCERRADO
                          </span>
                        ) : isUserLeader ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-secondary-fixed text-on-secondary-fixed font-bold">
                            SEU LANCE LÍDER
                          </span>
                        ) : (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary-fixed text-on-primary-fixed font-bold">
                            EM DISPUTA
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-on-surface-variant">
                        <span>
                          Lance Atual: <strong className="text-primary">R$ {lot.lanceAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong> (R$ {lot.precoUnitarioAtual.toFixed(2)}/un)
                        </span>
                        <AuctionCountdown
                          terminaEm={lot.terminaEm}
                          size="sm"
                          onExpire={() =>
                            setLots((prev) =>
                              prev.map((item) =>
                                item.id === lot.id && item.status !== 'encerrado' && item.status !== 'homologado'
                                  ? { ...item, status: 'encerrado' }
                                  : item
                              )
                            )
                          }
                        />
                      </div>
                    </div>

                    <Link
                      href={`/leiloes/${lot.id}`}
                      className="px-4 py-2 bg-primary hover:bg-primary-container text-white font-bold rounded-lg text-xs transition-colors shrink-0 text-center"
                    >
                      Sala do Pregão
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Recent Orders & Dock pick-up */}
        <div className="lg:col-span-5 bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-surface-container pb-3">
            <h3 className="font-extrabold text-base text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">local_shipping</span>
              Retiradas FOB &amp; Docas
            </h3>
            <Link href="/pedidos" className="text-xs text-primary font-bold hover:underline">
              Ver pedidos
            </Link>
          </div>

          {displayOrders.length === 0 ? (
            <div className="py-6 text-center space-y-2 text-xs text-on-surface-variant">
              <p>Você ainda não possui pedidos Escrow registrados em sua conta.</p>
              <Link href="/catalogo" className="text-primary font-bold hover:underline inline-block">
                Explorar lotes disponíveis
              </Link>
            </div>
          ) : (
            <div className="space-y-3 text-xs">
              {displayOrders.map((order) => (
                <div
                  key={order.id}
                  className="p-3.5 rounded-xl bg-surface-container-low border border-surface-container space-y-2"
                >
                  <div className="flex justify-between items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(isDemoMode || order.isDemo) && <DemoBadge compact />}
                      <span className="font-bold text-on-surface">{order.codigoPedido}</span>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold ${
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
                        ? 'Escrow Retido'
                        : order.statusPagamento === 'em_disputa'
                        ? 'Em Disputa'
                        : order.statusPagamento === 'estornado'
                        ? 'Estornado'
                        : order.statusPagamento === 'aguardando_pagamento'
                        ? 'Aguardando PIX'
                        : 'Liquidado D+0'}
                    </span>
                  </div>
                  <p className="text-on-surface-variant font-medium">{order.tituloLote}</p>
                  <div className="text-[11px] text-on-surface bg-white p-2 rounded-lg border border-outline-variant/20">
                    <span className="font-bold text-primary block">Doca / Logística FOB:</span>
                    <span>{order.docaAgendada || 'Aguardando agendamento'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {isDemoMode && (
        <div className="rounded-2xl bg-primary-fixed/40 border border-primary/30 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-extrabold text-on-surface">
              Gostou de conhecer o Varejista Online? Agora crie sua conta e faça parte da nossa rede comercial.
            </h3>
            <p className="text-xs text-on-surface-variant">
              Cadastre-se como Pessoa Física, Empresa, Comprador ou Fornecedor e inicie sua operação com dados 100% reais.
            </p>
          </div>
          <Link
            href="/cadastro"
            className="px-5 py-2.5 bg-primary hover:bg-primary-container text-white text-xs font-extrabold rounded-xl shrink-0 text-center"
          >
            COMEÇAR AGORA
          </Link>
        </div>
      )}

      {/* Central de Alertas & Dados Cadastrais / KYC apenas no Ambiente Original */}
      {!isDemoMode && (
        <>
          <NotificationsInboxCard />
          <CompanyProfileAndKycCard />
        </>
      )}
    </div>
  );
}

