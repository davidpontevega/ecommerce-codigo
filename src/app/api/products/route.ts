import { NextResponse, type NextRequest } from "next/server";

import { authErrorResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import {
  productCreateSchema,
  productQuerySchema,
} from "@/modules/products/schemas/product.schema";
import * as productRepository from "@/server/repositories/product.repository";

export async function GET(request: NextRequest) {
  const parsed = productQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Parámetros de consulta inválidos",
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  // `status=available` (el default) es la ruta pública del storefront. Pedir
  // filas retiradas del catálogo no lo es: exige `products.read`.
  if (parsed.data.status !== "available") {
    try {
      await requirePermission("products.read");
    } catch (error) {
      return authErrorResponse(error);
    }
  }

  try {
    return NextResponse.json(await productRepository.list(parsed.data));
  } catch (error) {
    console.error("GET /api/products", error);
    return NextResponse.json(
      { error: "No se pudieron listar los productos" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  let actorId: string;

  try {
    actorId = (await requirePermission("products.create")).id;
  } catch (error) {
    return authErrorResponse(error);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Cuerpo JSON inválido" },
      { status: 400 },
    );
  }

  const parsed = productCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const created = await productRepository.create(parsed.data, actorId);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const mapped = productRepository.mapDbError(error);

    if (mapped) {
      return NextResponse.json(
        { error: mapped.message },
        { status: mapped.status },
      );
    }

    console.error("POST /api/products", error);
    return NextResponse.json(
      { error: "No se pudo crear el producto" },
      { status: 500 },
    );
  }
}
