import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";

import { stripe } from "@/lib/stripe";
import { cancelOrder, fulfillOrder } from "@/server/services/checkout.service";
import { savePaymentMethodFromSetupSession } from "@/server/services/payment-method.service";

// `?? ""` y no `!`: el `throw` de abajo corre al cargar el módulo, así que el
// handler nunca ve la cadena vacía, y el tipo sigue siendo `string` dentro de él.
const WEBHOOK_SECRET: string = process.env.STRIPE_WEBHOOK_SECRET ?? "";

if (!WEBHOOK_SECRET) {
  throw new Error(
    "STRIPE_WEBHOOK_SECRET no está definida. Cópiala del `stripe listen` a .env.local.",
  );
}

/**
 * Única fuente de verdad del pago. Sin Zod: el contrato lo garantiza la firma
 * de Stripe y los tipos `Stripe.Event` del SDK; validar de nuevo el payload solo
 * duplicaría el esquema de un tercero.
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  // Cuerpo CRUDO. Un `request.json()` intermedio invalida la firma.
  const payload = await request.text();

  let event: Stripe.Event;

  // Sin firma válida no se toca la base de datos.
  try {
    if (!signature) {
      throw new Error("Falta la cabecera stripe-signature");
    }

    event = stripe.webhooks.constructEvent(payload, signature, WEBHOOK_SECRET);
  } catch (error) {
    console.error("POST /api/webhooks/stripe — firma inválida", error);
    return new NextResponse("Invalid signature", { status: 400 });
  }

  try {
    await handleEvent(event);
    return NextResponse.json({ received: true });
  } catch (error) {
    // 500 → Stripe reintenta con backoff. Nunca un 200 optimista: dejaría un
    // pedido cobrado y `pending` para siempre.
    console.error(`POST /api/webhooks/stripe — ${event.type}`, error);
    return new NextResponse("Handler failed", { status: 500 });
  }
}

async function handleEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object;

      // Alta de tarjeta (spec 013): comparte tipo de evento con el pago pero no
      // tiene pedido que cumplir. Se ramifica **antes** que nada: una sesión de
      // setup en `fulfillOrder` buscaría un pedido inexistente, lanzaría, y
      // Stripe reintentaría el evento para siempre.
      if (session.mode === "setup") {
        const setupIntentId =
          typeof session.setup_intent === "string"
            ? session.setup_intent
            : session.setup_intent?.id;
        const userId = session.metadata?.userId;

        // Sin uno de los dos no hay nada que guardar y reintentar no lo arregla.
        if (!setupIntentId || !userId) {
          console.warn(
            `Sesión de setup ${session.id} sin setup_intent o sin userId en metadata`,
          );
          return;
        }

        await savePaymentMethodFromSetupSession({ setupIntentId, userId });
        return;
      }

      // Con métodos de pago diferidos `completed` llega aún `unpaid`: el cobro
      // no ha ocurrido y no hay nada que cumplir todavía.
      if (session.payment_status === "unpaid") {
        return;
      }

      await fulfillOrder({
        sessionId: session.id,
        paymentIntentId:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : (session.payment_intent?.id ?? null),
        // Checkout de invitado: el email lo recoge Stripe (spec 010 D1).
        email: session.customer_details?.email ?? null,
      });
      return;
    }

    case "checkout.session.async_payment_failed":
    case "checkout.session.expired":
      await cancelOrder(event.data.object.id);
      return;

    // Cualquier otro tipo: 200 sin efectos. Los suscritos se configuran en el
    // Dashboard; ignorar aquí evita reintentos infinitos de lo que no nos toca.
    default:
      return;
  }
}
