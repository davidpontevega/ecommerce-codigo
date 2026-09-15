"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { CartLine } from "@/modules/storefront/types/storefront.types";

type CartState = {
  lines: CartLine[];
  /** No pasa de `product.stock`; con stock 0 no crea línea. */
  add: (product: Omit<CartLine, "qty">) => void;
  /** Se acota a `[0, line.stock]`; `qty <= 0` elimina la línea. */
  setQty: (id: string, qty: number) => void;
  clear: () => void;
};

/**
 * Carrito persistido en `localStorage`. La spec 008 lo moverá a `carts`/
 * `cart_items` en servidor; hasta entonces esto evita perder el carrito en cada
 * recarga (bloqueaba el QA del checkout de la spec 010).
 */
export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      add: (product) =>
        set((state) => {
          const existing = state.lines.find((line) => line.id === product.id);

          if (!existing) {
            // Sin stock no hay línea que crear: el "+" ya viene `disabled`, esto
            // es la guardia del propio store.
            return product.stock > 0
              ? { lines: [...state.lines, { ...product, qty: 1 }] }
              : state;
          }

          return {
            lines: state.lines.map((line) =>
              line.id === product.id
                ? { ...line, qty: Math.min(line.qty + 1, line.stock) }
                : line,
            ),
          };
        }),
      setQty: (id, qty) =>
        set((state) => {
          const target = state.lines.find((line) => line.id === id);

          if (!target) return state;

          // El tope vive aquí y no en cada llamador: el control de cantidad y el
          // stepper del drawer llaman a `setQty` por separado.
          const next = Math.min(Math.max(qty, 0), target.stock);

          return {
            lines:
              next <= 0
                ? state.lines.filter((line) => line.id !== id)
                : state.lines.map((line) =>
                    line.id === id ? { ...line, qty: next } : line,
                  ),
          };
        }),
      clear: () => set({ lines: [] }),
    }),
    { name: "cart" },
  ),
);

/** Derivados como funciones puras: un selector que crea objeto re-renderiza siempre. */
export const cartCount = (lines: CartLine[]): number =>
  lines.reduce((total, line) => total + line.qty, 0);

/** Suma en centavos enteros: nunca `float`. */
export const cartSubtotalCents = (lines: CartLine[]): number =>
  lines.reduce((total, line) => total + line.priceCents * line.qty, 0);
