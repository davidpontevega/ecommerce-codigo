import { NextResponse, type NextRequest } from "next/server";

import { authErrorResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { adminOrdersQuerySchema } from "@/modules/orders-admin/schemas/admin-order.schema";
import * as orderRepository from "@/server/repositories/order.repository";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("orders.read");
  } catch (error) {
    return authErrorResponse(error);
  }

  const parsed = adminOrdersQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Parámetros de consulta inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await orderRepository.listForAdmin(parsed.data));
  } catch (error) {
    console.error("GET /api/admin/orders", error);
    return NextResponse.json(
      { error: "No se pudieron listar los pedidos" },
      { status: 500 },
    );
  }
}
