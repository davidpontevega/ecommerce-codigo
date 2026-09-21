import { api } from "@/lib/axios";

import type {
  AdminOrderDetailResponse,
  AdminOrderListResponse,
  AdminOrderStatus,
  AdminOrdersQueryInput,
} from "../schemas/admin-order.schema";

const RESOURCE = "/admin/orders";

export async function listAdminOrders(
  params: AdminOrdersQueryInput,
): Promise<AdminOrderListResponse> {
  const { data } = await api.get<AdminOrderListResponse>(RESOURCE, {
    // Lista por coma, como la espera el schema: axios serializaría el array
    // como `status[]=`, que `Object.fromEntries(searchParams)` no lee.
    params: { ...params, status: params.status?.join(",") || undefined },
  });

  return data;
}

export async function getAdminOrder(
  id: string,
): Promise<AdminOrderDetailResponse> {
  const { data } = await api.get<AdminOrderDetailResponse>(`${RESOURCE}/${id}`);
  return data;
}

/**
 * La respuesta no se usa: la vista se repinta invalidando `adminOrdersQueryKey`,
 * que además devuelve los campos del cliente que el `UPDATE` no trae.
 */
export async function updateAdminOrderStatus(
  id: string,
  status: AdminOrderStatus,
): Promise<void> {
  await api.patch(`${RESOURCE}/${id}/status`, { status });
}
