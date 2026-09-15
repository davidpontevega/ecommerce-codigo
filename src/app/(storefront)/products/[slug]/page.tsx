import { ChevronRight, Home } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { Separator } from "@/components/ui/separator";
import { discountPercent, formatPrice, stockNote } from "@/lib/utils";
import { CartQtyControl } from "@/modules/cart/components/cart-qty-control";
import { productQuerySchema } from "@/modules/products/schemas/product.schema";
import { ProductCard } from "@/modules/storefront/components/product-card";
import { ProductImage } from "@/modules/storefront/components/product-image";
import * as productRepository from "@/server/repositories/product.repository";

import { ScrollReset } from "./scroll-reset";

/**
 * Next resuelve `generateMetadata` y la página por separado: sin `cache()` la
 * misma visita haría dos veces la consulta.
 */
const getProduct = cache(productRepository.findBySlug);

export async function generateMetadata({
  params,
}: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) {
    return { title: "Producto no encontrado — E-commerce Tech" };
  }

  return {
    title: `${product.name} — E-commerce Tech`,
    description:
      product.specs?.resumen ??
      product.description ??
      `${product.name} en E-commerce Tech.`,
  };
}

export default async function ProductDetailPage({
  params,
}: PageProps<"/products/[slug]">) {
  const { slug } = await params;
  const product = await getProduct(slug);

  // Inexistente, borrado o de categoría inactiva: los tres los descarta el
  // `where` de `findBySlug`, así que aquí son el mismo 404.
  if (!product) {
    notFound();
  }

  // Secuencial y no en un `Promise.all`: depende de `product.categorySlug`.
  // Se piden 4 porque `list` no sabe excluir un id: el actual sale de los 4 aquí.
  const sameCategory = await productRepository.list(
    productQuerySchema.parse({
      categorySlug: product.categorySlug,
      categoryActive: "true",
      pageSize: "4",
    }),
  );
  const related = sameCategory.data
    .filter((item) => item.id !== product.id)
    .slice(0, 3);

  const discount = discountPercent(
    product.priceCents,
    product.compareAtPriceCents,
  );
  const soldOut = product.stock <= 0;
  const summary = product.specs?.resumen ?? product.description;
  // `specs` es jsonb de forma libre: `String(...)` evita que un número o un
  // objeto rompan el render, y los vacíos no pintan fila.
  const specs = Object.entries(product.specs ?? {}).filter(
    ([key, value]) => key !== "resumen" && String(value ?? "").trim() !== "",
  );

  return (
    <div className="flex flex-col gap-4 px-1 sm:px-3">
      <ScrollReset slug={product.slug} />
      <nav
        aria-label="Ruta de navegación"
        className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-[13px]"
      >
        <Link href="/" className="flex items-center gap-1.5 hover:underline">
          <Home aria-hidden className="size-3.5" />
          Inicio
        </Link>
        <ChevronRight aria-hidden className="size-3.5" />
        <Link
          href={`/products?category=${product.categorySlug}`}
          className="hover:underline"
        >
          {product.categoryName}
        </Link>
        <ChevronRight aria-hidden className="size-3.5" />
        <span className="text-foreground font-medium">{product.name}</span>
      </nav>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <div className="border-storefront-border bg-storefront-sunk rounded-card relative overflow-hidden border p-3">
          <ProductImage
            name={product.name}
            imageUrl={product.imageUrl}
            sizes="(max-width: 1024px) 100vw, 55vw"
            className={`aspect-[4/3] rounded-[20px] ${soldOut ? "opacity-55" : ""}`}
          />
          {discount !== null ? (
            <span className="bg-brand text-brand-foreground rounded-pill absolute top-6 left-6 px-2.5 py-1 font-mono text-[11.5px] font-semibold">
              -{discount} %
            </span>
          ) : null}
        </div>

        <div className="border-storefront-border bg-storefront-card rounded-card border p-6 sm:p-8">
          {product.brand ? (
            <p className="text-muted-foreground text-[12px] font-medium tracking-[0.14em] uppercase">
              {product.brand}
            </p>
          ) : null}

          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-pretty sm:text-[30px]">
            {product.name}
          </h1>

          {summary ? (
            <p className="text-muted-foreground mt-2.5 text-[14.5px] leading-relaxed text-pretty">
              {summary}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap items-baseline gap-3">
            <span className="font-mono text-[28px] font-semibold tracking-tight">
              {formatPrice(product.priceCents)}
            </span>
            {product.compareAtPriceCents ? (
              <span className="text-muted-foreground font-mono text-sm line-through">
                {formatPrice(product.compareAtPriceCents)}
              </span>
            ) : null}
            {discount !== null ? (
              <span className="bg-brand text-brand-foreground rounded-pill px-2.5 py-1 font-mono text-[11.5px] font-semibold">
                -{discount} %
              </span>
            ) : null}
          </div>

          <p className="text-muted-foreground mt-2 text-[13px]">
            {stockNote(product.stock)}
          </p>

          {/* Isla de cliente: el resto de la ficha es marcado puro. */}
          <CartQtyControl
            product={{
              id: product.id,
              name: product.name,
              slug: product.slug,
              priceCents: product.priceCents,
              imageUrl: product.imageUrl,
              stock: product.stock,
            }}
            addLabel="Agregar al carrito"
            className="mt-6 h-13"
          />

          {specs.length > 0 ? (
            <div className="mt-8">
              <h2 className="text-[13px] font-semibold tracking-[0.12em] uppercase">
                Especificaciones
              </h2>
              <dl className="mt-3">
                {specs.map(([key, value], index) => (
                  <div key={key}>
                    {index > 0 ? <Separator className="bg-storefront-border" /> : null}
                    <div className="grid grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)] gap-3 py-2.5 text-[13.5px]">
                      <dt className="text-muted-foreground capitalize">{key}</dt>
                      <dd className="font-medium">{String(value)}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}

          <Link
            href={`/products?category=${product.categorySlug}`}
            className="text-muted-foreground hover:text-foreground mt-8 flex w-fit items-center gap-1.5 text-[13.5px] font-medium"
          >
            Ver más de {product.categoryName}
            <ChevronRight aria-hidden className="size-3.5" />
          </Link>
        </div>
      </div>

      {related.length > 0 ? (
        <section className="mt-6">
          <h2 className="text-[13px] font-semibold tracking-[0.12em] uppercase">
            Productos parecidos
          </h2>
          <div className="mt-4 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
