---
id: 014
title: Admin — Órdenes (listado y detalle, solo lectura)
status: done
module: orders-admin
scope: client
---

# 014 — Admin: Órdenes

## Objetivo
Un miembro del staff con permiso puede ver el listado de pedidos (fecha, cliente,
total, estado) filtrado por rango de fecha, estado y cliente (texto libre), y
abrir el detalle de un pedido con sus líneas.

## Decisiones (resueltas con el usuario, brainstorming 2026-09-18)
- **D1** — Solo lectura en esta vuelta: sin cambio manual de estado. El estado lo
  sigue moviendo el webhook de Stripe (spec 011).
- **D2** — Filtro de cliente: texto libre (ILIKE) sobre `orders.email` + nombre/
  apellido del usuario cuando el pedido tiene `user_id`; cubre invitados
  (checkout de invitado, spec 010 D1) que solo tienen email.
- **D3** — Estados visibles: `pending` + `paid` + `cancelled` (a diferencia de
  "Mis compras", spec 012, que excluye `pending`) — el admin necesita ver
  pedidos atascados para diagnosticar webhooks fallidos, como el incidente real
  resuelto el 2026-09-14/15.
- **D4** — Detalle en página propia `/admin/orders/[id]`, no un `Dialog` — mismo
  patrón que `admin/roles/[id]`.

## Alcance
Incluye: listado paginado con filtros (fecha, estado, cliente), detalle de un
pedido, permiso `orders.read`.

No incluye: cambio de estado, reembolsos, exportar, notificaciones, edición de
ningún campo del pedido.

## Contexto verificado
- `orders`/`order_items` ya existen (specs 010/011), sin cambios de esquema.
- Patrón de filtro de fecha en zona `America/Lima` (offset fijo `-05:00`, `to`
  inclusivo) ya resuelto en spec 012 (`src/app/api/orders/route.ts`).
- Patrón `buildFilters` + `new PgDialect().sqlToQuery()` para probarlo sin BD ya
  usado y testeado en `product.repository.ts`, `category.repository.ts` y
  `user.repository.ts` (con sus `*.test.ts`).
- `src/app/(admin)/admin/orders/` y `src/app/api/admin/orders/` hoy solo tienen
  `.gitkeep` — nada que reutilizar salvo el patrón de `admin/products` y
  `admin/users`.
- `src/lib/permissions.ts` → `PERMISSIONS` no tiene ningún código `orders.*`
  todavía.
- `src/modules/orders/` ya existe (spec 012, "Mis compras", storefront): schema,
  service y hooks propios del cliente, con `requireAuth()` y scoping al usuario
  de la sesión — no sirve tal cual para el admin, que necesita ver pedidos de
  cualquier usuario y no exige que el pedido sea suyo.

## Criterios de aceptación
- [x] AC1 — Un usuario con `orders.read` ve `/admin/orders`: tabla con fecha,
      cliente (email), nº de líneas, total, badge de estado, paginada.
- [x] AC2 — Filtro de fecha (`from`/`to`) acota por `created_at` en zona Lima,
      `to` inclusivo — mismo criterio que spec 012.
- [x] AC3 — Filtro de estado: multi-selección entre `pending`/`paid`/`cancelled`;
      sin filtro = todos.
- [x] AC4 — Filtro de cliente: texto libre, busca por ILIKE en `orders.email` y
      en `users.firstName`/`lastName` cuando `user_id` no es null.
- [x] AC5 — Clic en una fila navega a `/admin/orders/[id]`: líneas (producto,
      cantidad, precio unitario, subtotal), cliente, total, estado, ids de
      Stripe (`stripe_checkout_session_id`/`stripe_payment_intent_id`) como
      referencia de solo lectura.
- [x] AC6 — Un id inexistente devuelve `notFound()` (404), no una página en
      blanco ni un 500.
- [x] AC7 — Sin el permiso `orders.read` → 403 en la API; el link de
      "Órdenes" no aparece en el sidebar del admin para ese usuario.
- [x] AC8 — Estados de carga (skeleton) y de error en la tabla y en el detalle.
- [x] AC9 — `npm run typecheck && npm run lint && npm run test && npm run build`
      en verde.

## Datos
Sin migración. `orders`, `order_items`, `users` ya existen tal cual.

## API
| Método | Ruta | Auth | Query | Response |
|---|---|---|---|---|
| GET | `/api/admin/orders` | `requirePermission('orders.read')` | `from`, `to`, `status[]`, `search`, `page`, `pageSize`, `sortBy`, `sortDir` | `{ data, total, page, pageSize }` · 400 · 403 |
| GET | `/api/admin/orders/[id]` | `requirePermission('orders.read')` | — | pedido + líneas · 404 · 403 |

