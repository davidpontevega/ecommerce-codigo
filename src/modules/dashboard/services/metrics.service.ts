import { api } from "@/lib/axios";

import type { DashboardMetrics } from "../types/metrics.types";

export async function getAdminMetrics(): Promise<DashboardMetrics> {
  const { data } = await api.get<DashboardMetrics>("/admin/metrics");
  return data;
}
