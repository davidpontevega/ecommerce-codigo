import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { PgDialect } from "drizzle-orm/pg-core";

import { productQuerySchema } from "@/modules/products/schemas/product.schema";

import {
  buildFilters,
  findPostgresError,
  isDifferent,
  mapDbError,
} from "./product.repository";

/** Error de driver: `Error` con las propiedades que expone node-postgres/Neon. */
const pgError = (code: string, extra: Record<string, unknown> = {}) =>
  Object.assign(new Error(`db error ${code}`), { code, ...extra });

describe("mapDbError", () => {
  test("maps a unique violation on the sku constraint to 409", () => {
    const result = mapDbError(
      pgError("23505", { constraint: "products_sku_unique" }),
    );

    assert.deepEqual(result, {
      status: 409,
      message: "Ya existe un producto con ese SKU",
    });
  });

  test("maps a unique violation on the slug constraint to 409", () => {
    const result = mapDbError(
      pgError("23505", { constraint: "products_slug_unique" }),
    );

    assert.deepEqual(result, {
      status: 409,
      message: "Ya existe un producto con ese slug",
    });
  });

  // El driver no siempre rellena `constraint`; el nombre suele venir en el texto.
  test("falls back to the error message when constraint is missing", () => {
    const result = mapDbError(
      Object.assign(
        new Error(
          'duplicate key value violates unique constraint "products_sku_unique"',
        ),
        { code: "23505" },
      ),
    );

    assert.deepEqual(result, {
      status: 409,
      message: "Ya existe un producto con ese SKU",
    });
  });

  test("maps a foreign key violation to 400", () => {
    const result = mapDbError(pgError("23503"));

    assert.deepEqual(result, {
      status: 400,
      message: "Categoría no encontrada",
    });
  });

  test("returns null for a postgres code it does not translate", () => {
    assert.equal(mapDbError(pgError("23502")), null);
  });

  test("returns null for an error without a postgres code", () => {
    assert.equal(mapDbError(new Error("boom")), null);
  });

  test("returns null for values that are not errors", () => {
    assert.equal(mapDbError(null), null);
    assert.equal(mapDbError(undefined), null);
    assert.equal(mapDbError("23505"), null);
    // Objeto plano que no hereda de Error: el driver siempre lanza `Error`.
    assert.equal(mapDbError({ code: "23505" }), null);
  });
});

describe("findPostgresError", () => {
  test("returns the error itself when it already carries a code", () => {
    const error = pgError("23505");

    assert.equal(findPostgresError(error), error);
  });

  test("walks the cause chain until it finds a code", () => {
    const root = pgError("23503");
    const wrapped = new Error("insert failed", {
      cause: new Error("query failed", { cause: root }),
    });

    assert.equal(findPostgresError(wrapped), root);
  });

  test("returns null when no error in the chain has a code", () => {
    const wrapped = new Error("outer", { cause: new Error("inner") });

    assert.equal(findPostgresError(wrapped), null);
  });

  test("returns null when the chain ends in a non-error cause", () => {
    const wrapped = new Error("outer", { cause: { code: "23505" } });

    assert.equal(findPostgresError(wrapped), null);
  });

  test("ignores a code that is not a string and keeps walking", () => {
    const root = pgError("23505");
    const wrapped = Object.assign(new Error("outer", { cause: root }), {
      code: 500,
    });

    assert.equal(findPostgresError(wrapped), root);
  });

  test("returns null for values that are not errors", () => {
    assert.equal(findPostgresError(null), null);
    assert.equal(findPostgresError("23505"), null);
  });
});

const dialect = new PgDialect();

/**
 * Compila la condición a texto + parámetros con el dialecto de Postgres: da
 * aserciones legibles sin abrir una conexión.
 */
const whereFor = (raw: Record<string, string>) => {
  const condition = buildFilters(productQuerySchema.parse(raw));
  if (condition === undefined) return undefined;

  const { sql, params } = dialect.sqlToQuery(condition);
  return { sql, params };
};

const NOT_DELETED = '"products"."deleted_at" is null';

