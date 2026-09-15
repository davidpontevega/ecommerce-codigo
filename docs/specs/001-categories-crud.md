---
id: 001
title: Infraestructura compartida + CRUD de Categorías (admin)
status: done
module: categories        # dominio declarado en docs/SETUP.md §3 (`modules/<dominio>`)
scope: admin
created: 2026-08-31
---

# 001 — Infraestructura compartida + CRUD de Categorías (admin)

## 1. Contexto

El repositorio es un scaffold verificado: existen `src/app/layout.tsx` (solo con
`ClerkProvider`), `src/proxy.ts` (Clerk sin matchers, todo público), 16 componentes
en `src/components/ui/`, `drizzle.config.ts` apuntando a `src/server/db/schema`, y
el resto de carpetas de `docs/SETUP.md` §3 con `.gitkeep`. **No hay cliente Drizzle,
ni schema, ni repositorios, ni Route Handlers, ni QueryProvider, ni instancia axios,
ni componente de tabla.**

El panel de administración necesita gestionar la taxonomía del catálogo. Categorías
es la primera sección porque `products.category_id` dependerá de ella. Como no
existe nada de la capa de datos ni de la capa de red del cliente, esta feature
arrastra la infraestructura compartida (Fase 0) que la Fase 2 (productos) reutilizará
sin cambios.

## 2. Objetivo

Un administrador puede listar, buscar, filtrar, crear, editar, desactivar y reactivar
categorías desde `/admin/categories`, con paginación y ordenamiento server-side, y
cada mutación queda registrada en `audit_logs` dentro de la misma transacción.

## 3. Alcance

### Incluye

**Fase 0 — infraestructura compartida**
- Cliente Drizzle sobre Neon (`drizzle-orm/neon-serverless` + `Pool`).
- Tabla `audit_logs` + helper transaccional `logAudit(tx, {...})`.
- Instancia única de axios con desempaquetado de errores.
- `QueryClient`, `QueryProvider` y cableado en `src/app/layout.tsx` (+ `<Toaster />`).
- Hook `useDebounce`.
- Componente genérico `<DataTable>` (TanStack Table **v9**) en modo server-side.
- Layout del área admin (`src/app/(admin)/admin/layout.tsx`) con sidebar, sin guard.
- Componentes shadcn faltantes: `alert-dialog`, `switch`.

**Fase 1 — sección Categorías**
- Tabla `categories` (plana, con soft-delete) + migración.
- Repositorio con `list/findById/findBySlug/create/update/setActive`.
- Route Handlers `GET|POST /api/categories` y `GET|PATCH /api/categories/[id]`.
- Módulo cliente `src/modules/categories/` (schemas, service, hooks, componentes, types).
- Página `/admin/categories`.

### No incluye (explícito)

- Autenticación, autorización, RBAC, `requirePermission`, cambios en `proxy.ts`.
  Decisión del usuario: `/admin/*` y `/api/categories/*` quedan **públicas**.
- Tablas `users`, `roles`, `permissions`, `role_permissions`, `user_roles`.
- FK `audit_logs.actor_id → users.id`. La columna existe y se escribe `null`.
- Jerarquía de categorías (`parent_id`) y borrado físico (no hay endpoint `DELETE`).
- Tabla `products` y todo lo relativo a la Fase 2.
- Vista de bitácora `/admin/audit-logs` (la tabla se escribe, no se lee desde la UI).
- `src/server/db/seed.ts` (el script `db:seed` seguirá fallando).
- Storefront, dashboard, tests automatizados.

## 4. Criterios de aceptación

- [x] **AC1** — Dado que existen 25 categorías, cuando abro `/admin/categories`,
  entonces la tabla muestra la primera página (10 filas), el total y los controles
  de paginación; navegar a la página 2 dispara una petición con `page=2`.
