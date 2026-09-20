import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  isNull,
  lte,
  sql,
  type SQL,
} from "drizzle-orm";

import { logAudit } from "@/lib/audit";
import type {
  ExpenseCreateInput,
  ExpenseQueryInput,
  ExpenseUpdateInput,
} from "@/modules/finance/schemas/expense.schema";
import { db } from "@/server/db";
import { expenses, type Expense } from "@/server/db/schema";

const sortColumns = {
  date: expenses.date,
  amountCents: expenses.amountCents,
  createdAt: expenses.createdAt,
} as const;

const editableKeys = [
  "concept",
  "amountCents",
  "date",
  "category",
] as const satisfies ReadonlyArray<keyof ExpenseUpdateInput & keyof Expense>;

export type ExpenseListResult = {
  data: Expense[];
  total: number;
  page: number;
  pageSize: number;
};

/**
 * Los gastos con soft-delete nunca se listan (AC4): el borrado es lógico para
 * conservar el rastro contable, no para poder volver a verlos en el panel.
 * `to` es **inclusivo** y se compara con `lte` porque `date` es un día, no un
 * instante: no hay que recortarlo al inicio del día siguiente.
 */
export function buildFilters(params: ExpenseQueryInput): SQL | undefined {
  const conditions: Array<SQL | undefined> = [isNull(expenses.deletedAt)];

  if (params.search) {
    conditions.push(ilike(expenses.concept, `%${params.search}%`));
  }

  if (params.category) {
    conditions.push(ilike(expenses.category, `%${params.category}%`));
  }

  if (params.from) {
    conditions.push(gte(expenses.date, params.from));
  }

  if (params.to) {
    conditions.push(lte(expenses.date, params.to));
  }

  return and(...conditions);
}

export async function list(
  params: ExpenseQueryInput,
): Promise<ExpenseListResult> {
  const where = buildFilters(params);
  const column = sortColumns[params.sortBy];
  const orderBy = params.sortDir === "asc" ? asc(column) : desc(column);

  const [rows, totals] = await Promise.all([
    db
      .select()
      .from(expenses)
      .where(where)
      .orderBy(orderBy)
      .limit(params.pageSize)
      .offset((params.page - 1) * params.pageSize),
    db.select({ value: count() }).from(expenses).where(where),
  ]);

  return {
    data: rows,
    total: totals[0]?.value ?? 0,
    page: params.page,
    pageSize: params.pageSize,
  };
}

export async function create(
  input: ExpenseCreateInput,
  actorId?: string | null,
): Promise<Expense> {
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(expenses)
      .values({
        concept: input.concept,
        amountCents: input.amountCents,
        date: input.date,
        category: input.category ?? null,
      })
      .returning();

    if (!created) {
      throw new Error("No se pudo registrar el gasto");
    }

    await logAudit(tx, {
      action: "expense.created",
      entityType: "expense",
      actorId,
      entityId: created.id,
      changes: {
        after: {
          concept: created.concept,
          amountCents: created.amountCents,
          date: created.date,
        },
      },
    });

    return created;
  });
}

/** `null` si el id no existe **o si ya estaba eliminado** (ambos son 404). */
export async function update(
  id: string,
  input: ExpenseUpdateInput,
  actorId?: string | null,
): Promise<Expense | null> {
  return db.transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(expenses)
      .where(and(eq(expenses.id, id), isNull(expenses.deletedAt)))
      .limit(1);

    if (!before) {
      return null;
    }

    const patch = Object.fromEntries(
      editableKeys
        .filter((key) => input[key] !== undefined)
        .map((key) => [key, input[key] ?? null]),
    );

    const [after] = await tx
      .update(expenses)
      .set(patch)
      .where(eq(expenses.id, id))
      .returning();

    if (!after) {
      return null;
    }

    const changedKeys = editableKeys.filter(
      (key) => key in patch && before[key] !== after[key],
    );

    await logAudit(tx, {
      action: "expense.updated",
      entityType: "expense",
      actorId,
      entityId: after.id,
      changes: {
        before: Object.fromEntries(changedKeys.map((key) => [key, before[key]])),
        after: Object.fromEntries(changedKeys.map((key) => [key, after[key]])),
      },
    });

    return after;
  });
}

/** `null` si el id no existe **o si ya estaba eliminado** (ambos son 404). */
export async function softDelete(
  id: string,
  actorId?: string | null,
): Promise<Expense | null> {
  return db.transaction(async (tx) => {
    const [deleted] = await tx
      .update(expenses)
      // reloj de Postgres, igual que created_at/updated_at
      .set({ deletedAt: sql`now()` })
      .where(and(eq(expenses.id, id), isNull(expenses.deletedAt)))
      .returning();

    if (!deleted) {
      return null;
    }

    await logAudit(tx, {
      action: "expense.deleted",
      entityType: "expense",
      actorId,
      entityId: id,
      changes: { after: { deleted: true } },
    });

    return deleted;
  });
}