describe("buildFilters", () => {
  test("returns undefined when no filter applies", () => {
    assert.equal(whereFor({ status: "all" }), undefined);
  });

  test("filters out soft-deleted rows by default", () => {
    assert.deepEqual(whereFor({}), { sql: NOT_DELETED, params: [] });
  });

  test("keeps only soft-deleted rows for status 'deleted'", () => {
    assert.deepEqual(whereFor({ status: "deleted" }), {
      sql: '"products"."deleted_at" is not null',
      params: [],
    });
  });

  test("searches name and sku with a wildcard pattern", () => {
    assert.deepEqual(whereFor({ search: "rtx" }), {
      sql: `(("products"."name" ilike $1 or "products"."sku" ilike $2) and ${NOT_DELETED})`,
      params: ["%rtx%", "%rtx%"],
    });
  });

  test("ignores an empty search string", () => {
    assert.deepEqual(whereFor({ search: "" }), { sql: NOT_DELETED, params: [] });
  });

  test("matches no row when categorySlug is an empty list", () => {
    assert.deepEqual(whereFor({ categorySlug: "" }), {
      sql: `(false and ${NOT_DELETED})`,
      params: [],
    });
  });

  test("filters by every slug in categorySlug", () => {
    assert.deepEqual(whereFor({ categorySlug: "laptops,gpu" }), {
      sql: `("categories"."slug" in ($1, $2) and ${NOT_DELETED})`,
      params: ["laptops", "gpu"],
    });
  });

  test("filters by categoryId", () => {
    const id = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";

    assert.deepEqual(whereFor({ categoryId: id }), {
      sql: `("products"."category_id" = $1 and ${NOT_DELETED})`,
      params: [id],
    });
  });

  test("filters by every brand in the list", () => {
    assert.deepEqual(whereFor({ brand: "Asus,MSI" }), {
      sql: `("products"."brand" in ($1, $2) and ${NOT_DELETED})`,
      params: ["Asus", "MSI"],
    });
  });

  test("adds a stock condition only when inStock is true", () => {
    assert.deepEqual(whereFor({ inStock: "true" }), {
      sql: `("products"."stock" > $1 and ${NOT_DELETED})`,
      params: [0],
    });
    assert.deepEqual(whereFor({ inStock: "false" }), {
      sql: NOT_DELETED,
      params: [],
    });
  });

  test("adds a compare price condition only when onSale is true", () => {
    assert.deepEqual(whereFor({ onSale: "true" }), {
      sql: `("products"."compare_at_price_cents" is not null and ${NOT_DELETED})`,
      params: [],
    });
    assert.deepEqual(whereFor({ onSale: "false" }), {
      sql: NOT_DELETED,
      params: [],
    });
  });

  // `false` es un filtro legítimo (categorías ocultas), solo `undefined` no filtra.
  test("filters by categoryActive on both booleans", () => {
    assert.deepEqual(whereFor({ categoryActive: "true" }), {
      sql: `("categories"."is_active" = $1 and ${NOT_DELETED})`,
      params: [true],
    });
    assert.deepEqual(whereFor({ categoryActive: "false" }), {
      sql: `("categories"."is_active" = $1 and ${NOT_DELETED})`,
      params: [false],
    });
  });

  test("filters by the price range inclusively", () => {
    assert.deepEqual(whereFor({ minPriceCents: "100", maxPriceCents: "500" }), {
      sql: `(${NOT_DELETED} and "products"."price_cents" >= $1 and "products"."price_cents" <= $2)`,
      params: [100, 500],
    });
  });

  // Cero es un límite válido, no "sin filtro": `maxPriceCents=0` debe vaciar la lista.
  test("keeps a zero price bound instead of dropping it", () => {
    assert.deepEqual(whereFor({ maxPriceCents: "0" }), {
      sql: `(${NOT_DELETED} and "products"."price_cents" <= $1)`,
      params: [0],
    });
  });

  test("combines every filter into a single conjunction", () => {
    const result = whereFor({
      search: "rtx",
      brand: "MSI",
      inStock: "true",
      onSale: "true",
      status: "deleted",
      minPriceCents: "1000",
    });

    assert.deepEqual(result, {
      sql:
        '(("products"."name" ilike $1 or "products"."sku" ilike $2)' +
        ' and "products"."brand" in ($3)' +
        ' and "products"."stock" > $4' +
        ' and "products"."compare_at_price_cents" is not null' +
        ' and "products"."deleted_at" is not null' +
        ' and "products"."price_cents" >= $5)',
      params: ["%rtx%", "%rtx%", "MSI", 0, 1000],
    });
  });
});

describe("isDifferent", () => {
  test("reports no change for an identical primitive", () => {
    assert.equal(isDifferent("Laptop", "Laptop"), false);
    assert.equal(isDifferent(0, 0), false);
  });

  test("reports a change for different primitives", () => {
    assert.equal(isDifferent(1200, 1300), true);
    assert.equal(isDifferent("a", "b"), true);
  });

  test("compares objects by content, not by reference", () => {
    assert.equal(isDifferent({ ram: "16GB" }, { ram: "16GB" }), false);
    assert.equal(isDifferent({ ram: "16GB" }, { ram: "32GB" }), true);
  });

  test("treats null and undefined as the same absent value", () => {
    assert.equal(isDifferent(null, undefined), false);
    assert.equal(isDifferent(undefined, null), false);
    assert.equal(isDifferent(null, null), false);
  });

  test("distinguishes an absent value from a falsy one", () => {
    assert.equal(isDifferent(null, 0), true);
    assert.equal(isDifferent(null, ""), true);
    assert.equal(isDifferent(null, false), true);
  });

  // El caso que motiva el `JSON.stringify`: el repo lee un `Date` y el cliente
  // manda su ISO; `!==` los daría por distintos en cada PATCH.
  test("matches a Date against its ISO string form", () => {
    const date = new Date("2026-01-15T10:30:00.000Z");

    assert.equal(isDifferent(date, "2026-01-15T10:30:00.000Z"), false);
    assert.equal(isDifferent(date, "2026-01-16T10:30:00.000Z"), true);
  });

  test("reports a change when an object gains or loses a key", () => {
    assert.equal(isDifferent({ ram: "16GB" }, {}), true);
    assert.equal(isDifferent({}, { ram: "16GB" }), true);
  });

  // Limitación conocida de comparar por JSON: el mismo jsonb con otro orden de
  // claves se reporta como cambio (escribe de más, nunca de menos).
  test("reports a change when object keys are in a different order", () => {
    assert.equal(
      isDifferent({ ram: "16GB", cpu: "i7" }, { cpu: "i7", ram: "16GB" }),
      true,
    );
  });
});
