import { and, desc, eq } from "drizzle-orm";

import { db, type Transaction } from "@/server/db";
import type { NewPaymentMethod, PaymentMethod } from "@/server/db/schema";
import { paymentMethods } from "@/server/db/schema";

/**
 * Solo lo que se pinta: el `stripe_payment_method_id` no baja al navegador, que
 * nunca elige la tarjeta a cobrar (D10).
 */
export type PaymentMethodCard = Pick<
  PaymentMethod,
  "id" | "brand" | "last4" | "expMonth" | "expYear"
>;

export async function listByUser(userId: string): Promise<PaymentMethodCard[]> {
  return db
    .select({
      id: paymentMethods.id,
      brand: paymentMethods.brand,
      last4: paymentMethods.last4,
      expMonth: paymentMethods.expMonth,
      expYear: paymentMethods.expYear,
    })
    .from(paymentMethods)
    .where(eq(paymentMethods.userId, userId))
    .orderBy(desc(paymentMethods.createdAt));
}

/**
 * Idempotente por `stripe_payment_method_id` (D7): Stripe reenvía el mismo
 * `checkout.session.completed` y el reenvío no puede duplicar la tarjeta.
 * `null` significa «ya estaba»: el servicio lo usa para no auditar dos veces.
 */
export async function saveFromStripe(
  tx: Transaction,
  card: NewPaymentMethod,
): Promise<PaymentMethod | null> {
  const [saved] = await tx
    .insert(paymentMethods)
    .values(card)
    .onConflictDoNothing({ target: paymentMethods.stripePaymentMethodId })
    .returning();

  return saved ?? null;
}

/**
 * La pertenencia viaja en el `WHERE`: una tarjeta ajena devuelve `null` igual que
 * una inexistente, así el handler responde 404 sin revelar nada (AC10).
 */
export async function findByIdForUser(
  id: string,
  userId: string,
): Promise<PaymentMethod | null> {
  const [card] = await db
    .select()
    .from(paymentMethods)
    .where(and(eq(paymentMethods.id, id), eq(paymentMethods.userId, userId)))
    .limit(1);

  return card ?? null;
}

/** Borrado físico (D5): un método desasociado en Stripe no se restaura. */
export async function remove(tx: Transaction, id: string): Promise<void> {
  await tx.delete(paymentMethods).where(eq(paymentMethods.id, id));
}
