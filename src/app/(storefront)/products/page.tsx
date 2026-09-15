import { ChevronRight, Home } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { categoryQuerySchema } from "@/modules/categories/schemas/category.schema";
import { CatalogView } from "@/modules/storefront/components/catalog-view";
import {
  storefrontProductsQuerySchema,
  toProductQuery,
} from "@/modules/storefront/schemas/storefront.schema";
import {
  toCategoryListResponse,
  toProductListResponse,
} from "@/modules/storefront/serializers";
import * as categoryRepository from "@/server/repositories/category.repository";
import * as productRepository from "@/server/repositories/product.repository";

export const metadata: Metadata = {
  title: "Catálogo — E-commerce Tech",
  description: "Todo el catálogo con filtros por categoría, precio y orden.",
};

const categoryParams = categoryQuerySchema.parse({
  status: "active",
  pageSize: "100",
  sortBy: "name",
  sortDir: "asc",
});

export default async function CatalogPage({
  searchParams,
}: PageProps<"/products">) {
  const params = storefrontProductsQuerySchema.parse(await searchParams);

  const [products, categories, brands] = await Promise.all([
    productRepository.list(toProductQuery(params)),
    categoryRepository.list(categoryParams),
    // Las marcas no cambian mientras el usuario filtra: son contenido de la
    // página, no un endpoint más.
    productRepository.listBrands(),
  ]);

  // Con varias categorías activas el título vuelve a "Catálogo": no hay una sola
  // que nombrar.
  const activeCategory =
    params.category?.length === 1
      ? categories.data.find(
          (category) => category.slug === params.category?.[0],
        )
      : undefined;

  return (
    <div className="flex flex-col gap-4 px-1 sm:px-3">
      <nav
        aria-label="Ruta de navegación"
        className="text-muted-foreground flex items-center gap-1.5 text-[13px]"
      >
        <Link href="/" className="flex items-center gap-1.5 hover:underline">
          <Home aria-hidden className="size-3.5" />
          Inicio
        </Link>
        <ChevronRight aria-hidden className="size-3.5" />
        <span className="text-foreground font-medium">
          {activeCategory?.name ?? "Catálogo"}
        </span>
      </nav>

      <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">
        {activeCategory?.name ?? "Catálogo"}
      </h1>

      {/* `<CatalogView>` lee `useSearchParams()`: sin este límite el build
          falla al prerenderizar. */}
      <Suspense fallback={null}>
        <CatalogView
          initialParams={params}
          initialProducts={toProductListResponse(products)}
          initialCategories={toCategoryListResponse(categories)}
          brands={brands}
        />
      </Suspense>
    </div>
  );
}
