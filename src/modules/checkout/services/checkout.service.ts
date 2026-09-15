import { api } from "@/lib/axios";

import type { CheckoutSessionInput } from "../schemas/checkout.schema";

/** Solo `{ productId, qty }`: el precio lo pone el servidor. */
export async function createCheckoutSession(
  items: CheckoutSessionInput["items"],
): Promise<{ url: string }> {
  const { data } = await api.post<{ url: string }>("/checkout/session", {
    items,
  });
  return data;
}