- [x] **AC2** — Dado el buscador vacío, cuando escribo "note", entonces tras el
  debounce se dispara **una** petición con `search=note` y la tabla muestra solo
  categorías cuyo `name` o `slug` contienen "note" (case-insensitive).
- [x] **AC3** — Dado el filtro de estado, cuando elijo Activas / Inactivas / Todas,
  entonces la petición lleva `status=active|inactive|all` y el resultado corresponde.
- [x] **AC4** — Dado el listado, cuando hago clic en el encabezado `Nombre`,
  entonces la petición lleva `sortBy=name&sortDir=asc` (y `desc` al segundo clic);
  el orden lo resuelve Postgres, no el navegador.
- [x] **AC5** — Dado el diálogo "Nueva categoría", cuando envío nombre y slug
  válidos, entonces la API responde 201, el diálogo se cierra, aparece un toast de
  éxito y la tabla se refresca con la nueva fila.
- [x] **AC6** — Dado un slug ya existente, cuando lo envío, entonces la API responde
  **409**, el diálogo permanece abierto y el mensaje se muestra bajo el campo `slug`.
- [x] **AC7** — Dada una categoría existente, cuando la edito y guardo, entonces la
  API responde 200 y su `updated_at` es posterior al valor previo.
- [x] **AC8** — Dada una categoría activa, cuando elijo "Desactivar" y confirmo en el
  `AlertDialog`, entonces pasa a `is_active = false`, se muestra como *Inactiva* y
  sigue visible con el filtro "Todas".
- [x] **AC9** — Dada una categoría inactiva, cuando elijo "Reactivar", entonces
  vuelve a `is_active = true`.
- [x] **AC10** — Dada cualquier mutación (crear / editar / desactivar / reactivar),
  cuando termina con éxito, entonces existe exactamente una fila nueva en
  `audit_logs` con `action` igual a `category.created` | `category.updated` |
  `category.deactivated` | `category.reactivated`, `entity_type = 'category'`,
  `entity_id` = id de la categoría y `actor_id = null`.
- [x] **AC11** — Dada una mutación que falla en la base de datos, cuando revierte la
  transacción, entonces **no** queda fila en `audit_logs` (mismo `tx`).
- [x] **AC12** — Dada la carga inicial, cuando la query está pendiente, entonces la
  tabla muestra skeletons; si la query falla, muestra mensaje de error + botón
  "Reintentar"; si devuelve 0 filas, muestra el estado vacío.
- [x] **AC13** — Dado `POST /api/categories` con `{ name: "" }`, entonces responde
  **400** con el detalle de Zod y no toca la base de datos.
- [x] **AC14** — Dado `GET /api/categories/<uuid-inexistente>`, entonces responde
  **404**; dado un id que no es UUID, responde **400**.
- [x] **AC15** — `npm run typecheck && npm run lint && npm run build` en verde.

## 5. Modelo de datos

Dos tablas nuevas. **Requiere migración** (`npm run db:generate` + `npm run db:migrate`).
Tipos inferidos, nunca duplicados a mano (regla 5).

### `audit_logs` — `src/server/db/schema/audit-log.ts`

Columnas según `docs/SETUP.md` §5.2, con una desviación: `actor_id` es `uuid`
nullable **sin foreign key**, porque la tabla `users` no existe todavía.

```ts
// src/server/db/schema/audit-log.ts — firma propuesta
export const auditSeverity = pgEnum("audit_severity", ["info", "warning", "error"]);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // ponytail: sin FK a users porque la tabla no existe; se añade en la fase RBAC
    actorId: uuid("actor_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    changes: jsonb("changes").$type<Record<string, unknown> | null>(),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    ipAddress: inet("ip_address"),
    userAgent: text("user_agent"),
    severity: auditSeverity("severity").notNull().default("info"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_logs_entity_idx").on(t.entityType, t.entityId),
    index("audit_logs_action_idx").on(t.action),
    index("audit_logs_created_at_idx").on(t.createdAt.desc()),
  ],
);

export type AuditLog = InferSelectModel<typeof auditLogs>;
export type NewAuditLog = InferInsertModel<typeof auditLogs>;
```

