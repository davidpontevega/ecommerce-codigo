import type { NewProduct, Product } from "@/server/db/schema";

export type { NewProduct, Product };

/** Fila del listado: el `innerJoin` a `categories` evita un N+1 por fila. */
export type ProductWithCategory = Product & { categoryName: string };

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

export type ProductListResponse = {
  data: ProductDto[];
  total: number;
  page: number;
  pageSize: number;
};
