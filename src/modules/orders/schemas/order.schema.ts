import { z } from "zod";

import type { Order, OrderItem } from "@/server/db/schema";

/**
 * `pending` se excluye (D2): son sesiones de pago a medio camino, no compras.
 */
export const LISTED_ORDER_STATUSES: Order["status"][] = ["paid", "cancelled"];

/**
 * `from`/`to` son **días locales de Lima** en `YYYY-MM-DD`, no instantes: el
 * handler los convierte con offset fijo `-05:00` (Perú no usa DST) y el mismo
 * criterio se usa al agrupar en el cliente.
 */
export const ordersQuerySchema = z
  .object({
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
  })
  // Comparación de strings: `YYYY-MM-DD` ordena igual lexicográfica que cronológicamente.
  .refine((range) => !range.from || !range.to || range.from <= range.to, {
    message: "El rango termina antes de empezar",
    path: ["to"],
  });

export type OrdersQuery = z.infer<typeof ordersQuerySchema>;

/**
 * Lo que recibe el cliente: `NextResponse.json` serializa las columnas
 * `timestamptz` a string ISO, no a `Date`.
 */
export type OrderWithItems = Omit<Order, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
};

export type OrdersResponse = { orders: OrderWithItems[] };
