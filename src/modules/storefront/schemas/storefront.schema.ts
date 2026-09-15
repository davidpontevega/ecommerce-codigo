import { z } from "zod";

import type { ProductQueryInput } from "@/modules/products/schemas/product.schema";

/** 12 encaja en 2, 3 y 4 columnas; no es configurable desde la URL. */
export const STOREFRONT_PAGE_SIZE = 12;

export const storefrontSortOptions = [
  { value: "new", label: "Novedades" },
  { value: "price-asc", label: "Menor precio" },
  { value: "price-desc", label: "Mayor precio" },
  { value: "discount", label: "Mayor descuento" },
] as const;

const sortValues = ["new", "price-asc", "price-desc", "discount"] as const;

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Multi-valor por coma (`?category=a,b`): `Object.fromEntries(searchParams)` se
 * queda con el último valor de una clave repetida, así que `?brand=a&brand=b`
 * perdería filtros en silencio.
 *
 * Los valores que no cumplen el patrón, o que exceden `itemMax`, se descartan
 * uno por uno en vez de invalidar el parámetro entero: esta capa no puede
 * romper la página. `itemMax` existe porque el Route Handler (`commaList` en
 * `product.schema.ts`) sí acota cada elemento — sin este filtro, un elemento
 * más largo que ese límite pasaba aquí y volvía 400 al hacer el fetch.
 */
export function listParam(max: number, pattern?: RegExp, itemMax?: number) {
  return z
    .string()
    .trim()
    .max(max)
    .transform((value) => {
      const items = value
        .split(",")
        .map((part) => part.trim())
        .filter(
          (part) =>
            part !== "" &&
            (!pattern || pattern.test(part)) &&
            (itemMax === undefined || part.length <= itemMax),
        );

      return items.length > 0 ? items : undefined;
    })
    .optional()
    .catch(undefined);
}

/** Presets del diseño, en unidades de moneda (lo que viaja en la URL). */
export const PRICE_RANGES = [
  { id: "all", label: "Todos", min: undefined, max: undefined },
  { id: "lt500", label: "< S/ 500", min: undefined, max: 500 },
  { id: "500-1500", label: "S/ 500 – 1.500", min: 500, max: 1500 },
  { id: "1500-4000", label: "S/ 1.500 – 4.000", min: 1500, max: 4000 },
  { id: "gt4000", label: "> S/ 4.000", min: 4000, max: undefined },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  min: number | undefined;
  max: number | undefined;
}>;

/**
 * Contrato de la barra de direcciones. A diferencia del Route Handler (límite de
 * confianza que devuelve 400), aquí un parámetro basura **no** puede romper la
 * página: cada campo cae a su valor por defecto con `.catch()`.
 */
export const storefrontProductsQuerySchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  // Los límites por elemento (140/120) son los mismos que `commaList` exige en
  // `product.schema.ts`: sin ellos, un elemento válido para esta capa volvía
  // 400 al pasar por el Route Handler.
  category: listParam(560, slugPattern, 140),
  brand: listParam(400, undefined, 120),
  // En unidades de moneda, no en centavos: la URL la lee y la escribe una persona.
  min: z.coerce.number().int().min(0).optional().catch(undefined),
  max: z.coerce.number().int().min(0).optional().catch(undefined),
  // Interruptores: presentes con "1" o ausentes, para que la URL siga siendo legible.
  stock: z.literal("1").optional().catch(undefined),
  deals: z.literal("1").optional().catch(undefined),
  sort: z.enum(sortValues).default("new").catch("new"),
  page: z.coerce.number().int().min(1).default(1).catch(1),
});

export type StorefrontSort = (typeof sortValues)[number];
export type StorefrontProductsQuery = z.infer<
  typeof storefrontProductsQuerySchema
>;

const sortMap = {
  new: { sortBy: "createdAt", sortDir: "desc" },
  "price-asc": { sortBy: "priceCents", sortDir: "asc" },
  "price-desc": { sortBy: "priceCents", sortDir: "desc" },
  discount: { sortBy: "discount", sortDir: "desc" },
} as const satisfies Record<
  StorefrontSort,
  Pick<ProductQueryInput, "sortBy" | "sortDir">
>;

/** Único traductor URL → API: lo usan el servidor y el service del cliente. */
export function toProductQuery(
  params: StorefrontProductsQuery,
): ProductQueryInput {
  return {
    search: params.q,
    categorySlug: params.category,
    brand: params.brand,
    categoryActive: true,
    inStock: params.stock === "1" || undefined,
    onSale: params.deals === "1" || undefined,
    minPriceCents: params.min === undefined ? undefined : params.min * 100,
    maxPriceCents: params.max === undefined ? undefined : params.max * 100,
    status: "available",
    page: params.page,
    pageSize: STOREFRONT_PAGE_SIZE,
    ...sortMap[params.sort],
  };
}

/** Filtros que el usuario puede quitar; `page` y `sort` no son "filtros". */
export function hasActiveFilters(params: StorefrontProductsQuery): boolean {
  return (
    params.q !== undefined ||
    params.category !== undefined ||
    params.brand !== undefined ||
    params.min !== undefined ||
    params.max !== undefined ||
    params.stock !== undefined ||
    params.deals !== undefined
  );
}

/** Añade o quita un valor de un filtro multi-valor; vacío = sin filtro. */
export function toggleValue(
  current: string[] | undefined,
  value: string,
): string[] | undefined {
  const list = current ?? [];
  const next = list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];

  return next.length > 0 ? next : undefined;
}
