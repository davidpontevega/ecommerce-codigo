import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  gte,
  ilike,
  inArray,
  lt,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import { endOfLimaDay, startOfLimaDay } from "@/lib/utils";
import type { AdminOrdersQueryInput } from "@/modules/orders-admin/schemas/admin-order.schema";
import { db, type Database, type Transaction } from "@/server/db";
import type {
  NewOrder,
  NewOrderItem,
  Order,
  OrderItem,
} from "@/server/db/schema";
import { orderItems, orders, users } from "@/server/db/schema";

/** Las líneas se insertan con el `order_id` del pedido recién creado. */
export type PendingOrderItem = Omit<NewOrderItem, "id" | "orderId">;

/**
 * Cabecera + líneas en la **misma** transacción: un pedido sin líneas no es un
 * pedido. La `tx` la abre el servicio, que es quien conoce la regla de negocio.
 */
export async function createPending(
  tx: Transaction,
  order: NewOrder,
  items: PendingOrderItem[],
): Promise<Order> {
  const [created] = await tx.insert(orders).values(order).returning();

  if (!created) {
    throw new Error("No se pudo crear el pedido");
  }

  await tx
    .insert(orderItems)
    .values(items.map((item) => ({ ...item, orderId: created.id })));

  return created;
}

/**
 * La sesión de Stripe existe después de haber commiteado el pedido: sin este
 * enlace el webhook (spec 011) no sabría qué fila marcar como pagada.
 */
export async function attachCheckoutSession(
  orderId: string,
  sessionId: string,
): Promise<void> {
  await db
    .update(orders)
    .set({ stripeCheckoutSessionId: sessionId })
    .where(eq(orders.id, orderId));
}

export async function findBySessionId(sessionId: string): Promise<Order | null> {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.stripeCheckoutSessionId, sessionId))
    .limit(1);

  return order ?? null;
}

/**
 * Cumplimiento idempotente en **un** `UPDATE` (spec 011 D1): el `status <> 'paid'`
 * viaja en el `WHERE`, así que un evento reenviado por Stripe no devuelve fila y
 * el servicio no repite ni el descuento de stock ni el `audit_log`.
 *
 * `coalesce` sobre el email: el del invitado lo recoge Stripe, pero el de un
 * pedido con sesión de Clerk no se pisa (AC7).
 */
export async function markPaid(
  tx: Transaction,
  sessionId: string,
  paymentIntentId: string | null,
  email: string | null,
): Promise<Order | null> {
  const [paid] = await tx
    .update(orders)
    .set({
      status: "paid",
      stripePaymentIntentId: paymentIntentId ?? undefined,
      email: email ? sql`coalesce(${orders.email}, ${email})` : undefined,
    })
    .where(
      and(
        eq(orders.stripeCheckoutSessionId, sessionId),
        ne(orders.status, "paid"),
      ),
    )
    .returning();

  return paid ?? null;
}

/** Solo desde `pending`: un pedido ya pagado no se cancela por un `expired` tardío. */
export async function markCancelled(
  tx: Transaction,
  sessionId: string,
): Promise<Order | null> {
  const [cancelled] = await tx
    .update(orders)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(orders.stripeCheckoutSessionId, sessionId),
        eq(orders.status, "pending"),
      ),
    )
    .returning();

  return cancelled ?? null;
}

/**
 * `executor` para poder leer las líneas dentro de la transacción del webhook
 * —donde el pedido acaba de cambiar de estado— y también desde la página de
 * éxito, que no abre ninguna.
 */
export async function listItems(
  orderId: string,
  executor: Database | Transaction = db,
): Promise<OrderItem[]> {
  return executor
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));
}

/** Un pedido con sus líneas ya adjuntas: la vista siempre necesita ambas. */
export type OrderWithItems = Order & { items: OrderItem[] };

export type ListByUserFilter = {
  from?: Date;
  /** **Exclusivo**: el handler suma un día al `to` del filtro para incluirlo. */
  to?: Date;
  statuses: Order["status"][];
};

/**
 * Dos consultas, no un `join`: con `join` la cabecera se repetiría por línea y
 * habría que deduplicar totales en memoria. El `inArray` sobre los ids ya leídos
 * usa `order_items_order_id_idx`.
 */
