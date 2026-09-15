"use client";

import { cn } from "@/lib/utils";
import type { CategoryDto } from "@/modules/categories/types/category.types";

import {
  hasActiveFilters,
  PRICE_RANGES,
  toggleValue,
  type StorefrontProductsQuery,
} from "../schemas/storefront.schema";

export type CatalogFiltersChange = (
  patch: Partial<StorefrontProductsQuery>,
) => void;

type Props = {
  params: StorefrontProductsQuery;
  categories: CategoryDto[];
  brands: string[];
  onChange: CatalogFiltersChange;
  onClear: () => void;
};

/**
 * Chip de filtro: `<button aria-pressed>`, el patrón nativo accesible para un
 * interruptor. Seleccionado invierte a tinta, no al acento: el lima queda para
 * la acción principal y como texto no llegaría a 4.5:1.
 */
function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-pill focus-visible:ring-ring/50 inline-flex h-[34px] items-center px-3.5 text-[13px] font-medium transition-colors outline-none focus-visible:ring-3 active:scale-[0.97] motion-reduce:transform-none motion-reduce:transition-none",
        active
          ? "bg-foreground text-background"
          : "bg-storefront-sunk text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="mt-6 first:mt-0">
      <legend className="text-muted-foreground mb-3 text-[11.5px] font-semibold tracking-wider uppercase">
        {title}
      </legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

/** No toca la URL: emite el cambio y `<CatalogView>` decide. */
export function CatalogFilters({
  params,
  categories,
  brands,
  onChange,
  onClear,
}: Props) {
  const activeRange =
    PRICE_RANGES.find(
      (range) => range.min === params.min && range.max === params.max,
    ) ?? null;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[17px] font-semibold tracking-tight">Filtros</h2>
        {hasActiveFilters(params) ? (
          <button
            type="button"
            onClick={onClear}
            className="rounded-pill bg-storefront-sunk text-muted-foreground hover:text-foreground h-8 px-3 text-[12.5px] font-medium transition-colors"
          >
            Limpiar
          </button>
        ) : null}
      </div>

      <div className="mt-6">
        <Section title="Categoría">
          {categories.map((category) => (
            <Chip
              key={category.id}
              active={params.category?.includes(category.slug) ?? false}
              onClick={() =>
                onChange({
                  category: toggleValue(params.category, category.slug),
                })
              }
            >
              {category.name}
            </Chip>
          ))}
        </Section>

        <Section title="Precio">
          {PRICE_RANGES.map((range) => (
            <Chip
              key={range.id}
              active={activeRange?.id === range.id}
              onClick={() => onChange({ min: range.min, max: range.max })}
            >
              {range.label}
            </Chip>
          ))}
        </Section>

        {brands.length > 0 ? (
          <Section title="Marca">
            {brands.map((brand) => (
              <Chip
                key={brand}
                active={params.brand?.includes(brand) ?? false}
                onClick={() => onChange({ brand: toggleValue(params.brand, brand) })}
              >
                {brand}
              </Chip>
            ))}
          </Section>
        ) : null}

        <Section title="Disponibilidad">
          <Chip
            active={params.stock === "1"}
            onClick={() =>
              onChange({ stock: params.stock === "1" ? undefined : "1" })
            }
          >
            Con stock
          </Chip>
          <Chip
            active={params.deals === "1"}
            onClick={() =>
              onChange({ deals: params.deals === "1" ? undefined : "1" })
            }
          >
            En oferta
          </Chip>
        </Section>
      </div>
    </div>
  );
}
