"use client";

import { Minus, Plus, ShoppingBag } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatPrice } from "@/lib/utils";
import { CheckoutButton } from "@/modules/checkout/components/checkout-button";
import { ProductImage } from "@/modules/storefront/components/product-image";

import { cartCount, cartSubtotalCents, useCartStore } from "../store/cart-store";

/**
 * Va dentro del `<Sheet>` de `<CartButton>`: así el cierre con Escape, el clic
 * en el overlay y la devolución del foco al disparador los resuelve base-ui.
 */
export function CartDrawer() {
  const lines = useCartStore((state) => state.lines);
  const setQty = useCartStore((state) => state.setQty);

  const count = cartCount(lines);
  const subtotal = cartSubtotalCents(lines);

  return (
    <SheetContent
      side="right"
      className="rounded-card bg-storefront-card inset-y-3 right-3 h-auto w-[calc(100%-1.5rem)] border-0 backdrop-blur-2xl sm:max-w-md"
    >
      <SheetHeader className="p-6 pb-4">
        <SheetTitle className="text-lg tracking-tight">
          Carrito{" "}
          <span className="text-muted-foreground font-mono font-normal">
            {count}
          </span>
        </SheetTitle>
      </SheetHeader>

      {lines.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2.5 p-10 text-center">
          <span className="bg-storefront-sunk text-muted-foreground rounded-pill grid size-14 place-items-center">
            <ShoppingBag aria-hidden className="size-6" />
          </span>
          <p className="text-[15px] font-medium">Todavía no hay nada acá</p>
          <SheetClose
            render={
              <Button
                variant="outline"
                className="rounded-pill border-storefront-border mt-1.5 h-11 px-5"
              />
            }
          >
            Seguir viendo
          </SheetClose>
        </div>
      ) : (
        <>
          <ul className="flex flex-1 flex-col gap-2 overflow-y-auto px-4">
            {lines.map((line) => (
              <li
                key={line.id}
                className="bg-storefront-sunk grid grid-cols-[64px_minmax(0,1fr)] items-center gap-3.5 rounded-[20px] p-2"
              >
                <ProductImage
                  name={line.name}
                  imageUrl={line.imageUrl}
                  sizes="64px"
                  className="size-16 rounded-2xl"
                />
                <div className="min-w-0 pr-2">
                  <p className="truncate text-sm leading-snug font-medium">
                    {line.name}
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="bg-storefront-card rounded-pill flex items-center gap-0.5 p-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Quitar uno de ${line.name}`}
                        onClick={() => setQty(line.id, line.qty - 1)}
                        className="rounded-pill size-7"
                      >
                        <Minus className="size-3.5" strokeWidth={2.4} />
                      </Button>
                      <span className="min-w-5 text-center font-mono text-[13px]">
                        {line.qty}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        disabled={line.qty >= line.stock}
                        aria-label={`Agregar uno de ${line.name}`}
                        onClick={() => setQty(line.id, line.qty + 1)}
                        className="rounded-pill size-7"
                      >
                        <Plus className="size-3.5" strokeWidth={2.4} />
                      </Button>
                    </div>
                    <span className="font-mono text-sm font-medium">
                      {formatPrice(line.priceCents * line.qty)}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="p-6 pt-4">
            <div className="flex items-baseline justify-between">
              <span className="text-muted-foreground text-sm">Total</span>
              <span className="font-mono text-2xl font-semibold tracking-tight">
                {formatPrice(subtotal)}
              </span>
            </div>
            <CheckoutButton />
          </div>
        </>
      )}
    </SheetContent>
  );
}