export async function listByUser(
  userId: string,
  filter: ListByUserFilter,
): Promise<OrderWithItems[]> {
  const rows = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.userId, userId),
        inArray(orders.status, filter.statuses),
        filter.from ? gte(orders.createdAt, filter.from) : undefined,
        filter.to ? lt(orders.createdAt, filter.to) : undefined,
      ),
    )
    .orderBy(desc(orders.createdAt));

  if (rows.length === 0) {
    return [];
  }

  const items = await db
    .select()
    .from(orderItems)
    .where(
      inArray(
        orderItems.orderId,
        rows.map((row) => row.id),
      ),
    );

  const byOrder = new Map<string, OrderItem[]>();

  for (const item of items) {
    const group = byOrder.get(item.orderId);
    if (group) {
      group.push(item);
    } else {
      byOrder.set(item.orderId, [item]);
    }
  }

  return rows.map((row) => ({ ...row, items: byOrder.get(row.id) ?? [] }));
}

/**
 * La pertenencia viaja en el `WHERE`: un pedido ajeno devuelve `null` igual que
 * uno inexistente, así el handler responde 404 sin revelar que existe.
 */
export async function findByIdForUser(
  id: string,
  userId: string,
): Promise<Order | null> {
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, id), eq(orders.userId, userId)))
    .limit(1);

  return order ?? null;
}

/* ---------------------------------------------------------------- panel ---
 * Lectura del panel (spec 014): sin scoping a usuario, con el titular ya
 * resuelto. `listByUser` no vale aquí justamente por ese scoping.
 */

export type AdminOrderRow = Order & {
  customerName: string | null;
  customerEmail: string | null;
  itemCount: number;
};

export type AdminOrderListResult = {
  data: AdminOrderRow[];
  total: number;
  page: number;
  pageSize: number;
};

const customerJoin = eq(users.id, orders.userId);

const adminOrderSelection = {
  ...getTableColumns(orders),
  // `nullif`: un usuario sin nombre ni apellido deja la celda vacía, no " ".
  customerName: sql<
    string | null
  >`nullif(btrim(concat_ws(' ', ${users.firstName}, ${users.lastName})), '')`,
  // El invitado solo tiene `orders.email` (lo copia el webhook, spec 011); el
  // pedido con sesión puede tenerlo nulo hasta entonces y cae al del usuario.
  customerEmail: sql<string | null>`coalesce(${orders.email}, ${users.email})`,
  // Subconsulta correlacionada sobre `order_items_order_id_idx`: evita una 2ª
  // consulta solo para contar líneas de la página.
  itemCount: sql<number>`(select count(*)::int from ${orderItems} where ${orderItems.orderId} = ${orders.id})`,
};

const adminSortColumns = {
  createdAt: orders.createdAt,
  totalCents: orders.totalCents,
} as const;

/**
 * `from`/`to` llegan como días locales de Lima; `to` es **inclusivo** para quien
 * filtra, así que se corta al empezar el día siguiente (mismo criterio que la
 * spec 012). Sin estados seleccionados no se filtra por estado: son todos.
 */
export function buildAdminFilters(
  params: AdminOrdersQueryInput,
): SQL | undefined {
  const conditions: Array<SQL | undefined> = [];

  if (params.from) {
    conditions.push(gte(orders.createdAt, startOfLimaDay(params.from)));
  }

  if (params.to) {
    conditions.push(lt(orders.createdAt, endOfLimaDay(params.to)));
  }

  if (params.status?.length) {
    conditions.push(inArray(orders.status, params.status));
  }

  if (params.search) {
    const pattern = `%${params.search}%`;
    conditions.push(
      or(
        ilike(orders.email, pattern),
        ilike(users.firstName, pattern),
        ilike(users.lastName, pattern),
      ),
    );
  }

  return and(...conditions);
}

export async function listForAdmin(
  params: AdminOrdersQueryInput,
): Promise<AdminOrderListResult> {
  const where = buildAdminFilters(params);
  const column = adminSortColumns[params.sortBy];
  const orderBy = params.sortDir === "asc" ? asc(column) : desc(column);

  const [rows, totals] = await Promise.all([
    db
      .select(adminOrderSelection)
      .from(orders)
      .leftJoin(users, customerJoin)
      .where(where)
      .orderBy(orderBy)
      .limit(params.pageSize)
      .offset((params.page - 1) * params.pageSize),
    db
      .select({ value: count() })
      .from(orders)
      .leftJoin(users, customerJoin)
      .where(where),
  ]);

  return {
    data: rows,
    total: totals[0]?.value ?? 0,
    page: params.page,
    pageSize: params.pageSize,
  };
}

/** Sin scoping a usuario: el permiso `orders.read` ya lo comprobó el handler. */
export async function findByIdForAdmin(
  id: string,
): Promise<AdminOrderRow | null> {
  const [order] = await db
    .select(adminOrderSelection)
    .from(orders)
    .leftJoin(users, customerJoin)
    .where(eq(orders.id, id))
    .limit(1);

  return order ?? null;
}
