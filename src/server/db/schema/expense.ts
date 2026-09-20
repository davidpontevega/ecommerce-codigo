import { sql } from "drizzle-orm";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/** Gastos varios del negocio (spec 017 D3): sin catálogo de categorías ni FK a users. */
export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    concept: text("concept").notNull(),
    /** Centavos, nunca float. El `> 0` lo valida Zod antes del repositorio. */
    amountCents: integer("amount_cents").notNull(),
    /**
     * Día del gasto, independiente de `created_at`: un recibo de ayer se puede
     * registrar hoy. Es `date` y no `timestamptz` porque ya es un día local.
     */
    date: date("date", { mode: "string" }).notNull(),
    category: text("category"),
    /** `null` = activo. Guarda *cuándo* se eliminó, no solo *que* se eliminó. */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      // reloj de Postgres, igual que en products: con new Date() un UPDATE podía
      // dejar updated_at < created_at por desfase entre el reloj de Node y el de la BD
      .$onUpdate(() => sql`now()`),
  },
  (t) => [
    index("expenses_date_idx").on(t.date),
    index("expenses_deleted_at_idx").on(t.deletedAt),
  ],
);

export type Expense = InferSelectModel<typeof expenses>;
export type NewExpense = InferInsertModel<typeof expenses>;
