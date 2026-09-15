"use client";

import { CreditCard, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { usePaymentMethods } from "../hooks/use-payment-methods";
import type { PaymentMethodDto } from "../schemas/payment-method.schema";
import { AddCardButton } from "./add-card-button";
import { DeleteCardDialog } from "./delete-card-dialog";

/** Stripe entrega la marca en minúscula (`visa`, `amex`, …). */
function brandLabel(brand: string): string {
  return brand.charAt(0).toUpperCase() + brand.slice(1);
}

export function CardList() {
  const query = usePaymentMethods();
  const [pendingDelete, setPendingDelete] = useState<PaymentMethodDto | null>(
    null,
  );

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 2 }, (_, index) => (
          <Skeleton key={index} className="rounded-card h-20" />
        ))}
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="border-storefront-border bg-storefront-card rounded-card flex flex-col items-center gap-3 border py-16 text-center">
        <p className="text-[15px] font-medium">
          No pudimos cargar tus tarjetas
        </p>
        <Button
          variant="outline"
          className="rounded-pill border-storefront-border h-11 px-5"
          onClick={() => void query.refetch()}
        >
          Reintentar
        </Button>
      </div>
    );
  }

  if (query.data.paymentMethods.length === 0) {
    return (
      <div className="border-storefront-border bg-storefront-card rounded-card flex flex-col items-center gap-2 border px-6 py-16 text-center sm:px-10">
        <span className="bg-storefront-sunk text-muted-foreground rounded-pill grid size-14 place-items-center">
          <CreditCard aria-hidden className="size-6" />
        </span>
        <p className="mt-2 text-base font-medium">Aún no tienes tarjetas</p>
        <p className="text-muted-foreground max-w-sm text-sm">
          Guarda una tarjeta para elegirla al pagar, sin volver a escribirla.
        </p>
        <AddCardButton className="bg-brand text-brand-foreground rounded-pill mt-2.5 h-11 px-5 hover:opacity-90" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {query.data.paymentMethods.map((card) => (
        <article
          key={card.id}
          className="border-storefront-border bg-storefront-card rounded-card flex flex-wrap items-center justify-between gap-3 border p-5"
        >
          <div className="flex items-center gap-3">
            <span className="bg-storefront-sunk text-muted-foreground rounded-pill grid size-11 place-items-center">
              <CreditCard aria-hidden className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {brandLabel(card.brand)} ···· {card.last4}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                Vence {String(card.expMonth).padStart(2, "0")}/{card.expYear}
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            aria-label={`Eliminar la tarjeta terminada en ${card.last4}`}
            className="rounded-pill border-storefront-border text-destructive h-10 px-4"
            onClick={() => setPendingDelete(card)}
          >
            <Trash2 aria-hidden className="size-4" />
            Eliminar
          </Button>
        </article>
      ))}

      <DeleteCardDialog
        card={pendingDelete}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      />
    </div>
  );
}
