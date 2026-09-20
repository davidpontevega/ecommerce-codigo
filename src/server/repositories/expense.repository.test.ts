import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { PgDialect } from "drizzle-orm/pg-core";

import { expenseQuerySchema } from "@/modules/finance/schemas/expense.schema";

import { buildFilters } from "./expense.repository";

const dialect = new PgDialect();

/**
 * Compila la condición a texto + parámetros con el dialecto de Postgres: da
 * aserciones legibles sin abrir una conexión.
 */
const whereFor = (raw: Record<string, string>) => {
  const condition = buildFilters(expenseQuerySchema.parse(raw));
  if (condition === undefined) return undefined;

  const { sql, params } = dialect.sqlToQuery(condition);
  return { sql, params };
};

const ACTIVE = '"expenses"."deleted_at" is null';

describe("buildFilters", () => {
  // AC4: el soft-delete nunca se lista, ni siquiera sin filtros.
  test("always excludes soft-deleted rows", () => {
    assert.deepEqual(whereFor({}), { sql: ACTIVE, params: [] });
  });

  test("searches the concept with a wildcard pattern", () => {
    assert.deepEqual(whereFor({ search: "alquiler" }), {
      sql: `(${ACTIVE} and "expenses"."concept" ilike $1)`,
      params: ["%alquiler%"],
    });
  });

  test("ignores an empty search string", () => {
    assert.deepEqual(whereFor({ search: "" }), { sql: ACTIVE, params: [] });
  });

  test("filters by category with a wildcard pattern", () => {
    assert.deepEqual(whereFor({ category: "servicios" }), {
      sql: `(${ACTIVE} and "expenses"."category" ilike $1)`,
      params: ["%servicios%"],
    });
  });

  // `date` es una columna `date`, no un instante: `to` se compara inclusivo y
  // sin el offset de Lima que sí necesitan los pedidos.
  test("bounds the date range inclusively on both ends", () => {
    assert.deepEqual(whereFor({ from: "2026-09-01", to: "2026-09-30" }), {
      sql: `(${ACTIVE} and "expenses"."date" >= $1 and "expenses"."date" <= $2)`,
      params: ["2026-09-01", "2026-09-30"],
    });
  });

  test("accepts an open-ended range", () => {
    assert.deepEqual(whereFor({ from: "2026-09-01" }), {
      sql: `(${ACTIVE} and "expenses"."date" >= $1)`,
      params: ["2026-09-01"],
    });
  });

  test("combines every filter", () => {
    assert.deepEqual(
      whereFor({ search: "luz", category: "servicios", to: "2026-09-30" }),
      {
        sql: `(${ACTIVE} and "expenses"."concept" ilike $1 and "expenses"."category" ilike $2 and "expenses"."date" <= $3)`,
        params: ["%luz%", "%servicios%", "2026-09-30"],
      },
    );
  });
});

describe("expenseQuerySchema", () => {
  test("rejects an inverted range", () => {
    assert.equal(
      expenseQuerySchema.safeParse({ from: "2026-09-30", to: "2026-09-01" })
        .success,
      false,
    );
  });

  test("rejects a malformed date", () => {
    assert.equal(expenseQuerySchema.safeParse({ from: "30-09-2026" }).success, false);
  });
});
