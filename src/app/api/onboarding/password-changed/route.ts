import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { logAudit } from "@/lib/audit";
import { authErrorResponse, requireAuth } from "@/lib/auth";
import { db } from "@/server/db";

/**
 * Cierra el cambio de contraseña forzado. El `clerkId` sale de la sesión, nunca
 * del cuerpo: si lo aceptara del cliente, cualquiera podría levantarle el flag
 * a otro. Por eso el endpoint no recibe cuerpo.
 */
export async function POST() {
  let user: Awaited<ReturnType<typeof requireAuth>>;

  try {
    user = await requireAuth();
  } catch (error) {
    return authErrorResponse(error);
  }

  try {
    // Merge por clave: `roles` sobrevive intacto.
    const clerk = await clerkClient();
    await clerk.users.updateUserMetadata(user.clerkId, {
      publicMetadata: { mustChangePassword: false },
    });

    await db.transaction(async (tx) => {
      await logAudit(tx, {
        action: "user.password_changed",
        entityType: "user",
        entityId: user.id,
        actorId: user.id,
        severity: "warning",
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/onboarding/password-changed", error);
    return NextResponse.json(
      { error: "No se pudo confirmar el cambio de contraseña" },
      { status: 500 },
    );
  }
}
