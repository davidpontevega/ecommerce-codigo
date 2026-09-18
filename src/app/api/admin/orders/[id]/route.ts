import { NextResponse } from "next/server";

import { authErrorResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { adminOrderIdSchema } from "@/modules/orders-admin/schemas/admin-order.schema";
import * as orderRepository from "@/server/repositories/order.repository";

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/admin/orders/[id]">,
) {
  const { id } = await params;

  try {
    await requirePermission("orders.read");
  } catch (error) {
    return authErrorResponse(error);
  }

  // Un uuid mal formado no llega al repositorio: Postgres lo rechazaría con un
  // 500 en vez del 404 que corresponde.
  if (!adminOrderIdSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  }

  try {
    const order = await orderRepository.findByIdForAdmin(id);

    if (!order) {
      return NextResponse.json(
        { error: "Pedido no encontrado" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      order,
      items: await orderRepository.listItems(order.id),
    });
  } catch (error) {
    console.error("GET /api/admin/orders/[id]", error);
    return NextResponse.json(
      { error: "No se pudo obtener el pedido" },
      { status: 500 },
    );
  }
}
