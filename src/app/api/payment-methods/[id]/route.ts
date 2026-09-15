import { NextResponse, type NextRequest } from "next/server";

import { authErrorResponse, requireAuth } from "@/lib/auth";
import { paymentMethodIdSchema } from "@/modules/payment-methods/schemas/payment-method.schema";
import * as paymentMethodRepository from "@/server/repositories/payment-method.repository";
import { removePaymentMethod } from "@/server/services/payment-method.service";

/**
 * Una tarjeta ajena, inexistente o con id malformado responden **igual**: el 404
 * no revela qué tarjetas existen ni de quién son (AC10).
 */
const notFound = () =>
  NextResponse.json({ error: "Tarjeta no encontrada" }, { status: 404 });

export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext<"/api/payment-methods/[id]">,
) {
  const { id } = await params;

  let userId: string;

  try {
    userId = (await requireAuth()).id;
  } catch (error) {
    return authErrorResponse(error);
  }

  if (!paymentMethodIdSchema.safeParse(id).success) {
    return notFound();
  }

  try {
    // La pertenencia se comprueba **antes** de tocar Stripe: nunca un detach de
    // una tarjeta que no es del usuario de la sesión.
    const card = await paymentMethodRepository.findByIdForUser(id, userId);

    if (!card) {
      return notFound();
    }

    await removePaymentMethod(card);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("DELETE /api/payment-methods/[id]", error);
    return NextResponse.json(
      { error: "No se pudo eliminar la tarjeta" },
      { status: 500 },
    );
  }
}
