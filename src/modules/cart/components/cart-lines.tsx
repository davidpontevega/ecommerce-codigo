"use client";

import { ShoppingBag } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatPrice } from "@/lib/utils";
import { CheckoutButton } from "@/modules/checkout/components/checkout-button";
import { ProductImage } from "@/modules/storefront/components/product-image";

import { cartCount, cartSubtotalCents, useCartStore } from "../store/cart-store";
import { CartQtyControl } from "./cart-qty-control";

/**
 * Único bloque cliente de `/cart`: el carrito vive en Zustand, la página que lo
 * envuelve sigue siendo Server Component.
 */
export function CartLines() {
  const lines = useCartStore((state) => state.lines);

  if (lines.length === 0) {
    return (
      <div className="border-storefront-border bg-storefront-card rounded-card flex flex-col items-center gap-2 border px-6 py-16 text-center sm:px-10 sm:py-20">
        <span className="bg-storefront-sunk text-muted-foreground rounded-pill grid size-14 place-items-center">
          <ShoppingBag aria-hidden className="size-6" />
        </span>
        <p className="mt-2 text-base font-medium">Tu carrito está vacío</p>
        <p className="text-muted-foreground max-w-sm text-sm">
          Agrega productos del catálogo y vuelve para completar tu compra.
        </p>
        <Button
          nativeButton={false}
          className="bg-brand text-brand-foreground rounded-pill mt-2.5 h-11 px-5 hover:opacity-90"
          render={<Link href="/products" />}
        >
          Explorar catálogo
        </Button>
      </div>
    );
  }

  const subtotal = cartSubtotalCents(lines);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <ul className="flex flex-col gap-2">
        {lines.map((line) => (
          <li
            key={line.id}
            className="border-storefront-border bg-storefront-card rounded-card grid grid-cols-[72px_minmax(0,1fr)] items-center gap-4 border p-3 sm:grid-cols-[88px_minmax(0,1fr)]"
          >
            <ProductImage
              name={line.name}
              imageUrl={line.imageUrl}
              sizes="88px"
              className="size-18 rounded-2xl sm:size-22"
            />
            <div className="min-w-0">
              <Link
                href={`/products/${line.slug}`}
                className="truncate text-sm font-medium hover:underline sm:text-[15px]"
              >
                {line.name}
              </Link>
              <p className="text-muted-foreground mt-0.5 font-mono text-xs">
                {formatPrice(line.priceCents)} c/u
              </p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <CartQtyControl product={line} />
                <span className="font-mono text-sm font-medium sm:text-base">
                  {formatPrice(line.priceCents * line.qty)}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <aside className="border-storefront-border bg-storefront-card rounded-card border p-6">
        <h2 className="text-base font-semibold tracking-tight">Resumen</h2>

        <Separator className="my-4" />

        <div className="text-muted-foreground flex items-baseline justify-between text-sm">
          <span>Productos</span>
          <span className="font-mono">{cartCount(lines)}</span>
        </div>
        <div className="mt-3 flex items-baseline justify-between">
          <span className="text-muted-foreground text-sm">Total</span>
          <span className="font-mono text-2xl font-semibold tracking-tight">
            {formatPrice(subtotal)}
          </span>
        </div>

        <CheckoutButton />

        <p className="text-muted-foreground mt-3 text-center text-xs">
          El pago se completa en Stripe.
        </p>
      </aside>
    </div>
  );
}
