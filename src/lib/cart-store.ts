'use client';

import { MOCK_AUCTION_LOTS } from './mock-data';
import { AuctionLot } from './types';

export interface CartItem {
  lot: AuctionLot;
  quantidade: number;
  precoTotal: number;
}

const CART_STORAGE_KEY = 'varejista_b2b_cart_v1';
export const CART_UPDATED_EVENT = 'varejista-cart-updated';

function getInitialDefaultCart(): CartItem[] {
  return [
    {
      lot: MOCK_AUCTION_LOTS[0],
      quantidade: 1,
      precoTotal: MOCK_AUCTION_LOTS[0].lanceAtual,
    },
  ];
}

export function getCartItems(): CartItem[] {
  if (typeof window === 'undefined') return getInitialDefaultCart();
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (raw === null) {
      const initial = getInitialDefaultCart();
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return getInitialDefaultCart();
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
  return updated;
}

export function removeLotFromCart(lotId: string): CartItem[] {
  const updated = getCartItems().filter((item) => item.lot.id !== lotId);
  saveCartItems(updated);
  return updated;
}

export function clearCart(): void {
  saveCartItems([]);
}
