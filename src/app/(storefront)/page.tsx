import type { Metadata } from "next";

import { categoryQuerySchema } from "@/modules/categories/schemas/category.schema";
import { productQuerySchema } from "@/modules/products/schemas/product.schema";
import { CatalogSummaryCard } from "@/modules/storefront/components/catalog-summary-card";
import { FeaturedProductCard } from "@/modules/storefront/components/featured-product-card";
import { HeroCarousel } from "@/modules/storefront/components/hero-carousel";
import { HighlightCard } from "@/modules/storefront/components/highlight-card";
import { PopularColorsCard } from "@/modules/storefront/components/popular-colors-card";
import { ProductCard } from "@/modules/storefront/components/product-card";
import { Reveal } from "@/modules/storefront/components/reveal";
import type { HeroSlide } from "@/modules/storefront/types/storefront.types";
import * as categoryRepository from "@/server/repositories/category.repository";
import * as productRepository from "@/server/repositories/product.repository";

export const metadata: Metadata = {
  title: "E-commerce Tech — tecnología al mejor precio",
  description:
    "Portátiles, audio y accesorios: ofertas y novedades del catálogo.",
};

// La portada no cambia por visitante: se regenera cada 5 minutos.
export const revalidate = 300;

const categoryParams = categoryQuerySchema.parse({
  status: "active",
  pageSize: "100",
  sortBy: "name",
  sortDir: "asc",
});

const onSaleParams = productQuerySchema.parse({
  onSale: "true",
  categoryActive: "true",
  pageSize: "3",
});

const featuredParams = productQuerySchema.parse({
  categoryActive: "true",
  pageSize: "6",
});

export default async function StorefrontHomePage() {
  const [onSale, featured, categories] = await Promise.all([
    productRepository.list(onSaleParams),
    productRepository.list(featuredParams),
    categoryRepository.list(categoryParams),
  ]);

  // Sin ofertas, el hero enseña las novedades: la página nunca se queda vacía.
  const heroProducts = onSale.data.length > 0 ? onSale.data : featured.data;
  const slugByCategory = new Map(
    categories.data.map((category) => [category.id, category.slug]),
  );

  const slides: HeroSlide[] = heroProducts.slice(0, 3).map((product, index) => ({
    ...product,
    index: String(index + 1).padStart(2, "0"),
    categorySlug: slugByCategory.get(product.categoryId) ?? null,
  }));

  if (slides.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-28 text-center">
        <h1 className="text-2xl font-semibold">Catálogo en preparación</h1>
        <p className="text-muted-foreground max-w-md text-sm">
          Estamos dando de alta los primeros productos. Vuelve en un rato.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid items-start gap-3.5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Reveal className="min-w-0 lg:col-start-1">
          <HeroCarousel slides={slides} />
        </Reveal>

        <div className="flex min-w-0 flex-col gap-3.5 lg:col-start-2 lg:row-span-2">
          <PopularColorsCard />
          {featured.data[0] ? (
            <FeaturedProductCard
              product={featured.data[0]}
              title="Destacado de la semana"
            />
          ) : null}
        </div>

        <Reveal className="grid min-w-0 gap-3.5 sm:grid-cols-3 lg:col-start-1">
          <CatalogSummaryCard
            total={featured.total}
            categories={categories.data.slice(0, 3)}
          />
          <HighlightCard
            productCount={featured.total}
            categoryCount={categories.total}
            latest={featured.data[0] ?? null}
          />
        </Reveal>
      </div>

      <Reveal className="pt-2">
        <h2 className="px-1 pb-3 text-sm font-semibold">Novedades</h2>
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {featured.data.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </Reveal>
    </div>
  );
}
