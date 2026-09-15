import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { productQuerySchema } from "@/modules/products/schemas/product.schema";

import {
  hasActiveFilters,
  listParam,
  STOREFRONT_PAGE_SIZE,
  storefrontProductsQuerySchema,
  toggleValue,
  toProductQuery,
} from "./storefront.schema";

/**
 * Los params se construyen parseando con el propio schema y no a mano: así el
 * test prueba el par URL → query real y no una forma inventada del tipo.
 */
const query = (raw: Record<string, string>) =>
  storefrontProductsQuerySchema.parse(raw);

describe("toProductQuery", () => {
  test("maps every sort option to its sortBy/sortDir pair", () => {
    const sortOf = (sort: string) => {
      const { sortBy, sortDir } = toProductQuery(query({ sort }));
      return { sortBy, sortDir };
    };

    assert.deepEqual(sortOf("new"), { sortBy: "createdAt", sortDir: "desc" });
    assert.deepEqual(sortOf("price-asc"), {
      sortBy: "priceCents",
      sortDir: "asc",
    });
    assert.deepEqual(sortOf("price-desc"), {
      sortBy: "priceCents",
      sortDir: "desc",
    });
    assert.deepEqual(sortOf("discount"), {
      sortBy: "discount",
      sortDir: "desc",
    });
  });

  test("converts min/max from currency units to cents", () => {
    const result = toProductQuery(query({ min: "500", max: "1500" }));

    assert.equal(result.minPriceCents, 50_000);
    assert.equal(result.maxPriceCents, 150_000);
  });

  test("leaves price bounds undefined when min/max are absent, not zero", () => {
    const result = toProductQuery(query({}));

    assert.equal(result.minPriceCents, undefined);
    assert.equal(result.maxPriceCents, undefined);
  });

  test("keeps a zero lower bound as 0 cents and not as undefined", () => {
    const result = toProductQuery(query({ min: "0" }));

    assert.equal(result.minPriceCents, 0);
  });

  test("maps the stock switch to inStock and its absence to undefined", () => {
    assert.equal(toProductQuery(query({ stock: "1" })).inStock, true);
    assert.equal(toProductQuery(query({})).inStock, undefined);
  });

  test("maps the deals switch to onSale and its absence to undefined", () => {
    assert.equal(toProductQuery(query({ deals: "1" })).onSale, true);
    assert.equal(toProductQuery(query({})).onSale, undefined);
  });

  test("always pins categoryActive to true and status to available", () => {
    const cases: Record<string, string>[] = [
      {},
      { q: "ssd" },
      { sort: "discount", page: "4" },
    ];

    for (const raw of cases) {
      const result = toProductQuery(query(raw));

      assert.equal(result.categoryActive, true);
      assert.equal(result.status, "available");
    }
  });

  test("always pins pageSize to STOREFRONT_PAGE_SIZE", () => {
    assert.equal(toProductQuery(query({})).pageSize, STOREFRONT_PAGE_SIZE);
    assert.equal(
      toProductQuery(query({ page: "7" })).pageSize,
      STOREFRONT_PAGE_SIZE,
    );
  });

  test("forwards the requested page", () => {
    assert.equal(toProductQuery(query({ page: "3" })).page, 3);
  });
});

describe("hasActiveFilters", () => {
  test("returns false when only page and sort are set", () => {
    assert.equal(hasActiveFilters(query({ page: "2", sort: "discount" })), false);
  });

  test("returns false when every filter field is undefined", () => {
    assert.equal(hasActiveFilters(query({})), false);
  });

  test("returns true when any single filter field is set", () => {
    const cases: Record<string, string> = {
      q: "ssd",
      category: "laptops",
      brand: "Dell",
      min: "500",
      max: "1500",
      stock: "1",
      deals: "1",
    };

    for (const [field, value] of Object.entries(cases)) {
      assert.equal(hasActiveFilters(query({ [field]: value })), true, field);
    }
  });

  test("returns true when a discarded filter still left a default page and sort", () => {
    // `sort` basura cae a "new" y no cuenta como filtro, pero `q` sí sigue puesto.
    assert.equal(hasActiveFilters(query({ q: "ssd", sort: "nope" })), true);
  });
});

