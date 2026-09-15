---
id: 012
title: Mis compras en el perfil
status: done
module: orders
scope: client
---

# 012 — Mis compras en el perfil

## Objetivo
Un cliente con sesión puede ver sus pedidos agrupados por día, filtrarlos por mes actual
o rango de fechas, y abrir un diálogo con el detalle y la boleta de Stripe.

## Alcance
Incluye: `GET /api/orders` (pedidos del usuario + líneas, filtro `from`/`to`),
`GET /api/orders/[id]/receipt` (proxy autenticado a la boleta), query nueva en
`order.repository`, módulo `src/modules/orders/` (schema, service, hook, filtro, lista
agrupada, dialog), reemplazo del `EmptySection` de la pestaña «compras».
No incluye: reembolsos, recomprar, paginación, export CSV, notificaciones, favoritos.

## Decisiones (resueltas por el usuario, 2026-09-09)
- **D1 — «boleta de Stripe» = opción A sin persistir.** Se activa
  `invoice_creation: { enabled: true }` en `/api/checkout/session` (T4). El proxy
  `GET /api/orders/[id]/receipt` (T5) hace
  `stripe.checkout.sessions.retrieve(sessionId, { expand: ["invoice"] })` en el click y
  responde `302` al `invoice_pdf`. **Sin columna, sin migración, sin tocar el webhook.**
  Coste: una llamada a Stripe por descarga. Los pedidos pagados **antes** del cambio no
  tendrán factura → el proxy responde `404` y el botón «Descargar boleta» se oculta.
- **D2 — Estados listados = `paid` y `cancelled`** (con badge). `pending` se excluye:
  son sesiones de pago a medio camino, no compras.
- **D3 — Agrupación.** Encabezado por **día** (`es-PE`, `dateStyle: "long"`), días en orden
  descendente. Sin encabezado adicional de mes/año: el filtro ya acota el periodo.

## Criterios de aceptación
- [x] AC1 — Dado un usuario con pedidos `paid` en el mes actual, cuando abre `/perfil` →
      «Mis compras», entonces ve sus compras agrupadas bajo encabezados de día descendentes.
- [x] AC2 — Cada tarjeta muestra hora, nº de líneas, total (`formatPrice`) y badge de estado.
- [x] AC3 — El filtro arranca en «Mes actual»; al elegir «Rango» aparecen `desde`/`hasta` y
      la lista se recarga sin recargar la página. `hasta` es inclusivo.
- [x] AC4 — Sin pedidos en el periodo: estado vacío propio («No hay compras en este periodo»).
- [x] AC5 — Mientras carga se ven skeletons; ante error, mensaje con botón «Reintentar».
- [x] AC6 — «Ver detalle» abre un `Dialog` con las líneas (producto, cantidad, precio
      unitario, subtotal de línea) y el total del pedido.
- [x] AC7 — En el dialog de un pedido con boleta hay «Descargar boleta» que apunta a
      `/api/orders/[id]/receipt` y termina en el PDF de Stripe. Sin boleta, el botón no se
      muestra (o se muestra deshabilitado con nota).
- [x] AC8 — `GET /api/orders` sin sesión responde `401`; nunca devuelve pedidos de otro
      usuario. `GET /api/orders/[id]/receipt` de un pedido ajeno responde `404`.
- [x] AC9 — `from`/`to` inválidos (no `YYYY-MM-DD`, o `from > to`) responden `400`.

## Datos
Sin cambios de esquema (con D1 = A). `orders.stripe_checkout_session_id` ya guarda el enlace
a Stripe y `orders_user_id_idx (user_id, created_at desc)` ya cubre la consulta.
Si se eligiera persistir la factura, sería `orders.stripe_invoice_id text unique` + migración.

## API
| Método | Ruta | Auth | Body / Query | Response |
|---|---|---|---|---|
| GET | `/api/orders` | sesión (`requireAuth`) | `?from=YYYY-MM-DD&to=YYYY-MM-DD` (ambos opcionales) | `200 { orders: (Order & { items: OrderItem[] })[] }` · `400` · `401` |
| GET | `/api/orders/[id]/receipt` | sesión (`requireAuth`) | — | `302` al `invoice_pdf` · `404` sin boleta o pedido ajeno · `401` |

Zod: `ordersQuerySchema` en `src/modules/orders/schemas/order.schema.ts` — `from`, `to`
opcionales con formato `YYYY-MM-DD`, `refine` de `from <= to`. Las fechas son día local de
Lima: el handler las convierte a instante con offset fijo `-05:00` (Perú no usa DST) y suma
un día a `to` para hacerlo inclusivo.

