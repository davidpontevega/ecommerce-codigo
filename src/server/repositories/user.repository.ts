import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  type SQL,
} from "drizzle-orm";

import { logAudit } from "@/lib/audit";
import type { UserQueryInput } from "@/modules/users/schemas/user.schema";
import type { UserRoleRef } from "@/modules/users/types/user.types";
import { db, type Transaction } from "@/server/db";
import { roles, userRoles, users, type User } from "@/server/db/schema";

export type UserWithRoles = User & { roles: UserRoleRef[] };

export type UserListResult = {
  data: UserWithRoles[];
  total: number;
  page: number;
  pageSize: number;
};

export type UserMutationResult =
  | { ok: true; user: UserWithRoles }
  | { ok: false; reason: "not-found" | "unknown-roles" };

const sortColumns = {
  createdAt: users.createdAt,
  email: users.email,
  firstName: users.firstName,
} as const;

export function buildFilters(params: UserQueryInput): SQL | undefined {
  const conditions: Array<SQL | undefined> = [];

  if (params.search) {
    const pattern = `%${params.search}%`;
    conditions.push(
      or(
        ilike(users.email, pattern),
        ilike(users.firstName, pattern),
        ilike(users.lastName, pattern),
      ),
    );
  }

  if (params.status !== "all") {
    conditions.push(eq(users.isActive, params.status === "active"));
  }

  return and(...conditions);
}

/** Roles de un conjunto de usuarios en una sola query: nunca N+1. */
async function findRolesByUserIds(
  tx: Transaction | typeof db,
  userIds: string[],
): Promise<Map<string, UserRoleRef[]>> {
  const grouped = new Map<string, UserRoleRef[]>();

  if (userIds.length === 0) {
    return grouped;
  }

  const rows = await tx
    .select({
      userId: userRoles.userId,
      id: roles.id,
      slug: roles.slug,
      name: roles.name,
    })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(inArray(userRoles.userId, userIds))
    .orderBy(asc(roles.name));

  for (const { userId, ...role } of rows) {
    const current = grouped.get(userId);
    if (current) {
      current.push(role);
    } else {
      grouped.set(userId, [role]);
    }
  }

  return grouped;
}

async function findWithRoles(
  tx: Transaction | typeof db,
  id: string,
): Promise<UserWithRoles | null> {
  const [user] = await tx.select().from(users).where(eq(users.id, id)).limit(1);

  if (!user) {
    return null;
  }

  const grouped = await findRolesByUserIds(tx, [user.id]);

  return { ...user, roles: grouped.get(user.id) ?? [] };
}

/**
 * Pagina primero y trae los roles de la página en una 2ª query: un `join` con
 * `user_roles` multiplicaría filas y rompería `limit`/`offset`.
 */
export async function list(params: UserQueryInput): Promise<UserListResult> {
  const where = buildFilters(params);
  const column = sortColumns[params.sortBy];
  const orderBy = params.sortDir === "asc" ? asc(column) : desc(column);

  const [rows, totals] = await Promise.all([
    db
      .select()
      .from(users)
      .where(where)
      .orderBy(orderBy)
      .limit(params.pageSize)
      .offset((params.page - 1) * params.pageSize),
    db.select({ value: count() }).from(users).where(where),
  ]);

  const grouped = await findRolesByUserIds(
    db,
    rows.map((row) => row.id),
  );

  return {
    data: rows.map((row) => ({ ...row, roles: grouped.get(row.id) ?? [] })),
    total: totals[0]?.value ?? 0,
    page: params.page,
    pageSize: params.pageSize,
  };
}

export function findDtoById(id: string): Promise<UserWithRoles | null> {
  return findWithRoles(db, id);
}

type CreateWithRolesInput = {
  clerkId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  roleIds: string[];
  actorId: string;
};

/**
 * Upsert por `clerk_id` + reemplazo total de roles: converge al mismo estado
 * llegue antes o después el webhook `user.created` (spec 004 §10).
 * La contraseña temporal nunca entra aquí ni en la bitácora.
 */
