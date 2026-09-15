import { api } from "@/lib/axios";

import type { PaymentMethodsResponse } from "../schemas/payment-method.schema";

export async function fetchPaymentMethods(): Promise<PaymentMethodsResponse> {
  const { data } = await api.get<PaymentMethodsResponse>("/payment-methods");
  return data;
}

/** Sin body: el Customer y la tarjeta los resuelve el servidor (D10). */
export async function createSetupSession(): Promise<{ url: string }> {
  const { data } = await api.post<{ url: string }>(
    "/payment-methods/setup-session",
  );
  return data;
}

export async function deletePaymentMethod(id: string): Promise<void> {
  await api.delete(`/payment-methods/${id}`);
}
