import { NextResponse } from "next/server";

import { authErrorResponse, requireAuth } from "@/lib/auth";
import * as paymentMethodRepository from "@/server/repositories/payment-method.repository";

/** El listado lee Postgres, no Stripe (D6). */
export async function GET() {
  let userId: string;

  try {
    userId = (await requireAuth()).id;
  } catch (error) {
    return authErrorResponse(error);
  }

  try {
    const paymentMethods = await paymentMethodRepository.listByUser(userId);

    return NextResponse.json({ paymentMethods });
  } catch (error) {
    console.error("GET /api/payment-methods", error);
    return NextResponse.json(
      { error: "No se pudieron obtener tus tarjetas" },
      { status: 500 },
    );
  }
}
