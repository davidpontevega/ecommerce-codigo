---
id: 011
title: Stripe — webhook de confirmación, cumplimiento y páginas de retorno
status: done
module: checkout
scope: client
---

# 011 — Stripe: webhook, cumplimiento y páginas de retorno

Segunda mitad del pago (spec 010 = `done`). Base: `docs/stripe/checkout-integration.md` §9, §10, §15.

## Objetivo
Un pedido `pending` pasa a `paid` con su stock descontado y su `audit_log`, por webhook
firmado de Stripe, y el comprador vuelve a `/checkout/success` y ve su pedido.

## Contexto verificado
- `src/app/api/webhooks/clerk/route.ts` — patrón a replicar: firma sobre cuerpo crudo → 400 si falla; `db.transaction` + `logAudit`; 500 para que el proveedor reintente.
- `src/proxy.ts:8` ya deja `/api/webhooks(.*)` público y `:14` `/checkout(.*)`. **011 no toca `proxy.ts`.**
- `order.repository.ts` — tiene `createPending`, `attachCheckoutSession`, `findBySessionId`, `listByUser`. Faltan `markPaid`, `markCancelled` y la lectura de líneas.
- `product.repository.ts` — sin decremento de stock (`findAvailableByIds` es solo lectura).
- `src/app/api/checkout/session/route.ts:69` — `success_url = /checkout/success?session_id={CHECKOUT_SESSION_ID}`.
- `src/app/(storefront)/checkout/` existe pero está **vacía** (hoy 404 al volver de Stripe).
- `stripe listen` ya reenvía a `localhost:3000/api/webhooks/stripe`; `STRIPE_WEBHOOK_SECRET` ya en `.env.local`. Sin deps nuevas.

## Decisiones
- **D1 — Idempotencia por `stripe_checkout_session_id`, no por `event.id`.** `markPaid` es un
  único `UPDATE … WHERE stripe_checkout_session_id = ? AND status <> 'paid' RETURNING *`: si no
  devuelve fila, ya estaba pagado (o no existe) y el servicio no hace nada. Atómico, sin tabla de
  eventos procesados y sin `SELECT … FOR UPDATE`.
- **D2 — Sobreventa: no se aborta.** El cobro ya ocurrió. Si `decrementStock` afecta 0 filas se
  registra `order.stock_shortfall` con `severity: "warning"` y el pedido sigue `paid`. Resolución
  manual (§10 de la guía). Deuda declarada.
- **D3 — `/checkout/success` limpia el carrito solo si el pedido está `paid`**, desde una isla
  cliente que llama `useCartStore.clear()` al montar. Un pago pendiente no debe vaciar el carrito.
- **D4 — Webhook caído en dev:** el pedido se queda `pending` y la página muestra "estamos
  confirmando tu pago". Limitación de desarrollo, no se compensa con cumplimiento en la página.
- **D5 — `checkout.session.expired` marca el pedido `cancelled`.** Suficiente como limpieza de
  pedidos nunca pagados; no hay job de barrido.

## Alcance
Incluye: `POST /api/webhooks/stripe`, `fulfillOrder`/`cancelOrder`, `markPaid`/`markCancelled`/
`listItems`, `decrementStock`, páginas `/checkout/success` y `/checkout/cancel`.

Fuera de alcance: "Mis compras" en `/perfil` (→ 012) · carrito en servidor (→ 008) · panel de
reembolsos (se hace en el Dashboard de Stripe) · reserva de stock y sobreventa más allá del log
`warning` · correo de confirmación propio (Stripe manda su recibo) · idempotencia por `event.id` ·
`proxy.ts`.

