"use client";

import { Loader2Icon, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

import { useAddCard } from "../hooks/use-payment-method-mutations";

export function AddCardButton({ className }: { className?: string }) {
  const { mutate, isPending, isSuccess } = useAddCard();

  // Tras el éxito el navegador todavía está yendo a Stripe: `isPending` ya bajó
  // pero la página sigue viva, y un segundo clic abriría otra sesión de alta.
  const busy = isPending || isSuccess;

  return (
    <Button
      type="button"
      disabled={busy}
      onClick={() => mutate()}
      className={className}
    >
      {busy ? (
        <>
          <Loader2Icon aria-hidden className="size-4 animate-spin" />
          Redirigiendo a Stripe…
        </>
      ) : (
        <>
          <Plus aria-hidden className="size-4" />
          Agregar tarjeta
        </>
      )}
    </Button>
  );
}
