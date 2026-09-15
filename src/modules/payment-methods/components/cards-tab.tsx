"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import {
  paymentMethodsQueryKey,
  usePaymentMethods,
} from "../hooks/use-payment-methods";
import { AddCardButton } from "./add-card-button";
import { CardList } from "./card-list";

/** Frontera cliente de la pestaña: la página `/perfil` sigue siendo Server Component. */
export function CardsTab({ justAdded }: { justAdded: boolean }) {
  const queryClient = useQueryClient();
  const { data } = usePaymentMethods();

  // El webhook que guarda la tarjeta puede llegar ~1s después del retorno del
  // navegador: al volver con `setup=success` se relee una vez. Sin polling.
  useEffect(() => {
    if (!justAdded) return;
    void queryClient.invalidateQueries({ queryKey: paymentMethodsQueryKey });
  }, [justAdded, queryClient]);

  return (
    <div className="flex flex-col gap-5">
      {/* El estado vacío ya trae su propio botón: aquí sobraría. */}
      {data && data.paymentMethods.length > 0 ? (
        <div className="flex justify-end">
          <AddCardButton className="bg-brand text-brand-foreground rounded-pill h-11 px-5 hover:opacity-90" />
        </div>
      ) : null}

      <CardList />
    </div>
  );
}
