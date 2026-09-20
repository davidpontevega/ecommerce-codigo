---
id: 016
title: Admin — Inventario (vista de restock, solo lectura + edición existente)
status: done
module: inventory
scope: client
---

# 016 — Admin: Inventario

## Objetivo
Un miembro del staff con `products.read` abre `/admin/inventory` y ve el
catálogo activo ordenado por stock ascendente, con un filtro "solo stock
bajo", para saber de un vistazo qué restockear — y puede corregir el stock
ahí mismo, abriendo el mismo formulario de producto que ya existe.

## Decisiones (resueltas con el usuario, brainstorming 2026-09-18)
- **D1 — Umbral de stock bajo global y fijo**, no configurable por producto.
  Sin columna nueva, sin migración.
- **D2 — Sin mutación nueva.** Para corregir stock, se reutiliza el
  `ProductFormDialog` que ya usa `admin/products` (misma mutación
  `products.update`, ya auditada — spec 002). Inventario es una vista
  filtrada/ordenada de lectura, no un formulario propio.
- **D3 — Sin permiso nuevo.** Es una vista distinta del mismo recurso
  (`products`), no un dominio nuevo: `products.read` para ver,
  `products.update` (ya exigido por el diálogo existente) para corregir.

## Alcance
Incluye: página `/admin/inventory` con tabla ordenada por stock ascendente,
filtro "solo stock bajo" + búsqueda + categoría, acción "Editar" que abre el
diálogo de producto existente.

No incluye: ajuste de stock inline sin abrir el diálogo, umbral configurable
por producto, historial de movimientos de inventario, proveedores u órdenes
de compra, notificaciones.

## Contexto verificado
- `src/app/api/products/route.ts` — el mismo endpoint que ya usa
  `admin/products` (público con `status=available`, exige `products.read`
  para cualquier otro `status`). Inventario **reutiliza esta misma ruta**, sin
  Route Handler nuevo — solo query params distintos.
- `src/server/repositories/product.repository.ts` → `list()` ya soporta
  `sortBy: "stock"` (columna ya en `sortColumns`) y filtros por rango de
  precio (`minPriceCents`/`maxPriceCents`) con el mismo patrón que necesita
  un filtro de stock máximo.
- `src/modules/products/schemas/product.schema.ts` → `productQuerySchema` no
  tiene ningún campo de stock máximo todavía.
- `src/server/repositories/metrics.repository.ts:21` → `LOW_STOCK_THRESHOLD = 5`
  ya existe (spec 015), pero vive en un archivo de servidor que importa `db` —
  **no se puede importar desde un componente cliente sin arrastrar el pool de
  Neon al bundle**. Se promueve a `src/lib/constants.ts` (nuevo, sin imports de
  servidor) para que tanto `metrics.repository.ts` como el módulo cliente de
  Inventario lean el mismo número.
- `src/modules/products/components/product-form-dialog.tsx` — el diálogo de
  alta/edición que ya usa `admin/products`; se reutiliza tal cual.
- `src/app/(admin)/admin/products/page.tsx` y su tabla — patrón de página +
  `DataTable` a replicar con distinto orden por defecto y un toggle extra.

## Criterios de aceptación
- [ ] AC1 — Un usuario con `products.read` ve `/admin/inventory`: tabla de
      productos activos (`deleted_at IS NULL`) ordenada por stock ascendente
      por defecto.
- [ ] AC2 — Toggle "solo stock bajo" filtra a `stock <= LOW_STOCK_THRESHOLD`;
      desactivado muestra todo el catálogo activo.
- [ ] AC3 — Búsqueda por nombre/SKU y filtro por categoría, mismo patrón que
      `admin/products`.
- [ ] AC4 — Cada fila muestra un badge de estado: 🔴 bajo (`stock <=` umbral)
      / normal.
- [ ] AC5 — Botón "Editar" en cada fila abre el `ProductFormDialog` existente
      con ese producto cargado; al guardar, la tabla de Inventario refleja el
      stock nuevo sin recargar la página.
