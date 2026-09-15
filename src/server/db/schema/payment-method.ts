import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./user";

/**
 * Espejo local de los PaymentMethods de Stripe (D6): el listado lee Postgres, no
 * la API. Solo los datos que Stripe entrega para pintar una tarjeta —nunca PAN
 * ni CVC, que no salen de Stripe (docs/SETUP.md §5.2).
 */
export const paymentMethods = pgTable(
  "payment_methods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // `cascade`: una tarjeta no significa nada sin su dueño, al revés que un pedido.
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Unique: la idempotencia del webhook se apoya en él (D7). */
    stripePaymentMethodId: text("stripe_payment_method_id").notNull().unique(),
    /** `visa`, `mastercard`, … tal cual lo devuelve Stripe. */
    brand: text("brand").notNull(),
    /** Cuatro dígitos: es todo lo que Stripe entrega. */
    last4: text("last4").notNull(),
    expMonth: integer("exp_month").notNull(),
    expYear: integer("exp_year").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("payment_methods_user_id_idx").on(t.userId, t.createdAt.desc()),
  ],
);

export type PaymentMethod = InferSelectModel<typeof paymentMethods>;
export type NewPaymentMethod = InferInsertModel<typeof paymentMethods>;
