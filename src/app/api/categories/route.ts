import { NextResponse, type NextRequest } from "next/server";

import { authErrorResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import {
  categoryCreateSchema,
  categoryQuerySchema,
} from "@/modules/categories/schemas/category.schema";
import * as categoryRepository from "@/server/repositories/category.repository";

export async function GET(request: NextRequest) {
  const parsed = categoryQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Parámetros de consulta inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await categoryRepository.list(parsed.data));
  } catch (error) {
    console.error("GET /api/categories", error);
    return NextResponse.json(
      { error: "No se pudieron listar las categorías" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  let actorId: string;

  try {
    actorId = (await requirePermission("categories.create")).id;
  } catch (error) {
    return authErrorResponse(error);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  const parsed = categoryCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const created = await categoryRepository.create(parsed.data, actorId);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (categoryRepository.isUniqueViolation(error)) {
      return NextResponse.json(
        { error: "Ya existe una categoría con ese slug" },
        { status: 409 },
      );
    }

    console.error("POST /api/categories", error);
    return NextResponse.json(
      { error: "No se pudo crear la categoría" },
      { status: 500 },
    );
  }
}
