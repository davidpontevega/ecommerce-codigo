"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { OrdersQuery } from "../schemas/order.schema";
import { fetchOrders } from "../services/order.service";

export function useOrders(range: OrdersQuery) {
  return useQuery({
    queryKey: ["orders", range] as const,
    queryFn: () => fetchOrders(range),
    staleTime: 60_000,
    // Al cambiar de rango se mantiene la lista anterior en pantalla.
    placeholderData: keepPreviousData,
  });
}
