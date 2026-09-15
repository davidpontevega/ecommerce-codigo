import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import { logAudit } from "@/lib/audit";
import type {
  ProductCreateInput,
  ProductQueryInput,
  ProductUpdateInput,
} from "@/modules/products/schemas/product.schema";
import type { ProductWithCategory } from "@/modules/products/types/product.types";
import type { ProductDetail } from "@/modules/storefront/types/storefront.types";
import { db, type Transaction } from "@/server/db";
import { categories, products } from "@/server/db/schema";

const productSelection = {
  ...getTableColumns(products),
  categoryName: categories.name,
};

const categoryJoin = eq(products.categoryId, categories.id);

/**
 * `DESC` pone los `NULL` **primero** en Postgres: sin el `coalesce` los
 * productos sin precio comparativo encabezarían "Mayor descuento".
 */
const discountExpression = sql`coalesce((${products.compareAtPriceCents} - ${products.priceCents})::float8 / nullif(${products.compareAtPriceCents}, 0), 0)`;

const sortColumns = {
  name: products.name,
  priceCents: products.priceCents,
  stock: products.stock,
  createdAt: products.createdAt,
  updatedAt: products.updatedAt,
  discount: discountExpression,
} as const;

const editableKeys = [
  "categoryId",
  "sku",
  "name",
  "slug",
  "description",
  "priceCents",
  "compareAtPriceCents",
  "stock",
  "brand",
  "specs",
  "weightGrams",
  "imageUrl",
] as const satisfies ReadonlyArray<
  keyof ProductUpdateInput & keyof ProductWithCategory
>;

export type ProductListResult = {
  data: ProductWithCategory[];
  total: number;
  page: number;
  pageSize: number;
};

export type RestoreResult =
  | { ok: true; product: ProductWithCategory }
  | { ok: false; reason: "not-found" | "not-deleted" };

export type UpdateResult =
  | { ok: true; product: ProductWithCategory }
  | { ok: false; reason: "not-found" | "no-changes" };

type PostgresError = { code?: unknown; constraint?: unknown; message: string };

export function findPostgresError(error: unknown): PostgresError | null {
  for (
    let current: unknown = error;
    current instanceof Error;
    current = current.cause
  ) {
    if ("code" in current && typeof current.code === "string") {
      return current as Error & PostgresError;
    }
  }
  return null;
}

/**
 * Traduce los errores de integridad de Postgres al contrato HTTP. El `UNIQUE` es
 * la única fuente de verdad para `sku`/`slug`: pre-chequear tendría una carrera
 * TOCTOU.
 */
export function mapDbError(
  error: unknown,
): { status: 400 | 409; message: string } | null {
  const pgError = findPostgresError(error);
  if (!pgError) return null;

  if (pgError.code === "23505") {
    const constraint =
      typeof pgError.constraint === "string"
        ? pgError.constraint
        : pgError.message;

    return constraint.includes("products_sku_unique")
      ? { status: 409, message: "Ya existe un producto con ese SKU" }
      : { status: 409, message: "Ya existe un producto con ese slug" };
  }

  if (pgError.code === "23503") {
    return { status: 400, message: "Categoría no encontrada" };
  }

  return null;
}

export function buildFilters(params: ProductQueryInput): SQL | undefined {
  const conditions: Array<SQL | undefined> = [];

  if (params.search) {
    const pattern = `%${params.search}%`;
    conditions.push(
      or(ilike(products.name, pattern), ilike(products.sku, pattern)),
    );
  }

  if (params.categoryId) {
    conditions.push(eq(products.categoryId, params.categoryId));
  }

  // El `innerJoin` a `categories` ya está en `list()`: filtrar por sus columnas
  // no añade ninguna consulta. Lista vacía ⇒ `inArray` emite `false`, es decir
  // "ningún valor coincide", que es lo que pide `?category=` explícito.
  if (params.categorySlug) {
    conditions.push(inArray(categories.slug, params.categorySlug));
  }

  if (params.brand) {
    conditions.push(inArray(products.brand, params.brand));
  }

  if (params.inStock === true) {
    conditions.push(gt(products.stock, 0));
  }

  if (params.categoryActive !== undefined) {
    conditions.push(eq(categories.isActive, params.categoryActive));
  }

  if (params.onSale === true) {
    conditions.push(isNotNull(products.compareAtPriceCents));
  }

  if (params.status === "available") {
    conditions.push(isNull(products.deletedAt));
  } else if (params.status === "deleted") {
    conditions.push(isNotNull(products.deletedAt));
  }

  if (params.minPriceCents !== undefined) {
    conditions.push(gte(products.priceCents, params.minPriceCents));
  }

  if (params.maxPriceCents !== undefined) {
    conditions.push(lte(products.priceCents, params.maxPriceCents));
  }

  return and(...conditions);
}

