import { clerkClient } from "@clerk/nextjs/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { NextResponse, type NextRequest } from "next/server";

import { logAudit } from "@/lib/audit";
import { db } from "@/server/db";
import * as rbacRepository from "@/server/repositories/rbac.repository";

type ClerkWebhookEvent = Awaited<ReturnType<typeof verifyWebhook>>;

/** `docs/SETUP.md` §5.1: todo usuario nuevo nace `customer`. */
const DEFAULT_ROLE_SLUG = "customer";

const ok = () => new NextResponse("OK", { status: 200 });

/**
 * Espejo local de Clerk. Las tres operaciones son idempotentes (upsert por
 * `clerk_id`, `onConflictDoNothing` en `user_roles`), así que un reintento de
 * Svix no necesita deduplicarse por `svix-id`.
 */
export async function POST(request: NextRequest) {
  let event: ClerkWebhookEvent;

  // Sin firma válida no se toca la base de datos.
  try {
    event = await verifyWebhook(request);
  } catch (error) {
    console.error("POST /api/webhooks/clerk — firma inválida", error);
    return new NextResponse("Verification failed", { status: 400 });
  }

  try {
    if (event.type === "user.created" || event.type === "user.updated") {
      return await syncUser(event, event.type === "user.created");
    }

    if (event.type === "user.deleted") {
      const clerkId = event.data.id;

      if (clerkId) {
        // Baja lógica: `audit_logs` conserva a su actor.
        await rbacRepository.deactivateByClerkId(clerkId);
      }
    }

    return ok();
  } catch (error) {
    // 500 para que Svix reintente: un 200 optimista dejaría al usuario sin fila.
    console.error(`POST /api/webhooks/clerk — ${event.type}`, error);
    return new NextResponse("Sync failed", { status: 500 });
  }
}

async function syncUser(
  event: Extract<ClerkWebhookEvent, { type: "user.created" | "user.updated" }>,
  isNew: boolean,
): Promise<NextResponse> {
  const {
    id,
    email_addresses,
    primary_email_address_id,
    first_name,
    last_name,
    image_url,
  } = event.data;

  const email =
    email_addresses.find((address) => address.id === primary_email_address_id)
      ?.email_address ?? email_addresses[0]?.email_address;

  if (!email) {
    // Cuenta sin email (solo teléfono): reintentar no la va a dar.
    console.error(`Usuario ${id} sin email; no se sincroniza.`);
    return ok();
  }

  // Un alta hecha desde el panel llega con sus roles ya en `publicMetadata`: es
  // la señal de que este `user.created` no debe degradarla a `customer`, incluso
  // si el webhook gana la carrera a la transacción del handler (spec 004 §10).
  const seededSlugs = readRoleSlugs(event.data.public_metadata);

  const slugsToCache = await db.transaction(async (tx) => {
    const user = await rbacRepository.upsertFromClerk(tx, {
      clerkId: id,
      email,
      firstName: first_name,
      lastName: last_name,
      imageUrl: image_url,
    });

    if (!isNew) {
      return null;
    }

    await logAudit(tx, {
      action: "user.created",
      entityType: "user",
      entityId: user.id,
      actorId: null,
      metadata: { source: "clerk.webhook" },
    });

    const existing = await rbacRepository.findRoleSlugsByUserId(tx, user.id);

    // Ya tiene roles (o los trae el evento): nada que asignar y nada que
    // cachear — su `publicMetadata` la escribe quien hizo el alta.
    if (existing.length > 0 || seededSlugs.length > 0) {
      return null;
    }

    const assigned = await rbacRepository.assignRoleBySlug(
      tx,
      user.id,
      DEFAULT_ROLE_SLUG,
    );

    if (!assigned) {
      return null;
    }

    await logAudit(tx, {
      action: "user.role_assigned",
      entityType: "user",
      entityId: user.id,
      actorId: null,
      changes: { after: { role: DEFAULT_ROLE_SLUG } },
      severity: "warning",
      metadata: { source: "clerk.webhook" },
    });

    // La lista completa leída de la BD, no `[DEFAULT_ROLE_SLUG]` a secas.
    return rbacRepository.findRoleSlugsByUserId(tx, user.id);
  });

  // Fuera de la transacción: es una llamada HTTP a Clerk. Solo cuando este
  // webhook fue quien asignó el rol, y porque escribir metadata emite otro
  // `user.updated`: hacerlo en cada update sería un bucle de webhooks.
  if (slugsToCache) {
    await cacheRolesInClerk(id, slugsToCache);
  }

  return ok();
}

/** `publicMetadata` es JSON arbitrario: se valida antes de leerlo. */
function readRoleSlugs(metadata: unknown): string[] {
  if (typeof metadata !== "object" || metadata === null) {
    return [];
  }

  const roles = (metadata as { roles?: unknown }).roles;

  return Array.isArray(roles)
    ? roles.filter((slug): slug is string => typeof slug === "string")
    : [];
}

/**
 * `publicMetadata` es cache derivado para el gate del middleware; la verdad está
 * en Postgres. El array se reescribe entero: un merge dejaría roles fantasma.
 */
async function cacheRolesInClerk(
  clerkId: string,
  slugs: string[],
): Promise<void> {
  try {
    const clerk = await clerkClient();
    await clerk.users.updateUserMetadata(clerkId, {
      publicMetadata: { roles: slugs },
    });
  } catch (error) {
    // La fuente de verdad ya está escrita: no se reintenta aquí (timeout de Svix).
    console.error(`No se pudo cachear los roles de ${clerkId} en Clerk`, error);
  }
}
