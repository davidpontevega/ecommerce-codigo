import { NextResponse, type NextRequest } from "next/server";

import { authErrorResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import {
  adminOrderIdSchema,
  updateOrderStatusSchema,
} from "@/modules/orders-admin/schemas/admin-order.schema";
import * as orderRepository from "@/server/repositories/order.repository";

const notFound = () =>
  NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext<"/api/admin/orders/[id]/status">,
) {
  const { id } = await params;

  let actorId: string;

  try {
    actorId = (await requirePermission("orders.update")).id;
  } catch (error) {
    return authErrorResponse(error);
  }

  // Mismo criterio que el GET: un uuid mal formado es un pedido que no existe,
  // no un 500 de Postgres.
  if (!adminOrderIdSchema.safeParse(id).success) {
    return notFound();
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  const parsed = updateOrderStatusSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const updated = await orderRepository.updateStatus(
      id,
      parsed.data.status,
      actorId,
    );

    return updated ? NextResponse.json(updated) : notFound();
  } catch (error) {
    console.error("PATCH /api/admin/orders/[id]/status", error);
    return NextResponse.json(
      { error: "No se pudo cambiar el estado del pedido" },
      { status: 500 },
    );
  }
}
