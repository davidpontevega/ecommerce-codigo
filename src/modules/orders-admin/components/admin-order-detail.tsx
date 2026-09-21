"use client";

import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError } from "@/lib/axios";
import { formatPrice } from "@/lib/utils";

import { limaDateTimeFormatter } from "../constants";
import { useAdminOrder } from "../hooks/use-admin-orders";
import { orderReference } from "./admin-order-columns";
import { AdminOrderStatusSelect } from "./admin-order-status-select";

type Props = { orderId: string; canUpdate: boolean };

export function AdminOrderDetail({ orderId, canUpdate }: Props) {
  const query = useAdminOrder(orderId);

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (query.isError) {
    // El 404 del handler es la respuesta definitiva: se traduce a la página de
    // "no encontrado" en vez de a un error reintentable.
    if (query.error instanceof ApiError && query.error.status === 404) {
      notFound();
    }

    return (
      <div className="flex flex-col items-start gap-3 rounded-lg border p-6">
        <p className="text-muted-foreground text-sm">
          No se pudo cargar el pedido.
        </p>
        <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
          Reintentar
        </Button>
      </div>
    );
  }

  const { order, items } = query.data;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 rounded-lg border p-6 sm:grid-cols-2">
        <Field label="Pedido">
          <span className="font-mono">{orderReference(order)}</span>
        </Field>
        <Field label="Estado">
          <AdminOrderStatusSelect
            orderId={order.id}
            status={order.status}
            canUpdate={canUpdate}
          />
        </Field>
        <Field label="Fecha">
          {limaDateTimeFormatter.format(new Date(order.createdAt))}
        </Field>
        <Field label="Cliente">
          {order.customerName ?? "Invitado"}
          {order.customerEmail ? (
            <span className="text-muted-foreground block text-xs">
              {order.customerEmail}
            </span>
          ) : null}
        </Field>
        <Field label="Sesión de Stripe">
          <span className="font-mono text-xs break-all">
            {order.stripeCheckoutSessionId ?? "—"}
          </span>
        </Field>
        <Field label="Payment intent">
          <span className="font-mono text-xs break-all">
            {order.stripePaymentIntentId ?? "—"}
          </span>
        </Field>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
              <TableHead className="text-right">Precio unitario</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.productName}</TableCell>
                <TableCell className="text-right font-mono">
                  {item.qty}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatPrice(item.unitPriceCents)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatPrice(item.lineTotalCents)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Separator />

        <div className="flex items-baseline justify-between p-4">
          <span className="text-muted-foreground text-sm">Total</span>
          <span className="font-mono text-xl font-semibold tracking-tight">
            {formatPrice(order.totalCents)}
          </span>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-xs">{label}</span>
      <div className="text-sm">{children}</div>
    </div>
  );
}