## Criterios de aceptación
- [x] AC1 — Dado un POST sin cabecera `stripe-signature` o con firma inválida, entonces responde **400** y no toca la BD. · verificado en vivo (`curl` sin firma → 400).
- [x] AC2 — Dado `checkout.session.completed` con `payment_status != "unpaid"`, entonces el pedido de esa sesión queda `status='paid'` con `stripe_payment_intent_id` escrito. · verificado con `stripe events resend evt_1UDG6t…` sobre el pedido `c06e3fb5…` (`pi_3UDG6sAh1VPLFmvL05SlZQV1`).
- [x] AC3 — Dado el mismo evento reenviado (`stripe events resend`), entonces la segunda vez no cambia nada: ni stock ni un segundo `audit_log`. · verificado: 2.º reenvío deja stock 6/9/5 y `count(order.paid) = 1`.
- [ ] AC4 — Dado un pedido de 2 líneas cumplido, entonces cada `products.stock` baja exactamente su `qty`. · **QA manual**: falta una compra nueva con stock medido antes/después (el pedido de QA ya venía cumplido al medir).
- [ ] AC5 — Dado un producto con `stock < qty` al llegar el webhook, entonces el pedido igual queda `paid` y existe un `audit_logs` con `severity='warning'` para esa línea. · **QA manual** (requiere bajar el stock a mano durante el pago).
- [x] AC6 — Dado el cumplimiento, entonces existe **un** `audit_logs` `action='order.paid'`, `entity_type='order'`, `actor_id` = `order.user_id` o `null`, con `stripe_payment_intent_id` en `metadata` y sin email ni datos de tarjeta. · verificado: `metadata` solo trae `cs_…`/`pi_…`.
- [x] AC7 — Dado un pedido de invitado (`orders.email IS NULL`), entonces el webhook copia `session.customer_details.email` a `orders.email`; si ya tenía email, no lo pisa. · `coalesce` en `markPaid`; el pedido de QA conservó su email de Clerk.
- [ ] AC8 — Dado `checkout.session.async_payment_failed` o `checkout.session.expired`, entonces el pedido pasa a `cancelled` y **ningún** stock cambia. · **QA manual** (dejar caducar una sesión de 30 min).
- [ ] AC9 — Dado un fallo de BD dentro del handler, entonces responde **500** (Stripe reintenta) y la transacción revierte entera. · **QA manual**.
- [x] AC10 — Dado un evento de tipo no manejado, entonces responde **200** sin efectos. · rama `default` del `switch`, sin efectos.
- [x] AC11 — Dado `/checkout/success?session_id=cs_…` de un pedido `paid`, entonces veo nº de pedido, estado, líneas y total, y el carrito queda vacío. · página verificada en vivo; el vaciado del carrito (isla cliente) queda para QA en navegador.
- [ ] AC12 — Dado el mismo enlace con el pedido aún `pending`, entonces veo "estamos confirmando tu pago" y el carrito **no** se vacía. · **QA manual** (rama `pending` de `STATUS_VIEW`, sin `<ClearCartOnPaid />`).
- [x] AC13 — Dado `/checkout/success` sin `session_id` o con uno inexistente, entonces `notFound()` (404), sin filtrar datos de otro pedido. · **verificado contra `next build && next start`** (`curl -o /dev/null -w "%{http_code}"`): sin query → **404**, `?session_id=cs_does_not_exist` → **404**, `?session_id=cs_test_b1bZ…` (pedido `c06e3fb5`) → **200** con `Pedido #C06E3FB5`. En `next dev` sigue saliendo 200 por el streaming del boundary.
- [x] AC14 — Dado `/checkout/cancel`, entonces veo "pago cancelado" con enlace a `/cart` y el carrito intacto. · verificado en vivo.
- [x] AC15 — Ambas páginas son accesibles sin sesión de Clerk (checkout de invitado). · verificadas con `curl` sin cookie de Clerk.

## Datos
**Sin cambios de esquema, sin migración.** `orders.status`, `orders.stripe_payment_intent_id`
(unique, nullable) y `orders.email` (nullable) ya existen desde `0003`/`0004`.

