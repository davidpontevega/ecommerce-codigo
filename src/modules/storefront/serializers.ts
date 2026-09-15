import type { CategoryListResponse } from "@/modules/categories/types/category.types";
import type { ProductListResponse } from "@/modules/products/types/product.types";
import type { CategoryListResult } from "@/server/repositories/category.repository";
import type { ProductListResult } from "@/server/repositories/product.repository";

/**
 * El repositorio devuelve `Date`; el cliente consume lo mismo que sale de
 * `NextResponse.json`, es decir strings ISO. Estas dos funciones hacen esa
 * conversión para que la lectura del servidor pueda entrar como `initialData`
 * sin mentir sobre el tipo.
 */
export function toProductListResponse(
  result: ProductListResult,
): ProductListResponse {
  return {
    ...result,
    data: result.data.map((product) => ({
      ...product,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
      deletedAt: product.deletedAt?.toISOString() ?? null,
    })),
  };
}

export function toCategoryListResponse(
  result: CategoryListResult,
): CategoryListResponse {
  return {
    ...result,
    data: result.data.map((category) => ({
      ...category,
      createdAt: category.createdAt.toISOString(),
      updatedAt: category.updatedAt.toISOString(),
    })),
  };
}
