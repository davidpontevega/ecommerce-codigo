"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError } from "@/lib/axios";

import type {
  CategoryCreateInput,
  CategoryUpdateInput,
} from "../schemas/category.schema";
import {
  createCategory,
  setCategoryActive,
  updateCategory,
} from "../services/category.service";
import { categoriesQueryKey } from "./use-categories";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CategoryCreateInput) => createCategory(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: categoriesQueryKey });
      toast.success("Categoría creada");
    },
    onError: (error) => {
      // El 409 lo pinta el formulario bajo el campo `slug`.
      if (error instanceof ApiError && error.status === 409) return;
      toast.error(errorMessage(error, "No se pudo crear la categoría"));
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CategoryUpdateInput }) =>
      updateCategory(id, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: categoriesQueryKey });
      toast.success("Categoría actualizada");
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) return;
      toast.error(errorMessage(error, "No se pudo actualizar la categoría"));
    },
  });
}

export function useSetCategoryActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      setCategoryActive(id, isActive),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: categoriesQueryKey });
      toast.success(
        variables.isActive ? "Categoría reactivada" : "Categoría desactivada",
      );
    },
    onError: (error) => {
      toast.error(errorMessage(error, "No se pudo cambiar el estado"));
    },
  });
}
