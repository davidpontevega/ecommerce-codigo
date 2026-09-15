import { ShoppingBag } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Pago cancelado — E-commerce Tech",
  description: "Cancelaste el pago antes de completarlo.",
};

/**
 * Solo informa: el pedido `pending` lo cierra el evento `checkout.session.expired`
 * del webhook, no esta página (el comprador puede no volver nunca).
 */
export default function CheckoutCancelPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-1 sm:px-3">
      <div className="border-storefront-border bg-storefront-card rounded-card flex flex-col items-center gap-2 border px-6 py-16 text-center sm:px-10 sm:py-20">
        <span className="bg-storefront-sunk text-muted-foreground rounded-pill grid size-14 place-items-center">
          <ShoppingBag aria-hidden className="size-6" />
        </span>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-[28px]">
          Pago cancelado
        </h1>
        <p className="text-muted-foreground max-w-sm text-sm">
          No se cobró nada y tu carrito sigue intacto. Puedes revisarlo y volver
          a intentarlo cuando quieras.
        </p>
        <Button
          nativeButton={false}
          className="bg-brand text-brand-foreground rounded-pill mt-2.5 h-11 px-5 hover:opacity-90"
          render={<Link href="/cart" />}
        >
          Volver al carrito
        </Button>
      </div>
    </div>
  );
}