Zod: `adminOrdersQuerySchema` (fechas `YYYY-MM-DD`, `status[]` del enum
`order_status`, `search` opcional, paginación con los mismos defaults que
`product`/`category`/`user`).

## Reutilizar
- Patrón `buildFilters` + `PgDialect().sqlToQuery()` de `product.repository.ts` /
  `category.repository.ts` / `user.repository.ts` (y sus tests).
- Patrón de fecha `America/Lima` de `src/app/api/orders/route.ts` (spec 012).
- `orderRepository.listItems` (spec 011) para las líneas del detalle.
- TanStack Table del patrón de `admin/products`/`admin/users`.
- `requirePermission`/`authErrorResponse` (`src/lib/auth.ts`, `src/lib/permissions.ts`).
- `formatPrice` (`src/lib/utils.ts`).
- Componentes shadcn ya instalados: `table`, `badge`, `select`, `input`, `skeleton`.
- **No** reutilizar `src/modules/orders/` de spec 012 tal cual (está scopeado al
  usuario de la sesión) — el admin necesita su propio módulo cliente.

## Tareas
- [x] T1 — `orders.read` en `PERMISSIONS` (`src/lib/permissions.ts`) + seed.
- [x] T2 — `order.repository.ts`: `listForAdmin(params)` con `buildFilters`
      (fecha/estado/cliente, join a `users` para el nombre) + paginación, y
      `findByIdForAdmin(id)` (sin scoping a usuario) · verif: AC1-AC4, AC6.
- [x] T3 — `adminOrdersQuerySchema` Zod · `src/modules/orders-admin/schemas/`
      (o el nombre de módulo que el `developer` fije siguiendo `docs/SETUP.md`).
- [x] T4 — `GET /api/admin/orders` · `src/app/api/admin/orders/route.ts` ·
      verif: AC1-AC4, AC7, AC9.
- [x] T5 — `GET /api/admin/orders/[id]` · `src/app/api/admin/orders/[id]/route.ts`
      · verif: AC5, AC6, AC7.
- [x] T6 — Módulo cliente admin: schema, service (axios), hooks (TanStack Query)
      · verif: typecheck.
- [x] T7 — `admin/orders/page.tsx`: tabla + filtros (fecha/estado/cliente) ·
      verif: AC1-AC4, AC8.
- [x] T8 — `admin/orders/[id]/page.tsx`: detalle · verif: AC5, AC6, AC8.
- [x] T9 — Pruebas unitarias de `buildFilters` con `PgDialect`, mismo patrón que
      `product.repository.test.ts`/`category.repository.test.ts`/
      `user.repository.test.ts` · verif: AC9.
- [x] T10 — `npm run typecheck && npm run lint && npm run test && npm run build`
      en verde.

## Implementación (2026-09-18)

`npm run typecheck` ✓ · `npm run lint` ✓ · `npm run test` ✓ (147 pruebas, 0 fallos)
· `npm run build` ✓ (`/admin/orders`, `/admin/orders/[id]`, `/api/admin/orders`,
`/api/admin/orders/[id]` como `ƒ`). Sin migración: `drizzle/` intacto.

Archivos:
- `src/lib/permissions.ts` — `orders.read`. El seed deriva los códigos de
  `PERMISSIONS` y rellena la matriz con `onConflictDoNothing`, así que no hubo
  nada que tocar en `seed.ts`: basta **volver a correr `npm run db:seed`** para
  que `super_admin`/`admin` reciban el permiso nuevo. Los demás roles de sistema
  (`manager`, `employee`, `audit`) siguen sin `orders.read`: cambiar esa matriz
  es decisión de negocio fuera del alcance de este spec, se concede desde la UI
  de roles.
- `src/lib/utils.ts` — `startOfLimaDay` / `endOfLimaDay` extraídos (estaban
  dentro de `src/app/api/orders/route.ts`, spec 012, que ahora los importa). Una
  sola definición del criterio de zona horaria para storefront y panel.
- `src/server/repositories/order.repository.ts` — `buildAdminFilters`,
  `listForAdmin`, `findByIdForAdmin` y la selección con `customerName`,
  `customerEmail` (`coalesce(orders.email, users.email)`) e `itemCount` por
  subconsulta correlacionada. `leftJoin` a `users` (los pedidos de invitado no
  tienen `user_id`). No se tocó `listByUser` ni `findByIdForUser`.
- `src/server/repositories/order.repository.test.ts` — `buildAdminFilters` con
  `PgDialect().sqlToQuery()`: búsqueda, estados, lista de estados vacía = todos,
  y los dos cortes de fecha en Lima (`from` ⇒ `05:00Z`, `to` inclusivo ⇒
  `05:00Z` del día siguiente).