## Reutilizar
- `src/lib/auth.ts` — `requireAuth()` + `authErrorResponse(error)` para el 401.
- `src/lib/stripe.ts` — singleton `stripe` en el proxy de la boleta.
- `src/lib/utils.ts` — `formatPrice` (nunca dividir por 100 a mano).
- `src/lib/axios.ts` — `api` y `ApiError` en el service/hook.
- `src/modules/checkout/{schemas,services,hooks}` — patrón exacto de módulo cliente.
- `src/app/api/checkout/session/route.ts` — patrón de handler (`safeParse` → repo → `console.error`).
- `src/server/repositories/order.repository.ts` — `listByUser` (se amplía) y `listItems`.
- `src/components/ui/{dialog,tabs,card,badge,button,separator,skeleton,select}.tsx` — ya instalados.
- Estado vacío: reutilizar el patrón visual de `EmptySection` de `perfil/page.tsx`.
- **No instalar** `calendar`/`popover`: el rango va con dos `<input type="date">` nativos.

## Tareas
- [x] T1 — Ampliar `listByUser(userId, { from?, to?, statuses })` a pedidos + líneas (segunda
      consulta con `inArray(orderItems.orderId, ids)` y agrupado en memoria) · `src/server/repositories/order.repository.ts`
- [x] T2 — `ordersQuerySchema` + tipo `OrderWithItems` · `src/modules/orders/schemas/order.schema.ts`
- [x] T3 — Handler `GET /api/orders` · `src/app/api/orders/route.ts`
- [x] T4 — (D1=A) Añadir `invoice_creation: { enabled: true }` · `src/app/api/checkout/session/route.ts`
- [x] T5 — Handler `GET /api/orders/[id]/receipt`: verifica dueño, `sessions.retrieve` con
      `expand: ["invoice"]`, `redirect(invoice.invoice_pdf)` · `src/app/api/orders/[id]/receipt/route.ts`
- [x] T6 — Service `fetchOrders({ from, to })` · `src/modules/orders/services/order.service.ts`
- [x] T7 — Hook `useOrders(range)` con `queryKey: ["orders", range]` · `src/modules/orders/hooks/use-orders.ts`
- [x] T8 — `<PurchaseFilters>` (select mes actual / rango + dos `input type="date"`) · `src/modules/orders/components/purchase-filters.tsx`
- [x] T9 — `<PurchaseList>`: agrupa por día (`Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima" })`),
      encabezados, tarjetas, skeleton/error/vacío · `src/modules/orders/components/purchase-list.tsx`
- [x] T10 — `<PurchaseDetailDialog>`: líneas, total y botón de boleta · `src/modules/orders/components/purchase-detail-dialog.tsx`
- [x] T11 — `<PurchasesTab>` (`"use client"`, filtro + lista) y sustituir el `EmptySection` de
      la pestaña «compras» · `src/modules/orders/components/purchases-tab.tsx`, `src/app/(storefront)/perfil/page.tsx`

Verificación final: `npm run typecheck && npm run lint` (el `build` lo corre el reviewer)

## Implementación (2026-09-09)

Todas las tareas T1–T11 están hechas. `typecheck` ✓ y `lint` ✓.

Decisiones de implementación tomadas dentro del alcance del spec:
- **AC7 — botón siempre visible en pedidos `paid`**, con nota bajo él («Las compras
  anteriores a la facturación automática no tienen boleta disponible»). El spec admitía
  ocultarlo, pero saber si hay factura exige una llamada extra a Stripe por pedido; el
  proxy ya responde `404` y el enlace abre en pestaña nueva. Los pedidos `cancelled` no
  muestran botón.
- **Rango invertido**: `<PurchaseFilters>` no dispara la consulta si `desde > hasta`;
  muestra una nota inline. El `400` del handler (AC9) sigue siendo la frontera real.
- **Repositorio**: `listByUser(userId, { from?, to?, statuses })` con `to` **exclusivo**
  (el handler suma el día) y segunda consulta `inArray` para las líneas. Se añadió
  `findByIdForUser(id, userId)` para el proxy de la boleta: la pertenencia va en el
  `WHERE`, así el `404` no distingue «ajeno» de «inexistente».
- **Zona horaria** verificada con un script puntual: un pedido de las 20:00 de Lima
  (01:00Z del día siguiente) entra en el filtro `to` de ese mismo día y se agrupa bajo su
  encabezado correcto.

