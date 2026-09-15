import { logAudit } from "@/lib/audit";
import { CheckoutUnavailableError } from "@/lib/errors";
import { db } from "@/server/db";
import type { Order } from "@/server/db/schema";
import * as orderRepository from "@/server/repositories/order.repository";
import type { PendingOrderItem } from "@/server/repositories/order.repository";
import * as productRepository from "@/server/repositories/product.repository";

/** Moneda única de la tienda (D2). ISO-4217 en minúscula, como la quiere Stripe. */
export const CURRENCY = "pen";

export type RequestedLine = { productId: string; qty: number };

/**
 * Línea ya congelada más la imagen del catálogo: Stripe la quiere para pintar el
 * Checkout, pero no es parte del pedido, así que viaja en memoria y no a `order_items`.
 */
export type PricedLine = PendingOrderItem & { imageUrl: string | null };

export type PendingOrder = { order: Order; items: PricedLine[] };

/**
 * Crea el pedido `pending` releyendo precio y stock de Postgres. El cliente solo
 * manda `{ productId, qty }`: cualquier precio que llegue del navegador se
 * ignora, porque es un precio que el usuario puede editar.
 *
 * No descuenta stock (eso es del webhook, spec 011): un carrito abandonado
 * bloquearía inventario.
 */
export async function createPendingOrder({
  userId,
  email,
  requested,
}: {
  userId: string | null;
  email: string | null;
  requested: RequestedLine[];
}): Promise<PendingOrder> {
  const available = await productRepository.findAvailableByIds(
    requested.map((line) => line.productId),
  );
  const byId = new Map(available.map((product) => [product.id, product]));

  const items: PricedLine[] = requested.map((line) => {
    const product = byId.get(line.productId);

    if (!product) {
      throw new CheckoutUnavailableError(
        "Uno de los productos ya no está disponible. Revisa tu carrito.",
      );
    }

    if (product.stock < line.qty) {
      throw new CheckoutUnavailableError(
        `No hay stock suficiente de ${product.name}: quedan ${product.stock}.`,
      );
    }

    return {
      productId: product.id,
      productName: product.name,
      unitPriceCents: product.priceCents,
      qty: line.qty,
      lineTotalCents: product.priceCents * line.qty,
      imageUrl: product.imageUrl,
    };
  });

  // Enteros de centavos de punta a punta: ninguna división por 100 hasta el formateo.
  const subtotalCents = items.reduce(
    (total, item) => total + item.lineTotalCents,
    0,
  );

  const order = await db.transaction((tx) =>
    orderRepository.createPending(
      tx,
      {
        userId,
        email,
        status: "pending",
        subtotalCents,
        // Sin envío ni impuestos en esta fase.
        totalCents: subtotalCents,
        currency: CURRENCY,
      },
      // `imageUrl` es solo para pintar el Checkout: no es parte del pedido.
      items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        unitPriceCents: item.unitPriceCents,
        qty: item.qty,
        lineTotalCents: item.lineTotalCents,
      })),
    ),
  );

  return { order, items };
}

/**
 * Cumplimiento del pago, llamado **solo** desde el webhook firmado: la página de
 * éxito no cumple nada porque el comprador puede cerrar el navegador antes de
 * cargarla (guía §9).
 *
 * Todo en una transacción: si el descuento de stock o la bitácora fallan, el
 * pedido no queda `paid` y el reintento de Stripe lo vuelve a intentar entero.
 */
export async function fulfillOrder({
  sessionId,
  paymentIntentId,
  email,
}: {
  sessionId: string;
  paymentIntentId: string | null;
  email: string | null;
}): Promise<void> {
  await db.transaction(async (tx) => {
    const order = await orderRepository.markPaid(
      tx,
      sessionId,
      paymentIntentId,
      email,
    );

    if (!order) {
      // Sin fila hay dos causas y se tratan distinto: si el pedido existe, ya
      // estaba `paid` y esto es un reenvío (idempotente, nada que hacer). Si no
      // existe, `attachCheckoutSession` (010, fuera de transacción) todavía no
      // escribió el id: propagar → 500 → Stripe reintenta y lo repara.
      if (await orderRepository.findBySessionId(sessionId)) {
        return;
      }

      throw new Error(`Ningún pedido atado a la sesión ${sessionId}`);
    }

    const items = await orderRepository.listItems(order.id, tx);

    for (const item of items) {
      const decremented = await productRepository.decrementStock(
        tx,
        item.productId,
        item.qty,
      );

      // D2: el cobro ya ocurrió, así que la sobreventa no aborta el pedido; se
      // registra para resolverla a mano.
      if (!decremented) {
        await logAudit(tx, {
          action: "order.stock_shortfall",
          entityType: "order",
          entityId: order.id,
          actorId: order.userId,
          severity: "warning",
          metadata: { productId: item.productId, qty: item.qty },
        });
      }
    }

    await logAudit(tx, {
      action: "order.paid",
      entityType: "order",
      entityId: order.id,
      // Invitado: sin actor. El pedido no lo hizo ningún usuario del sistema.
      actorId: order.userId,
      changes: { after: { status: "paid", totalCents: order.totalCents } },
      // Solo ids de Stripe: ni email, ni datos de tarjeta (docs/SETUP.md §5.2).
      metadata: {
        stripeCheckoutSessionId: sessionId,
        stripePaymentIntentId: paymentIntentId,
      },
    });
  });
}

/**
 * Pago fallido o sesión caducada (D5). No toca stock: nunca se descontó, el
 * descuento vive en `fulfillOrder`.
 */
export async function cancelOrder(sessionId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const order = await orderRepository.markCancelled(tx, sessionId);

    // No estaba `pending`: ya se pagó o ya se canceló. Nada que hacer.
    if (!order) {
      return;
    }

    await logAudit(tx, {
      action: "order.cancelled",
      entityType: "order",
      entityId: order.id,
      actorId: order.userId,
      changes: { after: { status: "cancelled" } },
      metadata: { stripeCheckoutSessionId: sessionId },
    });
  });
}
