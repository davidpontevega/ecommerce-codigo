import type { NewProduct, Product } from "@/server/db/schema";

export type { NewProduct, Product };

/**
 * Fila del listado: el `innerJoin` a `categories` evita un N+1 por fila.
 *
 * **Sin `costCents` a propósito** (spec 019 D8): esta es la forma que devuelven
 * las lecturas públicas (`list`, `findBySlug`). El costo es dato financiero y
 * solo viaja en `ProductWithCost`, detrás de un permiso.
 */
export type ProductWithCategory = Omit<Product, "costCents"> & {
  categoryName: string;
};

type WithCost = { costCents: number | null };

/** Lectura por id del panel: la única del repositorio que trae el costo. */
export type ProductWithCost = ProductWithCategory & WithCost;

/**
 * Lo que realmente recibe el cliente: `NextResponse.json` serializa las
 * columnas `timestamptz` a string ISO, no a `Date`.
 */
export type ProductDto = Omit<
  ProductWithCategory,
  "createdAt" | "updatedAt" | "deletedAt"
> & {
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

/** Respuesta de `GET /api/products/[id]`, que exige `products.read`. */
export type ProductWithCostDto = ProductDto & WithCost;

export type ProductListResponse = {
  data: ProductDto[];
  total: number;
  page: number;
  pageSize: number;
};
