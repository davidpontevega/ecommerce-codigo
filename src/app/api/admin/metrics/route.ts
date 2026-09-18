import { NextResponse } from "next/server";

import { authErrorResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import * as metricsRepository from "@/server/repositories/metrics.repository";

/** Sin query params: la ventana es fija (spec 015 D3), no hay entrada que validar. */
export async function GET() {
  try {
    await requirePermission("dashboard.read");
  } catch (error) {
    return authErrorResponse(error);
  }

  try {
    return NextResponse.json(await metricsRepository.getDashboardMetrics());
  } catch (error) {
    console.error("GET /api/admin/metrics", error);
    return NextResponse.json(
      { error: "No se pudieron calcular las métricas" },
      { status: 500 },
    );
  }
}
