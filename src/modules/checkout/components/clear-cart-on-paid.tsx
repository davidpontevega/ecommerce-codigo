"use client";

import { useEffect } from "react";

import { useCartStore } from "@/modules/cart/store/cart-store";

/**
 * Vacía el carrito de `localStorage` al volver de Stripe. La página solo la monta
 * cuando el pedido ya está `paid` (D3): un pago aún pendiente no debe borrar lo
 * que el comprador podría necesitar reintentar.
 */
export function ClearCartOnPaid() {
  const clear = useCartStore((state) => state.clear);

  useEffect(() => {
    clear();
  }, [clear]);

  return null;
}
