import { asc, count, eq, inArray, sql } from "drizzle-orm";

import { logAudit } from "@/lib/audit";
import type { RolePermissionRef } from "@/modules/roles/types/role.types";
import { db, type Transaction } from "@/server/db";
import {
  permissions,
  rolePermissions,
  roles,
  userRoles,
  type Role,
} from "@/server/db/schema";

export type RoleWithUserCount = Role & { userCount: number };

export type RoleDetail = Role & { permissions: RolePermissionRef[] };

export type ReplacePermissionsResult =
  | { ok: true; role: RoleDetail }
  | { ok: false; reason: "not-found" | "unknown-codes" };

/** Un `leftJoin` agrupado, sin N+1. */
export async function listWithUserCount(): Promise<RoleWithUserCount[]> {
  const rows = await db
    .select({
      role: roles,
      userCount: count(userRoles.userId),
    })
    .from(roles)
    .leftJoin(userRoles, eq(userRoles.roleId, roles.id))
    .groupBy(roles.id)
    .orderBy(asc(roles.name));

  return rows.map(({ role, userCount }) => ({ ...role, userCount }));
}

export function findByIds(ids: string[]): Promise<Role[]> {
  return ids.length === 0
    ? Promise.resolve([])
    : db.select().from(roles).where(inArray(roles.id, ids));
}

/**
 * Devuelve **todos** los permisos con `granted`, no solo los concedidos: la
 * matriz se pinta entera con una sola request.
 */
async function findDetail(
  tx: Transaction | typeof db,
  id: string,
): Promise<RoleDetail | null> {
  const [role] = await tx.select().from(roles).where(eq(roles.id, id)).limit(1);

  if (!role) {
    return null;
  }

  const rows = await tx
    .select({
      code: permissions.code,
      resource: permissions.resource,
      action: permissions.action,
      description: permissions.description,
      granted: sql<boolean>`${rolePermissions.roleId} is not null`,
    })
    .from(permissions)
    .leftJoin(
      rolePermissions,
      sql`${rolePermissions.permissionId} = ${permissions.id} and ${rolePermissions.roleId} = ${id}`,
    )
    .orderBy(asc(permissions.resource), asc(permissions.code));

  return { ...role, permissions: rows };
}

export function findDetailById(id: string): Promise<RoleDetail | null> {
  return findDetail(db, id);
}

export async function replacePermissions(
  id: string,
  codes: string[],
  actorId: string,
): Promise<ReplacePermissionsResult> {
  return db.transaction(async (tx) => {
    const before = await findDetail(tx, id);

    if (!before) {
      return { ok: false, reason: "not-found" };
    }

    const unique = [...new Set(codes)];

    const matched = unique.length
      ? await tx
          .select({ id: permissions.id })
          .from(permissions)
          .where(inArray(permissions.code, unique))
      : [];

    if (matched.length !== unique.length) {
      return { ok: false, reason: "unknown-codes" };
    }

    await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, id));

    if (matched.length > 0) {
      await tx
        .insert(rolePermissions)
        .values(matched.map(({ id: permissionId }) => ({ roleId: id, permissionId })));
    }

    await logAudit(tx, {
      action: "role.permissions_changed",
      entityType: "role",
      entityId: id,
      actorId,
      changes: {
        before: {
          permissions: before.permissions
            .filter((permission) => permission.granted)
            .map((permission) => permission.code),
        },
        after: { permissions: unique },
      },
      severity: "warning",
    });

    const after = await findDetail(tx, id);

    if (!after) {
      throw new Error(`No se pudo releer el rol ${id}`);
    }

    return { ok: true, role: after };
  });
}
