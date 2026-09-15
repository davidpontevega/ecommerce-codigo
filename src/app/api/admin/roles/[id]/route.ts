import { NextResponse, type NextRequest } from "next/server";

import { authErrorResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { roleIdSchema } from "@/modules/roles/schemas/role.schema";
import * as roleRepository from "@/server/repositories/role.repository";

export async function GET(
  _request: NextRequest,
  { params }: RouteContext<"/api/admin/roles/[id]">,
) {
  const { id } = await params;

  if (!roleIdSchema.safeParse(id).success) {
    return NextResponse.json(
      { error: "Identificador inválido" },
      { status: 400 },
    );
  }

  try {
    await requirePermission("roles.read");
  } catch (error) {
    return authErrorResponse(error);
  }

  try {
    const role = await roleRepository.findDetailById(id);

    return role
      ? NextResponse.json(role)
      : NextResponse.json({ error: "Rol no encontrado" }, { status: 404 });
  } catch (error) {
    console.error("GET /api/admin/roles/[id]", error);
    return NextResponse.json(
      { error: "No se pudo obtener el rol" },
      { status: 500 },
    );
  }
}
