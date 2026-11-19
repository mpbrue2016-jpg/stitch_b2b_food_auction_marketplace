'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  CART_UPDATED_EVENT,
  CartItem,
  clearCart,
  getCartItems,
  removeLotFromCart,
  syncCartFromServer,
  updateLotQuantity,
} from '@/lib/cart-store';
import { useEnvironment } from '@/components/EnvironmentProvider';
import { DemoBadge, DidacticHint } from '@/components/DemoBadge';
import { calculateSplit, SplitCalculationResult } from '@/lib/commission-engine';
import { ProductCategory } from '@/lib/types';

export default function CarrinhoPage() {
  const router = useRouter();
  const {
    isDemoMode,
    sandbox,
    simulateUpdateCartQty,
    simulateRemoveFromCart,
    simulateClearCart,
  } = useEnvironment();
  const [realCartItems, setRealCartItems] = useState<CartItem[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const envQuery = isDemoMode ? 'modelo' : 'original';

    if (isDemoMode) {
      fetch(`/api/categorias?env=modelo`, { cache: 'no-store' })
        .then((res) => (res.ok ? res.json() : null))
        .then((catsData) => {
          if (Array.isArray(catsData?.categories)) setCategories(catsData.categories);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
      return;
    }

    const syncLocal = () => setRealCartItems(getCartItems());
    syncLocal();

    Promise.all([
      syncCartFromServer(),
      fetch(`/api/categorias?env=${envQuery}`, { cache: 'no-store' })
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null),
    ])
      .then(([items, catsData]) => {
        setRealCartItems(items);
        if (Array.isArray(catsData?.categories)) {
          setCategories(catsData.categories);
        }
      })
      .finally(() => setLoading(false));

    window.addEventListener(CART_UPDATED_EVENT, syncLocal);
    return () => window.removeEventListener(CART_UPDATED_EVENT, syncLocal);
  }, [isDemoMode]);

  const cartItems: CartItem[] = isDemoMode ? sandbox.simulatedCart : realCartItems;
  const subtotal = cartItems.reduce((acc, item) => acc + item.precoTotal, 0);
  const modalidade = cartItems[0]?.lot.tipoVenda || 'leilao';
  const freightTypes = Array.from(new Set(cartItems.map((item) => item.lot.tipoFrete || 'FOB')));
  const freightLabel =
    freightTypes.length > 1
      ? 'Misto (FOB / CIF)'
      : freightTypes[0] === 'CIF'
      ? 'CIF (Entrega pela Indústria)'
      : 'FOB (A retirar no CD)';

  const [split, setSplit] = useState<SplitCalculationResult>(() =>
    calculateSplit(0, modalidade)
  );

  useEffect(() => {
    if (subtotal <= 0) {
      setSplit(calculateSplit(0, modalidade));
      return;
    }
    let active = true;
    fetch(
      `/api/comissoes?env=${isDemoMode ? 'modelo' : 'original'}&amount=${encodeURIComponent(subtotal)}&modalidade=${encodeURIComponent(modalidade)}`
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.split) setSplit(data.split);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [subtotal, modalidade, isDemoMode]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="space-y-1">
        {isDemoMode && (
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <DemoBadge compact />
            <span className="text-[11px] font-bold text-amber-800">
              Carrinho Simulado — Ambiente Modelo
            </span>
          </div>
        )}
        <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface">
          Carrinho de Arremates &amp; Pedidos B2B
        </h1>
        <p className="text-xs sm:text-sm text-on-surface-variant">
          Confira seus lotes arrematados e avance para a emissão de custódia fiduciária escrow.
        </p>
      </div>

      {isDemoMode && (
        <DidacticHint
          title="Simulação de Carrinho B2B"
          text="Adicione lotes do catálogo demonstrativo para testar o cálculo automático do Split Escrow antes de criar sua conta comercial."
        />
      )}

      {loading ? (
        <div className="p-12 text-center bg-surface-container-lowest rounded-2xl border border-outline-variant/30 space-y-3">
          <div className="w-8 h-8 rounded-full border-4 border-primary/20 border-t-primary animate-spin mx-auto" />
          <p className="text-xs font-bold text-on-surface-variant">Sincronizando carrinho B2B...</p>
        </div>
      ) : cartItems.length === 0 ? (
        <div className="p-12 text-center bg-surface-container-lowest rounded-2xl border border-outline-variant/30 space-y-4">
          <span className="material-symbols-outlined text-outline text-5xl">shopping_cart</span>
          <h3 className="font-bold text-base text-on-surface">Seu carrinho está vazio</h3>
          <p className="text-xs text-on-surface-variant">
            {isDemoMode
              ? 'Adicione lotes demonstrativos do catálogo para simular o pagamento Escrow.'
              : 'Explore os pregões ao vivo ou o catálogo real para arrematar lotes.'}
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
            {cartItems.map((item) => (
              <div
                key={item.lot.id}
                className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 shadow-sm flex flex-col sm:flex-row items-center gap-4"
              >
                <div className="relative w-24 h-24 rounded-xl overflow-hidden bg-surface-container shrink-0">
                  <Image
                    src={item.lot.produto.imagemUrl}
                    alt={item.lot.produto.titulo}
                    fill
                    sizes="96px"
                    quality={92}
                    referrerPolicy="no-referrer"
                    className="object-cover img-sharp"
                  />
                </div>

                <div className="flex-1 space-y-1 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    {(isDemoMode || item.lot.isDemo) && <DemoBadge compact />}
                    <span className="text-[10px] text-on-surface-variant font-bold uppercase">
                      LOTE #{item.lot.codigoLote} •{' '}
                      {categories.find((c) => c.id === item.lot.produto.categoriaId)?.nome || 'Geral B2B'} •{' '}
                      {item.lot.produto.marca}
                    </span>
                  </div>
                  <h3 className="font-bold text-sm text-on-surface">
                    <Link href={`/leiloes/${item.lot.id}`} className="hover:text-primary transition-colors">
                      {item.lot.produto.titulo}
                    </Link>
                  </h3>
                  <p className="text-on-surface-variant">
                    Volume: {item.lot.produto.totalCaixas} caixas ({item.lot.produto.paletes} paletes)
                  </p>
                  <p className="text-secondary font-bold">
                    Custo Unitário: R$ {item.lot.precoUnitarioAtual.toFixed(2)} / un
                  </p>
                </div>

                <div className="flex flex-col items-end gap-1.5 sm:border-l sm:border-surface-container sm:pl-4">
                  <span className="text-[10px] text-on-surface-variant uppercase font-bold block">
                    Valor do Lote ({item.quantidade}x):
                  </span>
                  <span className="text-lg font-extrabold text-primary block">
                    R$ {item.precoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                  <div className="flex items-center gap-1 bg-surface-container-low rounded-lg p-0.5 border border-outline-variant/30">
                    <button
                      type="button"
                      onClick={() =>
                        isDemoMode
                          ? simulateUpdateCartQty(item.lot.id, Math.max(1, item.quantidade - 1))
                          : setRealCartItems(updateLotQuantity(item.lot.id, -1))
                      }
                      disabled={item.quantidade <= 1}
                      className="w-6 h-6 rounded flex items-center justify-center font-bold text-xs hover:bg-white disabled:opacity-40"
                      aria-label="Diminuir quantidade"
                    >
                      −
                    </button>
                    <span className="px-2 text-xs font-extrabold">{item.quantidade}</span>
                    <button
                      type="button"
                      onClick={() =>
                        isDemoMode
                          ? simulateUpdateCartQty(item.lot.id, item.quantidade + 1)
                          : setRealCartItems(updateLotQuantity(item.lot.id, 1))
                      }
                      className="w-6 h-6 rounded flex items-center justify-center font-bold text-xs hover:bg-white"
                      aria-label="Aumentar quantidade"
                    >
                      +
                    </button>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    {cartItems.length > 1 && (
                      <Link
                        href={`/checkout?loteId=${item.lot.id}&sourceType=buy_now&valor=${item.precoTotal}`}
                        className="text-[11px] text-primary hover:underline font-bold"
                      >
                        Pagar só este
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        isDemoMode
                          ? simulateRemoveFromCart(item.lot.id)
                          : setRealCartItems(removeLotFromCart(item.lot.id))
                      }
                      className="text-[11px] text-error hover:underline font-semibold"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              </div>
            ))}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  if (isDemoMode) {
                    simulateClearCart();
                  } else {
                    clearCart();
                    setRealCartItems([]);
                  }
                }}
                className="text-xs text-outline hover:text-error font-semibold"
              >
                Limpar carrinho
              </button>
            </div>
          </div>

          {/* Summary Box */}
          <div className="lg:col-span-4 bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30 shadow-sm space-y-4 text-xs">
            <h3 className="font-extrabold text-sm text-on-surface uppercase border-b border-surface-container pb-2">
              {isDemoMode ? 'Resumo Simulado do Pedido' : 'Resumo Financeiro do Pedido'}
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
                <span className="font-bold text-primary">{freightLabel}</span>
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
              onClick={() =>
                router.push(
                  cartItems.length > 1
                    ? '/checkout?fromCart=1'
                    : `/checkout?fromCart=1&loteId=${cartItems[0].lot.id}&sourceType=buy_now&valor=${subtotal}`
                )
              }
              className="w-full py-3 bg-primary hover:bg-primary-container text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">lock</span>
              <span>
                {isDemoMode
                  ? 'Simular Checkout Escrow (Modelo)'
                  : cartItems.length > 1
                  ? `Prosseguir para Checkout (${cartItems.length} lotes)`
                  : 'Prosseguir para Checkout Escrow'}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

