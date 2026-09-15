"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { CategoryQueryInput } from "../schemas/category.schema";
import { listCategories } from "../services/category.service";

export const categoriesQueryKey = ["categories"] as const;

export function useCategories(params: CategoryQueryInput) {
  return useQuery({
    queryKey: [...categoriesQueryKey, params],
    queryFn: () => listCategories(params),
    // Evita el parpadeo a skeleton al paginar u ordenar.
    placeholderData: keepPreviousData,
  });
}
