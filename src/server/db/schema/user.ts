import { sql } from "drizzle-orm";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkId: text("clerk_id").notNull().unique(),
    // No es unique: Clerk admite varios emails por cuenta; el unique real es clerk_id.
    email: text("email").notNull(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    imageUrl: text("image_url"),
    /**
     * Customer de Stripe, 1:1 y perezoso (D2): se crea al guardar la primera
     * tarjeta, así que es `null` para todo usuario que nunca pasó por ahí.
     */
    stripeCustomerId: text("stripe_customer_id").unique(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      // reloj de Postgres, igual que created_at
      .$onUpdate(() => sql`now()`),
  },
  (t) => [index("users_email_idx").on(t.email)],
);

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