Append-only por convención: nadie escribe `UPDATE` ni `DELETE` sobre esta tabla.
El índice `(actor_id, created_at desc)` de SETUP.md §5.2 se difiere: hoy la columna
es siempre `null` (ver §11).

### `categories` — `src/server/db/schema/category.ts`

| Columna | Tipo | Nota |
|---|---|---|
| `id` | `uuid` PK, `defaultRandom()` | |
| `name` | `text` not null | |
| `slug` | `text` not null **unique** | derivado del nombre en el form, editable |
| `description` | `text` nullable | |
| `is_active` | `boolean` not null default `true` | soft-delete = `false` |
| `created_at` | `timestamptz` not null default `now()` | |
| `updated_at` | `timestamptz` not null default `now()` | ``$onUpdate(() => sql`now()`)`` |

```ts
// src/server/db/schema/category.ts — firma propuesta
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => sql`now()`),
  },
  (t) => [index("categories_is_active_idx").on(t.isActive)],
);

export type Category = InferSelectModel<typeof categories>;
export type NewCategory = InferInsertModel<typeof categories>;
```

El `unique` sobre `slug` es la única defensa contra duplicados; no hay pre-chequeo
en el repositorio (ver §8).

## 6. Contratos de API

Ninguna ruta lleva auth en esta fase (decisión del usuario). Todas validan con Zod
antes de tocar el repositorio (regla 4). Formato de error uniforme:
`{ error: string, issues?: unknown }`.

| Método | Ruta | Auth | Request | Response | Errores |
|---|---|---|---|---|---|
| GET | `/api/categories` | pública | query: `search?`, `status?`, `page?`, `pageSize?`, `sortBy?`, `sortDir?` | `{ data: Category[], total: number, page: number, pageSize: number }` | 400, 500 |
| POST | `/api/categories` | pública | `CategoryCreateInput` | `Category` (201) | 400, 409, 500 |
| GET | `/api/categories/[id]` | pública | — | `Category` | 400, 404, 500 |
| PATCH | `/api/categories/[id]` | pública | `CategoryUpdateInput` | `Category` | 400, 404, 409, 500 |

No existe `DELETE`: "eliminar" en la UI es `PATCH { isActive: false }`.

### Schemas Zod — `src/modules/categories/schemas/category.schema.ts`

Un solo archivo, consumido por el Route Handler (servidor) y por el formulario
(cliente). Zod 4.

```ts
export const categorySortFields = ["name", "createdAt", "updatedAt"] as const;

export const categoryQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(["active", "inactive", "all"]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z.enum(categorySortFields).default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(2, "Mínimo 2 caracteres").max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(140)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Solo minúsculas, números y guiones"),
  description: z.string().trim().max(1000).nullish(),
  isActive: z.boolean().default(true),
});

export const categoryUpdateSchema = categoryCreateSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Sin cambios que aplicar");

export const categoryIdSchema = z.uuid();

export type CategoryQueryInput = z.infer<typeof categoryQuerySchema>;
export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;
```

Respuesta de listado (tipo, no schema de validación — el cliente confía en su
propia API):

```ts
export type CategoryListResponse = {
  data: Category[];
  total: number;
  page: number;
  pageSize: number;
};
```

## 7. Arquitectura y archivos afectados

Mapa capa por capa según `docs/SETUP.md` §3.

**Servidor / datos**
- `src/server/db/index.ts` — **nuevo**. `Pool` de `@neondatabase/serverless` +
  `drizzle` de `drizzle-orm/neon-serverless`. Pool cacheado en `globalThis` para no
  filtrar conexiones con el HMR de dev.
