"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { ExpenseQueryInput } from "../schemas/expense.schema";
import { listExpenses } from "../services/expense.service";

export const expensesQueryKey = ["expenses"] as const;

export function useExpenses(params: ExpenseQueryInput) {
  return useQuery({
    queryKey: [...expensesQueryKey, params],
    queryFn: () => listExpenses(params),
    // Evita el parpadeo a skeleton al paginar u ordenar.
    placeholderData: keepPreviousData,
  });
}
