import { CheckCircle2, Clock, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatPrice } from "@/lib/utils";
import { ClearCartOnPaid } from "@/modules/checkout/components/clear-cart-on-paid";
import type { Order } from "@/server/db/schema";
import * as orderRepository from "@/server/repositories/order.repository";

/** `generateMetadata` y la página piden el mismo pedido: una sola consulta. */
const getOrder = cache(orderRepository.findBySessionId);

/**
 * El 404 se decide aquí y no solo en el componente: el `loading.tsx` del grupo
 * envuelve la página en Suspense, así que Next ya habría enviado el shell con
 * status 200 antes de que el `notFound()` del cuerpo se ejecute. `generateMetadata`
 * corre antes de abrir el stream, así que este es el único punto donde el 404 sale
 * de verdad como 404 (AC13).
 */
export async function generateMetadata({
  searchParams,
}: PageProps<"/checkout/success">): Promise<Metadata> {
  const { session_id: sessionId } = await searchParams;
  const order =
    typeof sessionId === "string" ? await getOrder(sessionId) : null;

  if (!order) {
    notFound();
  }

  return {
    title: `Pedido #${order.id.slice(0, 8).toUpperCase()} — E-commerce Tech`,
    description: "Resumen de tu pedido tras el pago.",
  };
}

/** El cumplimiento lo hace el webhook, así que un `pending` aquí es normal (D4). */
const STATUS_VIEW = {
  paid: {
    icon: CheckCircle2,
    tone: "text-emerald-600 dark:text-emerald-400",
    label: "Pagado",
    title: "¡Gracias por tu compra!",
    description:
      "Recibimos tu pago. Te enviamos el comprobante al correo de la compra.",
  },
  pending: {
    icon: Clock,
    tone: "text-amber-600 dark:text-amber-400",
    label: "Pendiente",
    title: "Estamos confirmando tu pago",
    description:
      "Tu pedido ya está registrado. En cuanto el banco confirme el cobro verás el estado actualizado aquí.",
  },
  cancelled: {
    icon: XCircle,
    tone: "text-muted-foreground",
    label: "Cancelado",
    title: "El pago no se completó",
    description:
      "No se cobró nada. Puedes volver al carrito e intentarlo de nuevo.",
  },
} as const satisfies Record<Order["status"], unknown>;

export default async function CheckoutSuccessPage({
  searchParams,
}: PageProps<"/checkout/success">) {
  const { session_id: sessionId } = await searchParams;

  // El pedido se busca **solo** por el id de sesión que firma Stripe: sin él, o
  // con uno que no existe, no se muestra nada (AC13). `generateMetadata` ya lo
  // cortó; esto es defensa en profundidad y estrecha el tipo.
  const order =
    typeof sessionId === "string" ? await getOrder(sessionId) : null;

  if (!order) {
    notFound();
  }

  const items = await orderRepository.listItems(order.id);
  const view = STATUS_VIEW[order.status];
  const StatusIcon = view.icon;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-1 sm:px-3">
      {order.status === "paid" ? <ClearCartOnPaid /> : null}

      <div className="border-storefront-border bg-storefront-card rounded-card flex flex-col items-center gap-2 border px-6 py-10 text-center sm:px-10 sm:py-12">
        <StatusIcon aria-hidden className={`size-12 ${view.tone}`} />
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-[28px]">
          {view.title}
        </h1>
        <p className="text-muted-foreground max-w-md text-sm">
          {view.description}
        </p>
      </div>

      <section className="border-storefront-border bg-storefront-card rounded-card border p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold tracking-tight">
              Pedido{" "}
              <span className="font-mono">
                #{order.id.slice(0, 8).toUpperCase()}
              </span>
            </h2>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {items.length} {items.length === 1 ? "producto" : "productos"}
            </p>
          </div>
          <Badge variant="secondary">{view.label}</Badge>
        </div>

        <Separator className="my-4" />

        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-4">
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

        <Separator className="my-4" />

        <div className="flex items-baseline justify-between">
          <span className="text-muted-foreground text-sm">Total</span>
          <span className="font-mono text-2xl font-semibold tracking-tight">
            {formatPrice(order.totalCents)}
          </span>
        </div>

        <Button
          nativeButton={false}
          className="bg-brand text-brand-foreground rounded-pill mt-6 h-11 w-full px-5 hover:opacity-90"
          render={<Link href="/products" />}
        >
          Seguir comprando
        </Button>
      </section>
    </div>
  );
}
