---
id: 010
title: Stripe Checkout — pedido pending + Checkout Session
status: done
module: checkout
scope: client
---

# 010 — Stripe Checkout: pedido `pending` + Checkout Session

Base: `docs/stripe/checkout-integration.md` (§1–§8, §10, §13). Este spec cubre la
**primera mitad** del pago: crear el pedido y mandar al usuario al Checkout de
Stripe. Confirmar el cobro es 011.

## Objetivo
Un cliente con líneas en el carrito puede abrir `/cart`, pulsar "Ir a pagar" y
llegar al Checkout alojado por Stripe con un pedido `pending` ya guardado en
Postgres con precios releídos del servidor.

## Contexto verificado
- Carrito efímero en Zustand: `cart-store.ts` (`lines`, `setQty`, `clear`,
  `cartCount`, `cartSubtotalCents`); `CartLine` = `{id,name,slug,priceCents,imageUrl,stock,qty}`.
- `cart-drawer.tsx:124` ya enlaza a `/cart`; `src/app/(storefront)/cart/` está vacío → 404 hoy.
- `.env.example` **ya** tiene `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET`: no es tarea.
- `src/server/services/` está vacío: `checkout.service.ts` estrena la carpeta.
- `src/proxy.ts:8` ya cubre `/api/webhooks(.*)` como público (sirve para 011).
- `product.repository.ts` **no** tiene lectura por lote de ids: hay que añadirla.

## Decisiones (resueltas por el usuario, 2026-09-07)
- **D1 — checkout de INVITADO** (revisado 2026-09-07 tras QA: `requireAuth()` en
  ruta pública devolvía 401 aunque hubiera sesión; además el flujo de referencia
  del curso es sin login). El handler usa `getCurrentUser()` opcional: con sesión
  de Clerk el pedido se ata al usuario, sin ella `user_id` y `email` quedan
  `null` y Stripe recoge el email (el webhook 011 lo copia a `orders.email`).
  `orders.email` pasa a **nullable** (migración `0004_fast_korvac.sql`).
  `/checkout(.*)` y `/api/checkout(.*)` son públicos en `proxy.ts`.
- **D2 — moneda única `pen`.** `currency: "pen"`, `unit_amount` entero en centavos.
- **D3 — `success_url`/`cancel_url` → `/checkout/success` y `/checkout/cancel`.**
  Dan 404 hasta que 011 cree las páginas; deuda declarada en Notas.

## Ajustes post-review (2026-09-07)
- Carrito Zustand pasa a `persist` en `localStorage` (`cart-store.ts`): sin esto
  el carrito se perdía en cada recarga y bloqueaba el QA. La spec 008 lo moverá a
  `carts`/`cart_items` en servidor.
- QA de punta a punta OK: `POST /api/checkout/session 200`, pago con `4242…`
  confirmado en el sandbox (`payment_status: paid`, `pi_…` `succeeded`), pedido
  `pending` en Neon con `stripe_checkout_session_id`. Falta el webhook y las
  páginas de retorno → spec 011.

## Alcance
Incluye: SDK `stripe`, singleton, tablas `orders`/`order_items` + migración,
repositorio de pedidos, servicio `createPendingOrder`, `POST /api/checkout/session`,
capa cliente del módulo `checkout`, página `/cart`, ajuste de `proxy.ts`.

No incluye (→ **011**): `POST /api/webhooks/stripe`, verificación de firma,
`fulfillOrder`, `markPaid`, descuento real de stock, `audit_logs` de `order.paid`,
páginas `/checkout/success` y `/checkout/cancel`, persistir carrito en BD,
"Mis compras" en `/perfil`.