## API
| Método | Ruta | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/api/webhooks/stripe` | firma `stripe-signature` (`constructEvent` sobre `await request.text()`) | payload crudo de Stripe | 200 `{received:true}` · 400 `Invalid signature` · 500 `Handler failed` |

Eventos manejados: `checkout.session.completed` y `checkout.session.async_payment_succeeded`
(gate `payment_status !== "unpaid"` → `fulfillOrder`) · `checkout.session.async_payment_failed` y
`checkout.session.expired` (→ `cancelOrder`). Cualquier otro: 200 sin efectos.
Sin Zod: el contrato lo garantiza la firma y los tipos `Stripe.Event` del SDK.

## Reutilizar
- `src/lib/stripe.ts` — singleton `stripe` (trae `stripe.webhooks.constructEvent`).
- `src/lib/audit.ts` — `logAudit(tx, entry)`; `severity: "warning"` ya soportado.
- `src/server/db/index.ts` — `db`, `db.transaction`, tipo `Transaction`.
- `src/server/repositories/order.repository.ts` — `findBySessionId` (lectura de la página `success`).
- `src/server/services/checkout.service.ts` — el archivo ya existe; `fulfillOrder` se le añade.
- `src/app/api/webhooks/clerk/route.ts` — patrón de handler (400 firma / 500 reintento).
- `src/modules/cart/store/cart-store.ts` — `useCartStore().clear` para la isla de D3.
- `src/lib/utils.ts` — `formatPrice`; `src/app/(storefront)/cart/page.tsx` — layout de resumen a imitar.
- shadcn ya instalado: `card`, `button`, `separator`, `badge`. **Nada nuevo que instalar.**

## Tareas
- [x] T1 — `markPaid(tx, sessionId, paymentIntentId, email)` (`UPDATE … WHERE session=? AND status<>'paid' RETURNING *`, email con `coalesce`), `markCancelled(sessionId)` (`WHERE session=? AND status='pending'`) y `listItems(orderId, executor = db)` · `src/server/repositories/order.repository.ts` · verif: AC2, AC3, AC7, AC8.
- [x] T2 — `decrementStock(tx, productId, qty): Promise<boolean>` — `UPDATE products SET stock = stock - qty WHERE id = ? AND stock >= qty`, `false` si afectó 0 filas · `src/server/repositories/product.repository.ts` · verif: AC4, AC5.
- [x] T3 — `fulfillOrder({sessionId, paymentIntentId, email})`: una `db.transaction` con T1 → si no hay fila, return; `listItems` → `decrementStock` por línea (log `warning` si `false`) → `logAudit` `order.paid` · `src/server/services/checkout.service.ts` · verif: AC2–AC7.
- [x] T4 — `cancelOrder(sessionId)` usando `markCancelled`, sin tocar stock · `src/server/services/checkout.service.ts` · verif: AC8.
- [x] T5 — `POST /api/webhooks/stripe`: `constructEvent` sobre cuerpo crudo → despacho de los 4 eventos → 200/400/500 · `src/app/api/webhooks/stripe/route.ts` · verif: AC1, AC9, AC10.
- [x] T6 — Isla `"use client"` `<ClearCartOnPaid />` que llama `clear()` en `useEffect` al montar · `src/modules/checkout/components/clear-cart-on-paid.tsx` · verif: AC11, AC12.
- [x] T7 — Página `/checkout/success` (Server Component): `session_id` de `searchParams` → `findBySessionId` + `listItems` → `notFound()` si no hay → resumen o aviso "confirmando tu pago"; monta T6 solo si `paid` · `src/app/(storefront)/checkout/success/page.tsx` · verif: AC11–AC13, AC15.
- [x] T8 — Página `/checkout/cancel`: mensaje y enlace a `/cart` · `src/app/(storefront)/checkout/cancel/page.tsx` · verif: AC14, AC15.

Verificación final: `npm run typecheck && npm run lint` (el `build` lo corre el reviewer).
QA manual: `stripe listen` activo → pagar con `4242 4242 4242 4242` → pedido `paid` + stock bajado
en `npm run db:studio`; `stripe events resend <evt_id>` para AC3.

## Notas
- **Orden de eventos:** `checkout.session.completed` puede llegar **antes** de que
  `attachCheckoutSession` (010, fuera de transacción) haya escrito el id → `markPaid` no encuentra
  fila. Devolver **500** en ese caso, no 200: el reintento de Stripe lo resuelve.
- **`request.text()` obligatorio.** Un `request.json()` intermedio invalida la firma.
- **Sobreventa (D2)** y **webhook caído en dev (D4)** son deuda declarada, no bugs.
- La página `success` **no cumple nada**: el usuario puede cerrar el navegador antes de cargarla (§9).

## Implementación (2026-09-07)

Archivos: `order.repository.ts` (+`markPaid`/`markCancelled`/`listItems`) ·
`product.repository.ts` (+`decrementStock`) · `checkout.service.ts` (+`fulfillOrder`/`cancelOrder`) ·
`src/app/api/webhooks/stripe/route.ts` · `src/modules/checkout/components/clear-cart-on-paid.tsx` ·
`src/app/(storefront)/checkout/{success,cancel}/page.tsx`. Sin migración, sin deps, sin tocar `proxy.ts`.

Dos desvíos menores de las tareas, ambos hacia arriba:

1. **`markCancelled(tx, sessionId)` recibe `tx`** (la tarea la pedía sin él) para que `cancelOrder`
   escriba `order.cancelled` en `audit_logs` dentro de la misma transacción que el cambio de estado
   (CLAUDE.md §4 regla 9). Sin `tx` la cancelación sería la única mutación de negocio sin bitácora.
2. **`fulfillOrder` distingue las dos causas de "sin fila"** que D1 junta: si `findBySessionId`
   encuentra el pedido, ya estaba `paid` → reenvío idempotente, 200; si no lo encuentra, la carrera
   con `attachCheckoutSession` (010) aún no escribió el id → `throw` → 500 y Stripe reintenta,
   como pide la nota de "Orden de eventos". Un `return` seco habría devuelto 200 y perdido el pago.

Pendiente de QA manual: AC4, AC5, AC8, AC9, AC12 (una compra nueva de punta a punta con
`4242 4242 4242 4242` los cubre casi todos).

**Iteración 2 — fix de AC13 (404 real).** La causa era `src/app/(storefront)/loading.tsx`: un
boundary a nivel de grupo hacía que Next enviara el shell con **200** antes de que la página
ejecutara `notFound()`. Moverlo a `generateMetadata` no basta en Next 16 (el streaming de metadata
tampoco bloquea la respuesta; medido: seguía 200). El arreglo es sacar el boundary del camino de
`/checkout/*`: el `loading.tsx` bajó a `src/app/(storefront)/products/loading.tsx`, que es el único
sitio donde llegaba a verse (`/` y `/cart` son estáticos, `/perfil` y `/products/[slug]` ya tenían el
suyo). Además la página lee el pedido por `cache(orderRepository.findBySessionId)` compartido entre
`generateMetadata` y el componente: una sola consulta, `notFound()` en ambos (defensa en profundidad)
y título real `Pedido #<id corto>`. Sin cambio de UX en ninguna ruta.

**Revisión iteración 2/2 — APROBADO (2026-09-07).** `typecheck`/`lint`/`build` en verde.
AC13 re-verificado contra `next build && next start` (`curl -o /dev/null -w %{http_code}`):
`/checkout/success` sin query → **404**, `?session_id=cs_does_not_exist` → **404**,
`?session_id=cs_test_b1bZ…` → **200** con el resumen del pedido `#C06E3FB5`.
Sin regresión: `/`, `/cart`, `/checkout/cancel` → 200 (estáticas en el route table, no necesitan
`loading.tsx`); `/products` conserva su skeleton vía `products/loading.tsx`; `/perfil` y
`/products/[slug]` conservan el suyo. El único route dinámico del grupo que se queda sin skeleton
de carga es `/checkout/success`, y es exactamente el objetivo del fix (consulta única, D4).
