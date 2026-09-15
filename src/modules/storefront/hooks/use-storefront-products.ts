"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { ProductListResponse } from "@/modules/products/types/product.types";

import type { StorefrontProductsQuery } from "../schemas/storefront.schema";
import { listStorefrontProducts } from "../services/storefront.service";

export function storefrontProductsQueryKey(params: StorefrontProductsQuery) {
  return ["storefront-products", params] as const;
}

export type StorefrontProductsInitialData = {
  params: StorefrontProductsQuery;
  data: ProductListResponse;
};

export function useStorefrontProducts(
  params: StorefrontProductsQuery,
  initial?: StorefrontProductsInitialData,
) {
  // `initialData` solo vale para la clave que el servidor ya resolvió: pasarla
  // en todas mostraría la primera página bajo cualquier filtro.
  const matchesInitial =
    initial !== undefined &&
    JSON.stringify(params) === JSON.stringify(initial.params);

  return useQuery({
    queryKey: storefrontProductsQueryKey(params),
    queryFn: () => listStorefrontProducts(params),
    initialData: matchesInitial ? initial.data : undefined,
    // El SSR ya entrega la primera página fresca: evita un refetch redundante al montar.
    initialDataUpdatedAt: matchesInitial ? () => Date.now() : undefined,
    staleTime: 60_000,
    // Al paginar o filtrar se mantiene la página anterior en pantalla.
    placeholderData: keepPreviousData,
  });
}