/** Relee la fila dentro de la transacción para devolverla con su `categoryName`. */
async function findInTransaction(
  tx: Transaction,
  id: string,
): Promise<ProductWithCategory | null> {
  const [product] = await tx
    .select(productSelection)
    .from(products)
    .innerJoin(categories, categoryJoin)
    .where(eq(products.id, id))
    .limit(1);

  return product ?? null;
}

export async function list(
  params: ProductQueryInput,
): Promise<ProductListResult> {
  const where = buildFilters(params);
  const column = sortColumns[params.sortBy];
  const orderBy = params.sortDir === "asc" ? asc(column) : desc(column);

  const [rows, totals] = await Promise.all([
    db
      .select(productSelection)
      .from(products)
      .innerJoin(categories, categoryJoin)
      .where(where)
      .orderBy(orderBy)
      .limit(params.pageSize)
      .offset((params.page - 1) * params.pageSize),
    db
      .select({ value: count() })
      .from(products)
      .innerJoin(categories, categoryJoin)
      .where(where),
  ]);

  return {
    data: rows,
    total: totals[0]?.value ?? 0,
    page: params.page,
    pageSize: params.pageSize,
  };
}

/** Marcas del catálogo publicable, una sola consulta, para los chips de filtro. */
export async function listBrands(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ brand: products.brand })
    .from(products)
    .where(and(isNull(products.deletedAt), isNotNull(products.brand)))
    .orderBy(asc(products.brand));

  return rows.flatMap((row) => (row.brand === null ? [] : [row.brand]));
}

export async function findById(
  id: string,
): Promise<ProductWithCategory | null> {
  const [product] = await db
    .select(productSelection)
    .from(products)
    .innerJoin(categories, categoryJoin)
    .where(eq(products.id, id))
    .limit(1);

  return product ?? null;
}

/**
 * Ficha pública por slug. El filtro de publicabilidad (`deleted_at` nulo y
 * categoría activa) va en el `where`, no en la página: es regla de negocio y el
 * siguiente llamador la olvidaría. `findById` **no** lo aplica a propósito —el
 * panel administra productos borrados—, así que son dos lecturas distintas.
 */
export async function findBySlug(slug: string): Promise<ProductDetail | null> {
  const [product] = await db
    .select({ ...productSelection, categorySlug: categories.slug })
    .from(products)
    .innerJoin(categories, categoryJoin)
    .where(
      and(
        eq(products.slug, slug),
        isNull(products.deletedAt),
        eq(categories.isActive, true),
      ),
    )
    .limit(1);

  return product ?? null;
}

/** Lo que el checkout necesita releer del catálogo para congelar una línea. */
export type PurchasableProduct = {
  id: string;
  name: string;
  priceCents: number;
  stock: number;
  imageUrl: string | null;
};

/**
 * Lectura por lote para el checkout: **una** consulta para todo el carrito, no
 * una por línea. Solo filas vigentes (`deleted_at IS NULL`); los ids ausentes de
 * la respuesta son los que el servicio rechaza.
 */
export async function findAvailableByIds(
  ids: string[],
): Promise<PurchasableProduct[]> {
  if (ids.length === 0) return [];

  return db
    .select({
      id: products.id,
      name: products.name,
      priceCents: products.priceCents,
      stock: products.stock,
      imageUrl: products.imageUrl,
    })
    .from(products)
    .where(and(inArray(products.id, ids), isNull(products.deletedAt)));
}

/**
 * Descuento condicional del webhook: el `stock >= qty` va en el `WHERE`, así que
 * dos cumplimientos simultáneos no pueden dejar el stock negativo. `false` = no
 * había existencias; el llamador decide (spec 011 D2: no aborta, registra).
 */
export async function decrementStock(
  tx: Transaction,
  productId: string,
  qty: number,
): Promise<boolean> {
  const [updated] = await tx
    .update(products)
    .set({ stock: sql`${products.stock} - ${qty}` })
    .where(and(eq(products.id, productId), gte(products.stock, qty)))
    .returning({ id: products.id });

  return updated !== undefined;
}

