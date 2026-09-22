---
id: 019
title: Admin — Impuestos (IGV) y Precio Unitario (costo y margen)
status: done
module: finance
scope: admin
---

# 019 — Admin: Impuestos (IGV) y Precio Unitario

## Objetivo
Un miembro del staff con `finance.manage` ve en `/admin/finance` cuánto del
ingreso del mes es IGV y cuál es la ganancia real ya sin ese impuesto, y en una
vista nueva de Precio Unitario ve, por producto activo, precio, costo y margen.

## Decisiones (resueltas con el usuario, brainstorming 2026-09-21)
Extiende la spec 017 (`done`); Ingresos y Egresos no cambian de alcance.
- **D1 — IGV es un cálculo, no un módulo de cumplimiento.** Perú, 18%. Los
  `priceCents` **ya incluyen IGV** (así se muestran al cliente), luego
  `igvCents = round(incomeCents * 18 / 118)` sobre el mismo `incomeCents` que
  ya calcula `getMonthSummary()`. Sin tabla nueva, sin SUNAT, sin integración.
- **D2 — Ganancias resta el IGV.** `netCents = incomeCents − igvCents −
  expenseCents` (antes: `incomeCents − expenseCents`). El IGV nunca fue plata
  del negocio.
- **D3 — El resumen pasa de 3 a 4 cards** en el mismo `/admin/finance`:
  Ingresos, Egresos, **Impuestos (IGV)** y Ganancias. Mismo componente
  `finance-summary-cards.tsx`, sin vista nueva para esto.
- **D4 — `products.cost_cents`**, integer nullable (centavos, nunca float). Se
  carga desde el `ProductFormDialog` existente, como un campo opcional más.
  Los productos actuales quedan en `null` hasta que alguien los edite: solo
  columna nueva, sin migración de datos.
- **D5 — El margen se calcula sin IGV.** `priceNetCents = round(priceCents *
  100 / 118)`; `marginCents = priceNetCents − costCents`; `marginPercent =
  marginCents / priceNetCents`. Con `costCents = null` el margen es **"sin
  dato"**, no `0`: la fila se muestra con guion, sin romper la vista.
- **D6 — Vista nueva "Precio unitario"** dentro de Finanzas: productos activos
  con precio, costo, margen % y margen en soles, protegida por
  `finance.manage` (no `products.read`): el costo es dato financiero.
- **D7 — Sin permiso nuevo.** Todo vive bajo `finance.manage` (spec 017 D5).
  Cargar el costo sigue exigiendo `products.update`, sin cambios ahí.
- **D8 — El costo no sale por ninguna lectura pública** (derivada del contexto
  verificado, ver abajo): `productSelection` se declara **sin** `costCents`;
  solo lo leen `findById` (endpoint que pasa a exigir `products.read`, para el
  prellenado del formulario) y la lectura de márgenes.

## Alcance
Incluye: `cost_cents` + migración, campo de costo en el formulario de producto,
`igvCents` y nuevo `netCents` en el resumen, 4º card, endpoint y vista de
márgenes, entrada de nav.

No incluye: declaración/exportación a SUNAT, tipos de IGV por producto o
exonerados, histórico de costos, costeo promedio o FIFO, margen por pedido
vendido, IGV de los egresos (los gastos entran por su monto total), selector de
rango, moneda distinta de PEN.

## Contexto verificado
- `src/server/repositories/finance.repository.ts:49` — `getMonthSummary()` ya
  resuelve la ventana del mes **una** vez y devuelve `incomeCents`/
  `expenseCents`; el IGV entra como derivado, sin consulta nueva.
- `src/modules/finance/types/finance.types.ts:27` — `FinanceSummary` es el
  único tipo a extender; `netCents` solo lo consume
  `finance-summary-cards.tsx:54` (grid `sm:grid-cols-3`, skeleton `[0,1,2]`).
- `src/server/db/schema/product.ts:27` — `priceCents`/`compareAtPriceCents`
  son `integer(...)`; `cost_cents` va junto a ellos, nullable.
- `src/modules/products/schemas/product.schema.ts:60` — `productFields`;
  `comparePriceIsHigher` solo mira `priceCents`/`compareAtPriceCents`: un
  campo nuevo **no** lo afecta, pero `productUpdateSchema` se construye con
  `.partial()` y hay que dejar `costCents` como `nullish` sin `.default()`.
