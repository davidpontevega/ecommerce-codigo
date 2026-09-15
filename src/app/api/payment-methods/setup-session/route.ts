import { NextResponse } from "next/server";

import { authErrorResponse, requireAuth } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { CURRENCY } from "@/server/services/checkout.service";
import { ensureStripeCustomer } from "@/server/services/payment-method.service";

// Del entorno, nunca de un header de la request: un `Host` falsificado convertiría
// la URL de retorno en un redirect abierto.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * Alta de tarjeta con el Checkout alojado en `mode: "setup"` (D3): aquí no se
 * cobra nada y la tarjeta la persiste el **webhook**, no el retorno del navegador.
 */
export async function POST() {
  let user;

  try {
    user = await requireAuth();
  } catch (error) {
    return authErrorResponse(error);
  }

  try {
    const customerId = await ensureStripeCustomer(user);

    const session = await stripe.checkout.sessions.create({
      mode: "setup",
      // Sin `payment_method_types`: los métodos se activan desde el Dashboard.
      // Con `setup` y sin esa lista, Stripe **exige** `currency` para saber qué
      // métodos puede ofrecer (verificado contra la API: `parameter_missing`).
      currency: CURRENCY,
      customer: customerId,
      // El webhook no puede resolver el usuario desde el Customer sin otra query.
      metadata: { userId: user.id },
      success_url: `${APP_URL}/perfil?tab=tarjetas&setup=success`,
      cancel_url: `${APP_URL}/perfil?tab=tarjetas&setup=cancel`,
    });

    if (!session.url) {
      throw new Error(`La sesión ${session.id} no trae URL de Checkout`);
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("POST /api/payment-methods/setup-session", error);
    return NextResponse.json(
      { error: "No se pudo iniciar el alta de la tarjeta" },
      { status: 500 },
    );
  }
}
