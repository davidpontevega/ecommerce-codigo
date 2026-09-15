import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { formatPrice } from "@/lib/utils";
import { ProductImage } from "@/modules/storefront/components/product-image";
import type { StorefrontProduct } from "@/modules/storefront/types/storefront.types";

export function FeaturedProductCard({
  product,
  title,
}: {
  product: StorefrontProduct;
  title: string;
}) {
  return (
    <section className="border-storefront-border bg-storefront-card relative flex flex-1 flex-col gap-3 overflow-hidden rounded-[26px] border p-6">
      <h2 className="text-sm font-semibold">{title}</h2>

      <Link
        href={`/products/${product.slug}`}
        className="flex flex-1 flex-col gap-3"
        aria-label={`Ver ${product.name}`}
      >
        <ProductImage
          name={product.name}
          imageUrl={product.imageUrl}
          className="mx-auto w-full max-w-[210px] rounded-[20px]"
        />
        <div>
          <p className="text-base font-semibold tracking-tight">
            {product.name}
          </p>
          <p className="text-muted-foreground mt-1 text-[13px]">
            {product.brand ?? product.categoryName} ·{" "}
            {formatPrice(product.priceCents)}
          </p>
        </div>
        <span
          aria-hidden
          className="bg-storefront-card border-storefront-border absolute top-4 right-4 grid size-8 place-items-center rounded-full border"
        >
          <ArrowUpRight className="size-3.5" />
        </span>
      </Link>
    </section>
  );
}
