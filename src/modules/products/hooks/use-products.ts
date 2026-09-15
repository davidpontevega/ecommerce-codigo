"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { ProductQueryInput } from "../schemas/product.schema";
import { listProducts } from "../services/product.service";

export const productsQueryKey = ["products"] as const;

export function useProducts(params: ProductQueryInput) {
  return useQuery({
    queryKey: [...productsQueryKey, params],
    queryFn: () => listProducts(params),
    // Evita el parpadeo a skeleton al paginar u ordenar.
    placeholderData: keepPreviousData,
  });
}
