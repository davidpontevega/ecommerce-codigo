import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { authErrorResponse, requireAuth } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import * as orderRepository from "@/server/repositories/order.repository";

/**
 * Un pedido ajeno, inexistente o sin factura responden **igual**: el 404 no
 * revela qué pedidos existen ni de quién son (AC8).
 */
const notFound = () =>
  NextResponse.json({ error: "Boleta no disponible" }, { status: 404 });

export async function GET(
  _request: NextRequest,
  { params }: RouteContext<"/api/orders/[id]/receipt">,
) {
  const { id } = await params;

  let userId: string;

  try {
    userId = (await requireAuth()).id;
  } catch (error) {
    return authErrorResponse(error);
  }

  if (!z.uuid().safeParse(id).success) {
    return notFound();
  }

  try {
    const order = await orderRepository.findByIdForUser(id, userId);

    if (!order?.stripeCheckoutSessionId) {
      return notFound();
    }

    const session = await stripe.checkout.sessions.retrieve(
      order.stripeCheckoutSessionId,
      { expand: ["invoice"] },
    );

    // Las compras anteriores a `invoice_creation` no tienen factura (D1).
    const invoice = session.invoice;
    const pdfUrl =
      invoice && typeof invoice !== "string" ? invoice.invoice_pdf : null;

    if (!pdfUrl) {
      return notFound();
    }

    // Redirect, no URL en el HTML: el enlace de Stripe nunca llega al cliente
    // sin pasar antes por la comprobación de sesión.
    return NextResponse.redirect(pdfUrl, 302);
  } catch (error) {
    console.error("GET /api/orders/[id]/receipt", error);
    return NextResponse.json(
      { error: "No se pudo obtener la boleta" },
      { status: 500 },
    );
  }
}