- [ ] AC6 — Sin `products.read` → 403 (mismo comportamiento que
      `admin/products` hoy con el endpoint compartido).
- [ ] AC7 — Estados de carga (skeleton) y de error (con reintento).
- [ ] AC8 — El link "stock bajo" del Dashboard (spec 015, `/admin/products`
      a secas) se actualiza para apuntar a `/admin/inventory` — ahora sí hay
      una vista construida específicamente para esto.
- [ ] AC9 — `npm run typecheck && npm run lint && npm run test && npm run build`
      en verde.

## Datos
Sin migración. `products` ya existe tal cual.

## API
Ninguna ruta nueva. `GET /api/products` (ya existente) con query params
adicionales:

| Query param nuevo | Tipo | Nota |
|---|---|---|
| `maxStock` | `number` opcional | Mismo patrón que `maxPriceCents`; el toggle "solo stock bajo" lo fija a `LOW_STOCK_THRESHOLD`. |

`sortBy=stock&sortDir=asc` ya es válido hoy (sin cambios en el schema para
eso). `status=available` para que Inventario, igual que el resto del admin de
productos, no muestre productos borrados.

## Reutilizar
- `GET /api/products`, `product.repository.list()`/`buildFilters()` —
  solo se les añade `maxStock` (mismo patrón que `maxPriceCents`).
- `src/modules/products/schemas/product.schema.ts` → `productQuerySchema` gana
  `maxStock`.
- `src/modules/products/services/product.service.ts` y su hook — mismo
  service que ya usa `admin/products`, solo con otros params por defecto.
- `ProductFormDialog` (`src/modules/products/components/product-form-dialog.tsx`)
  — sin tocar, se monta igual que en `admin/products`.
- `DataTable` compartido (`src/components/shared/data-table.tsx`, ya con
  `onRowClick` desde spec 014).
- `requirePermission('products.read')` — ya lo aplica `GET /api/products`,
  nada que añadir.
- Componentes shadcn ya instalados: `table`, `badge`, `switch`/`toggle`,
  `input`, `select`, `skeleton`.

## Tareas
- [x] T1 — `LOW_STOCK_THRESHOLD` de `metrics.repository.ts` → nuevo
      `src/lib/constants.ts` (sin imports de servidor); `metrics.repository.ts`
      lo importa de ahí en vez de declararlo.
- [x] T2 — `maxStock` en `productQuerySchema` (`src/modules/products/schemas/product.schema.ts`)
      y en `buildFilters` (`src/server/repositories/product.repository.ts`),
      mismo patrón que `maxPriceCents` · verif: AC2.
- [x] T3 — `src/app/(admin)/admin/inventory/page.tsx` + módulo cliente
      (columnas, toggle "solo stock bajo", búsqueda, filtro de categoría,
      badge de estado) · verif: AC1, AC3, AC4, AC7.
- [x] T4 — Montar `ProductFormDialog` en Inventario para la acción "Editar",
      invalidando la query de Inventario al guardar (no solo la de
      `admin/products`) · verif: AC5.
- [x] T5 — Actualizar el link de "stock bajo" del Dashboard
      (`src/modules/dashboard/components/low-stock-list.tsx`, spec 015) de
      `/admin/products` a `/admin/inventory` · verif: AC8.
- [x] T6 — Añadir "Inventario" al nav del admin (mismo patrón que "Pedidos"/
      "Tablero" de specs 014/015, gate por `products.read`).
- [x] T7 — Pruebas unitarias de la parte de `buildFilters` que cambia
      (`maxStock`), mismo patrón `PgDialect` ya usado en
      `product.repository.test.ts`.
- [x] T8 — `npm run typecheck && npm run lint && npm run test && npm run build`
      en verde.

## Implementación (2026-09-20)

Archivos nuevos:
- `src/lib/constants.ts` — `LOW_STOCK_THRESHOLD`, sin imports (T1).
- `src/app/(admin)/admin/inventory/page.tsx` — Server Component con gate
  `can("products.read")`.
