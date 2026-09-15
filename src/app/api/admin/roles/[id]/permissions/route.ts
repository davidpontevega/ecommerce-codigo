import { NextResponse, type NextRequest } from "next/server";

import { authErrorResponse } from "@/lib/auth";
import { requirePermission, type PermissionCode } from "@/lib/permissions";
import {
  roleIdSchema,
  rolePermissionsSchema,
} from "@/modules/roles/schemas/role.schema";
import * as roleRepository from "@/server/repositories/role.repository";

/** El permiso que abre esta misma puerta: el rol que lo otorga se auto-protege. */
const KEY_PERMISSION: PermissionCode = "roles.update_permissions";

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext<"/api/admin/roles/[id]/permissions">,
) {
  const { id } = await params;

  if (!roleIdSchema.safeParse(id).success) {
    return NextResponse.json(
      { error: "Identificador inválido" },
      { status: 400 },
    );
  }

  let actorId: string;

  try {
    actorId = (await requirePermission(KEY_PERMISSION)).id;
  } catch (error) {
    return authErrorResponse(error);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  const parsed = rolePermissionsSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const target = await roleRepository.findDetailById(id);

    if (!target) {
      return NextResponse.json({ error: "Rol no encontrado" }, { status: 404 });
    }

    // Se deriva del dato, no del slug: nadie puede dejar a la instancia sin
    // ninguna cuenta capaz de reabrir la matriz.
    const grantsKey = target.permissions.some(
      (permission) => permission.code === KEY_PERMISSION && permission.granted,
    );

    if (grantsKey) {
      return NextResponse.json(
        {
          error:
            "Este rol concede la gestión de permisos y no puede modificarse",
        },
        { status: 409 },
      );
    }

    const result = await roleRepository.replacePermissions(
      id,
      parsed.data.permissionCodes,
      actorId,
    );

    if (!result.ok) {
      return result.reason === "unknown-codes"
        ? NextResponse.json(
            { error: "Alguno de los permisos no existe" },
            { status: 400 },
          )
        : NextResponse.json({ error: "Rol no encontrado" }, { status: 404 });
    }

    return NextResponse.json(result.role);
  } catch (error) {
    console.error("PATCH /api/admin/roles/[id]/permissions", error);
    return NextResponse.json(
      { error: "No se pudieron cambiar los permisos" },
      { status: 500 },
    );
  }
}