- `src/server/db/schema/audit-log.ts` — **nuevo**.
- `src/server/db/schema/category.ts` — **nuevo**.
- `src/server/db/schema/index.ts` — **nuevo**. Barrel que re-exporta ambas tablas.
- `src/server/repositories/category.repository.ts` — **nuevo**. Única capa que
  consulta la BD para este dominio (regla 3).
- `drizzle/` — **nuevo**. Migración generada por drizzle-kit.

**Lib compartida**
- `src/lib/audit.ts` — **nuevo**. `logAudit(tx, {...})`.
- `src/lib/axios.ts` — **nuevo**. Instancia única + `ApiError`.
- `src/lib/query-client.ts` — **nuevo**. Factory del `QueryClient`.

**API**
- `src/app/api/categories/route.ts` — **nuevo**. `GET` + `POST`.
- `src/app/api/categories/[id]/route.ts` — **nuevo**. `GET` + `PATCH`.

**Componentes transversales**
- `src/components/providers/query-provider.tsx` — **nuevo**. `"use client"`.
- `src/components/shared/data-table.tsx` — **nuevo**. `"use client"`, genérico.
- `src/components/ui/alert-dialog.tsx`, `src/components/ui/switch.tsx` — **nuevos**
  vía `npx shadcn@latest add` (nunca escritos a mano).
- `src/hooks/use-debounce.ts` — **nuevo**.

**Módulo cliente `src/modules/categories/`**
- `types/category.types.ts` — re-export de `Category` / `NewCategory`.
- `schemas/category.schema.ts` — Zod (§6).
- `services/category.service.ts` — llamadas axios tipadas.
- `hooks/use-categories.ts` — `useQuery`.
- `hooks/use-category-mutations.ts` — `useMutation` ×3 + invalidación.
- `components/category-columns.tsx` — `ColumnDef` v9.
- `components/category-table.tsx` — orquesta estado de query params + `<DataTable>`.
- `components/category-form-dialog.tsx` — `Dialog` + RHF + `zodResolver` + `Field`.

**App**
- `src/app/layout.tsx` — **modificado**. Envolver `children` en `<QueryProvider>`
  dentro de `<ClerkProvider>` y añadir `<Toaster />` de `sonner`.
- `src/app/(admin)/admin/layout.tsx` — **nuevo**. Server Component, sidebar, sin guard.
- `src/app/(admin)/admin/categories/page.tsx` — **nuevo**. Server Component mínimo.

**Sin tocar:** `src/proxy.ts`, `src/app/(auth)/**`, `src/app/page.tsx`,
`drizzle.config.ts` (ya apunta a `src/server/db/schema`).