- `src/modules/orders-admin/` — `schemas/admin-order.schema.ts` (query Zod,
  estados, DTOs serializados), `constants.ts` (etiquetas/variantes de estado y
  formateador `America/Lima`), `services/admin-order.service.ts`,
  `hooks/use-admin-orders.ts` (`useAdminOrders` + `useAdminOrder`, sin reintento
  ante 404), `components/admin-order-table.tsx`, `admin-order-columns.tsx`,
  `admin-order-detail.tsx`. Módulo propio, sin tocar `src/modules/orders/`.
- `src/app/api/admin/orders/route.ts` y `[id]/route.ts` —
  `requirePermission('orders.read')` → `safeParse` → repositorio.
- `src/app/(admin)/admin/orders/page.tsx` y `[id]/page.tsx` — Server Components
  con `can('orders.read')` → `notFound()`; la UI de datos es cliente.
- `src/components/shared/admin-nav.tsx` — entrada «Pedidos» filtrada por
  `orders.read` (AC7).
- `src/components/shared/data-table.tsx` — prop opcional `onRowClick` (AC5). La
  fila además lleva un enlace «Ver detalle» enfocable: el `onClick` del `<tr>`
  no llega por teclado.
- `src/modules/roles/components/role-permission-matrix.tsx` — etiqueta
  «Pedidos» para el recurso nuevo, si no la matriz mostraría `orders` en crudo.

Decisiones de implementación:
- **Estado multi-selección por lista de comas** (`?status=pending,paid`), no
  parámetro repetido: la query se lee con `Object.fromEntries(searchParams)`,
  que se quedaría solo con el último valor (mismo motivo que `commaList` en
  `product.schema.ts`). Lista vacía ⇒ sin filtro, no "ningún estado" (AC3).
- **AC6 desde el cliente**: el detalle se carga con el hook y, si el handler
  responde 404, el componente llama `notFound()` — el `NotFoundBoundary` del
  router lo atiende igual que en un Server Component. Un uuid mal formado
  también es 404 en el handler, no un 500 de Postgres.
- **Orden** limitado a `createdAt` y `totalCents`; el resto de columnas con
  `enableSorting: false`.

Pendiente de QA manual (necesita BD y sesión reales):
- `npm run db:seed` para sembrar `orders.read` y concederlo a los roles que
  toque desde `/admin/roles`.
- AC1-AC5 y AC8 en `/admin/orders` con datos reales (incluido un pedido de
  invitado, sin `user_id`, y uno atascado en `pending`).
- AC7 con un usuario del staff **sin** `orders.read`: 403 en
  `/api/admin/orders`, sin enlace «Pedidos» en el sidebar y `notFound()` al
  teclear la URL.

## Notas
- **Zona horaria**: mismo cuidado que spec 012 — el filtro y cualquier
  agrupación por fecha deben usar `America/Lima` de forma consistente entre
  servidor y cliente.
- **Módulo cliente separado del de spec 012**: `src/modules/orders/` (storefront,
  "Mis compras") exige sesión propia y scoping a `userId`; mezclarlo con el
  admin (que ve pedidos de cualquiera) sería el tipo de `if` que CLAUDE.md
  pide evitar — mejor un módulo propio aunque repita algo de forma, que un
  módulo con una bandera "es admin" por dentro.

## Cierre

Reviewer: **APROBADO** iteración 1/2 (tope de 5 rondas de `subagent-driven-development`,
no se necesitó ninguna). typecheck / lint / test (147/147) / build — verdes, corridos
por el propio reviewer, no solo reportados por el developer.

Hallazgos menores, no bloqueantes, dejados en el ledger:
- `.gitignore` traía un bloque duplicado (`.vercel`/`.env*`) de un `vercel link`
  anterior — limpiado al cerrar este spec.
- `startOfLimaDay`/`endOfLimaDay` (`src/lib/utils.ts`) no tienen test directo en
  `utils.test.ts`, solo cobertura indirecta vía `order.repository.test.ts`.
  Fórmula idéntica a la que reemplazó en spec 012 (movida, no reescrita) — sin
  riesgo de regresión hoy, pero un test directo blindaría el contrato compartido
  ante un cambio futuro en cualquiera de los dos llamadores.

Pendiente de QA manual (necesita BD real): `npm run db:seed` para que `orders.read`
llegue a `super_admin`/`admin`; recorrido de AC1-AC5/AC8 con datos reales,
incluido un pedido de invitado y uno en `pending`; AC7 con un usuario del staff
sin el permiso.