## Criterios de aceptación
- [x] AC1 — Dado un carrito con líneas, cuando abro `/cart`, entonces veo cada línea con imagen, nombre, cantidad, subtotal de línea y el total (`formatPrice`).
- [x] AC2 — Dado un carrito vacío, cuando abro `/cart`, entonces veo estado vacío con enlace al catálogo y sin botón de pago.
- [x] AC3 — Dado que pulso "Ir a pagar", cuando el POST está en vuelo, entonces el botón queda deshabilitado con estado de carga y no se puede disparar dos veces.
- [x] AC4 — Dado un POST correcto, entonces el navegador navega a `session.url` de Stripe.
- [x] AC5 — Dado el POST, entonces existe una fila en `orders` con `status='pending'`, `stripe_checkout_session_id = cs_test_…` y sus `order_items`.
- [x] AC6 — Dado que el cliente manda un `priceCents` en el body, entonces se ignora: los totales salen de `products.price_cents` releído en el servidor.
- [x] AC7 — Dado un `productId` inexistente, borrado (`deleted_at`) o con `stock < qty`, entonces la API responde **409** con mensaje legible y **no** crea pedido ni sesión.
- [x] AC8 — Dado un body inválido (uuid mal formado, `qty` 0 o > 99, `items` vacío), entonces responde **400** con `issues` de Zod.
- [x] AC9 — Dado que no hay sesión de Clerk (D1 = exigir sesión), entonces responde **401** vía `authErrorResponse`.
- [x] AC10 — Dado un fallo de Stripe o de BD, entonces el botón muestra error legible (toast) y el carrito **no** se vacía.
- [x] AC11 — La sesión de Stripe lleva `mode: "payment"`, `metadata.orderId`, `client_reference_id`, `expires_at` a 30 min, `unit_amount` entero en centavos, `currency: "pen"` y **sin** `payment_method_types`.

## Datos
Requiere migración (`npm run db:generate && npm run db:migrate`). Tipos inferidos
con `InferSelectModel`/`InferInsertModel` como `product.ts:52-53`.

`orders` — `src/server/db/schema/order.ts`

| Columna | Tipo | Constraint |
|---|---|---|
| `id` | uuid | PK `defaultRandom()` |
| `user_id` | uuid | FK `users.id` onDelete `restrict`, nullable (null = invitado, D1) |
| `email` | text | notNull |
| `status` | pgEnum `order_status` (`pending`\|`paid`\|`cancelled`) | notNull default `pending` |
| `subtotal_cents` | integer | notNull |
| `total_cents` | integer | notNull (= subtotal en esta fase) |
| `currency` | text | notNull default `'pen'` |
| `stripe_checkout_session_id` | text | unique, nullable |
| `stripe_payment_intent_id` | text | unique, nullable (lo escribe 011) |
| `created_at` / `updated_at` | timestamptz | notNull `defaultNow()`, `updated_at` con `$onUpdate(() => sql\`now()\`)` |

Índices: `(user_id, created_at desc)`, `(status)`, `(stripe_checkout_session_id)`.

`order_items` — `src/server/db/schema/order-item.ts`

| Columna | Tipo | Constraint |
|---|---|---|
| `id` | uuid | PK `defaultRandom()` |
| `order_id` | uuid | FK `orders.id` onDelete `cascade`, notNull |
| `product_id` | uuid | FK `products.id` onDelete `restrict`, notNull |
| `product_name` | text | notNull (copia congelada) |
| `unit_price_cents` | integer | notNull (copia de `products.price_cents`) |
| `qty` | integer | notNull |
| `line_total_cents` | integer | notNull |

Índice: `(order_id)`. Barrel: dos `export *` en `schema/index.ts`.

