---
id: 018
title: Admin — Cambio manual de estado de una orden
status: done
module: orders-admin
scope: client
---

# 018 — Admin: Cambio manual de estado de una orden

## Objetivo
Un miembro del staff con `orders.update` cambia el estado de un pedido
(`pending`/`paid`/`cancelled`) desde el listado o desde el detalle, con
confirmación previa y registro en `audit_logs`.

## Decisiones (resueltas con el usuario, brainstorming 2026-09-20)
- **D0 — Revierte la D1 de la spec 014** ("solo lectura, el estado lo mueve solo
  el webhook de Stripe"). A partir de aquí el estado tiene dos fuentes: el
  webhook (spec 011) y esta mutación manual del staff.
- **D1 — Transición libre.** De cualquier estado a cualquier otro, sin máquina de
  estados. Incluye marcar `paid` a mano sin cobro real en Stripe: **riesgo de
  negocio aceptado explícitamente por el usuario**, no se bloquea en el backend.
- **D2 — Permiso nuevo `orders.update`**, separado de `orders.read` (mismo patrón
  que `products.read`/`products.update`).
- **D3 — UI en dos lugares**: un `Select` de estado por fila en la tabla
  (`admin-order-columns.tsx`) y otro en la página de detalle
  (`admin-order-detail.tsx`).
- **D4 — Confirmación siempre**: cualquier cambio, sea cual sea el destino, pasa
  por un `alert-dialog` antes de aplicarse (mismo componente que ya usan las
  eliminaciones de products/categories/expenses).
- **D5 — API**: `PATCH /api/admin/orders/[id]/status`, body
  `{ status: 'pending' | 'paid' | 'cancelled' }` validado con Zod contra el enum
  `orderStatus` ya existente. `requirePermission('orders.update')`.
- **D6 — Repositorio**: `updateStatus(id, status, actorId)` con `logAudit` dentro
  de la misma `db.transaction`; el `changes` guarda estado anterior y nuevo
  (acción `order.status_changed`), sin PII.
- **D7 — Nav/permisos**: `orders.update` se añade a `PERMISSIONS`. El recurso
  `orders` ya tiene etiqueta en `RESOURCE_LABELS` desde la spec 014: solo aparece
  la acción nueva en la matriz, sin tocar ese archivo.

## Alcance
Incluye: permiso `orders.update`, endpoint `PATCH .../status`, mutación auditada,
`Select` + confirmación en tabla y detalle.

No incluye: reembolsos ni nada contra la API de Stripe, ajuste de stock al
cambiar de estado, notificación al cliente, estados nuevos, edición de cualquier
otro campo del pedido, historial visible de cambios en la UI.

## Contexto verificado
- `src/server/db/schema/order.ts:15` — `orderStatus` pgEnum con los tres valores;
  `updatedAt` ya se refresca solo (`$onUpdate(now())`). Sin migración.
- `src/server/repositories/order.repository.ts` — hoy solo muta estado desde el
  webhook (`markPaid`/`markCancelled`, ambas con `WHERE` condicional y `tx`
  recibida por parámetro). Ninguna de las dos sirve: la manual no filtra por
  `sessionId` ni por estado previo. Las lecturas de admin (`listForAdmin`,
  `findByIdForAdmin`, `adminOrderSelection`) se quedan como están.
- `src/server/repositories/category.repository.ts:186` `setActive` — patrón exacto
  a copiar: `db.transaction` → `update ... returning()` → `logAudit(tx, …)` →
  `null` si no hubo fila.
- `src/app/api/admin/expenses/[id]/route.ts:17` — patrón de `PATCH` admin:
  valida id → `actorId = (await requirePermission(...)).id` → `request.json()` en
  try/catch → `safeParse` → repositorio → 404 si `null`.
- `src/modules/orders-admin/schemas/admin-order.schema.ts` — ya exporta
  `ADMIN_ORDER_STATUSES`, `adminOrderIdSchema` y `AdminOrderDto`; no hay ningún
  schema de mutación todavía.
- `src/modules/orders-admin/components/admin-order-columns.tsx:61` — la columna
  `status` es hoy un `Badge` de solo lectura y `adminOrderColumns()` no recibe
  props; hay que pasarle el callback de cambio.
- `admin-order-detail.tsx:69` — el `Field "Estado"` es otro `Badge`; ahí entra el
  segundo control.
- `src/modules/orders-admin/hooks/use-admin-orders.ts` — solo queries, sin
  `useMutation`; `adminOrdersQueryKey = ["admin-orders"]` cubre lista y detalle
  por prefijo.
- `src/lib/permissions.ts:71` — existe `orders.read`, no existe `orders.update`.
- `src/components/ui/`: `select.tsx`, `alert-dialog.tsx`, `badge.tsx` ya
  instalados. **No instalar nada.**
- `metrics.repository.ts:61,112` y `finance.repository.ts:19` filtran por
  `status = 'paid'`: un cambio manual mueve Tablero y Finanzas.

## Criterios de aceptación
- [ ] AC1 — Con `orders.update`, cada fila de `/admin/orders` muestra un `Select`
      con los tres estados y el actual seleccionado.
- [ ] AC2 — Elegir un estado abre el `alert-dialog` de confirmación (siempre,
      cualquier transición); cancelar deja el pedido y el `Select` como estaban.
- [ ] AC3 — Confirmar aplica el cambio: la fila muestra el estado nuevo sin
      recargar la página, con toast de éxito.
- [ ] AC4 — Mismo control y mismo flujo en `/admin/orders/[id]`.
- [ ] AC5 — Cualquier transición es válida, incluida `cancelled → paid` y
      `paid → pending` (D1).
- [ ] AC6 — Un usuario con `orders.read` pero sin `orders.update` ve los estados
      como badge de solo lectura, sin `Select`; el `PATCH` le responde 403.
- [ ] AC7 — Id inexistente o uuid mal formado → 404; body inválido → 400.
- [ ] AC8 — Cada cambio deja una fila en `audit_logs` con acción
      `order.status_changed`, `entityId` del pedido, `actorId` y
      `changes = { before: { status }, after: { status } }`. Sin email ni datos
      de Stripe en el log.
- [ ] AC9 — Error de la mutación → toast de error y el estado mostrado vuelve al
      anterior (no queda una UI mintiendo).
- [x] AC10 — `npm run typecheck && npm run lint && npm run test && npm run build`
      en verde.

## Datos
Sin migración. `orders.status` ya es `order_status` y `audit_logs` ya existe.

## API
| Método | Ruta | Auth | Body | Response |
|---|---|---|---|---|
| PATCH | `/api/admin/orders/[id]/status` | `requirePermission('orders.update')` | `{ status }` | `AdminOrderDto` · 400 · 403 · 404 |

Zod: `updateOrderStatusSchema` en
`src/modules/orders-admin/schemas/admin-order.schema.ts` —
`z.object({ status: z.enum(ADMIN_ORDER_STATUSES) })`, derivado del enum ya
existente, sin repetir los literales.

## Reutilizar
- `db.transaction` + `logAudit` de `category.repository.ts` → `setActive`.
- Forma del handler: `src/app/api/admin/expenses/[id]/route.ts` (PATCH).
- `adminOrderIdSchema`, `ADMIN_ORDER_STATUSES`, `AdminOrderDto`
  (`admin-order.schema.ts`) y `ORDER_STATUS_LABELS`/`ORDER_STATUS_VARIANTS`
  (`src/modules/orders-admin/constants.ts`).
- `adminOrdersQueryKey` — invalidar el prefijo refresca lista y detalle (AC3/AC4).
- Patrón de hook de mutación con `sonner`: `src/modules/finance/hooks/use-expense-mutations.ts`.
- Patrón de `AlertDialog` de confirmación: `src/modules/finance/components/expense-table.tsx`.
- `requirePermission`/`authErrorResponse`, `api` de `src/lib/axios.ts`.
- shadcn `select`, `alert-dialog`, `badge` — ya instalados.

## Tareas
- [x] T1 — `orders.update` en `PERMISSIONS` (`src/lib/permissions.ts`).
- [x] T2 — `updateOrderStatusSchema` · `src/modules/orders-admin/schemas/admin-order.schema.ts`.
- [x] T3 — `updateStatus(id, status, actorId)` en
      `src/server/repositories/order.repository.ts`: `db.transaction`, lee el
      estado previo, `update ... returning()`, `logAudit` con
      `order.status_changed`, devuelve `null` si no existe · verif: AC5, AC7, AC8.
- [x] T4 — `PATCH /api/admin/orders/[id]/status` ·
      `src/app/api/admin/orders/[id]/status/route.ts` · verif: AC6, AC7.
- [x] T5 — `updateAdminOrderStatus` en `services/admin-order.service.ts` +
      `useUpdateAdminOrderStatus` en `hooks/use-admin-orders.ts` (invalida
      `adminOrdersQueryKey`, toasts de éxito/error) · verif: AC3, AC9.
- [x] T6 — Componente compartido `admin-order-status-select.tsx` (`Select` +
      `AlertDialog`; sin permiso, renderiza el `Badge` actual) ·
      `src/modules/orders-admin/components/` · verif: AC1, AC2, AC6.
- [x] T7 — Montarlo en la columna `status` de `admin-order-columns.tsx`
      (`adminOrderColumns({ canUpdate })`, propagado desde `admin-order-table.tsx`
      y la page con `can('orders.update')`) · verif: AC1, AC3.
- [x] T8 — Montarlo en el `Field "Estado"` de `admin-order-detail.tsx` (la page
      del detalle le pasa `canUpdate`) · verif: AC4.
- [x] T9 — Test unitario de `updateStatus` en el estilo ya usado en
      `order.repository.test.ts` · verif: AC8.
- [x] T10 — `npm run typecheck && npm run lint && npm run test && npm run build`.

## Notas
- **`npm run db:seed`** tras T1 para que `orders.update` llegue a la tabla
  `permissions`; concederlo a roles no-`admin` es decisión de negocio, se hace
  desde `/admin/roles`.
- **El stock no se toca.** El descuento de stock vive en el cumplimiento del
  webhook (spec 011); marcar `paid` a mano no lo dispara, ni `cancelled` lo
  devuelve. Consecuencia conocida de D1, fuera de alcance.
- **Carrera con el webhook**: un pedido puesto a `cancelled` a mano puede volver
  a `paid` si llega después un `checkout.session.completed` (el `WHERE` de
  `markPaid` solo excluye `status = 'paid'`). Se acepta: el webhook refleja un
  cobro real y debe ganar.
- Tablero (spec 015) y Finanzas (spec 017) cuentan solo pedidos `paid`: un cambio
  manual altera sus cifras. Se refrescan por su propio intervalo, no se invalidan
  desde este hook.

## Implementación (2026-09-20)

Archivos nuevos:
- `src/app/api/admin/orders/[id]/status/route.ts` — `PATCH` con
  `requirePermission('orders.update')`, uuid → 404, body → 400 (T4).
- `src/modules/orders-admin/components/admin-order-status-select.tsx` —
  `Select` + `AlertDialog`, o `Badge` de solo lectura sin permiso (T6).

Archivos tocados:
- `src/lib/permissions.ts` — `orders.update` (T1). Sembrado: `npm run db:seed`
  → "19 permisos, 6 roles, 53 pares rol-permiso".
- `src/modules/orders-admin/schemas/admin-order.schema.ts` —
  `updateOrderStatusSchema` sobre `ADMIN_ORDER_STATUSES` (T2).
- `src/server/repositories/order.repository.ts` — `updateStatus` +
  `applyStatusChange` con `logAudit` en la misma `tx` (T3).
- `src/modules/orders-admin/services/admin-order.service.ts` —
  `updateAdminOrderStatus` (T5).
- `src/modules/orders-admin/hooks/use-admin-orders.ts` —
  `useUpdateAdminOrderStatus` (T5).
- `src/modules/orders-admin/components/admin-order-columns.tsx` —
  `adminOrderColumns({ canUpdate })` y la columna `status` con el control (T7).
- `src/modules/orders-admin/components/admin-order-table.tsx` — prop `canUpdate`
  propagada a las columnas (T7).
- `src/modules/orders-admin/components/admin-order-detail.tsx` — prop
  `canUpdate` y el control en el campo "Estado" (T8).
- `src/app/(admin)/admin/orders/page.tsx` y `.../[id]/page.tsx` —
  `can('orders.update')` y textos de cabecera al día (T7, T8).
- `src/server/repositories/order.repository.test.ts` — 3 tests de
  `applyStatusChange` (T9).

Notas de implementación:
- **`applyStatusChange(tx, …)` exportada aparte de `updateStatus(id, …)`**: la
  firma del spec (`updateStatus(id, status, actorId)`) abre su propia
  `db.transaction`, lo que hace imposible probarla sin conexión. La `tx` por
  parámetro es el mismo patrón que ya usan `markPaid`/`markCancelled`, y deja
  verificar el payload de auditoría con una transacción de mentira (T9), en
  línea con el resto de tests del repositorio, que no abren conexión.
- **El estado previo se lee con un `select` dentro de la tx** antes del `UPDATE`:
  `returning()` solo devuelve la fila ya escrita y AC8 pide el `before`. Ese
  mismo `select` es el que decide el 404.
- **Sin actualización optimista** (AC9): el `Select` cuelga siempre del estado
  que devolvió el servidor, así que un error no deja nada que revertir; el
  cambio se ve tras invalidar `adminOrdersQueryKey` (AC3/AC4).
- **`stopPropagation` en el contenedor del control**: la fila de la tabla navega
  al detalle en su `onClick`; la guardia viaja con el componente (mismo criterio
  que `cart-qty-control.tsx`) para no depender de dónde se monte.
- El texto del diálogo avisa de que el cambio "no mueve el stock ni cobra nada
  en Stripe": es la consecuencia conocida de D1, dicha donde se decide.

Desviaciones:
- **Respuesta del `PATCH`**: devuelve la fila `orders` actualizada, no un
  `AdminOrderDto` completo (le faltan `customerName`/`customerEmail`/`itemCount`,
  que vienen del `join` de lectura). Construirlo exigiría una segunda consulta
  para un cuerpo que nadie lee: el cliente invalida y refetchea, y el service lo
  tipa como `Promise<void>`.
- **uuid mal formado → 404**, no 400: lo pide AC7 y es lo que ya hace el `GET`
  hermano; el 400 queda para el body inválido.

Pendiente de QA manual:
- AC1–AC5 en `/admin/orders` y `/admin/orders/[id]` con el rol `super_admin`:
  `Select` en cada fila, confirmación siempre, cancelar no cambia nada, éxito
  sin recargar y transiciones de ida y vuelta (`cancelled → paid`).
- AC6 con un rol que tenga `orders.read` y **no** `orders.update` (concederlo o
  revocarlo desde `/admin/roles`): badge de solo lectura y `PATCH` → 403.
- AC8: revisar la fila `order.status_changed` en `audit_logs` (actor, entityId y
  `changes` sin PII) contra la BD real.
- AC9: forzar un fallo del endpoint y comprobar toast de error + `Select` en el
  estado anterior.
- `npm run db:seed` completó la parte RBAC y falló al reponer el catálogo por la
  FK preexistente `order_items_product_id_products_id_fk` (deuda ya documentada,
  ajena a este spec): el permiso nuevo **sí** quedó en la tabla `permissions`.

## Cierre

Reviewer: **APROBADO** iteración 1/2 (tope de 5 rondas, no se necesitó ninguna).
typecheck / lint / test (170/170) / build — verdes, corridos por el reviewer
de forma independiente. Sin hallazgos bloqueantes ni mayores.

Las 3 desviaciones del developer, confirmadas por el reviewer:
- `applyStatusChange(tx, …)` + `updateStatus(id, …)`: mismo patrón ya usado
  por `markPaid`/`markCancelled` (tx por parámetro), tests cubren el payload
  de auditoría exacto, no solo el happy path.
- `PATCH` devuelve la fila cruda de `orders` (no `AdminOrderDto` completo):
  la UI refetchea vía invalidación de `adminOrdersQueryKey`, no lee la
  respuesta — consistente en tabla y detalle.
- Select previo a la auditoría dentro de la misma tx: sin condición de
  carrera nueva frente a la ya aceptada en §Notas. Precisión del reviewer
  (no bloqueante): en `READ COMMITTED` el `before` auditado podría no
  reflejar el estado inmediatamente anterior si el webhook comita entre el
  select y el update — mismo riesgo ya documentado, matiz menor.

`stopPropagation` en el contenedor del control confirmado como fix
necesario (la fila de la tabla navega al detalle en su `onClick`) y bien
ubicado. D7 confirmado: `role-permission-matrix.tsx` intacto.

Pendiente de QA manual (necesita BD y sesión real): recorrido de AC1-AC9
con datos reales — cambiar estado desde tabla y detalle, confirmar el
alert-dialog en cada transición, ver Dashboard/Finanzas moverse tras un
cambio manual de `paid`.