- `src/modules/products/components/inventory-table.tsx` — filtros + `DataTable`
  + `ProductFormDialog`.
- `src/modules/products/components/inventory-columns.tsx` — columnas y badge
  bajo/normal.

Archivos tocados: `metrics.repository.ts` (importa la constante),
`product.schema.ts` (`maxStock` + `isProductSortField`), `product.repository.ts`
(`lte(stock, maxStock)`), `product-table.tsx` (usa el guard compartido),
`low-stock-list.tsx` (link), `admin-nav.tsx` (entrada "Inventario"),
`product.repository.test.ts` (3 tests de `maxStock`).

Notas de implementación:
- **T4 sin código extra**: `useUpdateProduct` ya invalida la clave `["products"]`
  completa e Inventario consume `useProducts` (`["products", params]`), así que
  la tabla se refresca al guardar por prefijo de queryKey. No hizo falta un hook
  ni una queryKey propios.
- **AC6 — desviación menor**: `GET /api/products` con `status=available` es la
  ruta pública y **no** exige `products.read`, así que la puerta real de la vista
  es `can("products.read")` en la página, que responde **404** (`notFound()`),
  no 403 — mismo patrón que `/admin/orders` (spec 014). El endpoint sigue sin
  tocarse.
- `isProductSortField` se extrajo a `product.schema.ts` (antes era un helper
  local de `product-table.tsx`) para que Inventario no lo duplicara.
- Sin permiso nuevo, sin ruta nueva, sin migración, `ProductFormDialog` sin
  tocar.

Pendiente de QA manual (requiere sesión con datos reales):
- AC1/AC3 — orden por stock ascendente y filtros de búsqueda/categoría en vivo.
- AC2 — el toggle deja solo `stock <= 5`.
- AC4/AC5 — badge por fila y refresco de la tabla tras guardar el diálogo.
- AC6 — un usuario sin `products.read` recibe 404 en `/admin/inventory` y no ve
  la entrada del nav.
- AC8 — el link del Tablero lleva a `/admin/inventory`.

## Notas
- **Esto cierra la deuda declarada en specs 014/015**: el umbral de stock bajo
  deja de estar duplicado (`metrics.repository.ts` definía su propia
  constante) y el enlace del Dashboard deja de apuntar a `/admin/products` a
  secas.
- **Sin ficha de producto** (`/admin/products/[id]` no existe, spec 015 §Cierre)
  — la edición sigue siendo por diálogo, no por navegación a una página. Si en
  el futuro se agrega una ficha, Inventario cambia su botón "Editar" para
  enlazar ahí; no es parte de esta vuelta.

## Cierre

Reviewer: **APROBADO** iteración 1/2 (tope de 5 rondas, no se necesitó ninguna).
typecheck / lint / test (154/154) / build — verdes, corridos por el reviewer.
Sin hallazgos bloqueantes ni mayores. D2/D3 confirmados: sin ruta nueva, sin
permiso nuevo, sin migración.

Notas menores (no bloqueantes, ya evaluadas por el reviewer como correctas):
- AC5 se cumple por invalidación de prefijo de TanStack Query
  (`["products"]` invalida también `["products", params]` de Inventario) —
  confirmado que es el comportamiento por defecto de v5, no un hallazgo.
- AC6 se cumple con `notFound()` (404) en vez de 403 literal — mismo patrón ya
  aprobado en spec 014 para `/admin/orders`, consistente en todo el admin.

Con esto se cierra la deuda declarada en specs 014/015: el umbral de stock
bajo vive en un solo lugar (`src/lib/constants.ts`) y el enlace del Dashboard
apunta a la vista real de Inventario.

Pendiente de QA manual (necesita BD y sesión real): recorrido de AC1-AC6 y AC8
con datos reales, incluido el flujo completo de editar stock desde Inventario
y ver la tabla actualizarse sin recargar.
