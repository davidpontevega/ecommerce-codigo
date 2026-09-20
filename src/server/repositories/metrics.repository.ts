import { and, asc, count, desc, eq, gte, isNull, lt, lte, sql } from "drizzle-orm";

import { LOW_STOCK_THRESHOLD } from "@/lib/constants";
import { endOfLimaDay, limaDay, startOfLimaDay } from "@/lib/utils";
import type {
  DashboardMetrics,
  LowStockProduct,
  SalesPoint,
  StatusCount,
  TopProduct,
} from "@/modules/dashboard/types/metrics.types";
import { db } from "@/server/db";
import { orderItems, orderStatus, orders, products } from "@/server/db/schema";

/** Ventana fija (spec 015 D3): sin selector de fechas en esta vuelta. */
export const WINDOW_DAYS = 30;

export const TOP_PRODUCTS_LIMIT = 5;
export const LOW_STOCK_LIMIT = 5;

const DAY_MS = 24 * 60 * 60 * 1000;

/** El día del pedido en Lima, no en UTC: uno de las 20:00 sigue siendo hoy. */
const limaDayColumn = sql<string>`to_char(${orders.createdAt} at time zone 'America/Lima', 'YYYY-MM-DD')`;

/** Los `days` días que terminan en `lastDay` (incluido), del más viejo al más nuevo. */
export function windowDays(lastDay: string, days = WINDOW_DAYS): string[] {
  const end = startOfLimaDay(lastDay).getTime();

  return Array.from({ length: days }, (_, index) =>
    limaDay(new Date(end - (days - 1 - index) * DAY_MS)),
  );
}

/**
 * Un día sin pedidos pagados no produce fila en el `GROUP BY`; sin este relleno
 * la línea del chart saltaría de un día al siguiente con ventas (AC2).
 */
export function fillSalesSeries(
  days: string[],
  rows: SalesPoint[],
): SalesPoint[] {
  const byDay = new Map(rows.map((row) => [row.date, row.totalCents]));

  return days.map((date) => ({ date, totalCents: byDay.get(date) ?? 0 }));
}

export async function salesByDay(
  from: Date,
  to: Date,
  days: string[],
): Promise<SalesPoint[]> {
  const rows = await db
    .select({
      date: limaDayColumn,
      totalCents: sql<number>`sum(${orders.totalCents})::int`,
    })
    .from(orders)
    .where(
      and(
        eq(orders.status, "paid"),
        gte(orders.createdAt, from),
        lt(orders.createdAt, to),
      ),
    )
    .groupBy(limaDayColumn);

  return fillSalesSeries(days, rows);
}

/** Los tres estados siempre presentes: un estado sin pedidos vale 0, no falta. */
export async function ordersByStatus(
  from: Date,
  to: Date,
): Promise<StatusCount[]> {
  const rows = await db
    .select({ status: orders.status, count: count() })
    .from(orders)
    .where(and(gte(orders.createdAt, from), lt(orders.createdAt, to)))
    .groupBy(orders.status);

  const byStatus = new Map(rows.map((row) => [row.status, row.count]));

  return orderStatus.enumValues.map((status) => ({
    status,
    count: byStatus.get(status) ?? 0,
  }));
}

/**
 * Sin `join` a `products`: el nombre está congelado en la línea (spec 010) y es
 * el que vio el cliente al comprar. `max()` porque el agrupado es por producto y
 * un renombrado del catálogo deja dos nombres para el mismo `product_id`.
 */
export async function topProducts(
  from: Date,
  to: Date,
  limit = TOP_PRODUCTS_LIMIT,
): Promise<TopProduct[]> {
  const qty = sql<number>`sum(${orderItems.qty})::int`;

  return db
    .select({
      productId: orderItems.productId,
      name: sql<string>`max(${orderItems.productName})`,
      qty,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(
      and(
        eq(orders.status, "paid"),
        gte(orders.createdAt, from),
        lt(orders.createdAt, to),
      ),
    )
    .groupBy(orderItems.productId)
    .orderBy(desc(qty))
    .limit(limit);
}

/** Solo catálogo vivo: un producto con soft-delete no hay que reponerlo. */
export async function lowStockProducts(
  threshold = LOW_STOCK_THRESHOLD,
  limit = LOW_STOCK_LIMIT,
): Promise<LowStockProduct[]> {
  return db
    .select({
      productId: products.id,
      name: products.name,
      slug: products.slug,
      stock: products.stock,
    })
    .from(products)
    .where(and(isNull(products.deletedAt), lte(products.stock, threshold)))
    .orderBy(asc(products.stock))
    .limit(limit);
}

/**
 * Las cuatro métricas en paralelo y con **una** ventana común: calcularla por
 * consulta abriría la puerta a que dos cards midan días distintos.
 */
export async function getDashboardMetrics(
  today = limaDay(),
): Promise<DashboardMetrics> {
  const days = windowDays(today);
  // `to` es el inicio de mañana; 30 días atrás es el inicio del primer día.
  const to = endOfLimaDay(today);
  const from = new Date(to.getTime() - WINDOW_DAYS * DAY_MS);

  const [sales, statuses, top, lowStock] = await Promise.all([
    salesByDay(from, to, days),
    ordersByStatus(from, to),
    topProducts(from, to),
    lowStockProducts(),
  ]);

  return {
    salesByDay: sales,
    ordersByStatus: statuses,
    topProducts: top,
    lowStock,
  };
}
