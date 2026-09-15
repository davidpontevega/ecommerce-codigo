import { z } from "zod";

import type { PaymentMethodCard } from "@/server/repositories/payment-method.repository";

/** Path param de `DELETE /api/payment-methods/[id]`. No hay body que validar. */
export const paymentMethodIdSchema = z.uuid();

/** Lo que ve el cliente: sin ids de Stripe (D10). Tipos derivados del schema. */
export type PaymentMethodDto = PaymentMethodCard;

export type PaymentMethodsResponse = { paymentMethods: PaymentMethodDto[] };
