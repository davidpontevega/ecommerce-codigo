import { and, eq, gte, isNull, lt, sql, type AnyColumn } from "drizzle-orm";

import { limaDay, limaMonthRange, startOfLimaDay } from "@/lib/utils";
import type { FinanceSummary } from "@/modules/finance/types/finance.types";
import { db } from "@/server/db";
import { expenses, orders } from "@/server/db/schema";

/** `coalesce` porque `sum()` sin filas devuelve `NULL`, no 0 (AC3). */
const sumCents = (column: AnyColumn) =>
  sql<number>`coalesce(sum(${column}), 0)::int`;

/** Solo pedidos `paid`: un `pending` todavía no es caja (AC2). */
async function incomeBetween(from: Date, to: Date): Promise<number> {
  const [row] = await db
    .select({ value: sumCents(orders.totalCents) })
    .from(orders)
    .where(
      and(
        eq(orders.status, "paid"),
        gte(orders.createdAt, from),
        lt(orders.createdAt, to),
      ),
    );

  return row?.value ?? 0;
}

/** `expenses.date` ya es un día local: se compara con los strings del rango. */
async function expensesBetween(from: string, to: string): Promise<number> {
  const [row] = await db
    .select({ value: sumCents(expenses.amountCents) })
    .from(expenses)
    .where(
      and(
        isNull(expenses.deletedAt),
        gte(expenses.date, from),
        lt(expenses.date, to),
      ),
    );

  return row?.value ?? 0;
}

/**
 * Ingresos y egresos del mes en curso con **una** ventana común, calculada una
 * sola vez: pedirla por consulta dejaría las dos mitades en meses distintos si
 * la petición cae justo en el cambio de mes.
 */
export async function getMonthSummary(
  today = limaDay(),
): Promise<FinanceSummary> {
  const { from, to } = limaMonthRange(today);

  const [incomeCents, expenseCents] = await Promise.all([
    // `orders.created_at` es `timestamptz`: el mismo día necesita el offset de Lima.
    incomeBetween(startOfLimaDay(from), startOfLimaDay(to)),
    expensesBetween(from, to),
  ]);

  return {
    month: from.slice(0, 7),
    incomeCents,
    expenseCents,
    netCents: incomeCents - expenseCents,
  };
}
