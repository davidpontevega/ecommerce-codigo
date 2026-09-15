import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

import { authErrorResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import {
  userIdSchema,
  userRolesSchema,
} from "@/modules/users/schemas/user.schema";
import * as userRepository from "@/server/repositories/user.repository";

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext<"/api/admin/users/[id]/roles">,
) {
  const { id } = await params;

  if (!userIdSchema.safeParse(id).success) {
    return NextResponse.json(
      { error: "Identificador inválido" },
      { status: 400 },
    );
  }

  let actorId: string;

  try {
    actorId = (await requirePermission("users.assign_roles")).id;
  } catch (error) {
    return authErrorResponse(error);
  }

  // Guard por identidad: nadie edita sus propios roles. Siempre queda otra
  // cuenta con la llave para repararlo, sin comparar slugs en el código.
  if (id === actorId) {
    return NextResponse.json(
      { error: "No puedes cambiar tus propios roles" },
      { status: 409 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  const parsed = userRolesSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const result = await userRepository.replaceRoles(
      id,
      parsed.data.roleIds,
      actorId,
    );

    if (!result.ok) {
      return result.reason === "unknown-roles"
        ? NextResponse.json(
            { error: "Alguno de los roles seleccionados no existe" },
            { status: 400 },
          )
        : NextResponse.json(
            { error: "Usuario no encontrado" },
            { status: 404 },
          );
    }

    // Cache derivado del gate del middleware. `updateUserMetadata` hace merge
    // por clave: `mustChangePassword` sobrevive; el array `roles` se reescribe.
    try {
      const clerk = await clerkClient();
      await clerk.users.updateUserMetadata(result.user.clerkId, {
        publicMetadata: {
          roles: result.user.roles.map((role) => role.slug),
        },
      });
    } catch (error) {
      console.error(
        `No se pudo cachear los roles de ${result.user.clerkId} en Clerk`,
        error,
      );
    }

    return NextResponse.json(result.user);
  } catch (error) {
    console.error("PATCH /api/admin/users/[id]/roles", error);
    return NextResponse.json(
      { error: "No se pudieron cambiar los roles" },
      { status: 500 },
    );
  }
}