## API
| Método | Ruta | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/api/checkout/session` | `requireAuth()` (D1) | `{ items: [{ productId, qty }] }` | 200 `{ url: string }` · 400 `{error,issues}` · 401 · 409 `{error}` · 500 `{error}` |

Zod `checkoutSessionSchema` (`src/modules/checkout/schemas/checkout.schema.ts`):
`items` array min 1 máx 50 de `{ productId: uuid, qty: int().min(1).max(99) }`.
Nada de precios en el body (AC6).

## Reutilizar
- `src/lib/auth.ts` — `requireAuth()`, `authErrorResponse()`; `UserAccess` trae `id` y `email`.
- `src/lib/errors.ts` — patrón de error de dominio; se le añade `CheckoutUnavailableError` (→ 409).
- `src/lib/axios.ts` — `api` + `ApiError` (status para el toast).
- `src/lib/utils.ts` — `formatPrice`, `stockNote`.
- `src/server/db/index.ts` — `db`, `db.transaction`, tipo `Transaction`.
- `src/modules/cart/store/cart-store.ts` — `useCartStore`, `cartSubtotalCents`, `clear`.
- `src/modules/storefront/components/product-image.tsx` — imagen de línea.
- `src/modules/products/hooks/use-product-mutations.ts` — patrón de `useMutation` + toast + `ApiError`.
- `src/app/api/products/route.ts` — patrón `try/catch json` → `safeParse` → repo → `console.error`.
- `src/server/db/schema/audit-log.ts` — patrón `pgEnum` para `order_status`.
- shadcn ya instalado: `button`, `card`, `separator`, `skeleton`, `sonner`. Nada nuevo que agregar.

## Tareas
- [x] T1 — `npm i stripe` (SDK de servidor; **no** `@stripe/stripe-js`) · `package.json` · verif: `npm run typecheck`.
- [x] T2 — Singleton Stripe que lanza si falta `STRIPE_SECRET_KEY` (patrón `src/server/db/index.ts:4-10`) · `src/lib/stripe.ts` · verif: typecheck.
- [x] T3 — Tabla `orders` + `pgEnum order_status` + tipos inferidos · `src/server/db/schema/order.ts` · verif: typecheck.
- [x] T4 — Tabla `order_items` + tipos inferidos · `src/server/db/schema/order-item.ts` · verif: typecheck.
- [x] T5 — Barrel con los dos `export *` · `src/server/db/schema/index.ts` · verif: typecheck.
- [x] T6 — Migración: `npm run db:generate && npm run db:migrate` · `drizzle/0003_fresh_proemial_gods.sql` aplicado a Neon.
- [x] T7 — Lectura por lote de productos disponibles (`inArray` + `deleted_at IS NULL`), una sola query · `src/server/repositories/product.repository.ts` (`findAvailableByIds`) · verif: AC7.
- [x] T8 — `createPending(tx, order, items)`, `attachCheckoutSession(orderId, sessionId)`, `findBySessionId`, `listByUser` · `src/server/repositories/order.repository.ts` · verif: typecheck.
- [x] T9 — `createPendingOrder({userId,email,requested})`: relee precios/stock (T7), valida disponibilidad, congela precio y nombre, calcula totales, inserta pedido + líneas en **una** `db.transaction`; devuelve `{ order, items }` con `imageUrl` en memoria para Stripe · `src/server/services/checkout.service.ts` · verif: AC5, AC6, AC7.
- [x] T10 — `CheckoutUnavailableError` (mensaje legible → 409) · `src/lib/errors.ts` · verif: AC7.
- [x] T11 — `checkoutSessionSchema` Zod · `src/modules/checkout/schemas/checkout.schema.ts` · verif: AC8.
- [x] T12 — `POST /api/checkout/session`: `requireAuth` → `safeParse` → `createPendingOrder` → `stripe.checkout.sessions.create` (§8 de la guía) → `attachCheckoutSession` → `{ url }` · `src/app/api/checkout/session/route.ts` · verif: AC4, AC5, AC8–AC11.
- [x] T13 — `createCheckoutSession(items)` con `api` de axios · `src/modules/checkout/services/checkout.service.ts` · verif: typecheck.
- [x] T14 — `useCheckout()`: `useMutation`, `isPending`, `onError` con toast desde `ApiError` · `src/modules/checkout/hooks/use-checkout.ts` · verif: AC3, AC10.
- [x] T15 — `<CheckoutButton>` `"use client"`: lee `lines` del store, mapea a `{productId,qty}`, deshabilita mientras `isPending`, en éxito `window.location.href = url` · `src/modules/checkout/components/checkout-button.tsx` · verif: AC3, AC4.
- [x] T16 — Página `/cart`: líneas, stepper con `setQty`, subtotal con `cartSubtotalCents`, `<CheckoutButton>`, estado vacío · `src/app/(storefront)/cart/page.tsx` + `src/modules/cart/components/cart-lines.tsx` · verif: AC1, AC2.
- [x] T17 — `/cart` público y `/checkout(.*)` según D1 · `src/proxy.ts` · verif: AC9 y `/cart` accesible sin sesión.

Verificación final: `npm run typecheck && npm run lint` (el `build` lo corre el reviewer).
QA manual: carrito → `/cart` → "Ir a pagar" → Checkout de Stripe con la tarjeta `4242 4242 4242 4242`,
y fila `pending` visible en `npm run db:studio`.

## Notas
- **`integration_identifier`** solo existe desde la API `2026-03-25.dahlia`. Si el SDK
  recién instalado fija una versión anterior, el parámetro no tipa: quitarlo antes que
  forzar un `as`, y anotarlo. Ante cualquier duda de la API, `stripe:stripe-docs`.
- **Imágenes:** `product_data.images` exige URL absoluta y pública. `products.image_url`
  es una ruta local (`/products/x.png`) → omitir `images` salvo que empiece por `http`.
- **`/cart` no puede ser Server Component puro:** el carrito vive en Zustand. `"use client"`
  en el bloque de líneas, no en la página entera.
- **Doble pedido:** dos clics = dos filas `pending` huérfanas. Lo mitiga `isPending` (AC3)
  y `expires_at` a 30 min; sin bloqueo de servidor en esta fase.
- **Deuda 010→011:** `success_url`/`cancel_url` apuntan a rutas 404 (D3); el pedido nunca
  pasa de `pending` porque el webhook es de 011; el stock no se descuenta.

## Cierre de implementación (2026-09-07)

`npm run typecheck` ✓ · `npm run lint` ✓ (el `build` lo corre el reviewer).

**Resoluciones tomadas durante T1–T17**

- **`integration_identifier` se queda.** `stripe@22.6.1` fija la API
  `2026-08-26.dahlia` (≥ `2026-03-25.dahlia`) y el parámetro tipa en
  `SessionCreateParams`. Valor enviado: `"g1ecom_checkout_v1"`. Cero `as`, cero
  `@ts-ignore`.
- **`/api/checkout(.*)` va en `isPublicRoute`, no `/checkout(.*)`.** `auth.protect()`
  en el borde responde 404 opaco a una request no-documento, lo que rompería AC9.
  El gate real es `requireAuth()` dentro del handler → 401 vía `authErrorResponse`,
  mismo patrón que `/api/products(.*)`. Las **páginas** `/checkout(.*)` siguen
  protegidas según D1.
- **Anti-duplicados en Zod.** `checkoutSessionSchema` rechaza dos líneas con el
  mismo `productId`: por separado pasan el chequeo de stock y sumadas lo exceden.
- **`isSuccess` además de `isPending`** en `<CheckoutButton>`: tras resolver la
  mutación el navegador todavía está yendo a Stripe y un segundo clic crearía un
  pedido huérfano (refuerza AC3).
- **Reutilizado sin duplicar:** `<CartQtyControl>` (stepper con tope de stock y
  región `aria-live`) y `<ProductImage>` en `/cart`; no se escribió stepper nuevo.
- `findBySessionId` / `listByUser` quedan sin consumidor hasta 011 y "Mis compras":
  se crearon porque T8 los pide de forma explícita.

**Pendiente de QA manual (no verificable con typecheck/lint)**

- AC1–AC5, AC10, AC11: carrito → `/cart` → "Ir a pagar" → Checkout de Stripe con
  `4242 4242 4242 4242`; fila `pending` con `cs_test_…` y sus `order_items` en
  `npm run db:studio`.
- AC6: POST con `priceCents` inyectado en el body → el total sale del catálogo.
- AC7: `productId` inexistente / soft-deleted / `qty > stock` → 409 y sin fila.
- AC8: uuid mal formado, `qty` 0 o 100, `items: []` → 400 con `issues`.
- AC9: POST sin sesión → 401 `{ error: "No autenticado" }`.
- Tras pagar, el retorno a `/checkout/success` da 404 hasta que 011 cree la página
  (deuda declarada en D3).

## Revisión (2026-09-07) — VEREDICTO: APROBADO · iteración 1/3

`npm run typecheck` ✓ · `npm run lint` ✓ · `npm run build` ✓

Trazabilidad de criterios (lectura de código, no runtime):

- AC1/AC2 — `cart-lines.tsx`: línea con imagen, nombre, `CartQtyControl`, `formatPrice(priceCents*qty)` y total; estado vacío con enlace a `/products` y sin `<CheckoutButton>`.
- AC3 — `checkout-button.tsx`: `disabled={isPending || isSuccess || lines.length === 0}`.
- AC4 — `use-checkout.ts` `onSuccess`: `window.location.href = url`.
- AC5 — `checkout.service.ts` (server) inserta `orders` + `order_items` en una `db.transaction`; `attachCheckoutSession` fija `stripe_checkout_session_id`.
- AC6 — `checkoutSessionSchema` solo acepta `{ productId, qty }`; el precio sale de `productRepository.findAvailableByIds` (Postgres) en `createPendingOrder`.
- AC7 — producto ausente / `deleted_at` / `stock < qty` → `CheckoutUnavailableError` **antes** de abrir la transacción → 409, sin pedido ni sesión.
- AC8 — `safeParse` → 400 con `parsed.error.issues`; `qty` fuera de `[1,99]`, `items` vacío o > 50 y `productId` repetido quedan cubiertos.
- AC9 — `/api/checkout(.*)` público en el borde (mismo patrón que `/api/products(.*)`); `requireAuth()` en el handler → `authErrorResponse` → 401 `{ error: "No autenticado" }`. Decisión del developer correcta: `auth.protect()` daría 404 opaco.
- AC10 — `useCheckout` nunca limpia el carrito; `onError` → toast desde `ApiError`.
- AC11 — `stripe.checkout.sessions.create`: `mode: "payment"`, `unit_amount` entero (centavos), `currency: "pen"`, `metadata.orderId`, `client_reference_id`, `expires_at` a 30 min, sin `payment_method_types`; `product_data.images` solo si `imageUrl` empieza por `http`.

Arquitectura: sin `db`/Drizzle/repositorio en componentes; fetching por `service` + hook; toda consulta en `src/server/repositories/`; tipos vía `InferSelectModel`/`InferInsertModel`; `"use client"` solo en `cart-lines.tsx`, no en `cart/page.tsx`. `src/lib/stripe.ts` no lo importa código cliente; `STRIPE_SECRET_KEY` sin `NEXT_PUBLIC_` y fuera de logs.

Migración `0003_fresh_proemial_gods.sql` coherente con §Datos: columnas, `pgEnum order_status`, FKs (`user_id` restrict, `order_id` cascade, `product_id` restrict), `unique` en ambos ids de Stripe, índices `(user_id, created_at desc)` / `(status)` / `(stripe_checkout_session_id)` / `(order_id)`.

Observación MENOR (no bloqueante): `attachCheckoutSession` corre fuera de transacción tras la llamada a Stripe; si falla deja pedido `pending` + sesión Stripe huérfanos. Cubierto por la deuda "doble pedido" ya declarada en Notas.
