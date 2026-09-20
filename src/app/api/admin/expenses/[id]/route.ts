import { NextResponse, type NextRequest } from "next/server";

import { authErrorResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import {
  expenseIdSchema,
  expenseUpdateSchema,
} from "@/modules/finance/schemas/expense.schema";
import * as expenseRepository from "@/server/repositories/expense.repository";

const invalidId = () =>
  NextResponse.json({ error: "Identificador inválido" }, { status: 400 });

const notFound = () =>
  NextResponse.json({ error: "Gasto no encontrado" }, { status: 404 });

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext<"/api/admin/expenses/[id]">,
) {
  const { id } = await params;

  if (!expenseIdSchema.safeParse(id).success) {
    return invalidId();
  }

  let actorId: string;

  try {
    actorId = (await requirePermission("finance.manage")).id;
  } catch (error) {
    return authErrorResponse(error);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  const parsed = expenseUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const updated = await expenseRepository.update(id, parsed.data, actorId);
    return updated ? NextResponse.json(updated) : notFound();
  } catch (error) {
    console.error("PATCH /api/admin/expenses/[id]", error);
    return NextResponse.json(
      { error: "No se pudo actualizar el gasto" },
      { status: 500 },
    );
  }
}

// Borrado lógico: setea `deleted_at`. 404 también si ya estaba eliminado.
export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext<"/api/admin/expenses/[id]">,
) {
  const { id } = await params;

  if (!expenseIdSchema.safeParse(id).success) {
    return invalidId();
  }

  let actorId: string;

  try {
    actorId = (await requirePermission("finance.manage")).id;
  } catch (error) {
    return authErrorResponse(error);
  }

  try {
    const deleted = await expenseRepository.softDelete(id, actorId);
    return deleted ? NextResponse.json(deleted) : notFound();
  } catch (error) {
    console.error("DELETE /api/admin/expenses/[id]", error);
    return NextResponse.json(
      { error: "No se pudo eliminar el gasto" },
      { status: 500 },
    );
  }
}
