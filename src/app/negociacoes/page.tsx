'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MOCK_PROPOSALS } from '@/lib/mock-data';
import { NegotiationProposal } from '@/lib/types';

export default function NegociacoesPage() {
  const router = useRouter();
  const [proposals, setProposals] = useState<NegotiationProposal[]>(MOCK_PROPOSALS);
  const [counterPriceInput, setCounterPriceInput] = useState<{ [id: string]: number }>({});
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/propostas')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.proposals?.length) {
          setProposals(data.proposals);
        }
      })
      .catch(() => {});
  }, []);

  const handleAccept = async (prop: NegotiationProposal) => {
    const finalUnitPrice = prop.contrapropostaPrecoUnitario || prop.precoUnitarioOfertado;
    const ratio = prop.precoUnitarioOfertado > 0 ? finalUnitPrice / prop.precoUnitarioOfertado : 1;
    const finalTotal = Number((prop.valorTotalProposta * ratio).toFixed(2));

    try {
      await fetch('/api/propostas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept', proposalId: prop.id }),
      });
    } catch {
      // fallback: segue para checkout mesmo se offline
    }

    router.push(`/checkout?loteId=${prop.loteId}&valor=${finalTotal}`);
  };

  const handleSendCounter = async (propId: string) => {
    const newPrice = counterPriceInput[propId];
    if (!newPrice || newPrice <= 0) return;

    try {
      const res = await fetch('/api/propostas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'counter', proposalId: propId, counterPrice: newPrice }),
      });
      const data = res.ok ? await res.json() : null;

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
      setFeedback(`Contraproposta de R$ ${newPrice.toFixed(2)}/un enviada com sucesso ao fornecedor!`);
    } catch {
      setProposals((prev) =>
        prev.map((p) =>
          p.id === propId
            ? {
                ...p,
                status: 'contraproposta',
                contrapropostaPrecoUnitario: newPrice,
              }
            : p
        )
      );
      setFeedback(`Contraproposta de R$ ${newPrice.toFixed(2)}/un registrada!`);
    }
    setTimeout(() => setFeedback(null), 3000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Breadcrumb & Header */}
      <div className="space-y-1">
        <nav className="text-xs text-on-surface-variant flex items-center gap-1.5">
          <Link href="/" className="hover:text-primary">Início</Link>
          <span>/</span>
          <span className="font-bold text-primary">Central de Negociação & Propostas Diretas</span>
        </nav>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface">
              Ofertas Comerciais & Negociação Direta
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

      {feedback && (
        <div className="p-3 bg-secondary-container/30 border border-secondary text-secondary font-bold text-xs rounded-xl flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          <span>{feedback}</span>
        </div>
      )}

      {/* Proposals List */}
      <div className="space-y-4">
        {proposals.map((prop) => (
          <div
            key={prop.id}
            className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30 shadow-sm space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-surface-container pb-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-on-surface-variant">
                  PROPOSTA #{prop.id} • Lote {prop.loteId}
                </span>
                <h3 className="font-extrabold text-base text-on-surface">{prop.tituloProduto}</h3>
              </div>
              <span
                className={`self-start sm:self-auto px-3 py-1 rounded-full text-xs font-extrabold uppercase ${
                  prop.status === 'contraproposta'
                    ? 'bg-primary-fixed text-on-primary-fixed'
                    : prop.status === 'aceita'
                    ? 'bg-secondary-fixed text-on-secondary-fixed'
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
                  placeholder="Novo preço unitário..."
                  value={counterPriceInput[prop.id] || ''}
                  onChange={(e) =>
                    setCounterPriceInput({
                      ...counterPriceInput,
                      [prop.id]: Number(e.target.value),
                    })
                  }
                  className="w-36 bg-surface-container-low px-3 py-1.5 rounded-lg border border-outline-variant/30 text-xs font-bold"
                />
                <button
                  type="button"
                  onClick={() => handleSendCounter(prop.id)}
                  className="px-3 py-1.5 bg-surface-container hover:bg-surface-container-high text-primary font-bold text-xs rounded-lg transition-colors"
                >
                  Enviar Contraproposta
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleAccept(prop)}
                  className="px-5 py-2 bg-secondary hover:bg-secondary-container text-white hover:text-on-secondary-container font-extrabold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  <span>Aceitar e Ir para Custódia Escrow</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
