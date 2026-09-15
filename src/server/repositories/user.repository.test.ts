import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { PgDialect } from "drizzle-orm/pg-core";

import { userQuerySchema } from "@/modules/users/schemas/user.schema";

import { buildFilters } from "./user.repository";

const dialect = new PgDialect();

/**
 * Compila la condición a texto + parámetros con el dialecto de Postgres: da
 * aserciones legibles sin abrir una conexión.
 */
const whereFor = (raw: Record<string, string>) => {
  const condition = buildFilters(userQuerySchema.parse(raw));
  if (condition === undefined) return undefined;

  const { sql, params } = dialect.sqlToQuery(condition);
  return { sql, params };
};

const SEARCH =
  '("users"."email" ilike $1 or "users"."first_name" ilike $2 or "users"."last_name" ilike $3)';

describe("buildFilters", () => {
  test("returns undefined when no filter applies", () => {
    assert.equal(whereFor({}), undefined);
    assert.equal(whereFor({ status: "all" }), undefined);
  });

  test("searches email, first name and last name with a wildcard pattern", () => {
    assert.deepEqual(whereFor({ search: "ana" }), {
      sql: SEARCH,
      params: ["%ana%", "%ana%", "%ana%"],
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
    assert.deepEqual(whereFor({ search: "a_b%" }), {
      sql: SEARCH,
      params: ["%a_b%%", "%a_b%%", "%a_b%%"],
    });
  });

  test("filters by is_active on both status values", () => {
    assert.deepEqual(whereFor({ status: "active" }), {
      sql: '"users"."is_active" = $1',
      params: [true],
    });
    assert.deepEqual(whereFor({ status: "inactive" }), {
      sql: '"users"."is_active" = $1',
      params: [false],
    });
  });

  test("combines search and status into a single conjunction", () => {
    assert.deepEqual(whereFor({ search: "ana", status: "inactive" }), {
      sql: `(${SEARCH} and "users"."is_active" = $4)`,
      params: ["%ana%", "%ana%", "%ana%", false],
    });
  });

  // Los demás campos del query solo gobiernan orden y paginación en `list`.
  test("ignores pagination and sorting params", () => {
    assert.equal(
      whereFor({ page: "3", pageSize: "50", sortBy: "email", sortDir: "asc" }),
      undefined,
    );
  });
});
