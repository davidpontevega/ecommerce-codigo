import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { igvFromGross, netFromGross, unitMargin } from "./tax";

describe("igvFromGross", () => {
  test("extracts the tax already contained in the gross amount", () => {
    assert.equal(igvFromGross(11800), 1800);
  });

  test("returns 0 for a month with no income (AC2)", () => {
    assert.equal(igvFromGross(0), 0);
  });

  test("rounds to whole cents instead of leaving a float", () => {
    // 1000 * 18 / 118 = 152.54…
    assert.equal(igvFromGross(1000), 153);
    assert.ok(Number.isInteger(igvFromGross(12345)));
  });
});

describe("netFromGross", () => {
  test("removes the tax contained in the gross amount", () => {
    assert.equal(netFromGross(11800), 10000);
  });

  test("rounds to whole cents", () => {
    // 1000 * 100 / 118 = 847.45…
    assert.equal(netFromGross(1000), 847);
  });
});

describe("unitMargin", () => {
  test("computes the margin over the net price (AC8)", () => {
    assert.deepEqual(unitMargin(11800, 5000), {
      priceNetCents: 10000,
      marginCents: 5000,
      marginPercent: 0.5,
    });
  });

  test("reports 'sin dato' instead of 0 when there is no cost (AC7)", () => {
    assert.deepEqual(unitMargin(11800, null), {
      priceNetCents: 10000,
      marginCents: null,
      marginPercent: null,
    });
  });

  test("keeps a negative margin when the cost beats the net price", () => {
    const result = unitMargin(11800, 12000);

    assert.equal(result.marginCents, -2000);
    assert.equal(result.marginPercent, -0.2);
  });

  test("treats a zero cost as a real cost, not as missing data", () => {
    assert.deepEqual(unitMargin(11800, 0), {
      priceNetCents: 10000,
      marginCents: 10000,
      marginPercent: 1,
    });
  });

  test("returns no percentage when the net price rounds to zero", () => {
    assert.deepEqual(unitMargin(0, 500), {
      priceNetCents: 0,
      marginCents: -500,
      marginPercent: null,
    });
  });
});
