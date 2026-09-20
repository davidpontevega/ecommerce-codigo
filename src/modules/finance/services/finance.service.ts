import { api } from "@/lib/axios";

import type { FinanceSummary } from "../types/finance.types";

export async function getFinanceSummary(): Promise<FinanceSummary> {
  const { data } = await api.get<FinanceSummary>("/admin/finance/summary");
  return data;
}