export async function create(
  input: ProductCreateInput,
  actorId?: string | null,
): Promise<ProductWithCategory> {
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(products)
      .values({
        categoryId: input.categoryId,
        sku: input.sku,
        name: input.name,
        slug: input.slug,
        description: input.description ?? null,
        priceCents: input.priceCents,
        compareAtPriceCents: input.compareAtPriceCents ?? null,
        stock: input.stock,
        brand: input.brand ?? null,
        specs: input.specs ?? null,
        weightGrams: input.weightGrams ?? null,
        imageUrl: input.imageUrl ?? null,
      })
      .returning({ id: products.id });

    if (!created) {
      throw new Error("No se pudo crear el producto");
    }

    await logAudit(tx, {
      action: "product.created",
      entityType: "product",
      actorId,
      entityId: created.id,
      changes: {
        after: {
          sku: input.sku,
          name: input.name,
          priceCents: input.priceCents,
        },
      },
    });

    const product = await findInTransaction(tx, created.id);

    if (!product) {
      throw new Error("No se pudo leer el producto recién creado");
    }

    return product;
  });
}

// jsonb y fechas no se comparan bien con `!==`: una referencia nueva siempre difiere.
export const isDifferent = (before: unknown, after: unknown): boolean =>
  JSON.stringify(before ?? null) !== JSON.stringify(after ?? null);

export async function update(
  id: string,
  input: ProductUpdateInput,
  actorId?: string | null,
): Promise<UpdateResult> {
  return db.transaction<UpdateResult>(async (tx) => {
    const before = await findInTransaction(tx, id);

    if (!before) {
      return { ok: false, reason: "not-found" };
    }

    // Diff contra el estado actual ANTES de escribir: un PATCH que no cambia
    // nada no debe tocar la fila, mover `updated_at` ni dejar rastro en
    // `audit_logs` (regla 9, AC16).
    const changedKeys = editableKeys.filter(
      (key) => input[key] !== undefined && isDifferent(before[key], input[key]),
    );

    if (changedKeys.length === 0) {
      return { ok: false, reason: "no-changes" };
    }

    const patch = Object.fromEntries(
      changedKeys.map((key) => [key, input[key]]),
    );

    await tx.update(products).set(patch).where(eq(products.id, id));

    const after = await findInTransaction(tx, id);

    if (!after) {
      return { ok: false, reason: "not-found" };
    }

    await logAudit(tx, {
      action: "product.updated",
      entityType: "product",
      actorId,
      entityId: id,
      changes: {
        before: Object.fromEntries(
          changedKeys.map((key) => [key, before[key]]),
        ),
        after: Object.fromEntries(changedKeys.map((key) => [key, after[key]])),
      },
    });

    return { ok: true, product: after };
  });
}

/** `null` si el id no existe **o si ya estaba eliminado** (ambos son 404). */
export async function softDelete(
  id: string,
  actorId?: string | null,
): Promise<ProductWithCategory | null> {
  return db.transaction(async (tx) => {
    const [deleted] = await tx
      .update(products)
      // reloj de Postgres, igual que created_at/updated_at
      .set({ deletedAt: sql`now()` })
      .where(and(eq(products.id, id), isNull(products.deletedAt)))
      .returning({ id: products.id });

    if (!deleted) {
      return null;
    }

    await logAudit(tx, {
      action: "product.deleted",
      entityType: "product",
      actorId,
      entityId: id,
      changes: { after: { deleted: true } },
    });

    return findInTransaction(tx, id);
  });
}

export async function restore(
  id: string,
  actorId?: string | null,
): Promise<RestoreResult> {
  return db.transaction<RestoreResult>(async (tx) => {
    const [restored] = await tx
      .update(products)
      .set({ deletedAt: null })
      .where(and(eq(products.id, id), isNotNull(products.deletedAt)))
      .returning({ id: products.id });

    if (!restored) {
      const [existing] = await tx
        .select({ id: products.id })
        .from(products)
        .where(eq(products.id, id))
        .limit(1);

      return { ok: false, reason: existing ? "not-deleted" : "not-found" };
    }

    await logAudit(tx, {
      action: "product.restored",
      entityType: "product",
      actorId,
      entityId: id,
      changes: { after: { deleted: false } },
    });

    const product = await findInTransaction(tx, id);

    return product ? { ok: true, product } : { ok: false, reason: "not-found" };
  });
}
