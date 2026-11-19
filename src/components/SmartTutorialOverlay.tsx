'use client';

import React from 'react';
import Link from 'next/link';
import { SMART_TUTORIAL_STEPS, useEnvironment } from '@/components/EnvironmentProvider';

export const SmartTutorialOverlay: React.FC = () => {
  const {
    tutorialOpen,
    tutorialStepIndex,
    openTutorial,
    closeTutorial,
    nextTutorialStep,
    prevTutorialStep,
    goToTutorialStep,
    isDemoMode,
  } = useEnvironment();

  const step = SMART_TUTORIAL_STEPS[tutorialStepIndex] || SMART_TUTORIAL_STEPS[0];
  const isFirst = tutorialStepIndex === 0;
  const isLast = tutorialStepIndex === SMART_TUTORIAL_STEPS.length - 1;

  if (!tutorialOpen) {
    return (
      <button
        type="button"
        onClick={() => openTutorial(tutorialStepIndex)}
        className="fixed bottom-4 right-4 z-40 px-3.5 py-2 rounded-xl bg-primary text-white shadow-xl hover:bg-primary-container transition-all text-xs font-bold flex items-center gap-2 border border-white/20"
        title="Consultar novamente o Tutorial Inteligente"
      >
        <span className="material-symbols-outlined text-[18px]">help</span>
        <span>Tutorial ({tutorialStepIndex + 1}/{SMART_TUTORIAL_STEPS.length})</span>
      </button>
    );
  }

  return (
    <aside
      aria-label="Tutorial Inteligente do Varejista Online"
      className="fixed bottom-3 right-3 left-3 sm:left-auto sm:bottom-5 sm:right-5 sm:w-[390px] z-40 rounded-2xl bg-surface-container-lowest border-2 border-primary/25 shadow-2xl p-4 space-y-3"
    >
      {/* Topo */}
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-extrabold uppercase tracking-wider">
              <span className="material-symbols-outlined text-[13px]">assistant_navigation</span>
              <span>Tutorial Inteligente</span>
            </span>
            <span className="text-[11px] font-bold text-on-surface-variant">
              Passo {tutorialStepIndex + 1} de {SMART_TUTORIAL_STEPS.length}
            </span>
          </div>
          <h4 className="font-extrabold text-sm text-on-surface">{step.titulo}</h4>
        </div>
        <button
          type="button"
          onClick={closeTutorial}
          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-surface-container text-on-surface-variant shrink-0"
          aria-label="Fechar tutorial"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>

      {/* Mensagem contextual */}
      <div className="rounded-xl bg-surface-container-low p-3 space-y-1.5 border border-outline-variant/20">
        <p className="text-xs font-extrabold text-primary">&ldquo;{step.mensagem}&rdquo;</p>
        <p className="text-[11px] text-on-surface-variant leading-relaxed">{step.dica}</p>
      </div>

      {/* Indicadores clicáveis */}
      <div className="flex items-center gap-1.5">
        {SMART_TUTORIAL_STEPS.map((s, idx) => (
          <button
            key={s.id}
            type="button"
            onClick={() => goToTutorialStep(idx)}
            aria-label={`Ir para passo ${idx + 1}: ${s.titulo}`}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              idx === tutorialStepIndex
                ? 'bg-primary'
                : idx < tutorialStepIndex
                ? 'bg-secondary'
                : 'bg-surface-container-high'
            }`}
          />
        ))}
      </div>

      {/* Ações */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={prevTutorialStep}
            disabled={isFirst}
            className="px-2.5 py-1.5 rounded-lg border border-outline-variant/40 text-[11px] font-bold text-on-surface hover:bg-surface-container disabled:opacity-40"
          >
            Voltar
          </button>
          {!isLast ? (
            <button
              type="button"
              onClick={nextTutorialStep}
              className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-container text-white text-[11px] font-bold"
            >
              Avançar
            </button>
          ) : (
            <button
              type="button"
              onClick={closeTutorial}
              className="px-3 py-1.5 rounded-lg bg-secondary text-white text-[11px] font-bold hover:opacity-95"
            >
              Concluir
            </button>
          )}
        </div>

        <Link
          href={isDemoMode ? `${step.href}?env=modelo` : step.href}
          className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
        >
          <span>{step.ctaLabel}</span>
          <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
        </Link>
      </div>
    </aside>
  );
};
