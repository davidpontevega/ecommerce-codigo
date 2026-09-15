"use client";

import { useQuery } from "@tanstack/react-query";

import { listCategories } from "@/modules/categories/services/category.service";
import type { CategoryQueryInput } from "@/modules/categories/schemas/category.schema";
import type { CategoryListResponse } from "@/modules/categories/types/category.types";

// Params fijos: el filtro de la tabla, el Select del formulario y el catálogo
// público comparten esta entrada de caché en vez de pedir la misma lista tres
// veces.
const params: CategoryQueryInput = {
  status: "active",
  page: 1,
  pageSize: 100,
  sortBy: "name",
  sortDir: "asc",
};

/**
 * `initialData` la aporta el Server Component del catálogo, que ya leyó las
 * categorías: sin ella el cliente repetiría la petición al hidratar.
 */
export function useActiveCategories(initialData?: CategoryListResponse) {
  return useQuery({
    queryKey: ["categories", params],
    queryFn: () => listCategories(params),
    initialData,
    // Las categorías cambian con muy poca frecuencia; las mutaciones del panel
    // invalidan `["categories"]` de todas formas.
    staleTime: 5 * 60_000,
  });
}