## 8. Decisiones técnicas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| `drizzle-orm/neon-serverless` + `Pool` | `drizzle-orm/neon-http` + `neon()` | `neon-http` no soporta `db.transaction()`. La regla 9 de CLAUDE.md exige que `logAudit` corra en la misma transacción que la mutación. Verificado: `@neondatabase/serverless@1.1.0` exporta `Pool`. |
| Pool cacheado en `globalThis` | Pool nuevo por módulo | En dev el HMR recarga el módulo y deja pools huérfanos consumiendo el límite de conexiones de Neon. |
| Tipo de la transacción derivado: `Parameters<Parameters<typeof db.transaction>[0]>[0]` | Escribir a mano el tipo `PgTransaction<...>` genérico | Una línea, siempre sincronizado con el cliente; el genérico manual de Drizzle es ilegible y se rompe al cambiar de driver. |
| Slug duplicado: dejar fallar el `UNIQUE` y mapear el código Postgres `23505` → 409 | `findBySlug()` antes del insert | El pre-chequeo tiene una carrera TOCTOU: dos requests simultáneos pasan la validación y uno explota con 500. El constraint es la única fuente de verdad. |
| Tabla y filtros **server-side** (`manualSorting`/`manualPagination`) | Cargar todo y filtrar en el cliente | La Fase 2 (productos) reutiliza el mismo `<DataTable>` con volúmenes mayores; hacerlo client-side ahora obliga a reescribirlo después. |
| TanStack Table **v9** | v8 (lo que dice CLAUDE.md §5) | v9.2.3 es lo instalado y su API es una reescritura: `useTable(options, selector?)`, `tableFeatures({...})`, `table.FlexRender`. Verificado en `node_modules/@tanstack/react-table/dist/useTable.d.ts`. Memoria `bootstrap-deviations`. |
| Formularios con `Field`/`FieldError` + RHF | Componente `Form` de shadcn | El estilo `base-nova` no publica `form.tsx`. Verificado: `src/components/ui/field.tsx` exporta `FieldError` con prop `errors?: Array<{ message?: string }>`, que encaja directo con `formState.errors.<campo>`. |
| Un solo archivo Zod compartido servidor/cliente | Un schema en el handler y otro en el form | DRY con criterio: dos consumidores reales del mismo contrato; duplicarlo garantiza que se desincronicen. |
| Soft-delete exclusivo, sin `DELETE` | Borrado físico | Decisión del usuario. Además preserva la integridad futura de `products.category_id` y deja rastro auditable. |
| ``updated_at` con `$onUpdate(() => sql`now()`)`` | Setearlo a mano en cada `update()`, o `$onUpdate(() => new Date())` | Una línea en el schema, imposible de olvidar en un handler nuevo. Y en el reloj de Postgres, igual que `created_at`: con `new Date()` el desfase entre el reloj de Node y el de la BD podía dejar `updated_at` anterior a `created_at` (rompe AC7 y el orden por `updatedAt`). |
| `ApiError extends Error` con `status` en el interceptor de axios | Propagar el `AxiosError` crudo | El formulario necesita distinguir 409 (slug duplicado, error de campo) de 500 (toast genérico) sin importar axios en un componente. |
| Dos queries en `list()` (filas + `count`) | `count(*) OVER ()` en la misma query | Dos SELECT simples, planes de ejecución claros y reutilizables. La ventana se justifica solo si el conteo aparece en un profiling. |
| Estado vacío y skeleton dentro de `data-table.tsx` | Componente `empty-state.tsx` aparte | Un solo consumidor hoy. Se extrae cuando haya un tercero (regla DRY del CLAUDE.md §6). |
| **Sin autenticación** en `/admin/*` y `/api/categories/*` | RBAC completo antes del CRUD | Decisión explícita del usuario. Desviación consciente de las reglas 8 y de la parte de "actor" de la regla 9. Registrada como deuda en §11. |

## 9. Tareas

### Fase 0 — infraestructura compartida

- [x] **T1** — Añadir los componentes shadcn faltantes con
  `npx shadcn@latest add alert-dialog switch` · archivos: `src/components/ui/alert-dialog.tsx`,
  `src/components/ui/switch.tsx` · verificación: ambos archivos existen y `npm run typecheck` pasa.
- [x] **T2** — Crear el cliente Drizzle sobre `neon-serverless` + `Pool`, con el pool
  cacheado en `globalThis` y `DATABASE_URL` obligatoria (fallo explícito si falta) ·
  archivo: `src/server/db/index.ts` · verificación: `npm run typecheck`.
- [x] **T3** — Definir el schema de `audit_logs` con su enum `audit_severity` y los
  tres índices · archivo: `src/server/db/schema/audit-log.ts` · verificación: `npm run typecheck`.
- [x] **T4** — Definir el schema de `categories` con `slug` único e índice en
  `is_active` · archivo: `src/server/db/schema/category.ts` · verificación: `npm run typecheck`.
- [x] **T5** — Crear el barrel que re-exporta ambas tablas · archivo:
  `src/server/db/schema/index.ts` · verificación: `npm run typecheck`.
- [x] **T6** — Generar y aplicar la migración · archivos: `drizzle/**` (generados) ·
  verificación: `npm run db:generate && npm run db:migrate`, luego `npm run db:studio`
  muestra `categories` y `audit_logs`.
