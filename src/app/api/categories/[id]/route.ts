import { NextResponse, type NextRequest } from "next/server";

import { authErrorResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import {
  categoryIdSchema,
  categoryUpdateSchema,
} from "@/modules/categories/schemas/category.schema";
import * as categoryRepository from "@/server/repositories/category.repository";

const invalidId = () =>
  NextResponse.json({ error: "Identificador inválido" }, { status: 400 });

const notFound = () =>
  NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 });

export async function GET(
  _request: NextRequest,
  { params }: RouteContext<"/api/categories/[id]">,
) {
  const { id } = await params;

  if (!categoryIdSchema.safeParse(id).success) {
    return invalidId();
  }

  try {
    const category = await categoryRepository.findById(id);
    return category ? NextResponse.json(category) : notFound();
  } catch (error) {
    console.error("GET /api/categories/[id]", error);
    return NextResponse.json(
      { error: "No se pudo obtener la categoría" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext<"/api/categories/[id]">,
) {
  const { id } = await params;

  if (!categoryIdSchema.safeParse(id).success) {
    return invalidId();
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  const parsed = categoryUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  // Un PATCH que solo mueve `isActive` es el soft-delete/reactivación de la UI y
  // se audita con su propia acción (AC10), no como una edición genérica.
  const { isActive, ...otherFields } = parsed.data;
  const isActiveToggle =
    isActive !== undefined && Object.keys(otherFields).length === 0;

  // Desactivar es la contrapartida de borrar: exige el permiso de borrado.
  let actorId: string;

  try {
    actorId = (
      await requirePermission(
        isActiveToggle ? "categories.delete" : "categories.update",
      )
    ).id;
  } catch (error) {
    return authErrorResponse(error);
  }

  try {
    const updated = isActiveToggle
      ? await categoryRepository.setActive(id, isActive, actorId)
      : await categoryRepository.update(id, parsed.data, actorId);

    return updated ? NextResponse.json(updated) : notFound();
  } catch (error) {
    if (categoryRepository.isUniqueViolation(error)) {
      return NextResponse.json(
        { error: "Ya existe una categoría con ese slug" },
        { status: 409 },
      );
    }

    console.error("PATCH /api/categories/[id]", error);
    return NextResponse.json(
      { error: "No se pudo actualizar la categoría" },
      { status: 500 },
    );
  }
}
