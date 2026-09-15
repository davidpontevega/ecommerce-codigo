"use client";

import { X } from "lucide-react";

import { formatPrice } from "@/lib/utils";
import type { CategoryDto } from "@/modules/categories/types/category.types";

import {
  toggleValue,
  type StorefrontProductsQuery,
} from "../schemas/storefront.schema";

type Props = {
  params: StorefrontProductsQuery;
  categories: CategoryDto[];
  onRemove: (patch: Partial<StorefrontProductsQuery>) => void;
  onClear: () => void;
};

type Chip = { key: string; label: string; clear: () => void };

export function CatalogActiveFilters({
  params,
  categories,
  onRemove,
  onClear,
}: Props) {
  const chips: Chip[] = [];

  if (params.q) {
    chips.push({
      key: "q",
      label: `“${params.q}”`,
      clear: () => onRemove({ q: undefined }),
    });
  }

  // Un chip por **valor**: dos categorías, dos chips.
  for (const slug of params.category ?? []) {
    const name = categories.find((category) => category.slug === slug)?.name;

    chips.push({
      key: `category-${slug}`,
      label: name ?? slug,
      clear: () => onRemove({ category: toggleValue(params.category, slug) }),
    });
  }

  for (const brand of params.brand ?? []) {
    chips.push({
      key: `brand-${brand}`,
      label: brand,
      clear: () => onRemove({ brand: toggleValue(params.brand, brand) }),
    });
  }

  if (params.min !== undefined) {
    chips.push({
      key: "min",
      label: `Desde ${formatPrice(params.min * 100)}`,
      clear: () => onRemove({ min: undefined }),
    });
  }

  if (params.max !== undefined) {
    chips.push({
      key: "max",
      label: `Hasta ${formatPrice(params.max * 100)}`,
      clear: () => onRemove({ max: undefined }),
    });
  }

  if (params.stock === "1") {
    chips.push({
      key: "stock",
      label: "Con stock",
      clear: () => onRemove({ stock: undefined }),
    });
  }

  if (params.deals === "1") {
    chips.push({
      key: "deals",
      label: "En oferta",
      clear: () => onRemove({ deals: undefined }),
    });
  }

  if (chips.length === 0) {
    return null;
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <span className="text-muted-foreground text-[13px]">
        Filtros activos:
      </span>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.clear}
          aria-label={`Quitar filtro ${chip.label}`}
          className="rounded-pill border-storefront-border bg-storefront-card hover:bg-storefront-sunk focus-visible:ring-ring/50 inline-flex h-8 items-center gap-1.5 border px-3 text-[13px] font-medium transition-colors outline-none focus-visible:ring-3"
        >
          {chip.label}
          <X className="size-3.5" aria-hidden />
        </button>
      ))}
      <button
        type="button"
        onClick={onClear}
        className="text-muted-foreground hover:text-foreground h-8 px-2 text-[13px] font-semibold underline-offset-4 hover:underline"
      >
        Quitar todo
      </button>
    </div>
  );
}
