"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError } from "@/lib/axios";

import type {
  ProductCreateInput,
  ProductUpdateInput,
} from "../schemas/product.schema";
import {
  createProduct,
  deleteProduct,
  restoreProduct,
  updateProduct,
} from "../services/product.service";
import { productsQueryKey } from "./use-products";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ProductCreateInput) => createProduct(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: productsQueryKey });
      toast.success("Producto creado");
    },
    onError: (error) => {
      // El 409 lo pinta el formulario bajo `sku` o `slug`.
      if (error instanceof ApiError && error.status === 409) return;
      toast.error(errorMessage(error, "No se pudo crear el producto"));
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ProductUpdateInput }) =>
      updateProduct(id, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: productsQueryKey });
      toast.success("Producto actualizado");
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) return;
      toast.error(errorMessage(error, "No se pudo actualizar el producto"));
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: productsQueryKey });
      toast.success("Producto eliminado");
    },
    onError: (error) => {
      toast.error(errorMessage(error, "No se pudo eliminar el producto"));
    },
  });
}

export function useRestoreProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => restoreProduct(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: productsQueryKey });
      toast.success("Producto restaurado");
    },
    onError: (error) => {
      toast.error(errorMessage(error, "No se pudo restaurar el producto"));
    },
  });
}
