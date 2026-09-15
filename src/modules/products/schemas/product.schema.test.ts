import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { z } from "zod";

import {
  commaList,
  comparePriceIsHigher,
  productCreateSchema,
  productQuerySchema,
} from "./product.schema";

/**
 * `commaList` se prueba vía el schema que la usa: `categorySlug` es el único
 * caso con `item` con patrón y `brand` el único sin él, así el test cubre la
 * fábrica con sus dos configuraciones reales y no con una inventada.
 */
const query = (raw: Record<string, unknown>) => productQuerySchema.safeParse(raw);

const parsed = (raw: Record<string, unknown>) => productQuerySchema.parse(raw);

describe("commaList / productQuerySchema.categorySlug", () => {
  test("splits a comma list into trimmed values", () => {
    assert.deepEqual(parsed({ categorySlug: " laptops , teclados " }).categorySlug, [
      "laptops",
      "teclados",
    ]);
  });

  test("rejects the whole param when one value does not match the slug pattern", () => {
    // A diferencia del storefront (`listParam` tiene `.catch()` y descarta el
    // valor malo), aquí el contrato del API falla: es un 400, no un filtro mudo.
    const result = query({ categorySlug: "laptops,TECLADOS!,mouse" });

    assert.equal(result.success, false);
    // El índice apunta al elemento culpable, no al param entero.
    assert.deepEqual(result.error?.issues[0].path, ["categorySlug", 1]);
  });

  test("leaves the field undefined when the param is absent", () => {
    assert.equal(parsed({}).categorySlug, undefined);
  });

  test("rejects one element longer than the item max even when the whole string fits", () => {
    // La garantía que a `listParam` del storefront le falta: `.pipe(z.array(item))`
    // acota cada elemento, no solo la cadena entera.
    const result = query({ categorySlug: "a".repeat(200) });

    assert.equal(result.success, false);
    assert.deepEqual(result.error?.issues[0].path, ["categorySlug", 0]);
    assert.equal(result.error?.issues[0].code, "too_big");
  });

  test("rejects the param when the whole string is longer than the list max", () => {
    const result = query({
      categorySlug: `${"a".repeat(300)},${"b".repeat(300)}`,
    });

    assert.equal(result.success, false);
    assert.deepEqual(result.error?.issues[0].path, ["categorySlug"]);
  });

  test("yields an empty list, not undefined, for an empty or comma-only param", () => {
    // Deliberado: `buildFilters` traduce `[]` a `inArray(..., [])` ⇒ `false`,
    // que es lo que pide un `?categorySlug=` explícito sin valores.
    assert.deepEqual(parsed({ categorySlug: "" }).categorySlug, []);
    assert.deepEqual(parsed({ categorySlug: ",,," }).categorySlug, []);
  });

  test("rejects a param that is not a string", () => {
    assert.equal(query({ categorySlug: 123 }).success, false);
  });

  test("accepts any non-empty value when the item schema has no pattern", () => {
    assert.deepEqual(parsed({ brand: "Dell, HP ,,Lenovo ThinkPad" }).brand, [
      "Dell",
      "HP",
      "Lenovo ThinkPad",
    ]);
  });

  test("rejects a brand longer than its own item max", () => {
    assert.equal(query({ brand: "x".repeat(121) }).success, false);
  });

  test("builds an optional schema that enforces both the list max and the item max", () => {
    const schema = commaList(10, z.string().max(3));

    assert.deepEqual(schema.parse("a,b"), ["a", "b"]);
    assert.equal(schema.parse(undefined), undefined);
    assert.equal(schema.safeParse("abcd").success, false, "item max");
    assert.equal(schema.safeParse("x".repeat(11)).success, false, "list max");
  });
});

describe("comparePriceIsHigher / productCreateSchema", () => {
  const base = {
    categoryId: "0b3c4f36-0a2f-4e33-9c31-2c2a3f2b6d11",
    sku: "SKU-1",
    name: "Laptop",
    slug: "laptop",
    priceCents: 1000,
  };

  const create = (extra: Record<string, unknown>) =>
    productCreateSchema.safeParse({ ...base, ...extra });

  test("accepts a compare price above the sale price", () => {
    assert.equal(create({ compareAtPriceCents: 2000 }).success, true);
    assert.equal(
      comparePriceIsHigher({ priceCents: 1000, compareAtPriceCents: 2000 }),
      true,
    );
  });

  test("rejects a compare price equal to the sale price", () => {
    assert.equal(create({ compareAtPriceCents: 1000 }).success, false);
    assert.equal(
      comparePriceIsHigher({ priceCents: 1000, compareAtPriceCents: 1000 }),
      false,
    );
  });

  test("rejects a compare price below the sale price and blames compareAtPriceCents", () => {
    const result = create({ compareAtPriceCents: 500 });

    assert.equal(result.success, false);
    assert.deepEqual(result.error?.issues[0].path, ["compareAtPriceCents"]);
    assert.equal(result.error?.issues[0].message, "Debe ser mayor que el precio");
  });

  test("accepts a null or absent compare price", () => {
    assert.equal(create({ compareAtPriceCents: null }).success, true);
    assert.equal(create({}).success, true);
    assert.equal(
      comparePriceIsHigher({ priceCents: 1000, compareAtPriceCents: null }),
      true,
    );
    assert.equal(comparePriceIsHigher({ priceCents: 1000 }), true);
  });

  test("has nothing to compare when the sale price is missing", () => {
    assert.equal(comparePriceIsHigher({ compareAtPriceCents: 2000 }), true);
  });
});
