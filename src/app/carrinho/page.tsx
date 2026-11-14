'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MOCK_AUCTION_LOTS } from '@/lib/mock-data';
import { calculateSplit } from '@/lib/commission-engine';

export default function CarrinhoPage() {
  const router = useRouter();
  const [cartItems, setCartItems] = useState([
    {
      lot: MOCK_AUCTION_LOTS[0],
      quantidade: 1,
      precoTotal: MOCK_AUCTION_LOTS[0].lanceAtual,
    },
  ]);

  const subtotal = cartItems.reduce((acc, item) => acc + item.precoTotal, 0);
  const split = calculateSplit(subtotal, 'leilao');

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface">
          Carrinho de Arremates & Pedidos B2B
        </h1>
        <p className="text-xs sm:text-sm text-on-surface-variant">
          Confira seus lotes arrematados e avance para a emissão de custódia fiduciária escrow.
        </p>
      </div>

      {cartItems.length === 0 ? (
        <div className="p-12 text-center bg-surface-container-lowest rounded-2xl border border-outline-variant/30 space-y-4">
          <span className="material-symbols-outlined text-outline text-5xl">shopping_cart</span>
          <h3 className="font-bold text-base text-on-surface">Seu carrinho está vazio</h3>
          <p className="text-xs text-on-surface-variant">
            Explore os pregões ao vivo ou o catálogo de alimentos para arrematar lotes.
          </p>
          <Link
            href="/catalogo"
            className="inline-block px-5 py-2.5 bg-primary text-white text-xs font-bold rounded-xl"
          >
            Ver Pregões Abertos
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Items List */}
          <div className="lg:col-span-8 space-y-4">
            {cartItems.map((item, idx) => (
              <div
                key={idx}
                className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 shadow-sm flex flex-col sm:flex-row items-center gap-4"
              >
                <img
                  src={item.lot.produto.imagemUrl}
                  alt={item.lot.produto.titulo}
                  className="w-24 h-24 rounded-xl object-cover shrink-0"
                />

                <div className="flex-1 space-y-1 text-xs">
                  <span className="text-[10px] text-on-surface-variant font-bold uppercase">
                    LOTE #{item.lot.codigoLote} • {item.lot.produto.marca}
                  </span>
                  <h3 className="font-bold text-sm text-on-surface">{item.lot.produto.titulo}</h3>
                  <p className="text-on-surface-variant">
                    Volume: {item.lot.produto.totalCaixas} caixas ({item.lot.produto.paletes} paletes)
                  </p>
                  <p className="text-secondary font-bold">
                    Custo Unitário: R$ {item.lot.precoUnitarioAtual.toFixed(2)} / un
                  </p>
                </div>

                <div className="text-right sm:border-l sm:border-surface-container sm:pl-4">
                  <span className="text-[10px] text-on-surface-variant uppercase font-bold block">
                    Valor do Lote:
                  </span>
                  <span className="text-lg font-extrabold text-primary block">
                    R$ {item.precoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCartItems([])}
                    className="text-[11px] text-error hover:underline font-semibold mt-1"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Summary Box */}
          <div className="lg:col-span-4 bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30 shadow-sm space-y-4 text-xs">
            <h3 className="font-extrabold text-sm text-on-surface uppercase border-b border-surface-container pb-2">
              Resumo Financeiro do Pedido
            </h3>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Subtotal dos Lotes:</span>
                <span className="font-bold text-on-surface">
                  R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Frete Logístico:</span>
                <span className="font-bold text-primary">FOB (A retirar no CD)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Taxa Administrativa ({split.percentualComissao}%):</span>
                <span className="font-bold text-secondary">Inclusa no valor total</span>
              </div>
            </div>

            <div className="pt-3 border-t border-surface-container flex justify-between items-baseline">
              <span className="font-extrabold text-sm text-on-surface">Total em Custódia:</span>
              <span className="text-xl font-extrabold text-primary">
                R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="p-3 bg-secondary-container/20 rounded-xl border border-secondary/30 text-[11px] text-secondary font-semibold">
              <div className="flex items-center gap-1 font-bold mb-0.5">
                <span className="material-symbols-outlined text-[15px]">security</span>
                <span>Custódia Escrow Segregada</span>
              </div>
              O valor permanece retido em conta escrow e só é liberado para a indústria após conferência de lacres na doca.
            </div>

            <button
              type="button"
              onClick={() => router.push(`/checkout?loteId=${cartItems[0].lot.id}&valor=${subtotal}`)}
              className="w-full py-3 bg-primary hover:bg-primary-container text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">lock</span>
              <span>Prosseguir para Checkout Escrow</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
