import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { index, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { orders } from "./order";
import { products } from "./product";

/**
 * Precio y nombre **congelados** al momento de la compra: el catálogo puede
 * cambiar después y el pedido no debe cambiar con él (docs/SETUP.md §5.3).
 */
export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    // `restrict`: el catálogo usa soft-delete, así que un producto vendido
    // nunca desaparece de verdad.
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    productName: text("product_name").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    qty: integer("qty").notNull(),
    lineTotalCents: integer("line_total_cents").notNull(),
  },
  (t) => [index("order_items_order_id_idx").on(t.orderId)],
);

export type OrderItem = InferSelectModel<typeof orderItems>;
export type NewOrderItem = InferInsertModel<typeof orderItems>;
