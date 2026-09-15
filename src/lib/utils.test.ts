import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { discountPercent, formatPrice, stockNote } from "./utils";

// `Intl.NumberFormat("es-PE")` separa el símbolo con espacio duro (U+00A0), no
// con un espacio normal: las expectativas lo escriben explícito para no comparar
// contra un string que se ve igual pero no lo es.
const NBSP = "\u00A0";

describe("formatPrice", () => {
  test("formats whole cents as PEN currency with two decimals", () => {
    assert.equal(formatPrice(549900), `S/${NBSP}5,499.00`);
  });

  test("formats zero cents as S/ 0.00", () => {
    assert.equal(formatPrice(0), `S/${NBSP}0.00`);
  });

  test("formats one cent as S/ 0.01 (smallest non-zero amount)", () => {
    assert.equal(formatPrice(1), `S/${NBSP}0.01`);
  });
});

describe("discountPercent", () => {
  test("returns null when compareAtCents is undefined", () => {
    assert.equal(discountPercent(549900, undefined), null);
  });

  test("returns null when compareAtCents is null", () => {
    assert.equal(discountPercent(549900, null), null);
  });

  test("returns null when compareAtCents equals priceCents", () => {
    assert.equal(discountPercent(549900, 549900), null);
  });

  test("returns null when compareAtCents is lower than priceCents", () => {
    assert.equal(discountPercent(549900, 499900), null);
  });

  test("returns the rounded percentage when compareAtCents is higher than priceCents", () => {
    assert.equal(discountPercent(7500, 10000), 25);
    assert.equal(discountPercent(549900, 699900), 21);
  });
});

describe("stockNote", () => {
  test("returns 'Agotado' when stock is zero", () => {
    assert.equal(stockNote(0), "Agotado");
  });

  test("returns '1 en stock' when stock is one (lower bound in stock)", () => {
    assert.equal(stockNote(1), "1 en stock");
  });

  test("returns '{n} en stock' when stock is positive", () => {
    assert.equal(stockNote(42), "42 en stock");
  });
});
