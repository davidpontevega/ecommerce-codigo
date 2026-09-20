import { NextResponse } from "next/server";

import { authErrorResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import * as financeRepository from "@/server/repositories/finance.repository";

/** Sin query params: el mes es el actual (spec 017 D4), no hay entrada que validar. */
export async function GET() {
  try {
    await requirePermission("finance.manage");
  } catch (error) {
    return authErrorResponse(error);
  }

  try {
    return NextResponse.json(await financeRepository.getMonthSummary());
  } catch (error) {
    console.error("GET /api/admin/finance/summary", error);
    return NextResponse.json(
      { error: "No se pudo calcular el resumen de caja" },
      { status: 500 },
    );
  }
}
