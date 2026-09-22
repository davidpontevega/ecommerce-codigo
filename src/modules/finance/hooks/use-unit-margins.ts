"use client";

import { useQuery } from "@tanstack/react-query";

import { listUnitMargins } from "../services/finance.service";

export const unitMarginsQueryKey = ["finance-unit-margins"] as const;

export function useUnitMargins() {
  return useQuery({
    queryKey: unitMarginsQueryKey,
    queryFn: listUnitMargins,
  });
}