- [x] **T7** — Implementar `logAudit(tx, { action, entityType, entityId?, changes?, metadata?, severity? })`,
  con el tipo de `tx` derivado de `db.transaction` · archivo: `src/lib/audit.ts` ·
  verificación: `npm run typecheck`.
- [x] **T8** — Crear la instancia única de axios (`baseURL` desde
  `NEXT_PUBLIC_APP_URL` o `/api` relativo) y el interceptor de respuesta que
  convierte el fallo en `ApiError { message, status }` · archivo: `src/lib/axios.ts` ·
  verificación: `npm run typecheck`.
- [x] **T9** — Crear el factory del `QueryClient` con defaults
  (`staleTime`, `retry`, `refetchOnWindowFocus: false`) · archivo:
  `src/lib/query-client.ts` · verificación: `npm run typecheck`.
- [x] **T10** — Crear el `QueryProvider` (`"use client"`, `QueryClientProvider` +
  devtools solo en dev) · archivo: `src/components/providers/query-provider.tsx` ·
  verificación: `npm run typecheck`.
- [x] **T11** — Envolver `children` en `<QueryProvider>` dentro de `<ClerkProvider>`
  y añadir `<Toaster />` de `sonner` · archivo: `src/app/layout.tsx` ·
  verificación: `npm run build`.
- [x] **T12** — Implementar `useDebounce<T>(value, delay)` genérico · archivo:
  `src/hooks/use-debounce.ts` · verificación: `npm run typecheck`.
- [x] **T13** — Implementar el `<DataTable>` genérico contra TanStack Table v9 en
  modo server-side (features estáticas fuera del componente; `manualSorting`,
  `manualPagination`, `rowCount`, estado controlado por props; skeleton, estado de
  error con reintento y estado vacío) · archivo: `src/components/shared/data-table.tsx` ·
  verificación: `npm run typecheck`.
- [x] **T14** — Crear el layout del área admin con sidebar (enlaces "Categorías" y
  "Productos" deshabilitado), textos en español, **sin guard de rol** · archivo:
  `src/app/(admin)/admin/layout.tsx` · verificación: `npm run build`.

### Fase 1 — sección Categorías

- [x] **T15** — Implementar el repositorio: `list`, `findById`, `findBySlug`,
  `create`, `update`, `setActive`; las tres mutaciones dentro de `db.transaction`
  con su `logAudit` correspondiente · archivo:
  `src/server/repositories/category.repository.ts` · verificación: `npm run typecheck`.
- [x] **T16** — Re-exportar los tipos inferidos del schema Drizzle (sin redeclararlos) ·
  archivo: `src/modules/categories/types/category.types.ts` · verificación: `npm run typecheck`.
- [x] **T17** — Escribir los schemas Zod de §6 · archivo:
  `src/modules/categories/schemas/category.schema.ts` · verificación: `npm run typecheck`.
- [x] **T18** — Implementar `GET` (parsea query con `categoryQuerySchema`) y `POST`
  (parsea body con `categoryCreateSchema`, mapea `23505` → 409) · archivo:
  `src/app/api/categories/route.ts` · verificación: `curl` a `/api/categories`
  devuelve `{ data: [], total: 0, ... }` y un body inválido devuelve 400.
- [x] **T19** — Implementar `GET` (404 si no existe) y `PATCH` (`categoryUpdateSchema`,
  404 / 409) validando el `id` con `categoryIdSchema` · archivo:
  `src/app/api/categories/[id]/route.ts` · verificación: `curl` con un uuid
  inexistente devuelve 404 y con un id no-uuid devuelve 400.
- [x] **T20** — Implementar el service tipado (`listCategories`, `getCategory`,
  `createCategory`, `updateCategory`, `setCategoryActive`) usando la instancia de
  axios · archivo: `src/modules/categories/services/category.service.ts` ·
  verificación: `npm run typecheck`.
