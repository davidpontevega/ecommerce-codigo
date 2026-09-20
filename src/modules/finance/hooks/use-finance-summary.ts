"use client";

import { useQuery } from "@tanstack/react-query";

import { getFinanceSummary } from "../services/finance.service";

export const financeSummaryQueryKey = ["finance-summary"] as const;

export function useFinanceSummary() {
  return useQuery({
    queryKey: financeSummaryQueryKey,
    queryFn: getFinanceSummary,
  });
}
