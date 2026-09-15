"use client";

import { Search, SearchX } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/hooks/use-debounce";
import { formatPrice, stockNote } from "@/lib/utils";

import { useProductSearch } from "../hooks/use-product-search";
import { ProductImage } from "./product-image";

/** Se piden 12 (`STOREFRONT_PAGE_SIZE`) y se pintan estos. */
const MAX_RESULTS = 6;

/**
 * Isla de cliente del header: el `<form action="/products">` se conserva tal
 * cual, así que sin JS —o antes de hidratar— Enter sigue buscando en el
 * catálogo. El JS solo intercepta el envío cuando ya puede hacer algo mejor.
 *
 * No usa `useSearchParams()`: vive en el layout del grupo y eso obligaría a un
 * `<Suspense>` en todas las páginas del storefront.
 */
export function SearchBox() {
  const router = useRouter();
  const listboxId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const debounced = useDebounce(term, 280);
  const search = useProductSearch(debounced);

  const trimmed = term.trim();
  const expanded = open && trimmed.length >= 2;
  const results = (search.data?.data ?? []).slice(0, MAX_RESULTS);
  const catalogHref = `/products?q=${encodeURIComponent(trimmed)}`;
  const optionId = (index: number) => `${listboxId}-option-${index}`;

  useEffect(() => {
    if (!expanded) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!formRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setActive(-1);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [expanded]);

  const goTo = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      setActive(-1);
      inputRef.current?.focus();
      return;
    }

    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    if (results.length === 0) return;

    event.preventDefault();
    setOpen(true);
    setActive((current) =>
      event.key === "ArrowDown"
        ? current + 1 >= results.length
          ? 0
          : current + 1
        : current <= 0
          ? results.length - 1
          : current - 1,
    );
  };

  return (
    <form
      ref={formRef}
      action="/products"
      method="get"
      role="search"
      onKeyDown={onKeyDown}
      onSubmit={(event) => {
        // Enter en el input: si hay una opción resaltada con las flechas, va a
        // esa ficha; si no, al catálogo. El botón de lupa nunca entra por aquí
        // (su `onClick` hace `preventDefault`).
        event.preventDefault();
        const selected = active >= 0 ? results[active] : undefined;

        goTo(
          selected
            ? `/products/${selected.slug}`
            : trimmed === ""
              ? "/products"
              : catalogHref,
        );
      }}
      className="border-storefront-border bg-storefront-card relative order-last flex h-12 w-full min-w-0 basis-full items-center gap-3 rounded-full border py-0 pr-2 pl-5 sm:order-none sm:w-auto sm:flex-1 sm:basis-auto"
    >
      <label htmlFor="storefront-search" className="sr-only">
        Buscar productos
      </label>
      <input
        ref={inputRef}
        id="storefront-search"
        name="q"
        type="search"
        role="combobox"
        autoComplete="off"
        aria-expanded={expanded}
        aria-controls={
          expanded && results.length > 0 ? listboxId : undefined
        }
        aria-autocomplete="list"
        aria-activedescendant={
          expanded && active >= 0 ? optionId(active) : undefined
        }
        placeholder="Buscar productos…"
        value={term}
        onChange={(event) => {
          setTerm(event.target.value);
          setOpen(true);
          // Un término nuevo invalida la opción resaltada; en el envío
          // `results[active]` puede ser `undefined` y cae al catálogo.
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
      />
      <Button
        type="submit"
        size="icon"
        aria-label="Buscar en el catálogo"
        onClick={(event) => {
          // La lupa siempre lleva al catálogo, nunca a una ficha, aunque el
          // ratón haya pasado por encima de un resultado (AC15).
          event.preventDefault();
          goTo(trimmed === "" ? "/products" : catalogHref);
        }}
        className="bg-foreground text-background size-9 shrink-0 rounded-full"
      >
        <Search className="size-4" />
      </Button>

      {expanded ? (
        <div className="border-storefront-border bg-storefront-shell rounded-card absolute inset-x-0 top-[calc(100%+8px)] z-50 border p-2 shadow-[0_28px_60px_-28px_rgba(20,25,40,0.45)] backdrop-blur-2xl">
          {search.isPending ? (
            <div className="flex flex-col gap-1.5 p-1">
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className="h-14 rounded-2xl" />
              ))}
            </div>
          ) : search.isError ? (
            <div className="flex items-center justify-between gap-3 p-3">
              <p className="text-[13.5px] font-medium">No se pudo buscar</p>
              <Button
                type="button"
                variant="outline"
                className="border-storefront-border rounded-pill h-9 px-4"
                onClick={() => void search.refetch()}
              >
                Reintentar
              </Button>
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-7 text-center">
              <span className="bg-storefront-sunk text-muted-foreground rounded-pill grid size-11 place-items-center">
                <SearchX aria-hidden className="size-5" />
              </span>
              <p className="text-[13.5px] font-medium">
                Nada para «{trimmed}»
              </p>
              <Link
                href={catalogHref}
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground text-[12.5px] underline underline-offset-4"
              >
                Buscar en todo el catálogo
              </Link>
            </div>
          ) : (
            <>
              <ul id={listboxId} role="listbox" aria-label="Resultados de la búsqueda">
                {results.map((product, index) => (
                  <li key={product.id} role="none">
                    <Link
                      id={optionId(index)}
                      role="option"
                      aria-selected={index === active}
                      href={`/products/${product.slug}`}
                      onClick={() => setOpen(false)}
                      className={`hover:bg-storefront-sunk grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl p-1.5 ${
                        index === active ? "bg-storefront-sunk" : ""
                      }`}
                    >
                      <ProductImage
                        name={product.name}
                        imageUrl={product.imageUrl}
                        sizes="52px"
                        className="size-13 rounded-xl"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-[13.5px] font-medium">
                          {product.name}
                        </span>
                        <span className="text-muted-foreground block truncate text-[12px]">
                          {product.categoryName} · {stockNote(product.stock)}
                        </span>
                      </span>
                      <span className="pr-1.5 font-mono text-[13px] font-medium">
                        {formatPrice(product.priceCents)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>

              <Link
                href={catalogHref}
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground block rounded-2xl p-2.5 text-center text-[12.5px] font-medium"
              >
                Ver todos los resultados
              </Link>
            </>
          )}
        </div>
      ) : null}
    </form>
  );
}
