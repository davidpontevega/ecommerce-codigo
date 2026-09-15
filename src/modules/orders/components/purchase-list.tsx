"use client";

import { Package } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/lib/utils";
import type { Order } from "@/server/db/schema";

import { useOrders } from "../hooks/use-orders";
import type { OrdersQuery, OrderWithItems } from "../schemas/order.schema";
import { PurchaseDetailDialog } from "./purchase-detail-dialog";

/** Mismo huso que el filtro del servidor: si no, un pedido de las 20:00 cae en otro día. */
const dayFormatter = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "long",
  timeZone: "America/Lima",
});

const timeFormatter = new Intl.DateTimeFormat("es-PE", {
  timeStyle: "short",
  timeZone: "America/Lima",
});

/** La API solo devuelve `paid` y `cancelled` (D2); `pending` está por exhaustividad. */
const STATUS_BADGE: Record<
  Order["status"],
  { label: string; variant: "secondary" | "outline" }
> = {
  paid: { label: "Pagado", variant: "secondary" },
  cancelled: { label: "Cancelado", variant: "outline" },
  pending: { label: "Pendiente", variant: "outline" },
};

/** La API ya devuelve los pedidos por fecha descendente: el `Map` conserva ese orden. */
function groupByDay(orders: OrderWithItems[]): [string, OrderWithItems[]][] {
  const groups = new Map<string, OrderWithItems[]>();

  for (const order of orders) {
    const day = dayFormatter.format(new Date(order.createdAt));
    const group = groups.get(day);
    if (group) {
      group.push(order);
    } else {
      groups.set(day, [order]);
    }
  }

  return [...groups];
}

export function PurchaseList({ range }: { range: OrdersQuery }) {
  const query = useOrders(range);
  const [selected, setSelected] = useState<OrderWithItems | null>(null);

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="rounded-card h-24" />
        ))}
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="border-storefront-border bg-storefront-card rounded-card flex flex-col items-center gap-3 border py-16 text-center">
        <p className="text-[15px] font-medium">No pudimos cargar tus compras</p>
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

  if (query.data.orders.length === 0) {
    return (
      <div className="border-storefront-border bg-storefront-card rounded-card flex flex-col items-center gap-2 border px-6 py-16 text-center sm:px-10">
        <span className="bg-storefront-sunk text-muted-foreground rounded-pill grid size-14 place-items-center">
          <Package aria-hidden className="size-6" />
        </span>
        <p className="mt-2 text-base font-medium">
          No hay compras en este periodo
        </p>
        <p className="text-muted-foreground max-w-sm text-sm">
          Cambia el rango de fechas para ver otras compras.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {groupByDay(query.data.orders).map(([day, orders]) => (
        <section key={day} className="flex flex-col gap-3">
          <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {day}
          </h2>

          {orders.map((order) => {
            const badge = STATUS_BADGE[order.status];

            return (
              <article
                key={order.id}
                className="border-storefront-border bg-storefront-card rounded-card flex flex-wrap items-center justify-between gap-3 border p-5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold">
                      #{order.id.slice(0, 8).toUpperCase()}
                    </span>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {timeFormatter.format(new Date(order.createdAt))} ·{" "}
                    {order.items.length}{" "}
                    {order.items.length === 1 ? "producto" : "productos"}
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <span className="font-mono text-base font-semibold tracking-tight">
                    {formatPrice(order.totalCents)}
                  </span>
                  <Button
                    variant="outline"
                    className="rounded-pill border-storefront-border h-10 px-4"
                    onClick={() => setSelected(order)}
                  >
                    Ver detalle
                  </Button>
                </div>
              </article>
            );
          })}
        </section>
      ))}

      <PurchaseDetailDialog
        order={selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </div>
  );
}
