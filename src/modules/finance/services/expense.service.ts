import { api } from "@/lib/axios";

import type {
  ExpenseCreateInput,
  ExpenseQueryInput,
  ExpenseUpdateInput,
} from "../schemas/expense.schema";
import type { ExpenseDto, ExpenseListResponse } from "../types/finance.types";

const RESOURCE = "/admin/expenses";

export async function listExpenses(
  params: ExpenseQueryInput,
): Promise<ExpenseListResponse> {
  const { data } = await api.get<ExpenseListResponse>(RESOURCE, { params });
  return data;
}

export async function createExpense(
  input: ExpenseCreateInput,
): Promise<ExpenseDto> {
  const { data } = await api.post<ExpenseDto>(RESOURCE, input);
  return data;
}

export async function updateExpense(
  id: string,
  input: ExpenseUpdateInput,
): Promise<ExpenseDto> {
  const { data } = await api.patch<ExpenseDto>(`${RESOURCE}/${id}`, input);
  return data;
}

export async function deleteExpense(id: string): Promise<ExpenseDto> {
  const { data } = await api.delete<ExpenseDto>(`${RESOURCE}/${id}`);
  return data;
}
