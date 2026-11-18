'use client';

import { AuctionLot } from './types';

export interface CartItem {
  lot: AuctionLot;
  quantidade: number;
  precoTotal: number;
}

const CART_STORAGE_KEY = 'varejista_b2b_cart_v1';
export const CART_UPDATED_EVENT = 'varejista-cart-updated';

export function getCartItems(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCartItems(items: CartItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event(CART_UPDATED_EVENT));
  } catch {
    // ignore storage quota errors
  }
}

export function addLotToCart(lot: AuctionLot, customPrice?: number): CartItem[] {
  const current = getCartItems();
  const unitLotPrice = customPrice ?? lot.precoArremateImediato ?? lot.lanceAtual;
  const existingIdx = current.findIndex((item) => item.lot.id === lot.id);

  let updated: CartItem[];
  if (existingIdx !== -1) {
    updated = current.map((item, idx) =>
      idx === existingIdx
        ? {
            ...item,
            lot,
            quantidade: item.quantidade + 1,
            precoTotal: Number(((item.quantidade + 1) * unitLotPrice).toFixed(2)),
          }
        : item
    );
  } else {
    updated = [
      ...current,
      {
        lot,
        quantidade: 1,
        precoTotal: unitLotPrice,
      },
    ];
  }

  saveCartItems(updated);

  if (typeof window !== 'undefined') {
    void fetch('/api/carrinho', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loteId: lot.id, quantidade: 1 }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data?.items)) {
          saveCartItems(data.items);
        }
      })
      .catch(() => {});
  }

  return updated;
}

export function removeLotFromCart(lotId: string): CartItem[] {
  const updated = getCartItems().filter((item) => item.lot.id !== lotId);
  saveCartItems(updated);

  if (typeof window !== 'undefined') {
    void fetch(`/api/carrinho?loteId=${encodeURIComponent(lotId)}`, {
      method: 'DELETE',
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data?.items)) {
          saveCartItems(data.items);
        }
      })
      .catch(() => {});
  }

  return updated;
}

export function updateLotQuantity(lotId: string, delta: number): CartItem[] {
  let targetNextQty = 1;
  const updated = getCartItems().map((item) => {
    if (item.lot.id !== lotId) return item;
    const unitLotPrice =
      item.quantidade > 0
        ? item.precoTotal / item.quantidade
        : item.lot.precoArremateImediato ?? item.lot.lanceAtual;
    const nextQty = Math.max(1, item.quantidade + delta);
    targetNextQty = nextQty;
    return {
      ...item,
      quantidade: nextQty,
      precoTotal: Number((nextQty * unitLotPrice).toFixed(2)),
    };
  });
  saveCartItems(updated);

  if (typeof window !== 'undefined') {
    void fetch('/api/carrinho', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loteId: lotId, quantidade: targetNextQty }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data?.items)) {
          saveCartItems(data.items);
        }
      })
      .catch(() => {});
  }

  return updated;
}

export function clearCart(): void {
  saveCartItems([]);
  if (typeof window !== 'undefined') {
    void fetch('/api/carrinho?clear=1', { method: 'DELETE' }).catch(() => {});
  }
}

export async function syncCartFromServer(): Promise<CartItem[]> {
  if (typeof window === 'undefined') return [];
  try {
    const res = await fetch('/api/carrinho', { cache: 'no-store' });
    if (!res.ok) return getCartItems();
    const data = await res.json();
    if (Array.isArray(data?.items)) {
      saveCartItems(data.items);
      return data.items;
    }
  } catch {
    // keep local cache if unauthenticated
  }
  return getCartItems();
}
