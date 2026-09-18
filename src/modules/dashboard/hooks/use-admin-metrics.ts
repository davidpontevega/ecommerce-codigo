"use client";

import { useQuery } from "@tanstack/react-query";

import { getAdminMetrics } from "../services/metrics.service";

/** "En vivo" = polling (spec 015 D1): el stack no tiene websockets ni SSE. */
export const METRICS_REFETCH_MS = 60_000;

export function useAdminMetrics() {
  return useQuery({
    queryKey: ["admin-metrics"],
    queryFn: getAdminMetrics,
    refetchInterval: METRICS_REFETCH_MS,
  });
}
