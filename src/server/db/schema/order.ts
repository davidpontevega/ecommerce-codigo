import { sql } from "drizzle-orm";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./user";

export const orderStatus = pgEnum("order_status", [
  "pending",
  "paid",
  "cancelled",
]);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // `restrict`: un pedido es contabilidad, no puede desaparecer con el usuario.
    // Nullable por si más adelante entra el checkout de invitado (D1).
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    // Checkout de invitado (D1, revisado): puede no haber email al crear el
    // pedido. Stripe lo recoge y el webhook (011) lo copia aquí.
    email: text("email"),
    status: orderStatus("status").notNull().default("pending"),
    /** Centavos enteros, recalculados en el servidor. Nunca `float`. */
    subtotalCents: integer("subtotal_cents").notNull(),
    /** = subtotal en esta fase: sin envío ni impuestos. */
    totalCents: integer("total_cents").notNull(),
    /** ISO-4217 en minúscula, como lo quiere Stripe. */
    currency: text("currency").notNull().default("pen"),
    stripeCheckoutSessionId: text("stripe_checkout_session_id").unique(),
    /** Lo escribe el webhook de la spec 011. */
    stripePaymentIntentId: text("stripe_payment_intent_id").unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      // reloj de Postgres, igual que el resto del schema
      .$onUpdate(() => sql`now()`),
  },
  (t) => [
    index("orders_user_id_idx").on(t.userId, t.createdAt.desc()),
    index("orders_status_idx").on(t.status),
    index("orders_stripe_session_idx").on(t.stripeCheckoutSessionId),
  ],
);

export type Order = InferSelectModel<typeof orders>;
export type NewOrder = InferInsertModel<typeof orders>;
