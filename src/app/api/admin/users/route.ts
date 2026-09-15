import { randomBytes } from "node:crypto";

import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

import { authErrorResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import {
  userCreateSchema,
  userQuerySchema,
} from "@/modules/users/schemas/user.schema";
import * as roleRepository from "@/server/repositories/role.repository";
import * as userRepository from "@/server/repositories/user.repository";

/**
 * La genera el servidor y viaja solo en la respuesta del `POST`: nunca se
 * persiste, nunca entra en `audit_logs` y nunca sube desde el navegador.
 */
function generateTemporaryPassword(): string {
  return randomBytes(12).toString("base64url");
}

/**
 * Clerk lanza `ClerkAPIResponseError` con `errors[].code`. Se comprueba la
 * forma en vez de importar el tipo: `@clerk/nextjs/errors` arrastra el bundle
 * de cliente y no puede entrar en un Route Handler.
 */
function isDuplicateIdentifierError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("errors" in error)) {
    return false;
  }

  const { errors } = error as { errors: unknown };

  return (
    Array.isArray(errors) &&
    errors.some(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        "code" in entry &&
        (entry as { code: unknown }).code === "form_identifier_exists",
    )
  );
}

export async function GET(request: NextRequest) {
  try {
    await requirePermission("users.read");
  } catch (error) {
    return authErrorResponse(error);
  }

  const parsed = userQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Parámetros de consulta inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await userRepository.list(parsed.data));
  } catch (error) {
    console.error("GET /api/admin/users", error);
    return NextResponse.json(
      { error: "No se pudieron listar los usuarios" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  let actorId: string;

  try {
    actorId = (await requirePermission("users.create")).id;
  } catch (error) {
    return authErrorResponse(error);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  const parsed = userCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { firstName, lastName, email, roleIds } = parsed.data;

  const clerk = await clerkClient();
  let createdClerkId: string | null = null;

  try {
    const selected = await roleRepository.findByIds(roleIds);

    if (selected.length !== new Set(roleIds).size) {
      return NextResponse.json(
        { error: "Alguno de los roles seleccionados no existe" },
        { status: 400 },
      );
    }

    const temporaryPassword = generateTemporaryPassword();

    // Los slugs viajan en `publicMetadata` desde el minuto cero: es la señal
    // que impide al webhook `user.created` degradar el alta a `customer`.
    const created = await clerk.users.createUser({
      emailAddress: [email],
      password: temporaryPassword,
      firstName,
      lastName: lastName ?? undefined,
      publicMetadata: {
        roles: selected.map((role) => role.slug),
        mustChangePassword: true,
      },
    });
    createdClerkId = created.id;

    const user = await userRepository.createWithRoles({
      clerkId: created.id,
      email,
      firstName,
      lastName: lastName ?? null,
      roleIds,
      actorId,
    });

    return NextResponse.json({ user, temporaryPassword }, { status: 201 });
  } catch (error) {
    if (isDuplicateIdentifierError(error)) {
      return NextResponse.json(
        { error: "Ya existe una cuenta con ese correo electrónico" },
        { status: 409 },
      );
    }

    // La cuenta se creó en Clerk pero Postgres falló: se revierte para no dejar
    // una cuenta huérfana. Si el borrado también falla, la recoge el webhook.
    if (createdClerkId) {
      try {
        await clerk.users.deleteUser(createdClerkId);
      } catch (cleanupError) {
        console.error("POST /api/admin/users — cleanup", cleanupError);
      }
    }

    console.error("POST /api/admin/users", error);
    return NextResponse.json(
      { error: "No se pudo crear el usuario" },
      { status: 500 },
    );
  }
}
