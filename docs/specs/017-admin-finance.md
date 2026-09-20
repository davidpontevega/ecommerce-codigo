---
id: 017
title: Admin — Finanzas (resumen de caja del mes + gastos varios)
status: done
module: finance
scope: admin
---

# 017 — Admin: Finanzas

## Objetivo
Un miembro del staff con `finance.manage` abre `/admin/finance` y ve, del mes
en curso, cuánto entró, cuánto salió y cuánto quedó — y administra ahí mismo
los gastos varios del negocio (alquiler, insumos, servicios).

## Decisiones (resueltas con el usuario, brainstorming 2026-09-20)
- **D1 — Sin vista de ventas nueva.** "Ingresos" es un número:
  `sum(orders.total_cents)` de pedidos `paid` del mes calendario actual en
  Lima. Reusa el patrón de fechas de `metrics.repository.ts`, extendido a
  límites de **mes**.
- **D2 — Sin salarios ni nómina.** Fuera de alcance: ninguna tabla de
  empleados, ningún concepto de personal.
- **D3 — "Pagos otros" = gastos varios, CRUD simple.** Tabla nueva `expenses`
  con `category` como **texto libre** (sin enum ni catálogo) y `deleted_at`
  para soft-delete, igual que `products` — nunca borrado físico.
- **D4 — Resumen fijo al mes actual** (3 totales, sin selector de rango). El
  filtro de fechas vive solo en la tabla de gastos.
- **D5 — Un permiso único `finance.manage`** (no read/write separados): cubre
  ver el resumen y el CRUD completo. Dominio nuevo, no reusa nada.
- **D6 — Sin ficha de detalle**: alta/edición por diálogo y borrado con
  confirmación, mismo patrón que categorías/productos.

## Alcance
Incluye: permiso `finance.manage`, tabla `expenses` (+ migración), CRUD de
gastos por API y UI, endpoint de resumen, página `/admin/finance` con 3 cards
y tabla filtrable, entrada "Finanzas" en el nav.

No incluye: salarios/nómina, presupuestos, categorías de gasto como catálogo,
adjuntar comprobantes, exportar, selector de rango en el resumen, moneda
distinta de PEN, proyecciones.

## Contexto verificado
- `src/lib/utils.ts` — `startOfLimaDay`/`endOfLimaDay`/`limaDay` ya existen
  (offset fijo `-05:00`). **No hay helper de mes**: se añade uno aquí, junto a
  los de día, porque lo necesitan las dos mitades del resumen (T2).
- `src/server/repositories/metrics.repository.ts:48` — `salesByDay()` ya suma
  `total_cents` de `paid` en una ventana `[from, to)`; el ingreso del mes es
  la misma consulta sin `groupBy`.
- `src/server/repositories/category.repository.ts` — espejo del CRUD:
  `buildFilters` → `list` paginado + `logAudit` dentro de `db.transaction`.
- `src/app/api/products/[id]/route.ts:109` — espejo del `DELETE` con
  soft-delete (`categories` usa `is_active`, no sirve como espejo aquí).
- `src/server/db/schema/product.ts` — patrón `deletedAt` + índices.
- `src/modules/orders-admin/schemas/admin-order.schema.ts:38` —
  `from`/`to` como `z.iso.date()` + `refine` de rango invertido, a espejar.
- `src/modules/orders-admin/components/admin-order-table.tsx` — filtros
  (`input type="date"`, búsqueda con `useDebounce`) + `DataTable`.
- `src/lib/permissions.ts` — `PERMISSIONS` es la única fuente; `seed.ts:479`
  deriva los códigos de ahí, así que basta re-correr `npm run db:seed`.
- `src/modules/roles/components/role-permission-matrix.tsx:21` —
  `RESOURCE_LABELS` necesita la entrada `finance` o la matriz muestra el
  recurso en crudo.
- `drizzle/` — última migración `0005_fancy_prodigy.sql`; esta será `0006_*`.

## Criterios de aceptación
- [ ] AC1 — Con `finance.manage`, `/admin/finance` muestra 3 cards del mes
      actual: ingresos, egresos y neto (ingresos − egresos), en formato
      `formatPrice`.
