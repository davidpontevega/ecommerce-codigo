import { and, asc, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";

import { logAudit } from "@/lib/audit";
import type {
  CategoryCreateInput,
  CategoryQueryInput,
  CategoryUpdateInput,
} from "@/modules/categories/schemas/category.schema";
import { db } from "@/server/db";
import { categories, type Category } from "@/server/db/schema";

const sortColumns = {
  name: categories.name,
  createdAt: categories.createdAt,
  updatedAt: categories.updatedAt,
} as const;

const editableKeys = [
  "name",
  "slug",
  "description",
  "isActive",
] as const satisfies ReadonlyArray<keyof CategoryUpdateInput & keyof Category>;

export type CategoryListResult = {
  data: Category[];
  total: number;
  page: number;
  pageSize: number;
};

/** `23505` = unique_violation de Postgres; Drizzle la envuelve en `cause`. */
export function isUniqueViolation(error: unknown): boolean {
  for (let current: unknown = error; current instanceof Error; current = current.cause) {
    if ("code" in current && current.code === "23505") {
      return true;
    }
  }
  return false;
}

export function buildFilters(params: CategoryQueryInput): SQL | undefined {
  const conditions: Array<SQL | undefined> = [];

  if (params.search) {
    const pattern = `%${params.search}%`;
    conditions.push(
      or(ilike(categories.name, pattern), ilike(categories.slug, pattern)),
    );
  }

  if (params.status !== "all") {
    conditions.push(eq(categories.isActive, params.status === "active"));
  }

  return and(...conditions);
}

export async function list(
  params: CategoryQueryInput,
): Promise<CategoryListResult> {
  const where = buildFilters(params);
  const column = sortColumns[params.sortBy];
  const orderBy = params.sortDir === "asc" ? asc(column) : desc(column);

  const [rows, totals] = await Promise.all([
    db
      .select()
      .from(categories)
      .where(where)
      .orderBy(orderBy)
      .limit(params.pageSize)
      .offset((params.page - 1) * params.pageSize),
    db.select({ value: count() }).from(categories).where(where),
  ]);

  return {
    data: rows,
    total: totals[0]?.value ?? 0,
    page: params.page,
    pageSize: params.pageSize,
  };
}

export async function findById(id: string): Promise<Category | null> {
  const [category] = await db
    .select()
    .from(categories)
    .where(eq(categories.id, id))
    .limit(1);

  return category ?? null;
}

export async function findBySlug(slug: string): Promise<Category | null> {
  const [category] = await db
    .select()
    .from(categories)
    .where(eq(categories.slug, slug))
    .limit(1);

  return category ?? null;
}

export async function create(
  input: CategoryCreateInput,
  actorId?: string | null,
): Promise<Category> {
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(categories)
      .values({
        name: input.name,
        slug: input.slug,
        description: input.description ?? null,
        isActive: input.isActive,
      })
      .returning();

    if (!created) {
      throw new Error("No se pudo crear la categoría");
    }

    await logAudit(tx, {
      action: "category.created",
      entityType: "category",
      actorId,
      entityId: created.id,
      changes: { after: { name: created.name, slug: created.slug } },
    });

    return created;
  });
}

export async function update(
  id: string,
  input: CategoryUpdateInput,
  actorId?: string | null,
): Promise<Category | null> {
  return db.transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(categories)
      .where(eq(categories.id, id))
      .limit(1);

    if (!before) {
      return null;
    }

    const [after] = await tx
      .update(categories)
      .set(input)
      .where(eq(categories.id, id))
      .returning();

    if (!after) {
      return null;
    }

    const changedKeys = editableKeys.filter(
      (key) => key in input && before[key] !== after[key],
    );

    await logAudit(tx, {
      action: "category.updated",
      entityType: "category",
      actorId,
      entityId: after.id,
      changes: {
        before: Object.fromEntries(changedKeys.map((key) => [key, before[key]])),
        after: Object.fromEntries(changedKeys.map((key) => [key, after[key]])),
      },
    });

    return after;
  });
}

export async function setActive(
  id: string,
  isActive: boolean,
  actorId?: string | null,
): Promise<Category | null> {
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(categories)
      .set({ isActive })
      .where(eq(categories.id, id))
      .returning();

    if (!updated) {
      return null;
    }

    await logAudit(tx, {
      action: isActive ? "category.reactivated" : "category.deactivated",
      entityType: "category",
      actorId,
      entityId: updated.id,
      changes: { after: { isActive } },
    });

    return updated;
  });
}