describe("toggleValue", () => {
  test("returns a single-item list when the current value is undefined", () => {
    assert.deepEqual(toggleValue(undefined, "dell"), ["dell"]);
  });

  test("removes a value that is already present", () => {
    assert.deepEqual(toggleValue(["dell", "hp"], "dell"), ["hp"]);
  });

  test("appends a value that is absent at the end of the list", () => {
    assert.deepEqual(toggleValue(["dell"], "hp"), ["dell", "hp"]);
  });

  test("returns undefined when removing the only value, not an empty list", () => {
    assert.equal(toggleValue(["dell"], "dell"), undefined);
  });

  test("treats an empty list like no filter at all", () => {
    assert.deepEqual(toggleValue([], "dell"), ["dell"]);
  });

  test("does not mutate the list it receives", () => {
    const current = ["dell"];
    toggleValue(current, "hp");

    assert.deepEqual(current, ["dell"]);
  });
});

describe("listParam / storefrontProductsQuerySchema", () => {
  test("splits a comma list into trimmed values", () => {
    assert.deepEqual(query({ category: " laptops , teclados " }).category, [
      "laptops",
      "teclados",
    ]);
  });

  test("drops values that do not match the slug pattern and keeps the rest", () => {
    assert.deepEqual(query({ category: "laptops,TECLADOS!,mouse" }).category, [
      "laptops",
      "mouse",
    ]);
  });

  test("returns undefined when every value was dropped, not an empty list", () => {
    assert.equal(query({ category: "TECLADOS!" }).category, undefined);
    assert.equal(query({ category: ",,," }).category, undefined);
    assert.equal(query({ category: "" }).category, undefined);
  });

  test("falls back to undefined when the whole param is longer than the max", () => {
    assert.equal(query({ category: `${"a".repeat(280)},${"b".repeat(281)}` }).category, undefined);
  });

  test("falls back to undefined for a value that is not a string", () => {
    assert.equal(
      storefrontProductsQuerySchema.parse({ category: 123 }).category,
      undefined,
    );
  });

  test("accepts any non-empty value when no pattern is given", () => {
    assert.deepEqual(query({ brand: "Dell, HP ,,Lenovo ThinkPad" }).brand, [
      "Dell",
      "HP",
      "Lenovo ThinkPad",
    ]);
  });

  test("builds a schema that degrades to undefined instead of failing", () => {
    const schema = listParam(10);

    assert.deepEqual(schema.safeParse("a,b"), { success: true, data: ["a", "b"] });
    assert.equal(schema.safeParse("x".repeat(11)).success, true);
    assert.equal(schema.parse("x".repeat(11)), undefined);
    assert.equal(schema.parse(undefined), undefined);
  });

  test("drops list values longer than the products API accepts", () => {
    // El contrato del handler acota cada elemento (`z.string().max(140)` para
    // categorySlug, `.max(120)` para brand); `listParam` solo acota la cadena
    // entera, así que un slug largo llega al fetch del cliente y vuelve 400.
    const longSlug = "a".repeat(200);

    assert.equal(
      productQuerySchema.safeParse({ categorySlug: longSlug }).success,
      false,
      "el API rechaza el slug largo, así que el storefront no debe reenviarlo",
    );
    assert.equal(query({ category: longSlug }).category, undefined);
  });

  test("recovers the default sort and page from junk values", () => {
    const parsed = query({ sort: "nope", page: "0", min: "-5", max: "1.5" });

    assert.equal(parsed.sort, "new");
    assert.equal(parsed.page, 1);
    assert.equal(parsed.min, undefined);
    assert.equal(parsed.max, undefined);
  });

  test("trims the search term and drops it when it is longer than the max", () => {
    assert.equal(query({ q: "  ssd nvme  " }).q, "ssd nvme");
    assert.equal(query({ q: "x".repeat(101) }).q, undefined);
  });

  test("only accepts the literal '1' for the stock and deals switches", () => {
    assert.equal(query({ stock: "1" }).stock, "1");
    assert.equal(query({ stock: "0" }).stock, undefined);
    assert.equal(query({ deals: "true" }).deals, undefined);
  });
});
