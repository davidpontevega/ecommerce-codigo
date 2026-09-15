"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchPaymentMethods } from "../services/payment-method.service";

export const paymentMethodsQueryKey = ["payment-methods"] as const;

export function usePaymentMethods() {
  return useQuery({
    queryKey: paymentMethodsQueryKey,
    queryFn: fetchPaymentMethods,
  });
}