- [ ] AC2 — Ingresos = suma de `total_cents` de pedidos `paid` con
      `created_at` dentro del mes calendario de Lima; un pedido del último día
      a las 23:00 cuenta, uno del día 1 del mes siguiente no.
- [ ] AC3 — Egresos = suma de `amount_cents` de gastos del mes excluyendo los
      soft-deleted (`deleted_at IS NULL`). Sin gastos ni ventas, los 3 totales
      son 0 (no error ni vacío).
- [ ] AC4 — La tabla lista los gastos activos paginados, ordenados por fecha
      descendente, con filtros de rango de fecha, búsqueda por concepto y
      categoría.
- [ ] AC5 — Crear un gasto (concepto, monto, fecha, categoría opcional) lo
      muestra en la tabla y actualiza las cards sin recargar.
- [ ] AC6 — Editar un gasto persiste los cambios y refresca tabla y cards.
- [ ] AC7 — Eliminar pide confirmación, hace soft-delete (la fila desaparece
      del listado pero el registro sigue en BD) y refresca cards.
- [ ] AC8 — Monto inválido (≤ 0, decimal, texto), concepto vacío o fecha mal
      formada → 400 de Zod y error visible en el formulario, sin escritura.
- [ ] AC9 — Sin `finance.manage`: 403 en los endpoints y la página responde
      404 (`notFound()`, mismo patrón que `/admin/orders`); la entrada del nav
      no aparece.
- [ ] AC10 — Toda mutación queda en `audit_logs` (`expense.created` /
      `expense.updated` / `expense.deleted`) en la misma transacción.
- [ ] AC11 — Estados de carga (skeleton) y de error (con reintento) en cards y
      tabla.
- [ ] AC12 — `npm run typecheck && npm run lint && npm run test && npm run build`
      en verde.

## Datos
Tabla nueva `expenses` — **requiere migración** (`npm run db:generate` →
`drizzle/0006_*.sql`, luego `npm run db:migrate`).

| Columna | Tipo | Constraint |
|---|---|---|
| `id` | uuid | PK, `defaultRandom()` |
| `concept` | text | NOT NULL |
| `amount_cents` | integer | NOT NULL, > 0 (validado en Zod; centavos, nunca float) |
| `date` | date (`mode: "string"`, `YYYY-MM-DD`) | NOT NULL — fecha del gasto, independiente de `created_at` |
| `category` | text | nullable, texto libre |
| `deleted_at` | timestamptz | nullable — `null` = activo |
| `created_at` / `updated_at` | timestamptz | NOT NULL, `defaultNow()`; `updated_at` con `$onUpdate(sql\`now()\`)` |

Índices: `expenses_date_idx` on `date`, `expenses_deleted_at_idx` on `deleted_at`.
Sin FK a `users`: quién lo registró ya vive en `audit_logs`.

