"use client";

import { Minus, Plus } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { MouseEvent } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/modules/cart/store/cart-store";
import type { CartLine } from "@/modules/storefront/types/storefront.types";

/**
 * Único control de cantidad de la tienda: "+" mientras el producto no está en
 * el carrito, `− qty +` en cuanto entra. Son el mismo estado con dos renders;
 * separarlos duplicaría el acceso al store y la guardia de stock.
 *
 * El tope real lo aplica el store (`add`/`setQty`); aquí solo se refleja con
 * `disabled` para que el botón no mienta.
 */
export function CartQtyControl({
  product,
  className,
  addLabel,
}: {
  product: Omit<CartLine, "qty">;
  className?: string;
  /** Texto junto al "+" cuando el producto aún no está en el carrito (ficha). */
  addLabel?: string;
}) {
  // Selector por id: devuelve un número, no un objeto nuevo en cada render.
  const qty = useCartStore(
    (state) => state.lines.find((line) => line.id === product.id)?.qty ?? 0,
  );
  const add = useCartStore((state) => state.add);
  const setQty = useCartStore((state) => state.setQty);
  const reduced = useReducedMotion();

  const soldOut = product.stock <= 0;

  // La tarjeta puede envolverse entera en un `<Link>`: un clic en "+" que
  // navega es el bug clásico de este patrón. La guardia viaja con el control.
  const handle = (run: () => void) => (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    run();
  };

  if (qty === 0) {
    return (
      <Button
        type="button"
        disabled={soldOut}
        aria-label={`Agregar ${product.name} al carrito`}
        onClick={handle(() => add(product))}
        className={cn(
          "bg-foreground text-background rounded-pill h-10 shrink-0 gap-2 transition-transform active:scale-95",
          addLabel ? "px-5 text-[14px] font-medium" : "w-10 p-0",
          className,
        )}
      >
        {soldOut && addLabel ? null : (
          <Plus className="size-4" strokeWidth={2.4} />
        )}
        {addLabel ? <span>{soldOut ? "Agotado" : addLabel}</span> : null}
      </Button>
    );
  }

  return (
    <div
      className={cn(
        "border-storefront-border bg-storefront-card rounded-pill flex h-10 shrink-0 items-center gap-0.5 border p-0.5",
        className,
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Quitar uno de ${product.name}`}
        onClick={handle(() => setQty(product.id, qty - 1))}
        className="rounded-pill size-8 shrink-0"
      >
        <Minus className="size-3.5" strokeWidth={2.4} />
      </Button>

      {/* Ancho fijo: con `flex-1` la píldora crecía y se salía de la tarjeta. */}
      <span className="relative w-8 shrink-0 text-center font-mono text-[13px] font-medium">
        {/* Región viva estable: no se remonta, así el lector anuncia el cambio. */}
        <span aria-live="polite" className="sr-only">
          {qty} en el carrito
        </span>
        {/* `key={qty}` reinicia el bump; `aria-hidden` para no duplicar el anuncio. */}
        <motion.span
          key={qty}
          aria-hidden
          animate={reduced ? undefined : { scale: [1, 1.3, 1] }}
          transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          className="block"
        >
          {qty}
        </motion.span>
      </span>

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={qty >= product.stock}
        aria-label={`Agregar uno de ${product.name}`}
        onClick={handle(() => setQty(product.id, qty + 1))}
        className="rounded-pill size-8 shrink-0"
      >
        <Plus className="size-3.5" strokeWidth={2.4} />
      </Button>
    </div>
  );
}
