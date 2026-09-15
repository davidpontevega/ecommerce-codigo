import { NextResponse } from "next/server";

import { authErrorResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import * as roleRepository from "@/server/repositories/role.repository";

/** Sin paginar: son los 6 roles de sistema. */
export async function GET() {
  try {
    await requirePermission("roles.read");
  } catch (error) {
    return authErrorResponse(error);
  }

  try {
    return NextResponse.json(await roleRepository.listWithUserCount());
  } catch (error) {
    console.error("GET /api/admin/roles", error);
    return NextResponse.json(
      { error: "No se pudieron listar los roles" },
      { status: 500 },
    );
  }
}
