"use client";

import { useQuery } from "@tanstack/react-query";

import { getProduct } from "../services/product.service";
import { productsQueryKey } from "./use-products";

/**
 * Lectura por id para el modo edición del formulario: la fila de la tabla ya no
 * trae `costCents` (spec 019 D8), así que el costo hay que pedirlo aquí.
 * `id === null` es el modo creación y no dispara ninguna petición.
 */
export function useProduct(id: string | null, enabled = true) {
  return useQuery({
    queryKey: [...productsQueryKey, "detail", id],
    queryFn: () => {
      // `enabled` ya lo impide; el guard es para no castear el tipo.
      if (id === null) throw new Error("useProduct necesita un id");
      return getProduct(id);
    },
    enabled: enabled && id !== null,
  });
}