Pendiente de QA manual (necesita BD y Stripe reales): AC1–AC7 en `/perfil` con un usuario
con pedidos, y una compra **nueva** de punta a punta para comprobar que `invoice_creation`
genera factura y que «Descargar boleta» acaba en el PDF. Las compras previas al cambio
darán `404` (esperado, D1).

## Notas
- **Checkout de invitado (spec 010 D1):** `orders.user_id` solo se llena si había sesión de
  Clerk al pagar. Una compra hecha como invitado —aunque use el mismo email— **no** aparece
  aquí. Limitación esperada; enlazar por email sería otra spec.
- **Boletas retroactivas:** con D1=A solo las compras posteriores al cambio tienen `invoice`.
- **Zona horaria:** el agrupado por día y el filtro deben usar el mismo criterio
  (`America/Lima`); si el server corta por UTC y el cliente agrupa por Lima, un pedido de las
  20:00 se ve en el día equivocado o cae fuera del rango.
- **`X-Frame-Options`:** ni `hosted_invoice_url` ni `receipt_url` se pueden embeber en un
  iframe dentro del `Dialog`; el PDF se sirve por redirect, no incrustado.

## Revisión (2026-09-09) — APROBADO

`typecheck` ✓ · `lint` ✓ · `build` ✓ (32 rutas, `/api/orders` y `/api/orders/[id]/receipt` como `ƒ`).

Verificado por lectura:
- **AC8 / aislamiento.** `GET /api/orders` → `listByUser(userId, …)` con `eq(orders.userId, userId)`
  siempre en el `WHERE`; imposible pedir por otro. `GET /api/orders/[id]/receipt`: `requireAuth`
  (401) → uuid inválido → 404 → `findByIdForUser(id, userId)` con la pertenencia en el `WHERE`
  (ajeno == inexistente == 404) → sin `stripeCheckoutSessionId` → 404 → sin `invoice`/`invoice_pdf`
  → 404. Un único `notFound()` para todos los casos.
- **Zona horaria.** Filtro y agrupado comparten criterio `-05:00` == `America/Lima` (sin DST).
  Pedido 20:00 Lima (01:00Z día+1): `to` del día Lima → `01:00Z < 05:00Z (día+1)` ✓ dentro del
  rango; `dayFormatter` con `timeZone: America/Lima` lo agrupa bajo su día Lima ✓. `currentMonthRange()`
  usa `en-CA` + `America/Lima`, mismo huso.
- **AC9.** `ordersQuerySchema`: `z.iso.date()` rechaza formatos no `YYYY-MM-DD`; `refine` `from <= to`
  (comparación lexicográfica válida para ese formato). Handler devuelve 400 con `issues`.
- **Receipt proxy.** `invoice_pdf` solo aparece en `NextResponse.redirect(pdfUrl, 302)`; nunca en HTML.
- **Arquitectura.** Fetch por `service` + hook TanStack Query; consultas solo en `order.repository`;
  `"use client"` en `modules/orders/**`, `perfil/page.tsx` sigue siendo Server Component; carga
  (skeletons) / error (Reintentar) / vacío presentes; sin `catch {}` vacío ni `any`/`@ts-ignore`.
- **T4.** Repo sin historial previo (todo untracked, un solo commit) → no hay `git diff` contra el
  que contrastar; `session/route.ts` se leyó entero: única adición coherente es
  `invoice_creation: { enabled: true }`.
- **Sin migración.** `drizzle/` sigue en `0004`; `order.ts` sin `stripe_invoice_id`.
- **security-review skill.** No arrancó (necesita `origin/HEAD`, ausente en repo de un solo commit).
  Superficie IDOR del proxy revisada a mano: sólida.

Observación MENOR (no bloquea): **AC7** — botón «Descargar boleta» visible y *habilitado* en todo
pedido `paid`, con nota al pie. El AC pedía ocultarlo o mostrarlo *deshabilitado*. Saber si hay
factura exige una llamada a Stripe por pedido (coste real no presupuestado); el proxy responde 404
limpio y la nota advierte. Limitación transitoria: todo pedido nuevo tendrá factura. Aceptado.

Pendiente de QA manual (arrastrado, necesita BD + Stripe reales): AC1–AC7 en `/perfil` y una compra
nueva de punta a punta que confirme que `invoice_creation` emite factura y que «Descargar boleta»
acaba en el PDF.
