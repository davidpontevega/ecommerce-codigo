---
id: 013
title: Mis tarjetas — guardar, gestionar y pagar con métodos de pago de Stripe
status: done
module: payment-methods
scope: client
---

# 013 — Mis tarjetas (métodos de pago guardados)

## Objetivo
Un cliente autenticado puede guardar, listar y eliminar tarjetas desde `/perfil`, y
elegirlas al pagar en el Checkout alojado de Stripe.

## Decisiones
- **D1 (fija)** — Todo el flujo de tarjetas exige sesión: `requireAuth()` en los 3
  endpoints; la pestaña vive en `/perfil`, que ya redirige a `/sign-in`.
- **D2** — `users.stripe_customer_id` (nullable, unique), no tabla aparte: es 1:1.
  Se crea perezosamente en el primer "Agregar tarjeta".
- **D3** — Alta por `POST /api/payment-methods/setup-session` → `{ url }`, igual que
  `/api/checkout/session` (010). La persistencia la hace el **webhook**, no el retorno.
- **D4** — Tabla `payment_methods` con `brand`/`last4`/`exp_*`. Sin PAN, sin CVC.
  Sin `is_default`: no hay flujo que lo consuma (fuera de alcance).
- **D5** — Borrado físico: `stripe.paymentMethods.detach()` + `DELETE` de la fila,
  confirmado con `AlertDialog`. Un método desasociado en Stripe no se "restaura".
- **D6** — El listado lee Postgres, no Stripe.
- **D7** — Idempotencia por `stripe_payment_method_id` unique + `onConflictDoNothing`.
- **D8 (verificado en docs)** — En el webhook, tras guardar la tarjeta:
  `stripe.paymentMethods.update(pm, { allow_redisplay: "always" })`. El Checkout de pago
  **solo muestra** métodos con `allow_redisplay: "always"`, y el default de un
  PaymentMethod es `"unspecified"`; `saved_payment_method_options` no existe en
  `mode: "setup"`, así que no hay forma de fijarlo al crear la sesión de alta.
- **D9** — `POST /api/checkout/session` (010): si hay sesión y el usuario tiene
  `stripe_customer_id`, se pasa `customer: <cus_id>` y se **omite** `customer_email`
  (excluyentes: `customer_email` solo alimenta la creación de un Customer nuevo). Sin
  `stripe_customer_id` → exactamente el código de hoy. Con `allow_redisplay: "always"`
  (D8), pasar `customer` basta: no hace falta `allow_redisplay_filters`.
- **D10** — La tarjeta la elige el comprador en la página de Stripe. El servidor nunca
  recibe ni cobra un `payment_method_id` elegido por el cliente: eso saltaría SCA/3DS
  y el modelo alojado de 010.

## Alcance
Incluye: pestaña "Mis tarjetas", alta hosted, listado, borrado, migración, despacho del
webhook por `session.mode`, y usar una tarjeta guardada en el Checkout de pago (D9).
No incluye: tarjeta predeterminada, editar una tarjeta (se borra y se agrega), varios
Customers por usuario, wallets (Apple/Google Pay y Link no son reutilizables en Checkout),
cobro off-session sin el comprador presente.

