import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

type CategoryTile = { id: string; name: string; slug: string };

export function CatalogSummaryCard({
  total,
  categories,
}: {
  total: number;
  categories: CategoryTile[];
}) {
  return (
    <section className="border-storefront-border bg-storefront-card rounded-[26px] border px-6 py-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold">
            <Link href="/products" className="hover:underline">
              Ver todo el catálogo
            </Link>
          </h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {total} artículos
          </p>
        </div>
        <Link
          href="/products"
          aria-label="Ver todo el catálogo"
          className="bg-storefront-card border-storefront-border text-foreground grid size-8 place-items-center rounded-full border"
        >
          <ArrowUpRight aria-hidden className="size-3.5" />
        </Link>
      </div>

      <div className="mt-4 flex gap-2.5">
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`/products?category=${category.slug}`}
            className="bg-brand/10 hover:bg-brand/20 grid flex-1 place-items-center rounded-[14px] px-2 py-4 text-center text-xs font-medium"
          >
            {category.name}
          </Link>
        ))}
      </div>
    </section>
  );
}
