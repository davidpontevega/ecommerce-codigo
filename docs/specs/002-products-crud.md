---
id: 002
title: CRUD de Productos (admin)
status: done
module: products
scope: admin
created: 2026-08-31
---

# 002 — CRUD de Productos (admin)

## Objetivo

Un administrador puede listar, buscar, filtrar, crear, editar, eliminar y restaurar
productos desde `/admin/products`, con paginación y ordenamiento server-side, y cada
mutación queda registrada en `audit_logs` dentro de la misma transacción.

## Alcance

**Incluye:** tabla `products` + migración · repositorio · `GET|POST /api/products`,
`GET|PATCH|DELETE /api/products/[id]` y `POST /api/products/[id]/restore` · módulo
`src/modules/products/` · página `/admin/products` · habilitar el enlace del sidebar.

**No incluye:** auth/RBAC (rutas públicas, ver §Deuda) · `product_images` y galería ·
columna `currency` (USD fijo) · borrado **físico** · storefront · variantes · tests.

> El soft-delete de productos es `deleted_at` (timestamptz nullable), no un booleano.
> `categories` conserva su `is_active` tal como lo dejó el spec 001: **no se toca**.

## Datos

Tabla nueva `products` en `src/server/db/schema/product.ts`. **Requiere migración**
(`npm run db:generate && npm run db:migrate`, aditiva: no toca `categories` ni `audit_logs`).

| Columna | Tipo | Constraint |
|---|---|---|
| `id` | uuid | PK `defaultRandom()` |
| `category_id` | uuid | not null, FK → `categories.id` `onDelete: "restrict"` |
| `sku` | text | not null **unique** |
| `name` | text | not null |
| `slug` | text | not null **unique** |
| `description` | text | nullable |
| `price_cents` | integer | not null (centavos USD) |
| `compare_at_price_cents` | integer | nullable |
| `stock` | integer | not null default `0` |
| `brand` | text | nullable |
| `specs` | jsonb | nullable, `$type<Record<string, string> \| null>()` |
| `weight_grams` | integer | nullable |
| `image_url` | text | nullable |
| `deleted_at` | timestamptz | **nullable, sin default** — `null` = disponible |
| `created_at` | timestamptz | not null `defaultNow()` |
| `updated_at` | timestamptz | not null `defaultNow()`, ``$onUpdate(() => sql`now()`)`` |

Sin columna `is_active`. Índices: `products_category_id_idx`, `products_deleted_at_idx`
(los `unique` de `sku` y `slug` ya crean el suyo). Tipos inferidos con `InferSelectModel`
(regla 5). `updated_at` y `deleted_at` usan el reloj de Postgres (``sql`now()` ``),
**nunca** `new Date()` (mismo bloqueante que en 001).

## API

Sin auth en esta fase. Error uniforme `{ error: string, issues?: unknown }`.

