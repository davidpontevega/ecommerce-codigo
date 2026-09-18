import type { AdminOrderStatus } from "./schemas/admin-order.schema";

/** Un solo texto por estado en tabla, filtros y detalle. */
export const ORDER_STATUS_LABELS: Record<AdminOrderStatus, string> = {
  pending: "Pendiente",
  paid: "Pagado",
  cancelled: "Cancelado",
};

export const ORDER_STATUS_VARIANTS: Record<
  AdminOrderStatus,
  "default" | "secondary" | "outline"
> = {
  pending: "outline",
  paid: "default",
  cancelled: "secondary",
};

export const limaDateTimeFormatter = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Lima",
});