- [x] **T21** — Implementar `useCategories(params)` con `queryKey ["categories", params]`
  y `placeholderData` para no parpadear al paginar · archivo:
  `src/modules/categories/hooks/use-categories.ts` · verificación: `npm run typecheck`.
- [x] **T22** — Implementar `useCreateCategory`, `useUpdateCategory` y
  `useSetCategoryActive`, todas invalidando `["categories"]` y emitiendo toast ·
  archivo: `src/modules/categories/hooks/use-category-mutations.ts` ·
  verificación: `npm run typecheck`.
- [x] **T23** — Definir las columnas (`nombre`, `slug`, `estado` con `Badge`,
  `creada`, acciones con `DropdownMenu`), encabezados en español · archivo:
  `src/modules/categories/components/category-columns.tsx` · verificación: `npm run typecheck`.
- [x] **T24** — Implementar el diálogo de formulario (crear y editar) con RHF +
  `zodResolver`, `Field`/`FieldError`, `Switch` para `isActive`, autogeneración del
  slug desde el nombre al crear y mapeo del 409 al campo `slug` · archivo:
  `src/modules/categories/components/category-form-dialog.tsx` ·
  verificación: `npm run typecheck`.
- [x] **T25** — Implementar `<CategoryTable>`: estado de `search`/`status`/`sorting`/
  `pagination`, buscador debounced, `Select` de estado, `AlertDialog` de confirmación
  para desactivar, y montaje de `<DataTable>` · archivo:
  `src/modules/categories/components/category-table.tsx` · verificación: `npm run typecheck`.
- [x] **T26** — Crear la página: Server Component con encabezado "Categorías",
  botón "Nueva categoría" y `<CategoryTable />` · archivo:
  `src/app/(admin)/admin/categories/page.tsx` · verificación: `npm run build`.
- [x] **T27** — Verificación final y recorrido manual del §"Verificación" del plan ·
  sin archivo · verificación: `npm run typecheck && npm run lint && npm run build`,
  y `npm run db:studio` muestra una fila en `audit_logs` por cada mutación con
  `actor_id = null`.

**Total: 27 tareas.**

## 10. Riesgos y consideraciones

- **Rutas públicas.** `POST`/`PATCH` en `/api/categories` los puede llamar cualquiera
  sin sesión. Es el riesgo dominante de esta fase y es una decisión consciente del
  usuario; no desplegar a un entorno accesible desde internet hasta cerrar la deuda
  de RBAC (§11).
- **WebSocket del driver Neon.** `neon-serverless` usa WebSocket. Node 24.15 (el del
  entorno, verificado) trae `WebSocket` global, así que no hace falta la dependencia
  `ws` (**no está instalada**). Si el build falla con "WebSocket not defined", la
  salida es `neonConfig.webSocketConstructor = ws` tras instalar `ws`, no cambiar de
  driver. Los Route Handlers deben quedarse en runtime Node: **no** declarar
  `export const runtime = "edge"`.
- **Fuga de conexiones en dev.** Sin el cacheo del `Pool` en `globalThis`, cada
  recarga de HMR abre un pool nuevo y se agota el límite de Neon. Es la causa típica
  de "too many connections" en desarrollo.
- **TanStack Table v9 es una API joven.** Reescritura respecto de v8: `useTable`
  recibe `{ features, columns, data }` construido con `tableFeatures({ rowSortingFeature,
  rowPaginationFeature, sortedRowModel: createSortedRowModel(), paginatedRowModel:
  createPaginatedRowModel() })`, y `ColumnDef` es `ColumnDef<TFeatures, TData, TValue>`
  (tres genéricos, no dos). La documentación pública puede seguir mostrando v8; la
  fuente de verdad son los `.d.ts` de `node_modules/@tanstack/table-core`.
- **`npm run typecheck` requiere typegen.** El script es `next typegen && tsc --noEmit`
  y `src/app/layout.tsx` usa `LayoutProps<"/">`; en un clon limpio `tsc` solo falla.
