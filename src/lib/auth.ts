import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { cache } from "react";

import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import * as rbacRepository from "@/server/repositories/rbac.repository";
import type { UserAccess } from "@/server/repositories/rbac.repository";

export { UnauthorizedError } from "@/lib/errors";

/**
 * Identidad + permisos efectivos del usuario de la request, releídos de Postgres
 * (fuente de verdad de la autorización; `publicMetadata` es cache derivado).
 * `cache()` de React memoiza por request: el guard, el `actorId` y el header
 * comparten una sola resolución.
 */
export const getCurrentUser = cache(async (): Promise<UserAccess | null> => {
  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  const user = await rbacRepository.findAccessByClerkId(userId);

  return user?.isActive ? user : null;
});

export async function requireAuth(): Promise<UserAccess> {
  const user = await getCurrentUser();

  if (!user) {
    throw new UnauthorizedError();
  }

  return user;
}

/** Mapeo único de los errores de los guards al contrato HTTP de la API. */
export function authErrorResponse(error: unknown): NextResponse {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  if (error instanceof ForbiddenError) {
    return NextResponse.json(
      { error: "No tienes permiso para esta acción" },
      { status: 403 },
    );
  }

  // Fallo al resolver el acceso (BD caída, sesión corrupta): nunca se traga.
  console.error("Resolución de permisos", error);
  return NextResponse.json(
    { error: "No se pudo verificar el acceso" },
    { status: 500 },
  );
}
