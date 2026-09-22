import { NextResponse } from "next/server";

import { authErrorResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import * as financeRepository from "@/server/repositories/finance.repository";

/**
 * El costo es dato financiero, no de catálogo: esta lectura va bajo
 * `finance.manage` y no bajo `products.read` (spec 019 D6). Sin query params,
 * nada que validar.
 */
export async function GET() {
  try {
    await requirePermission("finance.manage");
  } catch (error) {
    return authErrorResponse(error);
  }

  try {
    return NextResponse.json({ data: await financeRepository.listUnitMargins() });
  } catch (error) {
    console.error("GET /api/admin/finance/margins", error);
    return NextResponse.json(
      { error: "No se pudieron calcular los márgenes" },
      { status: 500 },
    );
  }
}