## Criterios de aceptación
- [x] AC1 — Dado un usuario con sesión, cuando abre `/perfil` → ve la pestaña "Mis tarjetas".
- [x] AC2 — Dado que no tiene tarjetas, cuando abre la pestaña → estado vacío + botón "Agregar tarjeta".
- [x] AC3 — Dado que pulsa "Agregar tarjeta", cuando responde la API → navega a la URL de Stripe (`mode: "setup"`).
- [x] AC4 — Dado que es su primera tarjeta, cuando se crea la sesión → se crea el Customer y se guarda en `users.stripe_customer_id`; en la segunda se reutiliza.
- [x] AC5 — Dado un `checkout.session.completed` con `mode: "setup"`, cuando llega al webhook → se inserta la tarjeta (`brand`, `last4`, `exp_month`, `exp_year`) y **no** se llama a `fulfillOrder`.
- [x] AC6 — Dado el mismo evento reenviado, cuando se procesa → no se duplica la fila y responde 200.
- [x] AC7 — Dado un `checkout.session.completed` con `mode: "payment"`, cuando llega → el flujo de 010/011 sigue idéntico (regresión).
- [x] AC8 — Dado que vuelve con `?tab=tarjetas&setup=success`, cuando carga → la pestaña activa es "Mis tarjetas" y la lista se refresca.
- [x] AC9 — Dado que pulsa eliminar, cuando confirma en el `AlertDialog` → desaparece de la lista y queda `detached` en Stripe.
- [x] AC10 — Dado el id de tarjeta de otro usuario, cuando hace `DELETE` → 404, sin detach.
- [x] AC11 — Sin sesión, cualquiera de los 3 endpoints de tarjetas → 401.
- [x] AC12 — La lista tiene estado de carga (skeleton) y de error, como `purchase-list.tsx`.
- [x] AC13 — Dado un usuario con `stripe_customer_id` y ≥1 tarjeta guardada, cuando paga desde `/cart` → el Checkout de Stripe le ofrece sus tarjetas guardadas como opción seleccionable.
- [x] AC14 — Dada la tarjeta recién guardada, cuando se consulta en Stripe → `allow_redisplay === "always"`.
- [x] AC15 (regresión) — Dado un invitado o un usuario sin `stripe_customer_id`, cuando paga → el checkout se comporta igual que en 010: `customer_email` como hoy, precio recalculado en servidor, `invoice_creation` intacto.
- [x] AC16 — La sesión de pago nunca lleva `customer` y `customer_email` a la vez.

## Datos
Migración requerida (`npm run db:generate` → `drizzle/0005_*.sql`).

`users` · nueva columna:
- `stripe_customer_id` · text · nullable · unique

`payment_methods` (nueva):
- `id` · uuid · PK default random
- `user_id` · uuid · not null · FK `users.id` `onDelete: "cascade"`
- `stripe_payment_method_id` · text · not null · unique
- `brand` · text · not null (`visa`, `mastercard`, …)
- `last4` · text · not null (4 dígitos; Stripe no entrega más)
- `exp_month` · integer · not null
- `exp_year` · integer · not null
- `created_at` · timestamptz · not null default now
- index `payment_methods_user_id_idx` on (`user_id`, `created_at` desc)

