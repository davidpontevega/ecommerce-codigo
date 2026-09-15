import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { PgDialect } from "drizzle-orm/pg-core";

import { categoryQuerySchema } from "@/modules/categories/schemas/category.schema";

import { buildFilters, isUniqueViolation } from "./category.repository";

/** Error de driver: `Error` con las propiedades que expone node-postgres/Neon. */
const pgError = (code: unknown) =>
  Object.assign(new Error(`db error ${String(code)}`), { code });

describe("isUniqueViolation", () => {
  test("returns true when the error itself carries the unique violation code", () => {
    assert.equal(isUniqueViolation(pgError("23505")), true);
  });

  test("walks the cause chain until it finds the unique violation code", () => {
    const wrapped = new Error("insert failed", {
      cause: new Error("query failed", { cause: pgError("23505") }),
    });

    assert.equal(isUniqueViolation(wrapped), true);
  });

  test("returns false for a different postgres code", () => {
    assert.equal(isUniqueViolation(pgError("23503")), false);
  });

  test("returns false for an error without a code", () => {
    assert.equal(isUniqueViolation(new Error("boom")), false);
  });

  test("returns false when no error in the cause chain carries the code", () => {
    const wrapped = new Error("outer", { cause: new Error("inner") });

    assert.equal(isUniqueViolation(wrapped), false);
  });

  // El recorrido para en el primer eslabón que no es `Error`: el driver siempre
  // lanza `Error`, un objeto plano con `code` no es una violación de unicidad.
  test("returns false when the chain ends in a non-error cause", () => {
    const wrapped = new Error("outer", { cause: { code: "23505" } });

    assert.equal(isUniqueViolation(wrapped), false);
  });

  test("returns false for a numeric code instead of the string form", () => {
    assert.equal(isUniqueViolation(pgError(23505)), false);
  });

  test("returns false for values that are not errors", () => {
    assert.equal(isUniqueViolation(null), false);
    assert.equal(isUniqueViolation(undefined), false);
    assert.equal(isUniqueViolation("23505"), false);
    assert.equal(isUniqueViolation({ code: "23505" }), false);
  });
});

const dialect = new PgDialect();

/**
 * Compila la condición a texto + parámetros con el dialecto de Postgres: da
 * aserciones legibles sin abrir una conexión.
 */
const whereFor = (raw: Record<string, string>) => {
  const condition = buildFilters(categoryQuerySchema.parse(raw));
  if (condition === undefined) return undefined;

  const { sql, params } = dialect.sqlToQuery(condition);
  return { sql, params };
};

const SEARCH = '("categories"."name" ilike $1 or "categories"."slug" ilike $2)';

describe("buildFilters", () => {
  test("returns undefined when no filter applies", () => {
    assert.equal(whereFor({}), undefined);
    assert.equal(whereFor({ status: "all" }), undefined);
  });

  test("searches name and slug with a wildcard pattern", () => {
    assert.deepEqual(whereFor({ search: "gpu" }), {
      sql: SEARCH,
      params: ["%gpu%", "%gpu%"],
    });
  });

  test("ignores an empty search string", () => {
    assert.equal(whereFor({ search: "" }), undefined);
  });

  // El schema recorta; un search de puro espacio no debe filtrar nada.
  test("ignores a whitespace-only search", () => {
    assert.equal(whereFor({ search: "   " }), undefined);
  });

  // Limitación conocida: el texto del usuario se interpola tal cual en el
  // patrón, así que sus `%`/`_` se comportan como comodines de ILIKE.
  test("passes user wildcards through to the ilike pattern", () => {
    assert.deepEqual(whereFor({ search: "50%" }), {
      sql: SEARCH,
      params: ["%50%%", "%50%%"],
    });
  });

  test("filters by is_active on both status values", () => {
    assert.deepEqual(whereFor({ status: "active" }), {
      sql: '"categories"."is_active" = $1',
      params: [true],
    });
    assert.deepEqual(whereFor({ status: "inactive" }), {
      sql: '"categories"."is_active" = $1',
      params: [false],
    });
  });

  test("combines search and status into a single conjunction", () => {
    assert.deepEqual(whereFor({ search: "gpu", status: "inactive" }), {
      sql: `(${SEARCH} and "categories"."is_active" = $3)`,
      params: ["%gpu%", "%gpu%", false],
    });
  });
});
