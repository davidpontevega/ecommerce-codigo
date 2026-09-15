import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

import { authErrorResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import {
  userIdSchema,
  userStatusSchema,
} from "@/modules/users/schemas/user.schema";
import * as userRepository from "@/server/repositories/user.repository";

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext<"/api/admin/users/[id]">,
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
    actorId = (await requirePermission("users.update")).id;
  } catch (error) {
    return authErrorResponse(error);
  }

  // Guard por identidad, no por nombre de rol: nadie se desactiva a sí mismo.
  if (id === actorId) {
    return NextResponse.json(
      { error: "No puedes cambiar tu propio estado" },
      { status: 409 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  const parsed = userStatusSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { isActive } = parsed.data;

  try {
    const user = await userRepository.setActive(id, isActive, actorId);

    if (!user) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 },
      );
    }

    // Fuera de la transacción: HTTP a Clerk. Postgres ya es correcto, así que
    // un fallo se registra y no se reintenta en bucle dentro del handler.
    try {
      const clerk = await clerkClient();
      await (isActive
        ? clerk.users.unbanUser(user.clerkId)
        : clerk.users.banUser(user.clerkId));
    } catch (error) {
      console.error(`No se pudo sincronizar el baneo de ${user.clerkId}`, error);
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("PATCH /api/admin/users/[id]", error);
    return NextResponse.json(
      { error: "No se pudo cambiar el estado del usuario" },
      { status: 500 },
    );
  }
}