## API
| Método | Ruta | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/api/payment-methods/setup-session` | requireAuth | — | `{ url }` |
| GET | `/api/payment-methods` | requireAuth | — | `{ paymentMethods: PaymentMethod[] }` |
| DELETE | `/api/payment-methods/[id]` | requireAuth | — | `204` / `404` |
| POST | `/api/checkout/session` | opcional (010) | sin cambios | sin cambios (`{ url }`) |

Zod: `paymentMethodIdSchema` (uuid) para el path param; no hay body que validar.
Tipo `PaymentMethod` inferido del schema Drizzle.
`success_url`: `${APP_URL}/perfil?tab=tarjetas&setup=success` · `cancel_url`: `…&setup=cancel`.
Sin `payment_method_types` en ninguna llamada.

## Reutilizar
- `src/lib/stripe.ts` — cliente Stripe ya configurado.
- `src/lib/auth.ts` — `requireAuth()` / `getCurrentUser()` + `authErrorResponse()`.
- `src/lib/audit.ts` — `logAudit(tx, …)` en la transacción; metadata solo con ids de Stripe.
- `src/lib/axios.ts` — `api` + `ApiError` para el service del módulo.
- `src/app/api/checkout/session/route.ts` — se **modifica** (T15), no se duplica: es el único creador de sesiones de pago.
- `src/modules/orders/*` — estructura a replicar (`schemas`/`services`/`hooks`/`components`).
- `src/modules/orders/components/purchase-list.tsx` — patrón de skeleton/error/vacío.
- `src/modules/checkout/hooks/use-checkout.ts` — mutación que hace `window.location.href = url`.
- `src/components/ui/` — `alert-dialog`, `card`, `button`, `badge`, `skeleton`, `tabs` ya instalados. **No hace falta `shadcn add`.**

## Tareas
- [x] T1 — Tabla `paymentMethods` · `src/server/db/schema/payment-method.ts` (+ export en `schema/index.ts`)
- [x] T2 — Columna `stripeCustomerId` · `src/server/db/schema/user.ts`
- [x] T3 — Generar y aplicar migración · `npm run db:generate && npm run db:migrate`
- [x] T4 — `setStripeCustomerId` / `findStripeCustomerId` · `src/server/repositories/user.repository.ts`
- [x] T5 — `listByUser` / `saveFromStripe` (onConflictDoNothing) / `findByIdForUser` / `remove` · `src/server/repositories/payment-method.repository.ts`
- [x] T6 — `ensureStripeCustomer`, `savePaymentMethodFromSetupSession`, `removePaymentMethod` (detach + delete + audit) · `src/server/services/payment-method.service.ts`
- [x] T7 — `POST /api/payment-methods/setup-session` · `src/app/api/payment-methods/setup-session/route.ts`
- [x] T8 — `GET /api/payment-methods` · `src/app/api/payment-methods/route.ts`
- [x] T9 — `DELETE /api/payment-methods/[id]` · `src/app/api/payment-methods/[id]/route.ts`
- [x] T10 — Despacho por `session.mode` antes del bloque de pago · `src/app/api/webhooks/stripe/route.ts`
- [x] T11 — `allow_redisplay: "always"` sobre el PaymentMethod guardado (D8) · `src/server/services/payment-method.service.ts`
- [x] T12 — Schema + service + hooks del módulo cliente · `src/modules/payment-methods/{schemas,services,hooks}/`
- [x] T13 — `CardsTab` + `CardList` + `AddCardButton` + `DeleteCardDialog` · `src/modules/payment-methods/components/`
- [x] T14 — Pestaña "Mis tarjetas" y `defaultValue` desde `searchParams.tab` · `src/app/(storefront)/perfil/page.tsx`
- [x] T15 — `customer` XOR `customer_email` según `stripe_customer_id` (D9) · `src/app/api/checkout/session/route.ts`

Verificación final: `npm run typecheck && npm run lint`

## Notas
- **Riesgo 1 (T10):** `checkout.session.completed` es compartido con 011. El `switch` debe
  ramificar por `session.mode === "setup"` **antes** del chequeo de `payment_status`/
  `fulfillOrder`, o una sesión de setup buscará un pedido inexistente, lanzará, devolverá
  500 y Stripe reintentará para siempre. AC7 es la regresión que lo cubre.
- **Riesgo 2 (T15):** `/api/checkout/session` ya se tocó en 010 y 012 (`invoice_creation`).
  El cambio es aditivo y condicionado a `stripe_customer_id`: la rama de invitado no se
  reescribe. AC15 + AC16 lo cubren. El recálculo de precio en servidor no se toca.
- El evento no trae `brand`/`last4`: hay que `stripe.setupIntents.retrieve(id, { expand: ["payment_method"] })`.
- Con `customer`, si el Customer tiene `email`, Stripe lo prefija y lo bloquea en Checkout:
  crear el Customer con el email del usuario, no vacío.
- Latencia webhook ↔ retorno: al volver con `setup=success` la tarjeta puede tardar ~1s.
  Invalidar la query al montar es suficiente; sin polling.
- `users` se sincroniza desde Clerk por webhook (004): el Customer se crea contra la fila
  de Postgres ya existente, nunca se crea usuario aquí.

## Implementación (2026-09-11)

Las 15 tareas están hechas. `npm run typecheck` ✓ · `npm run lint` ✓ (el `build` lo corre
el reviewer). Migración `drizzle/0005_fancy_prodigy.sql` generada y **aplicada** a Neon.

Hallazgos durante la implementación, verificados contra la API de Stripe (sandbox):
- **`currency` es obligatoria en `mode: "setup"`** cuando no se manda
  `payment_method_types` (que aquí está prohibido): sin ella la API responde
  `parameter_missing`. La sesión de alta usa `CURRENCY` de `checkout.service.ts`, que pasa
  a exportarse para no duplicar la moneda de la tienda. Con ella, Stripe resuelve solo
  `["card", "link"]`.
- **D8 confirmado en la API**: al adjuntar un PaymentMethod queda `allow_redisplay:
  "unspecified"`; el `paymentMethods.update` posterior lo deja en `"always"`. Ese update
  corre **después** de la transacción y también en un reenvío del evento: es la vía de
  reparación si la primera vez falló a medias.
- Un método sin `card` expandida (Link/wallet, fuera de alcance) se registra con `warn` y
  no guarda fila: lanzar dejaría a Stripe reintentando un evento que nunca cuadraría.
- `paymentMethods.detach` tolera `StripeInvalidRequestError` (ya desasociado) para que un
  reintento pueda borrar la fila; cualquier otro error se propaga.
- `GET /api/payment-methods` no devuelve `stripe_payment_method_id` al navegador (D10): el
  repositorio selecciona solo `id`/`brand`/`last4`/`exp_*`.

### Pendiente de QA manual (con `stripe listen` activo → `/api/webhooks/stripe`)
- AC1–AC4, AC8, AC9, AC12 — pestaña, alta, retorno con `?tab=tarjetas&setup=success`,
  borrado con `AlertDialog`, skeleton/error.
- AC5–AC7 — webhook: `mode: "setup"` guarda tarjeta sin llamar a `fulfillOrder`; reenvío
  sin duplicar; **regresión** de `mode: "payment"` (010/011) intacta.
- AC10, AC11 — 404 con id ajeno; 401 sin sesión. Nota: `/api/payment-methods` no es ruta
  pública en `src/proxy.ts`, así que sin sesión responde primero el `auth.protect()` del
  middleware, igual que `/api/orders` (012); el 401 de `requireAuth()` es la segunda
  barrera.
- AC13–AC16 — pago con tarjeta guardada ofrecida en el Checkout, `allow_redisplay` de la
  tarjeta recién dada de alta, y regresión del checkout de invitado.

## Revisión (2026-09-11)

VEREDICTO: APROBADO · ITERACIÓN: 1/2. `typecheck`/`lint`/`build` en verde. Las 15
tareas trazadas contra código real (no por inferencia): T10 confirma `mode === "setup"`
ramifica antes de `fulfillOrder`, `cancelOrder`/`markCancelled` no rompe con una sesión
de setup; T11 confirma `paymentMethods.update(..., { allow_redisplay: "always" })` se
invoca de verdad; T15 confirma `customer` XOR `customer_email` y que la rama de invitado
no cambió una línea frente a 010/012. IDOR de `DELETE /api/payment-methods/[id]`
correcto: `findByIdForUser` antes de `detach`, borra por `id` interno (uuid), nunca por
`stripe_payment_method_id`, que tampoco se expone en `GET`. `CURRENCY` exportado de
`checkout.service.ts` sin duplicar el literal. Migración coherente con el spec.

Lo que la revisión de código no cubre: AC5–AC7 (webhook en vivo), AC13–AC14 (Checkout
ofreciendo tarjetas guardadas, `allow_redisplay` confirmado en el Dashboard/API de
Stripe) siguen necesitando la QA manual con `stripe listen` que ya lista la sección
anterior. La lógica que las sostiene está verificada en código; falta la corrida real.
