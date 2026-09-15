"use client";

import { Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCartStore } from "@/modules/cart/store/cart-store";

import { useCheckout } from "../hooks/use-checkout";

export function CheckoutButton() {
  const lines = useCartStore((state) => state.lines);
  const { mutate, isPending, isSuccess } = useCheckout();

  // Tras el éxito el navegador todavía está yendo a Stripe: `isPending` ya bajó
  // pero la página sigue viva, y un segundo clic crearía un pedido huérfano.
  const busy = isPending || isSuccess;

  return (
    <Button
      type="button"
      disabled={busy || lines.length === 0}
      onClick={() =>
        mutate(lines.map((line) => ({ productId: line.id, qty: line.qty })))
      }
      className="bg-brand text-brand-foreground rounded-pill mt-4 h-13 w-full text-[15px] hover:opacity-90"
    >
      {busy ? (
        <>
          <Loader2Icon aria-hidden className="size-4 animate-spin" />
          Redirigiendo a Stripe…
        </>
      ) : (
        "Ir a pagar"
      )}
    </Button>
  );
}
