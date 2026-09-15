import Link from "next/link";

import { discountPercent, formatPrice, stockNote } from "@/lib/utils";
import { CartQtyControl } from "@/modules/cart/components/cart-qty-control";
import { ProductImage } from "@/modules/storefront/components/product-image";
import type { StorefrontProduct } from "@/modules/storefront/types/storefront.types";

export function ProductCard({ product }: { product: StorefrontProduct }) {
  const discount = discountPercent(
    product.priceCents,
    product.compareAtPriceCents,
  );
  const soldOut = product.stock <= 0;
  // El resumen del diseño vive en `specs.resumen`; la descripción es el respaldo.
  const spec = product.specs?.resumen ?? product.description ?? null;

  return (
    <article className="group border-storefront-border bg-storefront-card rounded-card flex flex-col border p-3 transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_20px_48px_-24px_rgba(20,25,40,0.35)] motion-reduce:transform-none motion-reduce:transition-none">
      <Link
        href={`/products/${product.slug}`}
        className="flex flex-1 flex-col rounded-[20px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <div
          className={`relative overflow-hidden rounded-[20px] ${soldOut ? "opacity-55" : ""}`}
        >
          <ProductImage
            name={product.name}
            imageUrl={product.imageUrl}
            className="aspect-[16/11] rounded-none transition-transform duration-500 group-hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none"
          />
          {discount !== null ? (
            <span className="bg-brand text-brand-foreground rounded-pill absolute top-3 left-3 px-2.5 py-1 font-mono text-[11.5px] font-semibold">
              -{discount} %
            </span>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col px-2 pt-4">
          <h3 className="text-[15px] leading-snug font-medium text-pretty">
            {product.name}
          </h3>
          <p className="text-muted-foreground mt-0.5 line-clamp-1 text-[12.5px]">
            {spec ?? product.categoryName}
          </p>
        </div>
      </Link>

      <div className="flex items-end justify-between gap-2.5 px-2 pt-4 pb-1.5">
        {/* `min-w-0`: en tarjeta estrecha se trunca el precio, no se sale el stepper. */}
        <div className="min-w-0">
          <p className="text-muted-foreground text-[11.5px]">
            {stockNote(product.stock)}
          </p>
          <div className="mt-0.5 flex min-w-0 items-baseline gap-2">
            <span className="truncate font-mono text-[19px] font-semibold tracking-tight">
              {formatPrice(product.priceCents)}
            </span>
            {product.compareAtPriceCents ? (
              <span className="text-muted-foreground truncate font-mono text-xs line-through">
                {formatPrice(product.compareAtPriceCents)}
              </span>
            ) : null}
          </div>
        </div>

        <CartQtyControl
          product={{
            id: product.id,
            name: product.name,
            slug: product.slug,
            priceCents: product.priceCents,
            imageUrl: product.imageUrl,
            stock: product.stock,
          }}
        />
      </div>
    </article>
  );
}
