'use client';

import React, { useState, useEffect } from 'react';
import { calculateSplit, getCommissionRules, updateCommissionRule } from '@/lib/commission-engine';

export const CommissionCalculator: React.FC = () => {
  const [rules, setRules] = useState(getCommissionRules());
  const [selectedRuleSlug, setSelectedRuleSlug] = useState('leilao');
  const [customRate, setCustomRate] = useState<number>(6.0);
  const [gmvAmount, setGmvAmount] = useState<number>(100000);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [newRateInput, setNewRateInput] = useState<number>(6.0);
  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/comissoes')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.rules?.length) {
          setRules(data.rules);
          const current = data.rules.find((r: { slug: string }) => r.slug === 'leilao');
          if (current) setCustomRate(current.percentualPadrao);
        }
      })
      .catch(() => {});
  }, []);

  const selectedRule = rules.find((r) => r.slug === selectedRuleSlug);
  const activeRate = customRate !== undefined ? customRate : (selectedRule?.percentualPadrao ?? 6.0);
  const splitResult = calculateSplit(gmvAmount, selectedRuleSlug, activeRate);

  const handleSaveRule = async (ruleId: string) => {
    const boundedRate = Math.max(0, Math.min(100, Number(newRateInput) || 0));
    setSaving(true);
    setSaveNotice(null);
    updateCommissionRule(ruleId, boundedRate);
    try {
      const res = await fetch('/api/comissoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleId, newPercentage: boundedRate }),
      });
      if (res.ok) {
        const refreshed = await fetch('/api/comissoes').then((r) => r.json());
        if (refreshed?.rules) setRules(refreshed.rules);
        setSaveNotice(`Regra atualizada para ${boundedRate}% e aplicada imediatamente aos próximos splits Escrow.`);
      } else {
        setRules([...getCommissionRules()]);
      }
    } catch {
      setRules([...getCommissionRules()]);
    } finally {
      setSaving(false);
      setEditingRuleId(null);
      if (selectedRule?.id === ruleId) setCustomRate(boundedRate);
    }
  };

  return (
    <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-surface-container">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[24px]">account_balance_wallet</span>
            <h3 className="font-extrabold text-lg text-on-surface">Motor de Take Rate & Split Fiduciário B2B</h3>
          </div>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Parametrização dinâmica das comissões administrativas da plataforma (6%, 20% ou taxas customizadas por modalidade).
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-container text-on-secondary-container text-xs font-bold">
          <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
          Split v3.4 Conectado ao BACEN
        </span>
      </div>

      {/* Tabela de Regras Configuráveis */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Modalidades & Comissões Parametrizadas
          </h4>
          {saveNotice && (
            <span className="text-xs font-bold text-secondary bg-secondary-container/30 px-3 py-1 rounded-lg">
              {saveNotice}
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {rules.map((rule) => {
            const isEditing = editingRuleId === rule.id;
            const isSelected = selectedRuleSlug === rule.slug;

            return (
              <div
                key={rule.id}
                onClick={() => {
                  setSelectedRuleSlug(rule.slug);
                  setCustomRate(rule.percentualPadrao);
                }}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'border-primary bg-primary-fixed/20 shadow-sm ring-1 ring-primary'
                    : 'border-outline-variant/40 bg-surface-container-low hover:border-primary/50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-on-surface">{rule.nomeModalidade}</span>
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant">
                      {rule.slug}
                    </span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant leading-tight mb-3">
                    {rule.descricao}
                  </p>
                </div>

                <div className="pt-2 border-t border-outline-variant/30 flex items-center justify-between">
                  {isEditing ? (
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="100"
                        value={newRateInput}
                        onChange={(e) => setNewRateInput(Number(e.target.value))}
                        className="w-16 px-1.5 py-0.5 text-xs font-bold border rounded bg-white"
                      />
                      <span className="text-xs font-bold">%</span>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleSaveRule(rule.id)}
                        className="px-2 py-0.5 bg-secondary text-white text-[10px] font-bold rounded disabled:opacity-50"
                      >
                        {saving ? 'Salvando...' : 'Salvar'}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-extrabold text-primary">{rule.percentualPadrao}%</span>
                      <span className="text-[10px] text-outline font-semibold">take-rate</span>
                    </div>
                  )}

                  {!isEditing && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingRuleId(rule.id);
                        setNewRateInput(rule.percentualPadrao);
                      }}
                      className="text-[11px] text-primary hover:underline font-bold"
                    >
                      Ajustar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Simulador Interativo de Transação */}
      <div className="bg-surface-container-low p-5 rounded-xl border border-outline-variant/30 space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface">
          Simulador Dinâmico de Split Fiduciário
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          {/* GMV Input */}
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1">
              Valor Bruto da Transação (R$):
            </label>
            <div className="flex items-center bg-white px-3 py-2 rounded-lg border border-outline-variant/50 focus-within:ring-2 focus-within:ring-primary">
              <span className="text-sm font-bold text-outline mr-2">R$</span>
              <input
                type="number"
                step="1000"
                min="1000"
                value={gmvAmount}
                onChange={(e) => setGmvAmount(Number(e.target.value))}
                className="w-full bg-transparent text-base font-extrabold text-on-surface focus:outline-none"
              />
            </div>
          </div>

          {/* Taxa Aplicada */}
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1">
              Taxa de Comissão Administrativa (%):
            </label>
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-white px-3 py-2 rounded-lg border border-outline-variant/50 flex-1">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  value={activeRate}
                  onChange={(e) => setCustomRate(Number(e.target.value))}
                  className="w-full bg-transparent text-base font-extrabold text-primary focus:outline-none"
                />
                <span className="text-sm font-bold text-outline">%</span>
              </div>
              <div className="flex gap-1">
                {[6, 10, 15, 20].map((quick) => (
                  <button
                    key={quick}
                    type="button"
                    onClick={() => setCustomRate(quick)}
                    className={`px-2 py-2 rounded text-xs font-bold transition-colors ${
                      activeRate === quick
                        ? 'bg-primary text-white'
                        : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
                    }`}
                  >
                    {quick}%
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Info */}
          <div className="text-xs text-on-surface-variant space-y-1">
            <div className="flex items-center gap-1 text-secondary font-bold">
              <span className="material-symbols-outlined text-[16px]">verified</span>
              <span>Split Automático em Conta Segregada</span>
            </div>
            <p>Liquidação instantânea D+0 via SPI/PIX para o fornecedor após liberação na doca.</p>
          </div>
        </div>

        {/* Breakdown de Liquidação */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-outline-variant/20">
          <div className="bg-white p-3.5 rounded-lg border border-outline-variant/30">
            <span className="text-[11px] text-on-surface-variant uppercase font-semibold block">
              Valor Total Transacionado (GMV)
            </span>
            <span className="text-lg font-extrabold text-on-surface">
              R$ {splitResult.valorBrutoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="bg-primary-fixed/30 p-3.5 rounded-lg border border-primary/20">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-on-primary-fixed uppercase font-bold block">
                Comissão Plataforma ({splitResult.percentualComissao}%)
              </span>
              <span className="material-symbols-outlined text-primary text-[18px]">monetization_on</span>
            </div>
            <span className="text-lg font-extrabold text-primary">
              R$ {splitResult.valorComissaoPlataforma.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="bg-secondary-fixed/30 p-3.5 rounded-lg border border-secondary/20">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-on-secondary-fixed uppercase font-bold block">
                Repasse Líquido ao Fornecedor
              </span>
              <span className="material-symbols-outlined text-secondary text-[18px]">payments</span>
            </div>
            <span className="text-lg font-extrabold text-secondary">
              R$ {splitResult.valorRepasseLiquidoFornecedor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