- `src/server/repositories/product.repository.ts:31` — `productSelection` es
  `getTableColumns(products)`: **toda columna nueva viaja a las lecturas
  públicas**. `list()` alimenta `GET /api/products` (público con
  `status=available`) y el SSR del storefront vía
  `modules/storefront/serializers.ts`, y `GET /api/products/[id]`
  (`src/app/api/products/[id]/route.ts:17`) **hoy no pide ningún permiso**.
  De ahí D8.
- `product.repository.ts:53` `editableKeys` — lista explícita; `costCents`
  tiene que entrar ahí o el `PATCH` lo ignora en silencio.
- `src/modules/products/components/product-form-dialog.tsx:55` — `emptyValues`
  y `toFormValues(product)` parten de `ProductDto`, que tras D8 **no** trae
  costo: el modo edición necesita una lectura por id (T5).
  `optionalNumber` (`:71`) ya convierte input vacío → `null`.
- `src/components/shared/data-table.tsx:41` — `DataTable` exige `rowCount`,
  `pagination` y `sorting` controlados (`manualSorting: true`) y ya trae
  skeleton, error con reintento y vacío.
- `src/lib/permissions.ts:98` — `finance.manage` existe; nada que crear (D7).
- `src/lib/constants.ts` — sin imports, pero solo constantes; los helpers de
  IGV van a `src/lib/tax.ts` (T2).
- `drizzle/` — última migración `0006_panoramic_mattie_franklin.sql`; esta
  será `0007_*`.

## Criterios de aceptación
- [ ] AC1 — `/admin/finance` muestra 4 cards del mes: Ingresos, Egresos,
      Impuestos (IGV) y Ganancias, en `formatPrice`.
- [x] AC2 — `igvCents = round(incomeCents * 18 / 118)`; con `incomeCents = 0`
      el IGV es 0, no error.
- [ ] AC3 — `netCents = incomeCents − igvCents − expenseCents`; negativo se
      sigue señalando en `text-destructive` (comportamiento de spec 017).
- [ ] AC4 — Crear o editar un producto con costo lo persiste en `cost_cents`;
      dejar el campo vacío guarda `null` y no rompe el guardado.
- [ ] AC5 — Costo inválido (≤ 0, decimal, texto) → 400 de Zod con el error bajo
      el campo, sin escritura.
- [ ] AC6 — `/admin/finance/unit-price` lista los productos activos con precio,
      costo, margen % y margen en soles; los `deleted_at IS NOT NULL` no salen.
- [ ] AC7 — Un producto sin costo muestra "—" en costo y margen (no `0`, no
      `NaN`) y el resto de la tabla se renderiza igual.
- [x] AC8 — Margen de un producto con `priceCents = 11800` y `costCents = 5000`:
      neto `10000`, margen `5000`, 50,0 %.
- [ ] AC9 — Sin `finance.manage`: 403 en `/api/admin/finance/margins` y 404 en
      `/admin/finance/unit-price`; la entrada del nav no aparece.
- [ ] AC10 — `cost_cents` **no** aparece en la respuesta de `GET /api/products`
      ni en el HTML del storefront; `GET /api/products/[id]` responde 403 sin
      `products.read`.
- [ ] AC11 — Estados de carga (skeleton) y error (con reintento) en las 4 cards
      y en la tabla de márgenes.
- [x] AC12 — `npm run typecheck && npm run lint && npm run test && npm run build`
      en verde.

## Datos
Columna nueva en `products` — **requiere migración** (`npm run db:generate` →
`drizzle/0007_*.sql`, luego `npm run db:migrate`).

| Columna | Tipo | Constraint |
|---|---|---|
| `cost_cents` | integer | nullable — costo unitario en centavos; `null` = sin dato (D5) |

Sin índice: la vista lee el catálogo activo entero, no filtra por costo.
Impuestos y márgenes no persisten: son derivados (D1, D5).

