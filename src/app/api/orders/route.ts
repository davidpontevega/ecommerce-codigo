import { NextResponse, type NextRequest } from "next/server";

import { authErrorResponse, requireAuth } from "@/lib/auth";
import {
  LISTED_ORDER_STATUSES,
  ordersQuerySchema,
} from "@/modules/orders/schemas/order.schema";
import * as orderRepository from "@/server/repositories/order.repository";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Perú no usa horario de verano: el offset es constante todo el año. */
const LIMA_OFFSET = "-05:00";

/** Instante en que empieza ese día en Lima. */
function startOfLimaDay(day: string): Date {
  return new Date(`${day}T00:00:00${LIMA_OFFSET}`);
}

export async function GET(request: NextRequest) {
  let userId: string;

  try {
    userId = (await requireAuth()).id;
  } catch (error) {
    return authErrorResponse(error);
  }

  const parsed = ordersQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Rango de fechas inválido", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { from, to } = parsed.data;

  try {
    const orders = await orderRepository.listByUser(userId, {
      from: from ? startOfLimaDay(from) : undefined,
      // `to` es inclusivo para quien filtra: se corta al empezar el día siguiente.
      to: to ? new Date(startOfLimaDay(to).getTime() + DAY_MS) : undefined,
      statuses: LISTED_ORDER_STATUSES,
    });

    return NextResponse.json({ orders });
  } catch (error) {
    console.error("GET /api/orders", error);
    return NextResponse.json(
      { error: "No se pudieron obtener tus compras" },
      { status: 500 },
    );
  }
}
