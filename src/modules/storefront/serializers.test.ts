import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { Category } from "@/modules/categories/types/category.types";
import type { ProductWithCategory } from "@/modules/products/types/product.types";

import { toCategoryListResponse, toProductListResponse } from "./serializers";

const CREATED_AT = new Date("2026-01-15T10:30:00.000Z");
const UPDATED_AT = new Date("2026-02-01T08:00:00.000Z");
const DELETED_AT = new Date("2026-03-20T23:59:59.999Z");

const product = (
  overrides: Partial<ProductWithCategory> = {},
): ProductWithCategory => ({
  id: "11111111-1111-4111-8111-111111111111",
  categoryId: "22222222-2222-4222-8222-222222222222",
  sku: "LAP-001",
  name: "Laptop Pro 14",
  slug: "laptop-pro-14",
  description: "Laptop de 14 pulgadas",
  priceCents: 549900,
  compareAtPriceCents: 699900,
  stock: 7,
  brand: "Acme",
  specs: { ram: "16GB" },
  weightGrams: 1400,
  imageUrl: "/products/laptop-pro-14.webp",
  deletedAt: null,
  createdAt: CREATED_AT,
  updatedAt: UPDATED_AT,
  categoryName: "Laptops",
  ...overrides,
});

const category = (overrides: Partial<Category> = {}): Category => ({
  id: "22222222-2222-4222-8222-222222222222",
  name: "Laptops",
  slug: "laptops",
  description: "Equipos portátiles",
  isActive: true,
  createdAt: CREATED_AT,
  updatedAt: UPDATED_AT,
  ...overrides,
});

describe("toProductListResponse", () => {
  test("converts createdAt/updatedAt to ISO strings and leaves every other field untouched", () => {
    const row = product();

    const [dto] = toProductListResponse({
      data: [row],
      total: 1,
      page: 1,
      pageSize: 12,
    }).data;

    assert.deepEqual(dto, {
      id: row.id,
      categoryId: row.categoryId,
      sku: row.sku,
      name: row.name,
      slug: row.slug,
      description: row.description,
      priceCents: row.priceCents,
      compareAtPriceCents: row.compareAtPriceCents,
      stock: row.stock,
      brand: row.brand,
      specs: row.specs,
      weightGrams: row.weightGrams,
      imageUrl: row.imageUrl,
      deletedAt: null,
      createdAt: "2026-01-15T10:30:00.000Z",
      updatedAt: "2026-02-01T08:00:00.000Z",
      categoryName: row.categoryName,
    });
  });

  test("keeps deletedAt as null when the product is not soft-deleted", () => {
    const [dto] = toProductListResponse({
      data: [product({ deletedAt: null })],
      total: 1,
      page: 1,
      pageSize: 12,
    }).data;

    assert.equal(dto.deletedAt, null);
  });

  test("converts deletedAt to an ISO string when the product is soft-deleted", () => {
    const [dto] = toProductListResponse({
      data: [product({ deletedAt: DELETED_AT })],
      total: 1,
      page: 1,
      pageSize: 12,
    }).data;

    assert.equal(dto.deletedAt, "2026-03-20T23:59:59.999Z");
  });

  test("passes total/page/pageSize through unchanged", () => {
    const { total, page, pageSize } = toProductListResponse({
      data: [product()],
      total: 137,
      page: 4,
      pageSize: 12,
    });

    assert.deepEqual({ total, page, pageSize }, {
      total: 137,
      page: 4,
      pageSize: 12,
    });
  });

  test("returns an empty data array when there are no products", () => {
    assert.deepEqual(
      toProductListResponse({ data: [], total: 0, page: 1, pageSize: 12 }),
      { data: [], total: 0, page: 1, pageSize: 12 },
    );
  });

  test("converts the dates of every row, not only the first one", () => {
    const { data } = toProductListResponse({
      data: [
        product({ id: "a", deletedAt: null }),
        product({ id: "b", deletedAt: DELETED_AT }),
      ],
      total: 2,
      page: 1,
      pageSize: 12,
    });

    assert.deepEqual(
      data.map((dto) => [dto.createdAt, dto.updatedAt, dto.deletedAt]),
      [
        ["2026-01-15T10:30:00.000Z", "2026-02-01T08:00:00.000Z", null],
        [
          "2026-01-15T10:30:00.000Z",
          "2026-02-01T08:00:00.000Z",
          "2026-03-20T23:59:59.999Z",
        ],
      ],
    );
  });
});

describe("toCategoryListResponse", () => {
  test("converts createdAt/updatedAt to ISO strings and leaves every other field untouched", () => {
    const row = category();

    const [dto] = toCategoryListResponse({
      data: [row],
      total: 1,
      page: 1,
      pageSize: 50,
    }).data;

    assert.deepEqual(dto, {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      isActive: true,
      createdAt: "2026-01-15T10:30:00.000Z",
      updatedAt: "2026-02-01T08:00:00.000Z",
    });
  });

  test("passes total/page/pageSize through unchanged", () => {
    const { total, page, pageSize } = toCategoryListResponse({
      data: [category()],
      total: 9,
      page: 2,
      pageSize: 50,
    });

    assert.deepEqual({ total, page, pageSize }, { total: 9, page: 2, pageSize: 50 });
  });

  test("returns an empty data array when there are no categories", () => {
    assert.deepEqual(
      toCategoryListResponse({ data: [], total: 0, page: 1, pageSize: 50 }),
      { data: [], total: 0, page: 1, pageSize: 50 },
    );
  });
});
