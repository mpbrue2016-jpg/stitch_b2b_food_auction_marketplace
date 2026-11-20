'use client';

import React from 'react';
import Link from 'next/link';
import { useEnvironment } from '@/components/EnvironmentProvider';
import { useAuth } from '@/components/AuthProvider';

interface DemoBadgeProps {
  variant?: 'amber' | 'blue';
  compact?: boolean;
  label?: string;
  className?: string;
}

export const DemoBadge: React.FC<DemoBadgeProps> = ({
  variant = 'amber',
  compact = false,
  label = 'MODELO — DEMONSTRAÇÃO',
  className = '',
}) => {
  const tone =
    variant === 'blue'
      ? 'bg-blue-600 text-white border-blue-700'
      : 'bg-amber-400 text-slate-950 border-amber-500';

  return (
    <span
      className={`inline-flex items-center gap-1.5 border font-extrabold uppercase tracking-wider shadow-xs select-none ${
        compact ? 'px-2 py-0.5 text-[9px] rounded-md' : 'px-2.5 py-1 text-[10px] rounded-lg'
      } ${tone} ${className}`}
    >
      <span className="material-symbols-outlined text-[13px]">school</span>
      <span>{label}</span>
    </span>
  );
};

export const DidacticHint: React.FC<{
  title: string;
  text?: string;
  description?: string;
  className?: string;
}> = ({ title, text, description, className = '' }) => {
  const body = text ?? description ?? '';
  return (
    <div
      className={`rounded-xl bg-blue-50 border border-blue-200 px-3.5 py-2.5 text-xs text-blue-950 flex items-start gap-2.5 ${className}`}
    >
      <span className="material-symbols-outlined text-blue-600 text-[18px] shrink-0 mt-0.5">
        tips_and_updates
      </span>
      <div className="leading-relaxed">
        <strong className="font-bold text-blue-900">{title}: </strong>
        <span>{body}</span>
      </div>
    </div>
  );
};

export const EnvironmentModeBanner: React.FC = () => {
  const { user, profile } = useAuth();
  const { isDemoMode, setEnvMode, openTutorial } = useEnvironment();

  if (isDemoMode) {
    return (
      <div className="bg-amber-50 border-b border-amber-300 text-amber-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
          <div className="flex items-center flex-wrap gap-2">
            <DemoBadge compact />
            <span className="font-semibold">
              Você está explorando o <strong>Ambiente Modelo</strong> (dados fictícios para aprendizagem). Operações comerciais são simuladas.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => openTutorial(0)}
              className="px-2.5 py-1 rounded-lg bg-white border border-amber-300 hover:bg-amber-100 font-bold text-[11px] flex items-center gap-1 transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">help</span>
              <span>Tutorial</span>
            </button>
            {user && profile ? (
              <button
                type="button"
                onClick={() => setEnvMode('original')}
                className="px-3 py-1 rounded-lg bg-secondary text-white hover:opacity-95 font-bold text-[11px] flex items-center gap-1 transition-opacity"
              >
                <span className="material-symbols-outlined text-[14px]">verified_user</span>
                <span>Ir para Minha Conta Original</span>
              </button>
            ) : (
              <Link
                href="/cadastro"
                className="px-3 py-1 rounded-lg bg-primary text-white hover:bg-primary-container font-bold text-[11px] flex items-center gap-1 transition-colors"
              >
                <span>Começar Cadastro Oficial</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-secondary-container/25 border-b border-secondary/20 text-on-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-1.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary text-white font-bold text-[10px] uppercase tracking-wider">
            <span className="material-symbols-outlined text-[12px]">verified</span>
            <span>AMBIENTE ORIGINAL • CONTA REAL</span>
          </span>
          <span className="font-medium text-on-surface-variant">
            Dados exclusivos da sua conta ({profile?.nomeFantasia || profile?.razaoSocial || user?.email}). Registros demonstrativos ocultos.
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => openTutorial(0)}
            className="px-2.5 py-0.5 rounded-lg bg-white border border-outline-variant/40 hover:bg-surface-container font-bold text-[11px] text-on-surface"
          >
            Reabrir Tutorial
          </button>
          <button
            type="button"
            onClick={() => setEnvMode('modelo')}
            className="px-2.5 py-0.5 rounded-lg bg-amber-400 text-slate-950 hover:bg-amber-300 font-bold text-[11px]"
          >
            Explorar Ambiente Modelo
          </button>
        </div>
      </div>
    </div>
  );
};
