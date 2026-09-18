import type { Order } from "@/server/db/schema";

/**
 * Contrato de `GET /api/admin/metrics`. Vive en el módulo cliente y lo importa
 * el repositorio (`import type`, se borra en compilación), igual que
 * `order.repository` importa su query de `orders-admin`: una sola definición.
 */

/** Un punto por día de la ventana; `date` es un día local de Lima `YYYY-MM-DD`. */
export type SalesPoint = { date: string; totalCents: number };

export type StatusCount = { status: Order["status"]; count: number };

/** Nombre congelado en la línea del pedido (spec 010), no el del catálogo. */
export type TopProduct = { productId: string; name: string; qty: number };

export type LowStockProduct = {
  productId: string;
  name: string;
  slug: string;
  stock: number;
};

export type DashboardMetrics = {
  salesByDay: SalesPoint[];
  ordersByStatus: StatusCount[];
  topProducts: TopProduct[];
  lowStock: LowStockProduct[];
};
