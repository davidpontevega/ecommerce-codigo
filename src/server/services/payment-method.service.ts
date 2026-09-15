import Stripe from "stripe";

import { logAudit } from "@/lib/audit";
import { stripe } from "@/lib/stripe";
import { db } from "@/server/db";
import type { PaymentMethod, User } from "@/server/db/schema";
import * as paymentMethodRepository from "@/server/repositories/payment-method.repository";
import * as userRepository from "@/server/repositories/user.repository";

/**
 * Customer 1:1 y perezoso (D2). Idempotente: si el usuario ya tiene columna, se
 * reutiliza y no se llama a Stripe.
 *
 * El Customer se crea **con email**: cuando el Checkout de pago recibe `customer`,
 * Stripe prefija y bloquea el campo de correo con el del Customer; uno vacío
 * dejaría al comprador sin poder escribirlo.
 */
export async function ensureStripeCustomer(user: User): Promise<string> {
  if (user.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  const customer = await stripe.customers.create({
    email: user.email,
    name:
      [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined,
    // Para rastrear el Customer hasta la fila de Postgres desde el Dashboard.
    metadata: { userId: user.id },
  });

  return userRepository.setStripeCustomerId(user.id, customer.id);
}

/**
 * Persiste la tarjeta de una sesión de Checkout en `mode: "setup"`. Solo desde el
 * webhook firmado: el retorno del navegador no persiste nada (D3).
 *
 * El evento no trae `brand`/`last4`, hay que expandir el SetupIntent.
 */
export async function savePaymentMethodFromSetupSession({
  setupIntentId,
  userId,
}: {
  setupIntentId: string;
  userId: string;
}): Promise<void> {
  const setupIntent = await stripe.setupIntents.retrieve(setupIntentId, {
    expand: ["payment_method"],
  });

  const method = setupIntent.payment_method;

  // Un wallet o un método sin tarjeta está fuera de alcance: no hay nada que
  // listar, y lanzar dejaría a Stripe reintentando un evento que nunca cuadrará.
  if (!method || typeof method === "string" || !method.card) {
    console.warn(
      `SetupIntent ${setupIntentId}: sin tarjeta expandida, no se guarda nada`,
    );
    return;
  }

  const card = method.card;

  await db.transaction(async (tx) => {
    const saved = await paymentMethodRepository.saveFromStripe(tx, {
      userId,
      stripePaymentMethodId: method.id,
      brand: card.brand,
      last4: card.last4,
      expMonth: card.exp_month,
      expYear: card.exp_year,
    });

    // Evento reenviado (D7): la fila ya existe y no se audita dos veces.
    if (!saved) {
      return;
    }

    await logAudit(tx, {
      action: "payment_method.added",
      entityType: "payment_method",
      entityId: saved.id,
      actorId: userId,
      // Solo ids de Stripe y la marca: ni PAN ni CVC (docs/SETUP.md §5.2).
      metadata: { stripePaymentMethodId: method.id, brand: card.brand },
    });
  });

  // D8: el Checkout de pago **solo** ofrece métodos con `allow_redisplay:
  // "always"`, y el default es `"unspecified"`. `mode: "setup"` no admite
  // `saved_payment_method_options`, así que se fija aquí, después de guardar.
  // Se ejecuta también en un reenvío: es la vía de reparación si falló antes.
  await stripe.paymentMethods.update(method.id, { allow_redisplay: "always" });
}

/** Borrado físico (D5): detach en Stripe + borrado de la fila, con bitácora. */
export async function removePaymentMethod(card: PaymentMethod): Promise<void> {
  try {
    await stripe.paymentMethods.detach(card.stripePaymentMethodId);
  } catch (error) {
    // Un método ya desasociado (reintento tras un fallo a medias) no puede dejar
    // la fila atrapada para siempre. Cualquier otro fallo sí se propaga.
    if (!(error instanceof Stripe.errors.StripeInvalidRequestError)) {
      throw error;
    }

    console.warn(
      `PaymentMethod ${card.stripePaymentMethodId} ya no estaba asociado`,
      error.message,
    );
  }

  await db.transaction(async (tx) => {
    await paymentMethodRepository.remove(tx, card.id);

    await logAudit(tx, {
      action: "payment_method.removed",
      entityType: "payment_method",
      entityId: card.id,
      actorId: card.userId,
      metadata: {
        stripePaymentMethodId: card.stripePaymentMethodId,
        brand: card.brand,
      },
    });
  });
}