export async function createWithRoles(
  input: CreateWithRolesInput,
): Promise<UserWithRoles> {
  return db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({
        clerkId: input.clerkId,
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
      })
      .onConflictDoUpdate({
        target: users.clerkId,
        set: {
          email: input.email,
          firstName: input.firstName,
          lastName: input.lastName,
          isActive: true,
        },
      })
      .returning();

    if (!user) {
      throw new Error(`No se pudo crear el usuario ${input.clerkId}`);
    }

    await tx.delete(userRoles).where(eq(userRoles.userId, user.id));
    await tx.insert(userRoles).values(
      input.roleIds.map((roleId) => ({
        userId: user.id,
        roleId,
        assignedBy: input.actorId,
      })),
    );

    const assigned = await findRolesByUserIds(tx, [user.id]);
    const roleRefs = assigned.get(user.id) ?? [];

    await logAudit(tx, {
      action: "user.created",
      entityType: "user",
      entityId: user.id,
      actorId: input.actorId,
      changes: {
        after: { roles: roleRefs.map((role) => role.slug) },
      },
      severity: "warning",
      metadata: { source: "admin.ui" },
    });

    return { ...user, roles: roleRefs };
  });
}

export async function replaceRoles(
  id: string,
  roleIds: string[],
  actorId: string,
): Promise<UserMutationResult> {
  return db.transaction(async (tx) => {
    const before = await findWithRoles(tx, id);

    if (!before) {
      return { ok: false, reason: "not-found" };
    }

    const existing = await tx
      .select({ id: roles.id })
      .from(roles)
      .where(inArray(roles.id, roleIds));

    if (existing.length !== new Set(roleIds).size) {
      return { ok: false, reason: "unknown-roles" };
    }

    await tx.delete(userRoles).where(eq(userRoles.userId, id));
    await tx
      .insert(userRoles)
      .values(roleIds.map((roleId) => ({ userId: id, roleId, assignedBy: actorId })));

    const grouped = await findRolesByUserIds(tx, [id]);
    const roleRefs = grouped.get(id) ?? [];

    await logAudit(tx, {
      action: "user.roles_changed",
      entityType: "user",
      entityId: id,
      actorId,
      // Slugs, no ids: la bitácora tiene que leerse sin resolver uuids.
      changes: {
        before: { roles: before.roles.map((role) => role.slug) },
        after: { roles: roleRefs.map((role) => role.slug) },
      },
      severity: "warning",
    });

    return { ok: true, user: { ...before, roles: roleRefs } };
  });
}

/** Solo la columna: el resto del usuario ya lo trae `getCurrentUser()`. */
export async function findStripeCustomerId(id: string): Promise<string | null> {
  const [row] = await db
    .select({ stripeCustomerId: users.stripeCustomerId })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  return row?.stripeCustomerId ?? null;
}

/**
 * `where` con `isNull`: si dos peticiones simultáneas crearan dos Customers, solo
 * la primera se queda con la columna y la segunda no la pisa (el Customer
 * sobrante queda huérfano en Stripe, no se cobra ni se usa). Devuelve el id que
 * quedó guardado, que puede no ser el que se intentó escribir.
 */
export async function setStripeCustomerId(
  id: string,
  stripeCustomerId: string,
): Promise<string> {
  const [updated] = await db
    .update(users)
    .set({ stripeCustomerId })
    .where(and(eq(users.id, id), isNull(users.stripeCustomerId)))
    .returning({ stripeCustomerId: users.stripeCustomerId });

  return (
    updated?.stripeCustomerId ??
    (await findStripeCustomerId(id)) ??
    stripeCustomerId
  );
}

export async function setActive(
  id: string,
  isActive: boolean,
  actorId: string,
): Promise<UserWithRoles | null> {
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(users)
      .set({ isActive })
      .where(eq(users.id, id))
      .returning();

    if (!updated) {
      return null;
    }

    await logAudit(tx, {
      action: isActive ? "user.activated" : "user.deactivated",
      entityType: "user",
      entityId: updated.id,
      actorId,
      changes: { before: { isActive: !isActive }, after: { isActive } },
      severity: "warning",
    });

    const grouped = await findRolesByUserIds(tx, [updated.id]);

    return { ...updated, roles: grouped.get(updated.id) ?? [] };
  });
}
