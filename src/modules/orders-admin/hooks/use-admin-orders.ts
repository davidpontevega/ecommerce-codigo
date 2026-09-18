"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { ApiError } from "@/lib/axios";

import type { AdminOrdersQueryInput } from "../schemas/admin-order.schema";
import { getAdminOrder, listAdminOrders } from "../services/admin-order.service";

export const adminOrdersQueryKey = ["admin-orders"] as const;

export function useAdminOrders(params: AdminOrdersQueryInput) {
  return useQuery({
    queryKey: [...adminOrdersQueryKey, params],
    queryFn: () => listAdminOrders(params),
    // Evita el parpadeo a skeleton al paginar u ordenar.
    placeholderData: keepPreviousData,
  });
}

export function useAdminOrder(id: string) {
  return useQuery({
    queryKey: [...adminOrdersQueryKey, "detail", id],
    queryFn: () => getAdminOrder(id),
    // Un 404 es la respuesta definitiva: reintentarlo solo retrasa el not-found.
    retry: (failureCount, error) =>
      !(error instanceof ApiError && error.status === 404) && failureCount < 2,
  });
}