## API
| Método | Ruta | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/api/admin/finance/summary` | `requirePermission('finance.manage')` | — | `{ month, incomeCents, expenseCents, netCents }` · 403 |
| GET | `/api/admin/expenses` | idem | — (query) | `{ data, total, page, pageSize }` · 400 · 403 |
| POST | `/api/admin/expenses` | idem | `expenseCreateSchema` | `Expense` 201 · 400 · 403 |
| PATCH | `/api/admin/expenses/[id]` | idem | `expenseUpdateSchema` | `Expense` · 400 · 403 · 404 |
| DELETE | `/api/admin/expenses/[id]` | idem | — | `Expense` (soft-deleted) · 403 · 404 |

Zod (`src/modules/finance/schemas/expense.schema.ts`):
- `expenseQuerySchema` — `search`, `category`, `from`, `to` (`z.iso.date()` +
  refine de rango invertido), `page`, `pageSize`, `sortBy` (`date` |
  `amountCents` | `createdAt`), `sortDir`.
- `expenseCreateSchema` — `concept` (min 2, max 160), `amountCents` (int
  positivo, sin `coerce`), `date` (`z.iso.date()`), `category` (max 60,
  nullish).
- `expenseUpdateSchema` — `.partial()` del anterior + refine "sin cambios".
- `expenseIdSchema` — `z.uuid()`.

El resumen no tiene entrada que validar (D4, mes fijo), igual que
`GET /api/admin/metrics`.

## Reutilizar
- `src/lib/utils.ts` — `startOfLimaDay`/`limaDay` y `formatPrice`; el helper de
  mes nuevo se apoya en ellos (T2).
- `src/lib/audit.ts` → `logAudit(tx, …)` dentro de `db.transaction`.
- `src/lib/permissions.ts` → `requirePermission` / `can`; `src/lib/auth.ts` →
  `authErrorResponse`.
- `src/components/shared/data-table.tsx` — `DataTable` con paginación, orden,
  `isPending`/`isError`/`onRetry`/`emptyMessage`.
- `src/hooks/use-debounce.ts` — búsqueda, igual que la tabla de pedidos.
- `src/modules/products/components/product-form-dialog.tsx` y
  `category-form-dialog.tsx` — patrón RHF + zodResolver a copiar (no a
  importar: otro dominio).
- `src/lib/axios.ts` y `src/lib/query-client.ts` — service y hooks.
- Componentes shadcn ya instalados: `card`, `table`, `dialog`,
  `alert-dialog`, `input`, `field`, `select`, `button`, `skeleton`, `sonner`.
  Nada nuevo que instalar.

## Tareas
- [x] T1 — `src/server/db/schema/expense.ts` (tabla + índices + tipos
      inferidos) y export en `schema/index.ts`; `npm run db:generate` +
      `npm run db:migrate` · verif: §Datos.
- [x] T2 — Helper de mes de Lima en `src/lib/utils.ts` (primer día del mes y
      primer día del mes siguiente, `YYYY-MM-DD`, junto a los helpers de día)
      · verif: AC2.
- [x] T3 — `finance.manage` en `PERMISSIONS` (`src/lib/permissions.ts`) +
      re-correr `npm run db:seed`; etiqueta `finance` en `RESOURCE_LABELS`
      (`role-permission-matrix.tsx`) · verif: AC9.
- [x] T4 — `src/modules/finance/schemas/expense.schema.ts` (los 4 schemas y
      tipos de la sección API) · verif: AC8.
- [x] T5 — `src/server/repositories/expense.repository.ts`: `buildFilters`,
      `list`, `create`, `update`, `softDelete`, todos auditados en su tx ·
      verif: AC4, AC7, AC10.
- [x] T6 — `src/server/repositories/finance.repository.ts`: `getMonthSummary()`
      — ingresos (`orders` `paid` en `[from, to)`) + egresos (`expenses`
      activos del mes) en `Promise.all`, con **una** sola ventana común ·
      verif: AC2, AC3.
- [x] T7 — `src/app/api/admin/expenses/route.ts` (GET + POST) y
      `.../[id]/route.ts` (PATCH + DELETE) · verif: AC5, AC6, AC7, AC8, AC9.
- [x] T8 — `src/app/api/admin/finance/summary/route.ts` (GET) · verif: AC1, AC9.
- [x] T9 — `src/modules/finance/services/*.service.ts` + hooks TanStack Query
      (lista, resumen y mutaciones; las mutaciones invalidan la clave
      `["expenses"]` **y** la del resumen) · verif: AC5, AC6, AC7.
- [x] T10 — `src/modules/finance/components/finance-summary-cards.tsx` (3
      cards + skeleton + error) · verif: AC1, AC11.
- [x] T11 — `src/modules/finance/components/expense-columns.tsx` y
      `expense-table.tsx` (filtros de fecha/búsqueda/categoría + `DataTable`)
      · verif: AC4, AC11.
- [x] T12 — `expense-form-dialog.tsx` (alta/edición) y confirmación de
      borrado · verif: AC5, AC6, AC7, AC8.
- [x] T13 — `src/app/(admin)/admin/finance/page.tsx`, Server Component con
      `can("finance.manage")` → `notFound()` · verif: AC9.
- [x] T14 — Entrada "Finanzas" en `src/components/shared/admin-nav.tsx`
      (icono `Wallet`, gate `finance.manage`) · verif: AC9.
- [x] T15 — Pruebas unitarias de las funciones puras: helper de mes (T2) y
      `buildFilters` de expenses (patrón `PgDialect` de
      `product.repository.test.ts`) · verif: AC2, AC4.
- [x] T16 — `npm run typecheck && npm run lint && npm run test && npm run build`
      en verde · verif: AC12.

## Implementación (2026-09-20)

Archivos nuevos:
- `src/server/db/schema/expense.ts` — tabla `expenses` + índices + tipos
  inferidos (T1).
- `drizzle/0006_panoramic_mattie_franklin.sql` — migración, **aplicada** a Neon.
- `src/modules/finance/schemas/expense.schema.ts` — los 4 schemas Zod +
  `isExpenseSortField` (T4).
- `src/modules/finance/types/finance.types.ts` — `ExpenseDto`,
  `ExpenseListResponse`, `FinanceSummary`.
- `src/server/repositories/expense.repository.ts` — CRUD auditado en su tx (T5).
- `src/server/repositories/finance.repository.ts` — `getMonthSummary()` (T6).
- `src/app/api/admin/expenses/route.ts` (GET + POST) y
  `src/app/api/admin/expenses/[id]/route.ts` (PATCH + DELETE) (T7).
- `src/app/api/admin/finance/summary/route.ts` (GET) (T8).
- `src/modules/finance/services/expense.service.ts` y `finance.service.ts`;
  hooks `use-expenses.ts`, `use-finance-summary.ts`,
  `use-expense-mutations.ts` (T9).
- `src/modules/finance/components/finance-summary-cards.tsx` (T10),
  `expense-columns.tsx` + `expense-table.tsx` (T11),
  `expense-form-dialog.tsx` (T12).
- `src/app/(admin)/admin/finance/page.tsx` (T13).
- `src/server/repositories/expense.repository.test.ts` — 9 tests de
  `buildFilters` + rango invertido (T15).

Archivos tocados: `src/server/db/schema/index.ts` (export), `src/lib/utils.ts`
(`limaMonthRange`), `src/lib/permissions.ts` (`finance.manage`),
`src/modules/roles/components/role-permission-matrix.tsx` (etiqueta `finance`),
`src/components/shared/admin-nav.tsx` (entrada "Finanzas", icono `Wallet`),
`src/lib/utils.test.ts` (4 tests de `limaMonthRange`).

Notas de implementación:
- **T2 — `limaMonthRange(day)` es aritmética sobre el texto**, no sobre `Date`:
  el día ya viene resuelto en Lima por `limaDay()`, así que sumar un mes es
  recortar `YYYY-MM` y cambiar el número; construir un `Date` intermedio solo
  reintroduciría el riesgo de zona. Vive junto a `startOfLimaDay`/`limaDay`.
- **T6 — ventana única**: `getMonthSummary` llama a `limaMonthRange` **una**
  vez y pasa el mismo par a las dos mitades: `startOfLimaDay(from/to)` para
  `orders.created_at` (`timestamptz`, necesita el offset) y los strings
  `YYYY-MM-DD` tal cual para `expenses.date` (columna `date`). `coalesce(sum
  (…), 0)::int` en ambas: sin filas, `sum()` devuelve `NULL`, no 0 (AC3).
- **T5 — `to` del filtro es inclusivo con `lte`**, no `lt` del día siguiente
  como en pedidos: `expenses.date` es un día, no un instante, así que no hay
  nada que recortar. Documentado en el repositorio y cubierto por test.
- **`update` con guard de soft-delete**: `PATCH` sobre un gasto ya eliminado
  devuelve 404, igual que `DELETE` (`isNull(deletedAt)` en el `where` de
  lectura). Un gasto borrado no se edita ni se restaura: el spec no pide
  restauración (a diferencia de productos).
- El `refine` "sin cambios" de `expenseUpdateSchema` cubre el `PATCH {}`; no se
  replicó el `UpdateResult`/`no-changes` de productos porque aquí no hay
  ninguna otra razón de fallo que distinguir del 404.
- **Filtros de tabla**: `search` → `ilike` sobre `concept`; `category` → `ilike`
  sobre `category`, ambos como `Input` de texto con `useDebounce`. Se descartó
  un `Select` de categorías porque exigiría un endpoint de distintos para una
  columna que es texto libre por decisión D3.

Desviaciones del spec:
- **`npm run db:seed` completa su mitad RBAC y falla en la del catálogo**
  (`Seed listo: 18 permisos, 6 roles, 51 pares rol-permiso` y luego
  `violates RESTRICT … order_items_product_id_products_id_fk`). Es una
  condición **preexistente y ajena a este spec**: el seed borra el catálogo
  antes de sembrarlo y ya hay pedidos reales que referencian productos. Lo que
  T3 necesitaba — `finance.manage` en la tabla `permissions` y en la matriz de
  `super_admin`/`admin` — se ejecuta **antes** del borrado y quedó aplicado
  (17 → 18 permisos). No se tocó el seed: arreglarlo es otro alcance.

Pendiente de QA manual (requiere sesión real con datos):
- AC1/AC2/AC3 — las 3 cards con cifras reales del mes; un pedido `paid` del
  último día a las 23:00 de Lima debe contar y uno del día 1 siguiente no.
- AC4 — paginación, orden por fecha/monto y los cuatro filtros en vivo.
- AC5/AC6/AC7 — alta, edición y borrado con confirmación refrescando tabla
  **y** cards sin recargar la página.
- AC8 — monto 0/negativo/decimal/texto y concepto vacío muestran el error bajo
  el campo y no escriben nada.
- AC9 — un usuario sin `finance.manage` recibe 404 en `/admin/finance`, 403 en
  los endpoints y no ve la entrada del nav.
- AC10 — las tres acciones dejan `expense.created`/`updated`/`deleted` en
  `audit_logs` con el `actor_id` correcto.
- AC11 — skeleton y error con reintento (requiere cortar la red).

## Notas
- **Cruce de mes**: el resumen se calcula con una única ventana obtenida una
  sola vez; pedirla por consulta dejaría ingresos y egresos en meses distintos
  si la petición cae en el cambio de mes.
- `orders.created_at` es `timestamptz` (necesita el offset de Lima) pero
  `expenses.date` es `date` (ya es un día local): la ventana del mes se usa
  como `Date` para pedidos y como string `YYYY-MM-DD` para gastos.
- Un gasto con soft-delete deja de contar en el resumen; ningún total
  histórico se recalcula hacia atrás porque el resumen siempre es del mes
  actual.

## Cierre

Reviewer: **APROBADO** iteración 1/2 (tope de 5 rondas, no se necesitó ninguna).
typecheck / lint / test (167/167) / build — verdes, corridos por el reviewer
de forma independiente (no solo confiados al reporte del developer).
Sin hallazgos bloqueantes ni mayores.

Puntos de riesgo verificados explícitamente:
- Ventana de mes calculada una sola vez en `getMonthSummary` y reusada para
  ingresos y egresos (sin drift si la petición cruza de mes).
- `expenses.date` (string `YYYY-MM-DD`) y `orders.createdAt` (`timestamptz`)
  sin mezclarse: cada uno compara contra su propio tipo.
- Las 3 mutaciones de `expenses` auditan con `logAudit(tx, …)` dentro de la
  misma transacción, sin PII.
- Permiso único `finance.manage` en todo el flujo, cero comparación por
  nombre de rol.
- Soft-delete real (`UPDATE deleted_at`, nunca `DELETE FROM`).
- Migración `0006_panoramic_mattie_franklin.sql` coincide con el schema.

Desviación reportada por el developer — confirmada por el reviewer como
**no-hallazgo, preexistente y ajena a este spec**: `npm run db:seed` siembra
RBAC (incluido `finance.manage`) correctamente y luego falla a mitad del
reseed de productos por una FK restrict con `order_items` ya existentes; no
toca `expenses`/`finance` en ningún archivo de este diff. Queda como deuda
técnica del seed, fuera de alcance de esta spec.

Con esto se cierran las 4 secciones del admin panel pedidas originalmente:
Dashboard (015), Órdenes (014), Inventario (016), Finanzas (017).

Pendiente de QA manual (necesita BD y sesión real): recorrido de AC1-AC11 con
datos reales — crear/editar/eliminar gastos y ver cards actualizarse, cruce
de mes en el resumen, filtros de fecha/categoría en la tabla.
