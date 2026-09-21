"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError } from "@/lib/axios";

import type {
  AdminOrderStatus,
  AdminOrdersQueryInput,
} from "../schemas/admin-order.schema";
import {
  getAdminOrder,
  listAdminOrders,
  updateAdminOrderStatus,
} from "../services/admin-order.service";

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

/**
 * Sin actualización optimista a propósito (AC9): el `Select` sigue mostrando el
 * estado que devolvió el servidor hasta que el refetch confirma el cambio, así
 * un error no deja la UI mintiendo. Invalidar el prefijo cubre lista y detalle.
 */
export function useUpdateAdminOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: AdminOrderStatus }) =>
      updateAdminOrderStatus(id, status),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminOrdersQueryKey });
      toast.success("Estado del pedido actualizado");
    },
    onError: (error) => {
      toast.error(
        error instanceof ApiError
          ? error.message
          : "No se pudo cambiar el estado del pedido",
      );
    },
  });
}