| Método | Ruta | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/api/products` | pública | query (`productQuerySchema`) | `{ data: ProductDto[], total, page, pageSize }` · 400, 500 |
| POST | `/api/products` | pública | `productCreateSchema` | `ProductDto` 201 · 400, 409, 500 |
| GET | `/api/products/[id]` | pública | — | `ProductDto` · 400, 404, 500 |
| PATCH | `/api/products/[id]` | pública | `productUpdateSchema` | `ProductDto` · 400, 404, 409, 500 |
| DELETE | `/api/products/[id]` | pública | — | `ProductDto` (soft-delete) · 400, 404, 500 |
| POST | `/api/products/[id]/restore` | pública | — | `ProductDto` · 400, 404, 409, 500 |

- `PATCH` solo actualiza campos editables y audita `product.updated`. Body vacío o sin
  cambios reales → **400** "Sin cambios que aplicar". `deleted_at` **no** se expone en el body.
- `DELETE` es soft: setea ``deleted_at = sql`now()` `` y audita `product.deleted`.
  **404** si el id no existe **o si ya está eliminado**.
- `POST .../restore` limpia `deleted_at` y audita `product.restored`. **404** si no existe;
  **409** "El producto no está eliminado" si `deleted_at` ya es `null`.

Zod en `src/modules/products/schemas/product.schema.ts`:

- `productSortFields = ["name", "priceCents", "stock", "createdAt", "updatedAt"]`.
- `productQuerySchema`: `search?` (≤100, busca en `name`/`sku`), `categoryId?` (`z.uuid()`),
  `status: z.enum(["available","deleted","all"]).default("available")`,
  `minPriceCents?`/`maxPriceCents?` (`z.coerce.number().int().min(0)`), `page` (default 1),
  `pageSize` (default 20, máx 100), `sortBy` (default `createdAt`), `sortDir` (default `desc`).
- `productCreateSchema`: `categoryId` uuid · `sku` 2–60 trim · `name` 2–160 · `slug` regex
  `/^[a-z0-9]+(?:-[a-z0-9]+)*$/` · `description?` ≤2000 nullish · `priceCents` int `>0` ·
  `compareAtPriceCents?` int `>0` nullish · `stock` int `>=0` default 0 · `brand?` ≤120
  nullish · `specs?` `z.record(z.string(), z.string()).nullish()` · `weightGrams?` int `>0`
  nullish · `imageUrl?` `z.url()` nullish. **Sin `isActive`**: un producto nace no eliminado.
  `.refine()` a nivel objeto: si `compareAtPriceCents` viene, debe ser `> priceCents`.
- `productUpdateSchema = productCreateSchema.partial().refine(v => Object.keys(v).length > 0,
  "Sin cambios que aplicar")`. No hace falta re-extender nada: al no existir `isActive` con
  `.default()`, el bug que evitaba el spec 001 no aplica aquí.
- `productIdSchema = z.uuid()` · `ProductFormValues = z.input<typeof productCreateSchema>`.

Mapeo de errores Postgres en el repositorio: `23505` → 409 distinguiendo por el nombre del
constraint (`products_sku_unique` → "Ya existe un producto con ese SKU";
`products_slug_unique` → "…ese slug"); `23503` → 400 "Categoría no encontrada".

## Reutilizar

Tal cual, sin modificar:

- `src/server/db/index.ts` — `db` + tipo `Transaction`.
- `src/lib/audit.ts` — `logAudit(tx, { action, entityType, entityId, changes })`, `actorId` null.
- `src/lib/axios.ts` — `api` + `ApiError` (`.status` para el 409).
- `src/components/shared/data-table.tsx` — `DataTable`, `DataTableColumnDef<ProductDto>`.
- `src/hooks/use-debounce.ts` · `src/components/ui/{alert-dialog,badge,dialog,dropdown-menu,field,input,select}.tsx`.
- `src/modules/categories/services/category.service.ts` → `listCategories({ status: "active",
  page: 1, pageSize: 100, sortBy: "name", sortDir: "asc" })` para el Select de categoría.
  **No duplicar el service ni el endpoint.**
- Patrones a copiar: `src/server/repositories/category.repository.ts`,
  `src/modules/categories/components/{category-table,category-form-dialog,category-columns}.tsx`.

Sin componentes shadcn nuevos. `Switch` **no** se usa aquí (no hay toggle de estado);
`description` y `specs` van con `Input`, igual que en 001.

## Tareas

- [x] **T1** — Schema Drizzle de `products` con FK, uniques, `deleted_at` e índices · `src/server/db/schema/product.ts`
- [x] **T2** — Re-exportar `products`/`Product`/`NewProduct` en el barrel · `src/server/db/schema/index.ts`
- [x] **T3** — Generar y aplicar la migración · `drizzle/**` · `npm run db:generate && npm run db:migrate`
- [x] **T4** — Schemas Zod de §API · `src/modules/products/schemas/product.schema.ts`
- [x] **T5** — Tipos: `ProductDto` (fechas ISO, `deletedAt: string | null`, `categoryName: string`) y `ProductListResponse` · `src/modules/products/types/product.types.ts`
- [x] **T6** — Repositorio `list`/`findById`/`create`/`update`/`softDelete`/`restore`, con `innerJoin` a `categories` para `categoryName`, filtro de `status` sobre `deleted_at`, las cuatro mutaciones en `db.transaction` + `logAudit`, y helper que lee el constraint del error `23505` · `src/server/repositories/product.repository.ts`
- [x] **T7** — `GET` + `POST` · `src/app/api/products/route.ts`
- [x] **T8** — `GET` + `PATCH` + `DELETE` (soft) · `src/app/api/products/[id]/route.ts`
- [x] **T9** — `POST` de restauración (404 / 409) · `src/app/api/products/[id]/restore/route.ts`
- [x] **T10** — Service tipado (`listProducts`, `getProduct`, `createProduct`, `updateProduct`, `deleteProduct`, `restoreProduct`) · `src/modules/products/services/product.service.ts`
- [x] **T11** — `useProducts(params)` con `keepPreviousData` y `productsQueryKey` · `src/modules/products/hooks/use-products.ts`
- [x] **T12** — `useCreateProduct`, `useUpdateProduct`, `useDeleteProduct`, `useRestoreProduct` (invalidan + toast; 409 silenciado para el form) · `src/modules/products/hooks/use-product-mutations.ts`
- [x] **T13** — Columnas v9: nombre, SKU, categoría, precio (formateado desde centavos con `Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })` — locale `en-US` porque AC15 fija `$1,299.99`; `es` daría `1299,99 US$`), stock, estado (`Badge` "Disponible"/"Eliminado" según `deletedAt`), acciones (`DropdownMenu`: Editar — deshabilitado si está eliminado — más Eliminar o Restaurar según estado) · `src/modules/products/components/product-columns.tsx`
- [x] **T14** — Diálogo de formulario: RHF + `zodResolver`, slug autogenerado del nombre, editor de `specs` como lista de pares clave/valor, 409 → `setError` en `sku` o `slug` según el mensaje · `src/modules/products/components/product-form-dialog.tsx`
- [x] **T15** — `<ProductTable>`: buscador debounced, Select de categoría (alimentado por `listCategories`), Select de estado (Disponibles / Eliminados / Todos), inputs de rango de precio, `AlertDialog` de confirmación **solo** para Eliminar, y `<DataTable>` · `src/modules/products/components/product-table.tsx`
- [x] **T16** — Página Server Component con encabezado "Productos" · `src/app/(admin)/admin/products/page.tsx`
- [x] **T17** — Habilitar el enlace "Productos" del sidebar (hoy es un `<span aria-disabled>`) · `src/app/(admin)/admin/layout.tsx`
- [x] **T18** — Verificación final y recorrido manual de los AC · `npm run typecheck && npm run lint`

**Total: 18 tareas.**

## Criterios de aceptación

- [ ] **AC1** — Con 25 productos disponibles, `/admin/products` muestra la primera página
  (20 filas), el total y la paginación; ir a la página 2 dispara la petición con `page=2`.
- [ ] **AC2** — Escribir "gtx" en el buscador dispara **una** petición tras el debounce con
  `search=gtx` y devuelve solo productos cuyo `name` o `sku` lo contienen (case-insensitive).
- [ ] **AC3** — El Select de estado manda `status=available|deleted|all` y filtra por
  `deleted_at`: `available` → `IS NULL`, `deleted` → `IS NOT NULL`, `all` → sin filtro.
  Sin tocar el Select, la petición lleva `status=available`.
- [ ] **AC4** — El Select de categoría lleva `categoryId=<uuid>` a la query y filtra.
- [ ] **AC5** — El rango de precio lleva `minPriceCents`/`maxPriceCents` y excluye lo que cae fuera.
- [ ] **AC6** — Clic en el encabezado `Precio` pide `sortBy=priceCents&sortDir=asc` (`desc` al
  segundo clic); el orden lo resuelve Postgres.
- [ ] **AC7** — Crear con datos válidos responde 201, cierra el diálogo, muestra toast y refresca la tabla.
- [ ] **AC8** — SKU o slug duplicado responde **409**, el diálogo sigue abierto y el mensaje
  aparece bajo el campo correcto (`sku` o `slug` según cuál colisionó).
- [ ] **AC9** — `POST` con `categoryId` que no existe responde **400** "Categoría no encontrada".
- [ ] **AC10** — Editar responde 200 y su `updated_at` es posterior al valor previo y `> created_at`.
- [ ] **AC11** — "Eliminar" + confirmación en el `AlertDialog` setea `deleted_at`; el producto
  desaparece del filtro por defecto "Disponibles" y sigue visible en "Eliminados" y "Todos",
  con el Badge *Eliminado* y la acción "Editar" deshabilitada.
- [ ] **AC12** — "Restaurar" sobre un producto eliminado limpia `deleted_at` y vuelve a aparecer
  en "Disponibles".
- [ ] **AC13** — `DELETE` sobre un producto **ya eliminado** responde **404**; `POST .../restore`
  sobre un producto **no eliminado** responde **409** "El producto no está eliminado".
- [ ] **AC14** — `specs` guardado como pares clave/valor se persiste en `jsonb` y reaparece en el
  formulario al reabrir para editar.
- [ ] **AC15** — `price_cents = 129999` se muestra como `$1,299.99`; el valor viaja siempre en centavos.
- [ ] **AC16** — Cada mutación deja exactamente una fila en `audit_logs` con `action` =
  `product.created|updated|deleted|restored`, `entity_type = 'product'`, `entity_id` = id del
  producto y `actor_id = null`; si la transacción revierte, no queda fila.
- [ ] **AC17** — `POST` con `priceCents: 0` o `compareAtPriceCents <= priceCents` responde **400**
  con el detalle de Zod y no toca la base de datos.
- [ ] **AC18** — `GET /api/products/<uuid-inexistente>` → **404**; id no-UUID → **400**;
  `PATCH` con body `{}` → **400** "Sin cambios que aplicar".
- [ ] **AC19** — La tabla muestra skeletons mientras carga, mensaje + "Reintentar" si falla, y
  estado vacío si no hay filas.
- [ ] **AC20** — `npm run typecheck && npm run lint && npm run build` en verde.

## Notas

- **Precio en `en-US`**: la columna formatea con locale `en-US` (símbolo antepuesto,
  coma de millares, punto decimal) aunque el resto de la UI esté en español, porque AC15
  lo fija literalmente como `$1,299.99`.
- **PATCH sin cambios reales → 400**: el repositorio hace el diff de `input` contra el
  estado actual **antes** del `UPDATE`. Si no cambia ninguna clave editable, aborta sin
  tocar la fila ni `audit_logs` y el handler devuelve 400 "Sin cambios que aplicar"
  (mismo código y mensaje que el body `{}`). Garantiza "una fila de auditoría por
  mutación real" (AC16, regla 9).
- **`deleted_at` en vez de booleano**: guarda *cuándo* se eliminó, no solo *que* se eliminó.
  El default de la query es `available`, así que ningún consumidor futuro ve productos
  eliminados por olvidar un filtro.
- **Editar un producto eliminado** está bloqueado en la UI, pero el `PATCH` lo permitiría.
  Se acepta: un producto eliminado no se lista por defecto y el `deleted_at` no se toca desde
  el body. Se cierra con el guard del spec de RBAC, no con un `if` extra aquí.
- **`onDelete: "restrict"`** en la FK: hoy nunca se dispara, porque categorías solo se
  desactiva (`is_active = false`), no se borra. Es la red por si aparece un borrado físico.
  Desactivar una categoría **no** elimina sus productos (fuera de alcance).
- **Sin N+1**: el listado son dos consultas (página con `innerJoin` a `categories` + `count`).
  Cualquier columna futura que consulte por fila va en el `join`.
- **Constraint duplicado**: no pre-chequear `sku`/`slug` antes del insert (carrera TOCTOU); la
  única fuente de verdad es el `UNIQUE`, y el 409 sale de mapear `23505`. Ojo: el `UNIQUE` de
  `sku`/`slug` **no** excluye eliminados, así que un SKU liberado por un soft-delete sigue
  ocupado. Es intencional: el SKU es identidad, no un nombre reutilizable.
- **`specs` sin validación de esquema**: `Record<string, string>` libre. Si el catálogo necesita
  specs tipadas por categoría, es un spec nuevo, no un `if` creciente aquí.
- **Rollback**: `DROP TABLE products;` + borrar el archivo de `drizzle/`. Base vacía, sin backfill.

## Deuda aceptada

Mismo bloque que `docs/specs/001-categories-crud.md` §11, extendido a productos:
`/admin/products` y `/api/products/*` quedan **públicas**, sin RBAC ni `requirePermission`,
sin tocar `src/proxy.ts`, y `audit_logs.actor_id` se escribe `null`. Se incumplen la regla 8 de
`CLAUDE.md` y la parte de "actor" de la regla 9. **No desplegar a un entorno accesible desde
internet** hasta cerrar el spec de RBAC, que además debe mover las rutas de escritura bajo
`/api/admin/`, poblar `actor_id` y añadir la FK `audit_logs.actor_id → users.id`.

Diferido también: purga física de productos eliminados (job de retención) y vista
`/admin/audit-logs`.
