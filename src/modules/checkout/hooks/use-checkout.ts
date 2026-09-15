"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError } from "@/lib/axios";

import type { CheckoutSessionInput } from "../schemas/checkout.schema";
import { createCheckoutSession } from "../services/checkout.service";

/**
 * El carrito **no** se vacía aquí: hasta que Stripe confirme el pago (spec 011)
 * el cliente puede volver atrás y reintentar con las mismas líneas.
 */
export function useCheckout() {
  return useMutation({
    mutationFn: (items: CheckoutSessionInput["items"]) =>
      createCheckoutSession(items),
    onSuccess: ({ url }) => {
      // Checkout alojado por Stripe: es una navegación fuera del sitio, no un
      // `router.push`, así que no pasa por el router de Next.
      window.location.href = url;
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) {
        toast.error("Inicia sesión para completar tu compra");
        return;
      }

      toast.error(
        error instanceof ApiError ? error.message : "No se pudo iniciar el pago",
      );
    },
  });
}
