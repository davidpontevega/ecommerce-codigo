"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { useDeleteCard } from "../hooks/use-payment-method-mutations";
import type { PaymentMethodDto } from "../schemas/payment-method.schema";

export function DeleteCardDialog({
  card,
  onOpenChange,
}: {
  card: PaymentMethodDto | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { mutate, isPending } = useDeleteCard();

  return (
    <AlertDialog open={card !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar la tarjeta?</AlertDialogTitle>
          <AlertDialogDescription>
            {card
              ? `La tarjeta terminada en ${card.last4} dejará de estar disponible al pagar. Tendrás que volver a agregarla.`
              : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending}
            onClick={() => {
              if (!card) return;
              mutate(card.id);
              onOpenChange(false);
            }}
          >
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
