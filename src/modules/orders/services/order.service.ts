import { api } from "@/lib/axios";

import type { OrdersQuery, OrdersResponse } from "../schemas/order.schema";

/** Axios omite los `undefined`, así que un rango vacío no manda query alguna. */
export async function fetchOrders(range: OrdersQuery): Promise<OrdersResponse> {
  const { data } = await api.get<OrdersResponse>("/orders", { params: range });
  return data;
}