## API
| Método | Ruta | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/api/admin/finance/summary` | `requirePermission('finance.manage')` | — | `{ month, incomeCents, expenseCents, igvCents, netCents }` (campos nuevos) |
| GET | `/api/admin/finance/margins` | idem | — | `{ data: UnitMarginDto[] }` · 403 |
| POST/PATCH | `/api/products` · `/api/products/[id]` | `products.create` / `products.update` | `costCents` opcional | sin cambios de forma |
| GET | `/api/products/[id]` | **`products.read`** (antes: público) | — | producto **con** `costCents` · 403 |

`UnitMarginDto` (`src/modules/finance/types/finance.types.ts`): `id`, `sku`,
`name`, `priceCents`, `costCents: number \| null`, `priceNetCents`,
`marginCents: number \| null`, `marginPercent: number \| null`.

Zod: `costCents` se añade a `productFields` como entero positivo `nullish`
(sin `coerce`, igual que `weightGrams`). No se toca `comparePriceIsHigher`.
El endpoint de márgenes no tiene entrada que validar, igual que el resumen.

## Reutilizar
- `src/server/repositories/finance.repository.ts` — `getMonthSummary` y
  `sumCents`; el IGV se deriva del `incomeCents` ya calculado.
- `src/modules/finance/components/finance-summary-cards.tsx` — `SummaryCard`
  interno: el 4º card es una instancia más, no un componente nuevo.
- `src/components/shared/data-table.tsx` — `DataTable` (skeleton/error/vacío).
- `src/modules/products/components/inventory-columns.tsx` y
  `inventory-table.tsx` — patrón de columnas y tabla admin de solo lectura.
- `src/lib/utils.ts` → `formatPrice`; `src/lib/permissions.ts` →
  `requirePermission`/`can`; `src/lib/auth.ts` → `authErrorResponse`.
- `src/modules/finance/services/finance.service.ts` y
  `hooks/use-finance-summary.ts` — espejo para el service y hook de márgenes.
- `src/modules/products/services/product.service.ts` — ahí entra `getProduct`.
- Componentes shadcn ya instalados (`card`, `table`, `input`, `field`,
  `skeleton`, `button`). **Nada que instalar.**

## Tareas
- [x] T1 — `costCents` en `src/server/db/schema/product.ts` + `npm run
      db:generate` y `npm run db:migrate` (`drizzle/0007_*`) · verif: §Datos.
- [x] T2 — `src/lib/tax.ts`: `IGV_RATE_PERCENT = 18`, `igvFromGross`,
      `netFromGross`, `unitMargin(priceCents, costCents)` — puras, `Math.round`,
      `null` si no hay costo · verif: AC2, AC8.
- [x] T3 — `product.repository.ts`: `productSelection` explícito **sin**
      `costCents`; `costCents` en `editableKeys`, en `create()` y en la
      selección de `findById` · verif: AC4, AC10.
- [x] T4 — `costCents` en `productFields` (`product.schema.ts`) · verif: AC5.
- [x] T5 — `requirePermission('products.read')` en `GET /api/products/[id]`;
      `getProduct(id)` en `product.service.ts` + hook `use-product.ts`
      (`enabled` solo en edición) · verif: AC10.
- [x] T6 — Campo "Costo (centavos)" en `product-form-dialog.tsx` con
      `optionalNumber`, prellenado desde T5 · verif: AC4, AC5.
- [x] T7 — `igvCents` y nuevo `netCents` en `getMonthSummary()` +
      `FinanceSummary` · verif: AC2, AC3.
- [x] T8 — `listUnitMargins()` en `finance.repository.ts`: productos con
      `deleted_at IS NULL`, mapeados con `unitMargin` de T2 · verif: AC6, AC7.
- [x] T9 — `src/app/api/admin/finance/margins/route.ts` (GET) · verif: AC9.
- [x] T10 — Service + hook `use-unit-margins.ts` en `modules/finance` ·
      verif: AC6.
- [x] T11 — 4º card en `finance-summary-cards.tsx` (grid a 4 columnas y
      skeleton a 4 slots) · verif: AC1, AC11.
- [x] T12 — `unit-margin-columns.tsx` + `unit-margin-table.tsx` (orden y
      paginación en cliente sobre la lista completa) · verif: AC6, AC7, AC11.
- [x] T13 — `src/app/(admin)/admin/finance/unit-price/page.tsx` con
      `can("finance.manage")` → `notFound()` · verif: AC9.
- [x] T14 — Entrada "Precio unitario" en `admin-nav.tsx` (icono `Tags`, gate
      `finance.manage`) · verif: AC9.
- [x] T15 — `src/lib/tax.test.ts`: IGV sobre bruto, margen con y sin costo,
      redondeo · verif: AC2, AC7, AC8.
- [x] T16 — `npm run typecheck && npm run lint && npm run test && npm run build`
      · verif: AC12.

## Notas
- **Fuga de costo (D8)**: `getTableColumns(products)` publica cualquier columna
  nueva en el catálogo público y en el SSR del storefront. Es el riesgo real de
  esta spec: el `productSelection` explícito es la única defensa y AC10 la
  verifica.
- Quien pueda editar productos verá el costo en el formulario: es consecuencia
  aceptada de D4/D7. El agregado (márgenes) sigue bajo `finance.manage`.
- `marginPercent` puede ser negativo (costo > precio neto): es información
  válida, se muestra, no se recorta a 0.
- La vista de márgenes lee el catálogo activo completo en una consulta; si el
  catálogo crece a miles de filas habrá que paginar en servidor.

## Implementación (2026-09-21)

### Archivos nuevos
- `src/lib/tax.ts` — `IGV_RATE_PERCENT`, `igvFromGross`, `netFromGross`,
  `unitMargin`. Puras, `Math.round`, enteros.
- `src/lib/tax.test.ts` — 11 casos (T15).
- `src/modules/products/hooks/use-product.ts` — lectura por id para el
  prellenado del costo en edición.
- `src/modules/finance/hooks/use-unit-margins.ts`,
  `src/modules/finance/components/unit-margin-columns.tsx`,
  `src/modules/finance/components/unit-margin-table.tsx`.
- `src/app/api/admin/finance/margins/route.ts`.
- `src/app/(admin)/admin/finance/unit-price/page.tsx`.
- `drizzle/0007_crazy_ezekiel_stane.sql` — `ALTER TABLE products ADD COLUMN
  cost_cents integer;`, aplicada con `db:migrate`.

### Archivos tocados
- `src/server/db/schema/product.ts` — `costCents` nullable.
- `src/server/repositories/product.repository.ts` — `productSelection` con las
  16 columnas **enumeradas** (adiós `getTableColumns`) + `adminSelection` con
  el costo; `costCents` en `editableKeys` y en `create()`; `findById` y
  `findInTransaction` pasan a `adminSelection`.
- `src/modules/products/types/product.types.ts` — `ProductWithCategory` ahora
  es `Omit<Product, "costCents">`; nuevos `ProductWithCost` (repo) y
  `ProductWithCostDto` (cliente).
- `src/modules/products/schemas/product.schema.ts` — `costCents` en
  `productFields`, entero positivo `nullish`. `comparePriceIsHigher` intacto.
- `src/app/api/products/[id]/route.ts` — `requirePermission("products.read")`
  en el `GET`.
- `src/modules/products/services/product.service.ts` — `getProduct` (ya
  existía) devuelve `ProductWithCostDto`.
- `src/modules/products/components/product-form-dialog.tsx` — campo "Costo
  (centavos)"; el diálogo espera al detalle antes de montar el formulario.
- `src/server/repositories/finance.repository.ts` — `igvCents` y nuevo
  `netCents` en `getMonthSummary()`; `listUnitMargins()`.
- `src/modules/finance/types/finance.types.ts` — `igvCents` en
  `FinanceSummary`; `UnitMarginDto`, `UnitMarginListResponse`.
- `src/modules/finance/services/finance.service.ts` — `listUnitMargins`.
- `src/modules/finance/components/finance-summary-cards.tsx` — 4º card, grid
  `sm:grid-cols-2 lg:grid-cols-4`, skeleton `[0,1,2,3]`, "Neto" → "Ganancias".
- `src/components/shared/admin-nav.tsx` — "Precio unitario" (`Tags`).

### Notas de implementación
- **D8, la parte que importa**: `productSelection` enumera columnas, así que una
  columna nueva en `products` **no** viaja sola a las lecturas públicas. Esa
  enumeración manual es la única defensa real: `ProductWithCategory =
  Omit<Product, "costCents">` **no** hace fallar el compilador si alguien vuelve
  a `getTableColumns` (TypeScript solo aplica excess property check a literales
  inline, no a una fila asignada al tipo; verificado empíricamente). Lo que
  avisa es el test de `productSelection` en
  `product.repository.test.ts`. Las únicas lecturas del costo son
  `adminSelection` (`findById`/`findInTransaction`) y `listUnitMargins`.
  `list()`, `findBySlug()`, `findAvailableByIds()` y `metrics.repository` no lo
  tocan.
- Gatear `GET /api/products/[id]` no rompe la tienda: `/products/[slug]` usa un
  `cache(findBySlug)` local en el servidor, nunca ese endpoint.
- `create()`, `update()`, `softDelete()` y `restore()` devuelven ahora
  `ProductWithCost`: son respuestas de endpoints con `products.*`, no públicas.

### Desviaciones
- **Nombre del 4º card**: "Impuestos (IGV 18 %)" en vez de "Impuestos (IGV)" —
  el porcentaje sale de `IGV_RATE_PERCENT`, no está escrito a mano.
- **Separador decimal del margen %**: `Intl.NumberFormat("es-PE")` rinde
  `50.0 %` y no `50,0 %` como escribe AC8; se prefirió la coherencia con
  `formatPrice`, que ya usa `es-PE` en toda la app.
- **`ProductWithCostDto`**: la spec solo nombraba el tipo del repositorio; hizo
  falta el gemelo de cliente porque `ProductDto` ya no lleva costo.
- **Columna "Precio sin IGV"** añadida a la tabla (no la pedía AC6): es el
  divisor del margen y sin ella el porcentaje no se puede auditar de un vistazo.

### Pendiente de QA manual
AC1, AC3, AC4, AC5, AC6, AC7, AC9, AC10 y AC11. En particular:
- `GET /api/products` y el HTML de `/products/[slug]` sin `cost_cents` (AC10).
- `GET /api/products/[id]` → 403 sin `products.read` (AC10).
- Guardar un producto con costo y con el campo vacío (AC4/AC5).
- `/admin/finance/unit-price` → 404 y nav sin la entrada sin `finance.manage`
  (AC9).

## Cierre

Reviewer: **APROBADO** iteración 2/5. Ronda 1 encontró un hallazgo Mayor
(no bloqueante para seguridad, sí para exactitud): el comentario afirmaba
una "doble red" de protección por tipos de TypeScript contra reintroducir
`costCents` en el catálogo público — el reviewer probó empíricamente que
es falso (TypeScript no aplica excess-property-check a una variable
asignada a un tipo). Ronda 2: comentario corregido para no prometer esa
protección inexistente, y test de regresión real añadido
(`describe("productSelection")` en `product.repository.test.ts`, sin
conexión a BD) que sí detecta la fuga — verificado por el reviewer con su
propia mutación del código (agregar `costCents`, ver fallar el test,
revertir).

**D8 (seguridad) — go/no-go: PASA**, confirmado en ambas rondas por el
reviewer leyendo el código real, no el reporte: `productSelection`
enumera columnas explícitas sin `costCents`, usada por `list()` y
`findBySlug()` (catálogo público); `costCents` solo vive en
`adminSelection`/`findById()`/`listUnitMargins()`, detrás de
`products.read`/`finance.manage`. `GET /api/products/[id]` (que antes de
esta spec no exigía ningún permiso) ahora exige `requirePermission('products.read')`
— confirmado que no rompe el storefront público, que usa `findBySlug`
directo server-side, nunca ese endpoint.

typecheck / lint / test (182/182) / build — verdes, corridos por el
reviewer de forma independiente en ambas rondas.

Con esto: Ingresos, Egresos, Impuestos (IGV 18%) y Ganancias (ingresos −
IGV − egresos) en el resumen de `/admin/finance`; nueva vista
`/admin/finance/unit-price` con margen por producto (costo opcional,
"sin dato" si no está cargado). De las 6 secciones originales pedidas,
Ganancias y Contabilidad quedaron fusionadas en el resumen existente —
no construidas como secciones aparte, según lo acordado en brainstorming.

Pendiente de QA manual (necesita BD y sesión real): AC1, AC3-AC6, AC11 —
recorrido de las 4 cards con datos reales, cargar costo en un producto y
ver aparecer su margen, orden/paginación de la tabla de márgenes,
estados de carga/error.
