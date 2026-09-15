import { z } from "zod";

/**
 * Solo `{ productId, qty }`. El precio **nunca** viaja en el body: se relee de
 * `products.price_cents` en el servidor (docs/stripe/checkout-integration.md §1).
 */
export const checkoutSessionSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.uuid(),
        qty: z.int().min(1).max(99),
      }),
    )
    .min(1, "El carrito está vacío")
    .max(50, "Demasiadas líneas en el carrito")
    // Dos líneas del mismo producto pasarían el chequeo de stock por separado y
    // juntas lo excederían. El store ya deduplica; la API es la frontera real.
    .refine(
      (items) => new Set(items.map((item) => item.productId)).size === items.length,
      "Hay productos repetidos en el carrito",
    ),
});

export type CheckoutSessionInput = z.infer<typeof checkoutSessionSchema>;
