import { Star } from "lucide-react";
import Link from "next/link";

import { formatPrice } from "@/lib/utils";
import type { StorefrontProduct } from "@/modules/storefront/types/storefront.types";

/**
 * Dos tiles del bento con datos reales: el mockup usa cifras de relleno
 * ("5 M+ descargas") que en una tienda de verdad serían una afirmación falsa.
 */
export function HighlightCard({
  productCount,
  categoryCount,
  latest,
}: {
  productCount: number;
  categoryCount: number;
  latest: StorefrontProduct | null;
}) {
  return (
    <>
      <section className="bg-brand text-brand-foreground flex items-center gap-4 rounded-[26px] px-6 py-5">
        <div>
          <p className="font-mono text-2xl font-semibold">{productCount}</p>
          <p className="mt-0.5 text-xs opacity-85">
            productos en {categoryCount} categorías
          </p>
        </div>
      </section>

      {latest ? (
        <section className="border-storefront-border bg-storefront-card flex items-center gap-4 rounded-[26px] border px-6 py-4">
          <div className="flex-1">
            <span className="text-brand inline-flex items-center gap-1.5 text-[11px] font-semibold">
              <Star aria-hidden className="size-3 fill-current" />
              Novedad
            </span>
            <p className="mt-1 text-sm font-semibold">Ya disponible</p>
            <Link
              href={`/products/${latest.slug}`}
              className="text-muted-foreground mt-0.5 block text-xs hover:underline"
            >
              {latest.name} · {formatPrice(latest.priceCents)}
            </Link>
          </div>
        </section>
      ) : null}
    </>
  );
}
