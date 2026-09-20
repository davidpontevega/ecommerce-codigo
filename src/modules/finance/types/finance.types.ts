import type { Expense, NewExpense } from "@/server/db/schema";

export type { Expense, NewExpense };

/**
 * Lo que realmente recibe el cliente: `NextResponse.json` serializa las columnas
 * `timestamptz` a string ISO, no a `Date`. `date` ya viaja como `YYYY-MM-DD`
 * porque la columna está declarada con `mode: "string"`.
 */
export type ExpenseDto = Omit<
  Expense,
  "createdAt" | "updatedAt" | "deletedAt"
> & {
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type ExpenseListResponse = {
  data: ExpenseDto[];
  total: number;
  page: number;
  pageSize: number;
};

/** Resumen de caja del mes en curso (spec 017 D4): mes fijo, sin rango. */
export type FinanceSummary = {
  /** `YYYY-MM` del mes calendario de Lima que se está resumiendo. */
  month: string;
  incomeCents: number;
  expenseCents: number;
  netCents: number;
};
