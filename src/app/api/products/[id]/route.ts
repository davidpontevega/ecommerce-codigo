import { NextResponse, type NextRequest } from "next/server";

import { authErrorResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import {
  productIdSchema,
  productUpdateSchema,
} from "@/modules/products/schemas/product.schema";
import * as productRepository from "@/server/repositories/product.repository";

const invalidId = () =>
  NextResponse.json({ error: "Identificador inválido" }, { status: 400 });

const notFound = () =>
  NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });

/**
 * Lectura del panel, no pública: devuelve el producto **con su costo**
 * (spec 019 D8). La tienda no pasa por aquí —usa `findBySlug` en el servidor—,
 * así que el permiso no cierra ninguna puerta que el cliente necesitara.
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteContext<"/api/products/[id]">,
) {
  const { id } = await params;

  if (!productIdSchema.safeParse(id).success) {
    return invalidId();
  }

  try {
    await requirePermission("products.read");
  } catch (error) {
    return authErrorResponse(error);
  }

  try {
    const product = await productRepository.findById(id);
    return product ? NextResponse.json(product) : notFound();
  } catch (error) {
    console.error("GET /api/products/[id]", error);
    return NextResponse.json(
      { error: "No se pudo obtener el producto" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext<"/api/products/[id]">,
) {
  const { id } = await params;

  if (!productIdSchema.safeParse(id).success) {
    return invalidId();
  }

  let actorId: string;

  try {
    actorId = (await requirePermission("products.update")).id;
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

  const parsed = productUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const result = await productRepository.update(id, parsed.data, actorId);

    if (result.ok) {
      return NextResponse.json(result.product);
    }

    return result.reason === "no-changes"
      ? NextResponse.json(
          { error: "Sin cambios que aplicar" },
          { status: 400 },
        )
      : notFound();
  } catch (error) {
    const mapped = productRepository.mapDbError(error);

    if (mapped) {
      return NextResponse.json(
        { error: mapped.message },
        { status: mapped.status },
      );
    }

    console.error("PATCH /api/products/[id]", error);
    return NextResponse.json(
      { error: "No se pudo actualizar el producto" },
      { status: 500 },
    );
  }
}

// Borrado lógico: setea `deleted_at`. 404 también si ya estaba eliminado.
export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext<"/api/products/[id]">,
) {
  const { id } = await params;

  if (!productIdSchema.safeParse(id).success) {
    return invalidId();
  }

  let actorId: string;

  try {
    actorId = (await requirePermission("products.delete")).id;
  } catch (error) {
    return authErrorResponse(error);
  }

  try {
    const deleted = await productRepository.softDelete(id, actorId);
    return deleted ? NextResponse.json(deleted) : notFound();
  } catch (error) {
    console.error("DELETE /api/products/[id]", error);
    return NextResponse.json(
      { error: "No se pudo eliminar el producto" },
      { status: 500 },
    );
  }
}
