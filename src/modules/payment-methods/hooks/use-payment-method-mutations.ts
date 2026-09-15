"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError } from "@/lib/axios";

import {
  createSetupSession,
  deletePaymentMethod,
} from "../services/payment-method.service";
import { paymentMethodsQueryKey } from "./use-payment-methods";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

/** La tarjeta la guarda el webhook al volver de Stripe, no este hook (D3). */
export function useAddCard() {
  return useMutation({
    mutationFn: createSetupSession,
    onSuccess: ({ url }) => {
      // Checkout alojado: navegación fuera del sitio, no pasa por el router.
      window.location.href = url;
    },
    onError: (error) => {
      toast.error(errorMessage(error, "No se pudo abrir el alta de tarjeta"));
    },
  });
}

export function useDeleteCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deletePaymentMethod(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: paymentMethodsQueryKey });
      toast.success("Tarjeta eliminada");
    },
    onError: (error) => {
      toast.error(errorMessage(error, "No se pudo eliminar la tarjeta"));
    },
  });
}
