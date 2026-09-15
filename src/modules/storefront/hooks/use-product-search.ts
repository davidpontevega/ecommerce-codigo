"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { storefrontProductsQuerySchema } from "../schemas/storefront.schema";
import { listStorefrontProducts } from "../services/storefront.service";

/**
 * Typeahead del header. Hook propio en vez de una bandera en
 * `useStorefrontProducts`: ese lleva `initialData` del SSR y no debe aprender un
 * modo condicional por un segundo consumidor.
 *
 * `enabled` es la mitad del ahorro de peticiones; la otra es el debounce del
 * llamador.
 */
export function useProductSearch(term: string) {
  // `q` está limitado a 100 en el schema y por encima cae a `undefined`, que
  // listaría el catálogo entero: se recorta antes de parsear.
  const q = term.trim().slice(0, 100);

  return useQuery({
    queryKey: ["storefront-search", q] as const,
    queryFn: () =>
      listStorefrontProducts(storefrontProductsQuerySchema.parse({ q })),
    enabled: q.length >= 2,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}
