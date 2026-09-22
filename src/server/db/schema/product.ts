import { sql } from "drizzle-orm";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { categories } from "./category";

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    categoryId: uuid("category_id")
      .notNull()
      // red por si algún día aparece un borrado físico de categorías
      .references(() => categories.id, { onDelete: "restrict" }),
    sku: text("sku").notNull().unique(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    priceCents: integer("price_cents").notNull(),
    compareAtPriceCents: integer("compare_at_price_cents"),
    /**
     * Costo unitario en centavos. `null` = sin dato, no cero: sin costo no hay
     * margen que calcular (spec 019 D5). Nunca sale por una lectura pública.
     */
    costCents: integer("cost_cents"),
    stock: integer("stock").notNull().default(0),
    brand: text("brand"),
    specs: jsonb("specs").$type<Record<string, string> | null>(),
    weightGrams: integer("weight_grams"),
    imageUrl: text("image_url"),
    /** `null` = disponible. Guarda *cuándo* se eliminó, no solo *que* se eliminó. */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      // reloj de Postgres, igual que created_at: con new Date() un UPDATE podía
      // dejar updated_at < created_at por desfase entre el reloj de Node y el de la BD
      .$onUpdate(() => sql`now()`),
  },
  (t) => [
    index("products_category_id_idx").on(t.categoryId),
    index("products_deleted_at_idx").on(t.deletedAt),
  ],
);

export type Product = InferSelectModel<typeof products>;
export type NewProduct = InferInsertModel<typeof products>;
