"use client";

import { useState } from "react";

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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { ORDER_STATUS_LABELS, ORDER_STATUS_VARIANTS } from "../constants";
import { useUpdateAdminOrderStatus } from "../hooks/use-admin-orders";
import {
  ADMIN_ORDER_STATUSES,
  type AdminOrderStatus,
} from "../schemas/admin-order.schema";

type Props = {
  orderId: string;
  status: AdminOrderStatus;
  canUpdate: boolean;
};

/**
 * Mismo control en la tabla y en el detalle. El `value` cuelga siempre del
 * estado que devolvió el servidor: si la mutación falla, el `Select` sigue
 * mostrando el anterior sin necesidad de revertir nada (AC9).
 */
export function AdminOrderStatusSelect({ orderId, status, canUpdate }: Props) {
  const [pending, setPending] = useState<AdminOrderStatus | null>(null);
  const mutation = useUpdateAdminOrderStatus();

  if (!canUpdate) {
    return (
      <Badge variant={ORDER_STATUS_VARIANTS[status]}>
        {ORDER_STATUS_LABELS[status]}
      </Badge>
    );
  }

  return (
    // La fila de la tabla navega al detalle en su `onClick`: la guardia viaja
    // con el control para no depender de dónde se monte.
    <div onClick={(event) => event.stopPropagation()}>
      <Select
        value={status}
        disabled={mutation.isPending}
        onValueChange={(next: AdminOrderStatus | null) => {
          if (next && next !== status) {
            setPending(next);
          }
        }}
      >
        <SelectTrigger size="sm" aria-label="Estado del pedido">
          <SelectValue>
            {(value: AdminOrderStatus) => ORDER_STATUS_LABELS[value]}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {ADMIN_ORDER_STATUSES.map((option) => (
            <SelectItem key={option} value={option}>
              {ORDER_STATUS_LABELS[option]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cambiar el estado del pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              Pasará de {ORDER_STATUS_LABELS[status]} a{" "}
              {pending ? ORDER_STATUS_LABELS[pending] : ""}. El cambio queda en
              la bitácora; no mueve el stock ni cobra nada en Stripe.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!pending) return;
                mutation.mutate({ id: orderId, status: pending });
                setPending(null);
              }}
            >
              Cambiar estado
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
