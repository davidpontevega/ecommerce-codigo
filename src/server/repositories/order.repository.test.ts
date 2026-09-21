import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { PgDialect } from "drizzle-orm/pg-core";

import { adminOrdersQuerySchema } from "@/modules/orders-admin/schemas/admin-order.schema";
import type { Transaction } from "@/server/db";
import type { Order } from "@/server/db/schema";

import { applyStatusChange, buildAdminFilters } from "./order.repository";

const dialect = new PgDialect();

/**
 * Compila la condición a texto + parámetros con el dialecto de Postgres: da
 * aserciones legibles sin abrir una conexión.
 */
const whereFor = (raw: Record<string, string>) => {
  const condition = buildAdminFilters(adminOrdersQuerySchema.parse(raw));
  if (condition === undefined) return undefined;

  const { sql, params } = dialect.sqlToQuery(condition);
  return { sql, params };
};

const SEARCH =
  '("orders"."email" ilike $1 or "users"."first_name" ilike $2 or "users"."last_name" ilike $3)';

describe("buildAdminFilters", () => {
  test("returns undefined when no filter applies", () => {
    assert.equal(whereFor({}), undefined);
  });

  // Los demás campos del query solo gobiernan orden y paginación en `listForAdmin`.
  test("ignores pagination and sorting params", () => {
    assert.equal(
      whereFor({
        page: "3",
        pageSize: "50",
        sortBy: "totalCents",
        sortDir: "asc",
      }),
      undefined,
    );
  });

  test("searches order email, first name and last name with a wildcard pattern", () => {
    assert.deepEqual(whereFor({ search: "ana" }), {
      sql: SEARCH,
      params: ["%ana%", "%ana%", "%ana%"],
    });
  });

  test("ignores a whitespace-only search", () => {
    assert.equal(whereFor({ search: "   " }), undefined);
  });

  test("filters by the selected statuses", () => {
    assert.deepEqual(whereFor({ status: "pending,cancelled" }), {
      sql: '"orders"."status" in ($1, $2)',
      params: ["pending", "cancelled"],
    });
  });

  // AC3: sin estados seleccionados se ven todos, no ninguno.
  test("ignores an empty status list instead of matching nothing", () => {
    assert.equal(whereFor({ status: "" }), undefined);
  });

  // AC2: `from` es el instante en que empieza ese día en Lima (UTC-5), no la
  // medianoche UTC. Drizzle ya serializa el `Date` al mapear el parámetro.
  test("anchors `from` to the start of the Lima day", () => {
    assert.deepEqual(whereFor({ from: "2026-09-18" }), {
      sql: '"orders"."created_at" >= $1',
      params: ["2026-09-18T05:00:00.000Z"],
    });
  });

  // AC2: `to` es inclusivo para quien filtra ⇒ corte exclusivo al día siguiente.
  test("makes `to` inclusive by cutting at the start of the next Lima day", () => {
    assert.deepEqual(whereFor({ to: "2026-09-18" }), {
      sql: '"orders"."created_at" < $1',
      params: ["2026-09-19T05:00:00.000Z"],
    });
  });

  test("combines every filter into a single conjunction", () => {
    const where = whereFor({
      from: "2026-09-01",
      to: "2026-09-18",
      status: "paid",
      search: "ana",
    });

    assert.equal(
      where?.sql,
      '("orders"."created_at" >= $1 and "orders"."created_at" < $2 and "orders"."status" in ($3) and ' +
        '("orders"."email" ilike $4 or "users"."first_name" ilike $5 or "users"."last_name" ilike $6))',
    );
  });

  test("rejects a range that ends before it starts", () => {
    assert.equal(
      adminOrdersQuerySchema.safeParse({ from: "2026-09-18", to: "2026-09-01" })
        .success,
      false,
    );
  });
});

const ORDER_ID = "6f3b5d2e-1b2c-4d5e-8f90-123456789abc";
const ACTOR_ID = "a1b2c3d4-1111-2222-3333-444455556666";

type AuditRow = {
  action: string;
  entityType: string;
  entityId: string | null;
  actorId: string | null;
  changes: Record<string, unknown> | null;
};

/**
 * Transacción de mentira: encadena solo lo que usa `applyStatusChange` y se
 * queda con lo escrito, para verificar la bitácora sin abrir una conexión.
 */
const fakeTx = (before?: Order["status"]) => {
  const audit: AuditRow[] = [];
  const updates: Array<Record<string, unknown>> = [];

  const tx = {
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => (before ? [{ status: before }] : []) }),
      }),
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => {
        updates.push(values);
        return {
          where: () => ({
            returning: async () => (before ? [{ id: ORDER_ID, ...values }] : []),
          }),
        };
      },
    }),
    insert: () => ({
      values: async (row: AuditRow) => {
        audit.push(row);
      },
    }),
  };

  return { tx: tx as unknown as Transaction, audit, updates };
};

describe("applyStatusChange", () => {
  // AC8: la bitácora guarda el salto y nada más —ni correo ni ids de Stripe.
  test("logs the status jump with the actor and no other payload", async () => {
    const { tx, audit, updates } = fakeTx("pending");

    const updated = await applyStatusChange(tx, ORDER_ID, "paid", ACTOR_ID);

    assert.deepEqual(updates, [{ status: "paid" }]);
    assert.equal(updated?.status, "paid");
    assert.deepEqual(audit, [
      {
        action: "order.status_changed",
        entityType: "order",
        entityId: ORDER_ID,
        actorId: ACTOR_ID,
        changes: { before: { status: "pending" }, after: { status: "paid" } },
        metadata: null,
        severity: "info",
      },
    ]);
  });

  // AC5 (D1): transición libre, incluido el camino de vuelta.
  test("accepts any transition, including cancelled back to paid", async () => {
    const { tx, audit } = fakeTx("cancelled");

    await applyStatusChange(tx, ORDER_ID, "paid", ACTOR_ID);

    assert.deepEqual(audit[0]?.changes, {
      before: { status: "cancelled" },
      after: { status: "paid" },
    });
  });

  // AC7: pedido inexistente ⇒ `null` para el 404, y ninguna fila de bitácora.
  test("returns null without auditing when the order does not exist", async () => {
    const { tx, audit, updates } = fakeTx();

    assert.equal(
      await applyStatusChange(tx, ORDER_ID, "cancelled", ACTOR_ID),
      null,
    );
    assert.deepEqual(updates, []);
    assert.deepEqual(audit, []);
  });
});
