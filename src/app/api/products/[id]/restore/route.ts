import { NextResponse, type NextRequest } from "next/server";

import { authErrorResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { productIdSchema } from "@/modules/products/schemas/product.schema";
import * as productRepository from "@/server/repositories/product.repository";

export async function POST(
  _request: NextRequest,
  { params }: RouteContext<"/api/products/[id]/restore">,
) {
  const { id } = await params;

  if (!productIdSchema.safeParse(id).success) {
    return NextResponse.json(
      { error: "Identificador inválido" },
      { status: 400 },
    );
  }

  // Restaurar es deshacer un borrado: mismo permiso que eliminar.
  let actorId: string;

  try {
    actorId = (await requirePermission("products.delete")).id;
  } catch (error) {
    return authErrorResponse(error);
  }

  try {
    const result = await productRepository.restore(id, actorId);

    if (result.ok) {
      return NextResponse.json(result.product);
    }

    return result.reason === "not-deleted"
      ? NextResponse.json(
          { error: "El producto no está eliminado" },
          { status: 409 },
        )
      : NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  } catch (error) {
    console.error("POST /api/products/[id]/restore", error);
    return NextResponse.json(
      { error: "No se pudo restaurar el producto" },
      { status: 500 },
    );
  }
}
