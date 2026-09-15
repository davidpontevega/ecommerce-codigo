import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { getAppUrl } from "@/lib/env";
import { CheckoutUnavailableError } from "@/lib/errors";
import { stripe } from "@/lib/stripe";
import { checkoutSessionSchema } from "@/modules/checkout/schemas/checkout.schema";
import * as orderRepository from "@/server/repositories/order.repository";
import { createPendingOrder } from "@/server/services/checkout.service";

// Del entorno, nunca de un header de la request: un `Host` falsificado convertiría
// la URL de retorno en un redirect abierto.
const APP_URL = getAppUrl();

const SESSION_TTL_SECONDS = 60 * 30;

export async function POST(request: NextRequest) {
  // Checkout de invitado (D1, revisado 2026-09-07): la sesión es opcional. Con
  // sesión de Clerk el pedido se ata al usuario; sin ella, Stripe recoge el
  // email y el webhook (spec 011) lo copia a `orders.email`.
  const user = await getCurrentUser();
  const userId = user?.id ?? null;
  const email = user?.email ?? null;
  // Invitado o usuario que nunca guardó una tarjeta: `null`, y todo sigue igual.
  const stripeCustomerId = user?.stripeCustomerId ?? null;

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  const parsed = checkoutSessionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const { order, items } = await createPendingOrder({
      userId,
      email,
      requested: parsed.data.items,
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      // Sin `payment_method_types`: los métodos se activan desde el Dashboard.
      line_items: items.map((item) => ({
        quantity: item.qty,
        price_data: {
          currency: order.currency,
          unit_amount: item.unitPriceCents,
          product_data: {
            name: item.productName,
            // Stripe exige URL absoluta y pública; `image_url` suele ser local.
            ...(item.imageUrl?.startsWith("http")
              ? { images: [item.imageUrl] }
              : {}),
          },
        },
      })),
      // D9 (spec 013): `customer` y `customer_email` son excluyentes. Con
      // Customer, el Checkout ofrece las tarjetas guardadas del comprador y
      // prefija su correo desde el propio Customer. Sin él, la rama de siempre:
      // `null` no lo acepta Stripe, así que si no hay email lo pide el Checkout.
      ...(stripeCustomerId
        ? { customer: stripeCustomerId }
        : { customer_email: order.email ?? undefined }),
      // Stripe emite la factura al pagar; su PDF es la «boleta» que sirve
      // `/api/orders/[id]/receipt` (spec 012 D1). No se persiste nada aquí.
      invoice_creation: { enabled: true },
      client_reference_id: order.id,
      metadata: { orderId: order.id },
      success_url: `${APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/checkout/cancel`,
      integration_identifier: "g1ecom_checkout_v1",
      // Una sesión que caduca evita pedidos `pending` eternos.
      expires_at: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    });

    if (!session.url) {
      throw new Error(`La sesión ${session.id} no trae URL de Checkout`);
    }

    await orderRepository.attachCheckoutSession(order.id, session.id);

    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (error instanceof CheckoutUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    console.error("POST /api/checkout/session", error);
    return NextResponse.json(
      { error: "No se pudo iniciar el pago" },
      { status: 500 },
    );
  }
}
