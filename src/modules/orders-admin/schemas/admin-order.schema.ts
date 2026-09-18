import { z } from "zod";

import type { Order, OrderItem } from "@/server/db/schema";

/**
 * A diferencia de "Mis compras" (spec 012, que oculta `pending`), el panel ve
 * los tres estados: un pedido atascado en `pending` es justo lo que hay que
 * poder diagnosticar (spec 014 D3).
 */
export const ADMIN_ORDER_STATUSES = [
  "pending",
  "paid",
  "cancelled",
] as const satisfies ReadonlyArray<Order["status"]>;

export const adminOrderSortFields = ["createdAt", "totalCents"] as const;

/**
 * Multi-valor por coma y no parámetro repetido: la query se lee con
 * `Object.fromEntries(searchParams)`, que se quedaría solo con el último valor.
 */
const statusList = z
  .string()
  .max(60)
  .transform((value) =>
    value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean),
  )
  .pipe(z.array(z.enum(ADMIN_ORDER_STATUSES)))
  .optional();

/**
 * `from`/`to` son **días locales de Lima** en `YYYY-MM-DD`, no instantes; los
 * convierte el repositorio con el offset fijo `-05:00` (spec 012).
 */
export const adminOrdersQuerySchema = z
  .object({
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    status: statusList,
    search: z.string().trim().max(100).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
    sortBy: z.enum(adminOrderSortFields).default("createdAt"),
    sortDir: z.enum(["asc", "desc"]).default("desc"),
  })
  // `YYYY-MM-DD` ordena igual lexicográfica que cronológicamente.
  .refine((range) => !range.from || !range.to || range.from <= range.to, {
    message: "El rango termina antes de empezar",
    path: ["to"],
  });

export type AdminOrdersQueryInput = z.infer<typeof adminOrdersQuerySchema>;
export type AdminOrderStatus = (typeof ADMIN_ORDER_STATUSES)[number];

export const adminOrderIdSchema = z.uuid();

/**
 * Lo que recibe el cliente: `NextResponse.json` serializa las columnas
 * `timestamptz` a string ISO, no a `Date`.
 */
export type AdminOrderDto = Omit<Order, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
  /** Nombre del titular cuando el pedido tiene `user_id`; `null` si es invitado. */
  customerName: string | null;
  /** `orders.email` y, si falta, el del usuario enlazado. */
  customerEmail: string | null;
  itemCount: number;
};

export type AdminOrderListResponse = {
  data: AdminOrderDto[];
  total: number;
  page: number;
  pageSize: number;
};

export type AdminOrderDetailResponse = {
  order: AdminOrderDto;
  items: OrderItem[];
};