- **Sin N+1.** El listado hace exactamente dos consultas (página + total). Cualquier
  columna futura que consulte por fila debe resolverse con `join`, no en bucle.
- **Crecimiento de `audit_logs`.** Cuatro acciones por categoría son inofensivas hoy,
  pero la política de retención (180 días para `info`) no está implementada.
- **Sin datos existentes.** La base está vacía: no hay backfill ni riesgo de migración
  destructiva.
- **Rollback.** drizzle-kit no genera migraciones de bajada. Revertir esta feature es
  `DROP TABLE categories, audit_logs; DROP TYPE audit_severity;` y borrar el archivo
  de `drizzle/`. Anotarlo antes de aplicar en cualquier base con datos.
- **Enum de Postgres.** `audit_severity` es un tipo, no una tabla: añadir valores
  después requiere `ALTER TYPE ... ADD VALUE`, que no es transaccional en Postgres.

## 11. Fuera de alcance / deuda aceptada

**Deuda de seguridad — la más urgente.** Se difieren, en bloque, todos los controles
de acceso: tablas `users` / `roles` / `permissions` / `role_permissions` / `user_roles`,
seed de permisos, webhook de Clerk (`user.created|updated|deleted`), `src/lib/auth.ts`,
`src/lib/permissions.ts` con `requirePermission('categories.create')`, y los
`createRouteMatcher` de `/admin` y `/api/admin` en `src/proxy.ts`. Mientras tanto
`/admin/*` y `/api/categories/*` son públicas y **no se cumplen** la regla 8 de
CLAUDE.md ni la parte de "actor" de la regla 9. Se retoma **antes de cualquier
despliegue accesible desde internet**, en un spec propio de RBAC que además debe:
añadir la FK `audit_logs.actor_id → users.id`, poblar `actor_id` con el usuario real,
crear el índice `(actor_id, created_at desc)` y mover las rutas de escritura de
categorías bajo `/api/admin/`.

Otras piezas diferidas:

- **Fase 2 — CRUD de productos.** Tabla `products` (con `category_id`, `sku`,
  `price_cents`, `stock`, `specs`, …), su módulo y su página. No arranca hasta que el
  usuario declare la Fase 1 terminada tras pruebas manuales; irá en
  `docs/specs/002-products-crud.md` y reutilizará toda la Fase 0 sin cambios. Quedan
  abiertas para ese spec: galería `product_images`, columna `currency` y el conjunto
  de filtros de la tabla.
- **`ip_address` y `user_agent` en `audit_logs`.** Las columnas existen pero se
  escriben `null`. Capturarlas requiere pasar las cabeceras del request hasta el
  repositorio; sin actor identificado el valor forense es bajo. Se retoma junto con
  el RBAC.
- **Vista `/admin/audit-logs`.** La bitácora se escribe pero no se lee desde la UI;
  hoy se inspecciona con `npm run db:studio`. Se retoma cuando haya más de un dominio
  auditado.
- **`src/server/db/seed.ts`.** El script `npm run db:seed` sigue fallando (verificado:
  el archivo no existe). Se crea con el seed de permisos, en el spec de RBAC.
- **Jerarquía de categorías (`parent_id`).** Descartada por decisión del usuario. Si
  el catálogo pide subcategorías, es una columna nueva + migración, no un rediseño.
- **Purga por retención de `audit_logs`.** Job aparte; se retoma cuando la tabla pase
  de unas decenas de miles de filas.
- **Refinamientos de la tabla:** selección múltiple y acciones en lote, exportar CSV,
  toggle de visibilidad de columnas, filtros persistidos en la URL y actualizaciones
  optimistas. Se retoman si el uso real los pide, no antes.
- **Tests automatizados.** El proyecto no tiene runner de tests configurado. La
  verificación de esta feature es `typecheck` + `lint` + `build` + el recorrido manual
  de T27.
