"use client";

import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError } from "@/lib/axios";

import type {
  ExpenseCreateInput,
  ExpenseUpdateInput,
} from "../schemas/expense.schema";
import {
  createExpense,
  deleteExpense,
  updateExpense,
} from "../services/expense.service";
import { expensesQueryKey } from "./use-expenses";
import { financeSummaryQueryKey } from "./use-finance-summary";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

/**
 * Toda mutación mueve las dos vistas: la tabla y los totales del mes. Invalidar
 * solo la lista dejaría las cards mostrando la caja de antes del cambio (AC5).
 */
function refreshFinance(queryClient: QueryClient): Promise<void[]> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: expensesQueryKey }),
    queryClient.invalidateQueries({ queryKey: financeSummaryQueryKey }),
  ]);
}

export function useCreateExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ExpenseCreateInput) => createExpense(input),
    onSuccess: async () => {
      await refreshFinance(queryClient);
      toast.success("Gasto registrado");
    },
    onError: (error) => {
      toast.error(errorMessage(error, "No se pudo registrar el gasto"));
    },
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ExpenseUpdateInput }) =>
      updateExpense(id, input),
    onSuccess: async () => {
      await refreshFinance(queryClient);
      toast.success("Gasto actualizado");
    },
    onError: (error) => {
      toast.error(errorMessage(error, "No se pudo actualizar el gasto"));
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteExpense(id),
    onSuccess: async () => {
      await refreshFinance(queryClient);
      toast.success("Gasto eliminado");
    },
    onError: (error) => {
      toast.error(errorMessage(error, "No se pudo eliminar el gasto"));
    },
  });
}
