"use client";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { formatPrice } from "@/lib/utils";

import type { OrderWithItems } from "../schemas/order.schema";

type Props = {
  order: OrderWithItems | null;
  onOpenChange: (open: boolean) => void;
};

const dateTimeFormatter = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "America/Lima",
});

export function PurchaseDetailDialog({ order, onOpenChange }: Props) {
  return (
    <Dialog open={order !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        {order ? (
          <>
            <DialogHeader>
              <DialogTitle>
                Pedido{" "}
                <span className="font-mono">
                  #{order.id.slice(0, 8).toUpperCase()}
                </span>
              </DialogTitle>
              <DialogDescription>
                {dateTimeFormatter.format(new Date(order.createdAt))}
              </DialogDescription>
            </DialogHeader>

            <ul className="flex flex-col gap-3">
              {order.items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {item.productName}
                    </p>
                    <p className="text-muted-foreground mt-0.5 font-mono text-xs">
                      {item.qty} × {formatPrice(item.unitPriceCents)}
                    </p>
                  </div>
                  <span className="font-mono text-sm font-medium">
                    {formatPrice(item.lineTotalCents)}
                  </span>
                </li>
              ))}
            </ul>

            <Separator className="my-1" />

            <div className="flex items-baseline justify-between">
              <span className="text-muted-foreground text-sm">Total</span>
              <span className="font-mono text-xl font-semibold tracking-tight">
                {formatPrice(order.totalCents)}
              </span>
            </div>

            {order.status === "paid" ? (
              <div className="flex flex-col gap-1.5">
                {/* Enlace, no `fetch`: el handler responde 302 al PDF de Stripe
                    y la URL firmada nunca llega al HTML de esta página. */}
                <Button
                  nativeButton={false}
                  variant="outline"
                  className="h-11 w-full gap-2"
                  render={
                    <a
                      href={`/api/orders/${order.id}/receipt`}
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  }
                >
                  <Download aria-hidden className="size-4" />
                  Descargar boleta
                </Button>
                <p className="text-muted-foreground text-xs">
                  Las compras anteriores a la facturación automática no tienen
                  boleta disponible.
                </p>
              </div>
            ) : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
