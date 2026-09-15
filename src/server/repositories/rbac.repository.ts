import { eq, getTableColumns } from "drizzle-orm";

import { db, type Transaction } from "@/server/db";
import {
  permissions,
  rolePermissions,
  roles,
  userRoles,
  users,
  type User,
} from "@/server/db/schema";

export type UserRoleSummary = { slug: string; name: string };

export type UserAccess = User & {
  roles: UserRoleSummary[];
  /** Códigos de permiso efectivos, ya deduplicados entre roles. */
  permissions: string[];
};

export type ClerkUserData = {
  clerkId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
};

/**
 * Resuelve identidad, roles y permisos efectivos en **una** query
 * (`users → user_roles → roles → role_permissions → permissions`) y deduplica
 * el producto cartesiano en memoria. Los `leftJoin` mantienen al usuario sin
 * roles (todo `customer` nuevo lo es).
 */
export async function findAccessByClerkId(
  clerkId: string,
): Promise<UserAccess | null> {
  const rows = await db
    .select({
      user: getTableColumns(users),
      roleSlug: roles.slug,
      roleName: roles.name,
      permissionCode: permissions.code,
    })
    .from(users)
    .leftJoin(userRoles, eq(userRoles.userId, users.id))
    .leftJoin(roles, eq(roles.id, userRoles.roleId))
    .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .leftJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(eq(users.clerkId, clerkId));

  const first = rows[0];

  if (!first) {
    return null;
  }

  const roleBySlug = new Map<string, UserRoleSummary>();
  const permissionCodes = new Set<string>();

  for (const row of rows) {
    if (row.roleSlug && row.roleName) {
      roleBySlug.set(row.roleSlug, { slug: row.roleSlug, name: row.roleName });
    }
    if (row.permissionCode) {
      permissionCodes.add(row.permissionCode);
    }
  }

  return {
    ...first.user,
    roles: [...roleBySlug.values()],
    permissions: [...permissionCodes],
  };
}

/** Upsert por `clerk_id`: el webhook `user.updated` no debe duplicar la fila. */
export async function upsertFromClerk(
  tx: Transaction,
  data: ClerkUserData,
): Promise<User> {
  const [user] = await tx
    .insert(users)
    .values(data)
    .onConflictDoUpdate({
      target: users.clerkId,
      set: {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        imageUrl: data.imageUrl,
      },
    })
    .returning();

  if (!user) {
    throw new Error(`No se pudo sincronizar el usuario ${data.clerkId}`);
  }

  return user;
}

/**
 * Slugs de los roles del usuario dentro de la transacción en curso. El webhook
 * lo usa para no pisar un alta hecha desde el panel (spec 004 §10).
 */
export async function findRoleSlugsByUserId(
  tx: Transaction,
  userId: string,
): Promise<string[]> {
  const rows = await tx
    .select({ slug: roles.slug })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(eq(userRoles.userId, userId));

  return rows.map((row) => row.slug);
}

/** `false` si el rol no existe o el usuario ya lo tenía. */
export async function assignRoleBySlug(
  tx: Transaction,
  userId: string,
  slug: string,
  assignedBy?: string | null,
): Promise<boolean> {
  const [role] = await tx
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.slug, slug))
    .limit(1);

  if (!role) {
    return false;
  }

  const assigned = await tx
    .insert(userRoles)
    .values({ userId, roleId: role.id, assignedBy: assignedBy ?? null })
    .onConflictDoNothing()
    .returning({ roleId: userRoles.roleId });

  return assigned.length > 0;
}

/**
 * Baja lógica: borrar la fila dejaría sin actor a toda la bitácora histórica
 * (`audit_logs.actor_id` es `set null`).
 */
export async function deactivateByClerkId(clerkId: string): Promise<boolean> {
  const deactivated = await db
    .update(users)
    .set({ isActive: false })
    .where(eq(users.clerkId, clerkId))
    .returning({ id: users.id });

  return deactivated.length > 0;
}
