import { api } from "@/lib/axios";
import type { ProductListResponse } from "@/modules/products/types/product.types";

import {
  toProductQuery,
  type StorefrontProductsQuery,
} from "../schemas/storefront.schema";

export async function listStorefrontProducts(
  params: StorefrontProductsQuery,
): Promise<ProductListResponse> {
  const query = toProductQuery(params);

  const { data } = await api.get<ProductListResponse>("/products", {
    params: {
      ...query,
      // Axios serializaría un array como `brand[]=Dell&brand[]=LG`; el handler
      // lee `Object.fromEntries(searchParams)` y esa clave no existe en el
      // schema, así que el filtro se perdería en silencio (200 de más).
      categorySlug: query.categorySlug?.join(","),
      brand: query.brand?.join(","),
    },
  });

  return data;
}
