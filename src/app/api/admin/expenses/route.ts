import { NextResponse, type NextRequest } from "next/server";

import { authErrorResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import {
  expenseCreateSchema,
  expenseQuerySchema,
} from "@/modules/finance/schemas/expense.schema";
import * as expenseRepository from "@/server/repositories/expense.repository";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("finance.manage");
  } catch (error) {
    return authErrorResponse(error);
  }

  const parsed = expenseQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Parámetros de consulta inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await expenseRepository.list(parsed.data));
  } catch (error) {
    console.error("GET /api/admin/expenses", error);
    return NextResponse.json(
      { error: "No se pudieron listar los gastos" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
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

  const parsed = expenseCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const created = await expenseRepository.create(parsed.data, actorId);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/expenses", error);
    return NextResponse.json(
      { error: "No se pudo registrar el gasto" },
      { status: 500 },
    );
  }
}
