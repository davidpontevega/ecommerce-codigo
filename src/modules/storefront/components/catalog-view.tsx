"use client";

import {
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  SearchX,
  SlidersHorizontal,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import type { CategoryListResponse } from "@/modules/categories/types/category.types";
import { useActiveCategories } from "@/modules/products/hooks/use-active-categories";
import type { ProductListResponse } from "@/modules/products/types/product.types";

import {
  useStorefrontProducts,
  type StorefrontProductsInitialData,
} from "../hooks/use-storefront-products";
import {
  hasActiveFilters,
  storefrontProductsQuerySchema,
  storefrontSortOptions,
  STOREFRONT_PAGE_SIZE,
  type StorefrontProductsQuery,
  type StorefrontSort,
} from "../schemas/storefront.schema";
import { CatalogActiveFilters } from "./catalog-active-filters";
import { CatalogFilters } from "./catalog-filters";
import { ProductCard } from "./product-card";

type Props = {
  initialParams: StorefrontProductsQuery;
  initialProducts: ProductListResponse;
  initialCategories: CategoryListResponse;
  brands: string[];
};

/**
 * Único dueño de `useSearchParams()`: la URL es la fuente de verdad del filtro,
 * así que un filtro es compartible y sobrevive a la recarga.
 */
export function CatalogView({
  initialParams,
  initialProducts,
  initialCategories,
  brands,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const reduced = useReducedMotion();

  const params = storefrontProductsQuerySchema.parse(
    Object.fromEntries(searchParams),
  );

  const initial: StorefrontProductsInitialData = {
    params: initialParams,
    data: initialProducts,
  };

  const productsQuery = useStorefrontProducts(params, initial);
  const categoriesQuery = useActiveCategories(initialCategories);
  const categories = categoriesQuery.data?.data ?? [];

  const applyPatch = useCallback(
    (patch: Partial<StorefrontProductsQuery>) => {
      const next = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(patch)) {
        // `String(["a","b"]) === "a,b"`: el multi-valor por coma se serializa solo.
        const serialized = value === undefined ? "" : String(value);

        if (serialized === "") {
          next.delete(key);
        } else {
          next.set(key, serialized);
        }
      }

      // Cambiar cualquier filtro devuelve el listado a la primera página.
      if (!("page" in patch)) {
        next.delete("page");
      }

      const query = next.toString();
      router.replace(query ? `/products?${query}` : "/products", {
        scroll: false,
      });
    },
    [router, searchParams],
  );

  const clearAll = useCallback(() => {
    router.replace("/products", { scroll: false });
  }, [router]);

  const total = productsQuery.data?.total ?? 0;
  const shown = productsQuery.data?.data.length ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / STOREFRONT_PAGE_SIZE));
  // Remonta la grilla al cambiar de filtro para que la entrada se repita.
  const gridKey = searchParams.toString();

  const filters = (
    <CatalogFilters
      params={params}
      categories={categories}
      brands={brands}
      onChange={applyPatch}
      onClear={clearAll}
    />
  );

  return (
    <div className="grid items-start gap-5 md:grid-cols-[300px_1fr]">
      <aside className="border-storefront-border bg-storefront-card rounded-card sticky top-5 hidden border p-6 md:block">
        {filters}
      </aside>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-5">
          <p className="text-muted-foreground text-[13.5px]">
            <span className="text-foreground font-mono font-semibold">
              {shown}
            </span>{" "}
            de{" "}
            <span className="text-foreground font-mono font-semibold">
              {total}
            </span>{" "}
            productos
          </p>

          <div className="flex items-center gap-2">
            <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
              <SheetTrigger
                render={
                  <Button
                    variant="outline"
                    className="border-storefront-border bg-storefront-card rounded-pill h-11 gap-2 px-4 md:hidden"
                  />
                }
              >
                <SlidersHorizontal className="size-4" />
                Filtros
              </SheetTrigger>
              <SheetContent
                side="bottom"
                className="max-h-[85vh] overflow-y-auto"
              >
                <SheetHeader>
                  <SheetTitle className="sr-only">Filtros</SheetTitle>
                </SheetHeader>
                <div className="p-4 pt-0">{filters}</div>
              </SheetContent>
            </Sheet>

            <div className="border-storefront-border bg-storefront-card rounded-pill flex h-11 items-center gap-2 border px-4">
              <ArrowDownUp
                aria-hidden
                className="text-muted-foreground size-4"
              />
              <Select
                value={params.sort}
                onValueChange={(value: StorefrontSort | null) =>
                  applyPatch({ sort: value ?? "new" })
                }
              >
                <SelectTrigger
                  aria-label="Ordenar por"
                  className="h-auto border-0 bg-transparent p-0 text-[13.5px] shadow-none focus-visible:ring-0"
                >
                  <SelectValue>
                    {(value) =>
                      storefrontSortOptions.find(
                        (option) => option.value === value,
                      )?.label ?? "Novedades"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {storefrontSortOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <CatalogActiveFilters
          params={params}
          categories={categories}
          onRemove={applyPatch}
          onClear={clearAll}
        />

        {productsQuery.isPending ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="rounded-card h-80" />
            ))}
          </div>
        ) : productsQuery.isError ? (
          <div className="border-storefront-border bg-storefront-card rounded-card flex flex-col items-center gap-3 border py-20 text-center">
            <p className="text-[15px] font-medium">
              No pudimos cargar el catálogo
            </p>
            <Button
              variant="outline"
              className="rounded-pill border-storefront-border h-11 px-5"
              onClick={() => void productsQuery.refetch()}
            >
              Reintentar
            </Button>
          </div>
        ) : productsQuery.data.data.length === 0 ? (
          <div className="border-storefront-border bg-storefront-card rounded-card flex flex-col items-center gap-2 border px-10 py-20 text-center">
            <span className="bg-storefront-sunk text-muted-foreground rounded-pill grid size-14 place-items-center">
              <SearchX aria-hidden className="size-6" />
            </span>
            <p className="mt-2 text-base font-medium">Nada con estos filtros</p>
            {hasActiveFilters(params) ? (
              <Button
                onClick={clearAll}
                className="bg-brand text-brand-foreground rounded-pill mt-2.5 h-11 px-5 hover:opacity-90"
              >
                Limpiar filtros
              </Button>
            ) : null}
          </div>
        ) : (
          <div
            key={gridKey}
            className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
          >
            {productsQuery.data.data.map((product, index) =>
              reduced ? (
                <ProductCard key={product.id} product={product} />
              ) : (
                // Solo `y`: animar `opacity` desde 0 dejaría contenido invisible
                // si la animación no llega a ejecutarse.
                <motion.div
                  key={product.id}
                  initial={{ y: 12 }}
                  animate={{ y: 0 }}
                  transition={{
                    duration: 0.42,
                    ease: [0.22, 1, 0.36, 1],
                    delay: Math.min(index, 8) * 0.035,
                  }}
                >
                  <ProductCard product={product} />
                </motion.div>
              ),
            )}
          </div>
        )}

        {pageCount > 1 ? (
          <nav
            aria-label="Paginación"
            className="mt-8 flex items-center justify-center gap-3"
          >
            <Button
              variant="outline"
              size="icon"
              aria-label="Página anterior"
              disabled={params.page <= 1}
              onClick={() => applyPatch({ page: params.page - 1 })}
              className="border-storefront-border rounded-pill size-11"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="font-mono text-sm">
              {params.page} / {pageCount}
            </span>
            <Button
              variant="outline"
              size="icon"
              aria-label="Página siguiente"
              disabled={params.page >= pageCount}
              onClick={() => applyPatch({ page: params.page + 1 })}
              className="border-storefront-border rounded-pill size-11"
            >
              <ChevronRight className="size-4" />
            </Button>
          </nav>
        ) : null}
      </div>
    </div>
  );
}
