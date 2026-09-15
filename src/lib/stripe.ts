import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  throw new Error(
    "STRIPE_SECRET_KEY no está definida. Configúrala en .env.local antes de arrancar.",
  );
}

/**
 * Solo servidor: la clave nunca lleva `NEXT_PUBLIC_` ni sale al bundle del
 * cliente (el checkout es alojado por Stripe, no hay clave pública que exponer).
 *
 * Sin `apiVersion` explícita: manda la que fija el SDK instalado
 * (`2026-08-26.dahlia`), que es la que corresponde a estos tipos.
 */
export const stripe = new Stripe(secretKey);
