'use client';

import React, { useState, useEffect } from 'react';
import { AuctionLot } from '@/lib/types';

interface BidModalProps {
  lot: AuctionLot;
  isOpen: boolean;
  onClose: () => void;
  onBidSuccess: (
    newBidAmount: number,
    updatedTerminaEm?: string,
    extendedDueToAntiSniping?: boolean
  ) => void;
}

export const BidModal: React.FC<BidModalProps> = ({
  lot,
  isOpen,
  onClose,
  onBidSuccess,
}) => {
  const minNextBid = lot.lanceAtual + lot.incrementoMinimo;
  const [bidAmount, setBidAmount] = useState<number>(minNextBid);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [antiSnipingExtended, setAntiSnipingExtended] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const isExpired =
    lot.status === 'encerrado' ||
    lot.status === 'homologado' ||
    new Date(lot.terminaEm).getTime() <= nowMs;

  useEffect(() => {
    if (isOpen) {
      setBidAmount(lot.lanceAtual + lot.incrementoMinimo);
      setErrorMsg(null);
      setTxHash(null);
      setAntiSnipingExtended(false);
      setSuccess(false);
      setNowMs(Date.now());
      const timer = setInterval(() => setNowMs(Date.now()), 1000);
      return () => clearInterval(timer);
    }
  }, [isOpen, lot.lanceAtual, lot.incrementoMinimo]);

  if (!isOpen) return null;

  const handleIncrement = (inc: number) => {
    setBidAmount((prev) => prev + inc);
  };

  const calculatedUnitPrice =
    lot.produto.totalUnidades > 0
      ? (bidAmount / lot.produto.totalUnidades).toFixed(2)
      : '0.00';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isExpired) {
      setErrorMsg('Pregão eletrônico encerrado. Não são aceitos novos lances.');
      return;
    }
    if (bidAmount < minNextBid) {
      setErrorMsg(`O valor mínimo para o próximo lance é R$ ${minNextBid.toLocaleString('pt-BR')}`);
      return;
    }
    setErrorMsg(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/lances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loteId: lot.id,
          valorLance: bidAmount,
          compradorId: 'user-varejista-01',
          empresaNome: 'Supermercado Central Ltda',
          cnpj: '12.***.***/0001-90',
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data?.error || 'Não foi possível homologar o lance no pregão.');
        setSubmitting(false);
        return;
      }

      const isExtended = Boolean(data.extendedDueToAntiSniping);
      setTxHash(data.transactionHash || null);
      setAntiSnipingExtended(isExtended);
      setSubmitting(false);
      setSuccess(true);
      onBidSuccess(bidAmount, data.lot?.terminaEm, isExtended);
      setTimeout(() => {
        setSuccess(false);
        setTxHash(null);
        setAntiSnipingExtended(false);
        onClose();
      }, 1900);
    } catch {
      setErrorMsg('Erro de comunicação com o livro de ofertas. Tente novamente.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-container-lowest rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-outline-variant/30 space-y-5 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-surface-container">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[24px]">gavel</span>
            <div>
              <h3 className="font-extrabold text-base text-on-surface">Confirmar Lance no Pregão</h3>
              <p className="text-xs text-on-surface-variant font-bold">{lot.codigoLote} • {lot.produto.titulo}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-container text-on-surface-variant"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {success ? (
          <div className="p-8 text-center space-y-3 bg-secondary-container/20 rounded-xl border border-secondary/30">
            <span className="material-symbols-outlined text-secondary text-5xl">check_circle</span>
            <h4 className="font-bold text-lg text-secondary">Lance Registrado com Sucesso!</h4>
            <p className="text-xs text-on-surface-variant">
              Seu lance de <strong>R$ {bidAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong> foi registrado no livro de ofertas sob custódia BACEN.
            </p>
            {antiSnipingExtended && (
              <p className="text-[11px] font-bold text-tertiary bg-tertiary-container/30 px-3 py-1.5 rounded-lg border border-tertiary/30">
                Regra Anti-Sniping ativada: cronômetro estendido em +3 minutos!
              </p>
            )}
            {txHash && (
              <p className="text-[11px] font-mono text-primary bg-white/80 px-3 py-1 rounded-lg inline-block border border-outline-variant/40">
                Auditoria WORM: {txHash}
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Informações Atuais */}
            <div className="grid grid-cols-2 gap-3 bg-surface-container-low p-3.5 rounded-xl text-xs">
              <div>
                <span className="text-on-surface-variant block">Lance Atual:</span>
                <span className="text-sm font-extrabold text-primary">
                  R$ {lot.lanceAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-on-surface-variant block">Próximo Lance Mínimo:</span>
                <span className="text-sm font-extrabold text-secondary">
                  R$ {minNextBid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {isExpired && (
              <div className="p-2.5 bg-error-container text-on-error-container rounded-lg text-xs font-bold">
                Pregão eletrônico encerrado para novos lances.
              </div>
            )}

            {/* Input de Lance com botões de incremento rápido */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-on-surface uppercase tracking-wide">
                Seu Lance no Lote Fechado (R$):
              </label>
              <div className="flex items-center bg-surface-container rounded-xl px-3 py-2 border-2 border-primary/20 focus-within:border-primary">
                <span className="text-base font-bold text-primary mr-2">R$</span>
                <input
                  type="number"
                  step="50"
                  min={minNextBid}
                  value={bidAmount}
                  disabled={isExpired}
                  onChange={(e) => setBidAmount(Number(e.target.value))}
                  className="w-full bg-transparent text-xl font-extrabold text-on-surface focus:outline-none disabled:opacity-50"
                  required
                />
              </div>

              {/* Botões de incremento rápido */}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[10px] text-outline font-bold uppercase">Incrementos:</span>
                {[500, 1000, 2500, 5000].map((inc) => (
                  <button
                    key={inc}
                    type="button"
                    disabled={isExpired}
                    onClick={() => handleIncrement(inc)}
                    className="px-2.5 py-1 rounded bg-surface-container hover:bg-surface-container-high text-xs font-bold text-primary transition-colors disabled:opacity-45"
                  >
                    + R$ {inc.toLocaleString('pt-BR')}
                  </button>
                ))}
              </div>
            </div>

            {/* Resumo da Valoração e Custo Unitário */}
            <div className="bg-surface-container p-3 rounded-lg text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Custo Unitário Calculado:</span>
                <span className="font-bold text-secondary">R$ {calculatedUnitPrice} / un</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Volume Total:</span>
                <span className="font-medium text-on-surface">
                  {lot.produto.totalCaixas} caixas ({lot.produto.totalUnidades.toLocaleString('pt-BR')} unidades)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Custódia Fiduciária:</span>
                <span className="text-[10px] text-secondary font-bold">100% Garantida via Escrow D+0</span>
              </div>
            </div>

            {errorMsg && (
              <div className="p-2.5 bg-error-container text-on-error-container rounded-lg text-xs font-bold">
                {errorMsg}
              </div>
            )}

            {/* CTA Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 px-4 rounded-xl border border-outline-variant text-xs font-bold text-on-surface hover:bg-surface-container transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting || isExpired || bidAmount < minNextBid}
                className="flex-1 py-2.5 px-4 rounded-xl bg-primary hover:bg-primary-container text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isExpired ? (
                  <span>Pregão Encerrado</span>
                ) : submitting ? (
                  <span>Registrando...</span>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">gavel</span>
                    <span>Confirmar Lance</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
