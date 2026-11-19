'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useEnvironment } from '@/components/EnvironmentProvider';
import { DemoBadge, DidacticHint } from '@/components/DemoBadge';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { NegotiationProposal } from '@/lib/types';

export default function NegociacoesPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const { isDemoMode, sandbox, simulateProposalAction } = useEnvironment();
  const [proposals, setProposals] = useState<NegotiationProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [counterPriceInput, setCounterPriceInput] = useState<{ [id: string]: number }>({});
  const [statusFilter, setStatusFilter] = useState<'todas' | 'pendente' | 'contraproposta' | 'aceita' | 'recusada'>('todas');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadProposals = useCallback(async () => {
    try {
      const res = await fetch('/api/propostas?env=original', { cache: 'no-store' });
      if (res.status === 401) {
        setAuthRequired(true);
        setProposals([]);
        return;
      }
      const data = res.ok ? await res.json() : null;
      setAuthRequired(false);
      setProposals(Array.isArray(data?.proposals) ? data.proposals : []);
    } catch {
      // preserve state on transient error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isDemoMode) {
      setAuthRequired(false);
      setLoading(false);
      setProposals(sandbox.simulatedProposals);
      return;
    }

    if (authLoading) return;
    if (!user) {
      setAuthRequired(true);
      setLoading(false);
      setProposals([]);
      return;
    }

    setLoading(true);
    void loadProposals();

    if (!isSupabaseConfigured) return;
    const channel = supabase
      .channel(`proposals-live-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'negotiation_proposals' },
        () => {
          void loadProposals();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isDemoMode, sandbox.simulatedProposals, user, authLoading, loadProposals]);

  const handleAccept = async (prop: NegotiationProposal) => {
    const finalUnitPrice = prop.contrapropostaPrecoUnitario || prop.precoUnitarioOfertado;
    const ratio = prop.precoUnitarioOfertado > 0 ? finalUnitPrice / prop.precoUnitarioOfertado : 1;
    const finalTotal = Number((prop.valorTotalProposta * ratio).toFixed(2));
    setErrorMsg(null);

    if (isDemoMode || prop.isDemo) {
      if (prop.status !== 'aceita') {
        simulateProposalAction(prop.id, 'accept');
        setFeedback('SIMULAÇÃO — AMBIENTE MODELO: Proposta aceita localmente. Você pode simular o Checkout Escrow!');
      }
      router.push(
        `/checkout?loteId=${encodeURIComponent(prop.loteId)}&proposalId=${encodeURIComponent(prop.id)}&sourceType=proposal&valor=${finalTotal}`
      );
      return;
    }

    if (prop.status === 'aceita') {
      router.push(
        `/checkout?loteId=${prop.loteId}&proposalId=${prop.id}&sourceType=proposal&valor=${finalTotal}`
      );
      return;
    }

    try {
      const res = await fetch('/api/propostas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept', proposalId: prop.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data?.error || 'Não foi possível aceitar a proposta.');
        return;
      }
      if (data?.proposal) {
        setProposals((prev) => prev.map((p) => (p.id === prop.id ? data.proposal : p)));
      }
    } catch {
      setErrorMsg('Falha de comunicação ao homologar a proposta. Tente novamente.');
      return;
    }

    if (profile?.role === 'fornecedor') {
      setFeedback('Proposta aceita! O comprador foi notificado para concluir o pagamento Escrow.');
      setTimeout(() => setFeedback(null), 4000);
      return;
    }

    router.push(
      `/checkout?loteId=${prop.loteId}&proposalId=${prop.id}&sourceType=proposal&valor=${finalTotal}`
    );
  };

  const handleSendCounter = async (propId: string) => {
    const newPrice = counterPriceInput[propId];
    if (!newPrice || newPrice <= 0) {
      setErrorMsg('Informe um preço unitário positivo para a contraproposta.');
      return;
    }
    setErrorMsg(null);

    if (isDemoMode) {
      simulateProposalAction(propId, 'counter', newPrice);
      setFeedback(
        `SIMULAÇÃO — AMBIENTE MODELO: Contraproposta de R$ ${newPrice.toFixed(2)}/un simulada com sucesso.`
      );
      setTimeout(() => setFeedback(null), 3500);
      return;
    }

    try {
      const res = await fetch('/api/propostas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'counter', proposalId: propId, counterPrice: newPrice }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data?.error || 'Não foi possível registrar a contraproposta.');
        return;
      }

      setProposals((prev) =>
        prev.map((p) =>
          p.id === propId
            ? data?.proposal || {
                ...p,
                status: 'contraproposta',
                contrapropostaPrecoUnitario: newPrice,
              }
            : p
        )
      );
      setFeedback(`Contraproposta de R$ ${newPrice.toFixed(2)}/un enviada com sucesso!`);
    } catch {
      setErrorMsg('Falha de comunicação ao enviar a contraproposta. Tente novamente.');
      return;
    }
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleReject = async (propId: string) => {
    setErrorMsg(null);

    if (isDemoMode) {
      simulateProposalAction(propId, 'reject');
      setFeedback('SIMULAÇÃO — AMBIENTE MODELO: Proposta recusada na demonstração (nenhum dado real foi alterado).');
      setTimeout(() => setFeedback(null), 3500);
      return;
    }

    try {
      const res = await fetch('/api/propostas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', proposalId: propId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data?.error || 'Não foi possível recusar a proposta.');
        return;
      }
      setProposals((prev) =>
        prev.map((p) =>
          p.id === propId ? data?.proposal || { ...p, status: 'recusada' } : p
        )
      );
      setFeedback(`Proposta #${propId.slice(0, 8)} recusada e encerrada na mesa de negociação.`);
    } catch {
      setErrorMsg('Falha de comunicação ao recusar a proposta. Tente novamente.');
      return;
    }
    setTimeout(() => setFeedback(null), 3000);
  };

  const visibleProposals = isDemoMode ? sandbox.simulatedProposals : proposals;
  const filteredProposals = visibleProposals.filter((p) =>
    statusFilter === 'todas' ? true : p.status === statusFilter
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Breadcrumb & Header */}
      <div className="space-y-1">
        <nav className="text-xs text-on-surface-variant flex items-center gap-1.5">
          <Link href="/" className="hover:text-primary">Início</Link>
          <span>/</span>
          <span className="font-bold text-primary">Central de Negociação &amp; Propostas Diretas</span>
        </nav>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {isDemoMode && <DemoBadge compact />}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface">
              Ofertas Comerciais &amp; Negociação Direta
            </h1>
            <p className="text-xs sm:text-sm text-on-surface-variant">
              Negocie lotes fracionados, volumes especiais e descontos progressivos direto com as indústrias.
            </p>
          </div>
          <Link
            href="/catalogo"
            className="bg-primary hover:bg-primary-container text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">search</span>
            <span>Explorar Lotes para Ofertar</span>
          </Link>
        </div>
      </div>

      {isDemoMode && (
        <DidacticHint
          title="Nesta seção você acompanha suas negociações"
          text="Experimente aceitar propostas, enviar contrapropostas ou avançar para a simulação do checkout Escrow usando os exemplos modelo abaixo — sem comprometer sua empresa ou gerar cobrança real."
        />
      )}

      {feedback && (
        <div className="p-3 bg-secondary-container/30 border border-secondary text-secondary font-bold text-xs rounded-xl flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          <span>{feedback}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-error-container text-on-error-container font-bold text-xs rounded-xl flex items-center justify-between gap-2">
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-[11px] underline"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Status Filter Strip */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {(
          [
            { id: 'todas', label: 'Todas' },
            { id: 'pendente', label: 'Pendentes' },
            { id: 'contraproposta', label: 'Contrapropostas' },
            { id: 'aceita', label: 'Aceitas' },
            { id: 'recusada', label: 'Recusadas' },
          ] as const
        ).map((tab) => {
          const count =
            tab.id === 'todas'
              ? visibleProposals.length
              : visibleProposals.filter((p) => p.status === tab.id).length;
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

      {/* Proposals List */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-surface-container-lowest p-10 rounded-2xl border border-outline-variant/30 text-center space-y-2">
            <div className="w-8 h-8 rounded-full border-4 border-primary/20 border-t-primary animate-spin mx-auto" />
            <p className="text-xs font-bold text-on-surface-variant">
              Carregando propostas comerciais no Supabase...
            </p>
          </div>
        ) : authRequired ? (
          <div className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/30 text-center space-y-3">
            <span className="material-symbols-outlined text-primary text-4xl">lock</span>
            <h3 className="text-sm font-extrabold text-on-surface">
              Faça login com seu CNPJ para acessar sua Mesa de Negociações
            </h3>
            <p className="text-xs text-on-surface-variant max-w-md mx-auto">
              Suas propostas fracionadas, contrapropostas de fornecedores e termos homologados são protegidos por RLS.
            </p>
            <Link
              href="/login?redirect=/negociacoes"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-container text-white text-xs font-bold"
            >
              Entrar na Mesa B2B
            </Link>
          </div>
        ) : filteredProposals.length === 0 ? (
          <div className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/30 text-center space-y-2">
            <span className="material-symbols-outlined text-outline text-3xl">handshake</span>
            <p className="text-sm font-bold text-on-surface">
              Nenhuma proposta encontrada neste status.
            </p>
            {statusFilter !== 'todas' ? (
              <button
                type="button"
                onClick={() => setStatusFilter('todas')}
                className="text-xs font-bold text-primary hover:underline"
              >
                Ver todas as propostas
              </button>
            ) : (
              <Link href="/catalogo" className="inline-block text-xs font-bold text-primary hover:underline">
                Explorar lotes e enviar primeira proposta direta
              </Link>
            )}
          </div>
        ) : (
          filteredProposals.map((prop) => {
            const isBuyer = !isDemoMode && profile?.role === 'comprador';
            const canCounter =
              (isDemoMode || profile?.role === 'fornecedor' || profile?.role === 'admin') &&
              prop.status !== 'recusada' &&
              prop.status !== 'aceita';
            return (
              <div
                key={prop.id}
                className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30 shadow-sm space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-surface-container pb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {(isDemoMode || prop.isDemo) && <DemoBadge compact />}
                      <span className="text-[10px] uppercase font-bold text-on-surface-variant">
                        PROPOSTA #{prop.id.slice(0, 8)} • Lote {prop.loteId.slice(0, 8)}
                      </span>
                    </div>
                    <h3 className="font-extrabold text-base text-on-surface">{prop.tituloProduto}</h3>
                  </div>
                  <span
                    className={`self-start sm:self-auto px-3 py-1 rounded-full text-xs font-extrabold uppercase ${
                      prop.status === 'contraproposta'
                        ? 'bg-primary-fixed text-on-primary-fixed'
                        : prop.status === 'aceita'
                        ? 'bg-secondary-fixed text-on-secondary-fixed'
                        : prop.status === 'recusada'
                        ? 'bg-error-container text-on-error-container'
                        : 'bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    Status: {prop.status}
                  </span>
                </div>

                {/* Grid of parties and values */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs bg-surface-container-low p-4 rounded-xl">
                  <div>
                    <span className="text-on-surface-variant block">Comprador:</span>
                    <strong className="text-on-surface">{prop.compradorNome}</strong>
                  </div>
                  <div>
                    <span className="text-on-surface-variant block">Fornecedor:</span>
                    <strong className="text-on-surface">{prop.fornecedorNome}</strong>
                  </div>
                  <div>
                    <span className="text-on-surface-variant block">Volume Ofertado:</span>
                    <strong className="text-primary font-bold">{prop.quantidadeCaixas} caixas</strong>
                  </div>
                  <div>
                    <span className="text-on-surface-variant block">Preço Ofertado:</span>
                    <strong className="text-secondary font-extrabold text-sm">
                      R$ {prop.precoUnitarioOfertado.toFixed(2)} / un
                    </strong>
                    <span className="text-[10px] text-outline block">
                      Total: R$ {prop.valorTotalProposta.toLocaleString('pt-BR')}
                    </span>
                  </div>
                </div>

                {/* Mensagem e Contraproposta */}
                <div className="text-xs space-y-2">
                  <p className="p-3 bg-surface-container-low rounded-xl text-on-surface italic">
                    &ldquo;{prop.mensagem}&rdquo;
                  </p>

                  {prop.contrapropostaPrecoUnitario && (
                    <div className="p-3 bg-primary-fixed/30 rounded-xl border border-primary/20 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-[20px]">swap_horiz</span>
                        <div>
                          <span className="font-bold text-primary block">Contraproposta da Indústria:</span>
                          <span className="text-on-surface-variant">Preço sugerido para fechar o lote imediatamente:</span>
                        </div>
                      </div>
                      <span className="text-base font-extrabold text-primary">
                        R$ {prop.contrapropostaPrecoUnitario.toFixed(2)} / un
                      </span>
                    </div>
                  )}
                </div>

                {/* Action Bar */}
                <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-surface-container">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.10"
                      min="0.01"
                      disabled={!canCounter}
                      placeholder={
                        isBuyer ? 'Apenas fornecedor envia contraproposta' : 'Novo preço unitário...'
                      }
                      value={counterPriceInput[prop.id] || ''}
                      onChange={(e) =>
                        setCounterPriceInput({
                          ...counterPriceInput,
                          [prop.id]: Number(e.target.value),
                        })
                      }
                      className="w-44 bg-surface-container-low px-3 py-1.5 rounded-lg border border-outline-variant/30 text-xs font-bold disabled:opacity-50"
                    />
                    <button
                      type="button"
                      disabled={
                        !canCounter ||
                        !counterPriceInput[prop.id] ||
                        counterPriceInput[prop.id] <= 0
                      }
                      onClick={() => handleSendCounter(prop.id)}
                      className="px-3 py-1.5 bg-surface-container hover:bg-surface-container-high text-primary font-bold text-xs rounded-lg transition-colors disabled:opacity-45"
                    >
                      Enviar Contraproposta
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {prop.status !== 'recusada' && prop.status !== 'aceita' && (
                      <button
                        type="button"
                        onClick={() => handleReject(prop.id)}
                        className="px-4 py-2 bg-error-container/70 hover:bg-error-container text-on-error-container font-bold text-xs rounded-xl transition-colors"
                      >
                        Recusar
                      </button>
                    )}
                    {(() => {
                      const isSupplierRole = !isDemoMode && profile?.role === 'fornecedor';
                      const waitingCounterparty =
                        !isDemoMode &&
                        ((prop.status === 'pendente' && isBuyer) ||
                          (prop.status === 'contraproposta' && isSupplierRole) ||
                          (prop.status === 'aceita' && isSupplierRole));
                      const disabledBtn = prop.status === 'recusada' || waitingCounterparty;

                      let actionLabel = isDemoMode
                        ? 'Simular Aceite & Checkout Modelo'
                        : 'Aceitar e Ir para Custódia Escrow';
                      if (!isDemoMode && prop.status === 'pendente' && isBuyer) {
                        actionLabel = 'Aguardando Resposta da Indústria';
                      } else if (!isDemoMode && prop.status === 'contraproposta' && isSupplierRole) {
                        actionLabel = 'Aguardando Aceite do Comprador';
                      } else if (!isDemoMode && prop.status === 'aceita' && isSupplierRole) {
                        actionLabel = 'Aguardando Pagamento Escrow';
                      } else if (prop.status === 'aceita') {
                        actionLabel = isDemoMode
                          ? 'Simular Checkout Escrow (Modelo)'
                          : 'Ir para Checkout Escrow';
                      } else if (isSupplierRole) {
                        actionLabel = 'Aceitar Proposta do Comprador';
                      }

                      return (
                        <button
                          type="button"
                          disabled={disabledBtn}
                          onClick={() => handleAccept(prop)}
                          className="px-5 py-2 bg-secondary hover:bg-secondary-container text-white hover:text-on-secondary-container font-extrabold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-45"
                        >
                          <span className="material-symbols-outlined text-[16px]">check_circle</span>
                          <span>{actionLabel}</span>
                        </button>
                      );
                    })()}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
