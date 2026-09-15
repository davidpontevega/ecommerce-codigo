---
title: Integración de Stripe — Checkout (pagos únicos)
status: draft
created: 2026-09-07
scope: pagos / storefront + server
depende_de: docs/SETUP.md · docs/specs/007 · docs/specs/008
---

# Integración de Stripe — Stripe Checkout

Guía de implementación para cobrar pedidos del storefront con **Stripe Checkout
alojado por Stripe** (Stripe-hosted). Cubre el arranque educativo: pagos únicos,
una sola moneda (PEN), modo test. No cubre suscripciones, Connect ni Payment
Element (ver §12).

Esta guía es un plano, no un spec ejecutable. Cuando se construya, pasa por el
flujo normal del proyecto (`orchestrator` → `spec` → aprobación → `developer` ⇄
`reviewer`).

---

## 1. Decisión: ¿sincronizar el catálogo con Stripe?

**No. El catálogo se queda solo en Postgres. Stripe no conoce nuestros
productos.**

En Stripe Checkout, cada `line_item` puede llevar el precio **en línea** con
`price_data` + `product_data` (nombre, imagen, `unit_amount` en centavos,
`currency`). No hace falta crear objetos `Product` ni `Price` en Stripe.

### Por qué no sincronizar ahora

| Sincronizar aporta… | ¿Lo necesitamos hoy? |
|---|---|
| Catálogo gestionable desde el Dashboard de Stripe | No — el catálogo se gestiona en `/admin/products` |
| Payment Links sin código | No |
| Stripe Billing / suscripciones (exige `Price`) | No — pagos únicos |
| Stripe Tax con códigos de impuesto por producto | No — sin impuestos en esta fase |
| Reportes de Stripe desglosados por producto | No — el reporte vive en nuestro panel |

Sincronizar introduce un problema de **doble fuente de verdad**: cada alta,
cambio de precio, `soft-delete` o ajuste de stock en el panel tendría que
propagarse a Stripe (webhook saliente, reconciliación, manejo de desfases). Es
trabajo y superficie de fallo a cambio de cero beneficio en pagos únicos.

### El enlace correcto con Stripe

No es `producto ↔ Stripe Price`. Es **`pedido ↔ Stripe Checkout Session /
PaymentIntent`**: guardamos en `orders` el `stripe_checkout_session_id` y el
`stripe_payment_intent_id`. Eso es lo que sirve para reconciliar cobros, emitir
reembolsos y rastrear un pago concreto.

### Cuándo reconsiderar

Crear `Product`/`Price` en Stripe (y una columna `stripe_price_id` en
`products`) recién vale la pena si aparece **suscripciones**, **Payment Links**,
o gestión del catálogo desde el Dashboard de Stripe. Hasta entonces, YAGNI.

> **Regla dura para el `developer`:** el precio que se cobra se recalcula
> **siempre en el servidor** leyendo `products.price_cents` desde Postgres. El
> cliente manda `{ productId, qty }`, nunca el precio. Un precio que llega del
> navegador es un precio que el usuario puede editar.

---

## 2. Alcance de esta fase

**Incluye**

- Página `/cart` (hoy el drawer enlaza a un 404).
- Botón "Ir a pagar" → crea un pedido `pending` en Postgres + una Checkout
  Session en Stripe → redirige a la URL alojada por Stripe.
- Páginas `/checkout/success` y `/checkout/cancel`.
- Webhook `POST /api/webhooks/stripe`: confirma el pago, marca el pedido
  `paid`, descuenta stock, escribe `audit_logs` — todo en una transacción.
- Tablas `orders` y `order_items`.
- Modo **test** con Stripe CLI para recibir webhooks en local.

**No incluye** (ver §12)

- Suscripciones, pagos recurrentes.
- Payment Element / checkout embebido / UI de pago a medida.
- Stripe Connect / marketplace / pagos divididos.
- Stripe Tax, cálculo de IGV, envío/shipping.
- Guardar tarjetas para después (Setup Intents).
- Panel de reembolsos (se hace desde el Dashboard de Stripe en esta fase).
- Carrito persistido en BD (`carts`/`cart_items`): el carrito sigue efímero en
  Zustand; en el checkout se envían las líneas al servidor.

---

## 3. Prerrequisitos

1. **Cuenta de Stripe** (o sandbox). Sin registro:
   ```bash
   npm i -g @stripe/cli
   stripe sandbox create      # genera claves de prueba
   ```
   Con cuenta propia: Dashboard → modo test → Developers → API keys.

2. **Clave restringida (RAK), no la secret key.** Dashboard → Developers →
   API keys → *Create restricted key*. Permisos mínimos para esta fase:
   - `Checkout Sessions`: write
   - `PaymentIntents`: read
   - `Webhook Endpoints`: write (solo si se crean por API; con el Dashboard no
     hace falta)
   Prefijo `rk_test_…`.

3. **Métodos de pago** activados en Dashboard → Settings → Payment methods.
   No se tocan por código (ver §7, regla de `payment_method_types`).

4. **Stripe CLI** autenticada para desarrollo local:
   ```bash
   stripe login          # o: stripe sandbox claim  (si se usó sandbox create)
   stripe whoami --format json
   ```

---

## 4. Dependencias

```bash
npm i stripe
```

Solo el SDK de servidor (`stripe`, Node SDK ≥ 22.x). **No** se instala
`@stripe/stripe-js` ni `@stripe/react-stripe-js`: el checkout es alojado por
Stripe, el cliente solo hace `window.location = session.url`.

---

## 5. Variables de entorno

Añadir a `.env.local` (y las claves vacías a `.env.example`):

```bash
# Stripe — modo test
STRIPE_SECRET_KEY="rk_test_..."              # clave restringida, solo servidor
STRIPE_WEBHOOK_SECRET="whsec_..."            # lo da `stripe listen` o el Dashboard
NEXT_PUBLIC_APP_URL="http://localhost:3000"  # ya existe; base de success/cancel URL
```

- `STRIPE_SECRET_KEY` **nunca** con prefijo `NEXT_PUBLIC_`: es de servidor.
- No hay clave pública que exponer (checkout alojado).
- `STRIPE_WEBHOOK_SECRET` cambia entre local (`stripe listen`) y producción
  (endpoint del Dashboard): son secretos distintos por entorno.

Validación: si el proyecto centraliza el acceso a `process.env`, añadir estas
tres ahí. Si no, `src/lib/stripe.ts` lanza al arrancar si falta la clave (patrón
de `src/server/db/index.ts`).

---

## 6. Modelo de datos

Dos tablas nuevas. Una tabla por archivo + barrel, según `docs/SETUP.md` §3.

### `src/server/db/schema/order.ts`

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | fk `users.id` **nullable** | null = invitado (si se permite checkout sin sesión) |
| `email` | text notNull | correo de contacto del pedido (de Clerk o del formulario de Stripe) |
| `status` | enum `pending` \| `paid` \| `cancelled` | arranca en `pending` |
| `subtotal_cents` | integer notNull | suma de líneas, calculada en servidor |
| `total_cents` | integer notNull | = subtotal en esta fase (sin envío ni impuestos) |
| `currency` | text notNull default `'pen'` | ISO-4217 en minúscula, como lo quiere Stripe |
| `stripe_checkout_session_id` | text unique nullable | `cs_test_…` — se setea al crear la sesión |
| `stripe_payment_intent_id` | text unique nullable | `pi_…` — se setea en el webhook |
| `created_at` | timestamptz default now() | |
| `updated_at` | timestamptz default now() `$onUpdate now()` | |

Índices: `(user_id, created_at desc)`, `(status)`,
`(stripe_checkout_session_id)`.

### `src/server/db/schema/order-item.ts`

Precio **congelado** al momento de la compra (`docs/SETUP.md` §5.3).

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid PK | |
| `order_id` | fk `orders.id` onDelete `cascade` | |
| `product_id` | fk `products.id` onDelete `restrict` | el producto no se borra físico; ver `soft-delete` |
| `product_name` | text notNull | copia: el nombre puede cambiar después |
| `unit_price_cents` | integer notNull | copia de `products.price_cents` al comprar |
| `qty` | integer notNull | |
| `line_total_cents` | integer notNull | `unit_price_cents * qty` |

Índice: `(order_id)`.

### Tipos

Se **infieren** del schema (`InferSelectModel`), no se escriben a mano
(`docs/SETUP.md` §4 regla 5). Ejemplo en `product.ts:52-53`.

### Migración

```bash
npm run db:generate     # genera drizzle/NNNN_*.sql
npm run db:migrate       # aplica a Neon
```

Actualizar el barrel `src/server/db/schema/index.ts` con los dos `export *`.

---

## 7. Arquitectura — dónde vive cada pieza

Respeta `docs/SETUP.md`. Nada de rutas nuevas fuera de esa estructura.

```
Cliente (/cart, "use client" abajo)
   │  POST { items: [{ productId, qty }] }
   ▼
src/modules/checkout/hooks/use-checkout.ts   (TanStack Query mutation)
   │
   ▼
src/modules/checkout/services/checkout.service.ts   (axios)
   │
   ▼
POST /api/checkout/session   (Route Handler)
   · Clerk auth (requireAuth) — o permitir invitado, decisión D2
   · Zod: checkoutSessionSchema  { items: [{ productId: uuid, qty: int 1..99 }] }
   · orderService.createPendingOrder(...)  ← relee precios y stock de Postgres
   · stripe.checkout.sessions.create(...)
   · guarda stripe_checkout_session_id en el pedido
   · responde { url }
   │
   ▼
Cliente: window.location.href = url   →   Checkout alojado por Stripe
   │
   ├─ paga  → redirect a  /checkout/success?session_id={CHECKOUT_SESSION_ID}
   └─ cancela → redirect a /checkout/cancel

   ⇢  (asíncrono, la verdad del pago)
Stripe  →  POST /api/webhooks/stripe
   · verifica firma con STRIPE_WEBHOOK_SECRET
   · checkout.session.completed / async_payment_succeeded  (gate: payment_status != 'unpaid')
   · db.transaction:
       - marca orders.status = 'paid', guarda stripe_payment_intent_id
       - descuenta products.stock de cada línea
       - logAudit(tx, { action: 'order.paid', ... })
   · idempotente por stripe_checkout_session_id
```

### Archivos nuevos

| Archivo | Rol |
|---|---|
| `src/lib/stripe.ts` | `export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)` — singleton, lanza si falta la clave. Patrón de `src/server/db/index.ts`. |
| `src/server/db/schema/order.ts` | tabla `orders` + tipos |
| `src/server/db/schema/order-item.ts` | tabla `order_items` + tipos |
| `src/server/repositories/order.repository.ts` | `createPending`, `findBySessionId`, `markPaid`, `listByUser` — toda consulta de pedidos vive aquí (`docs/SETUP.md` §4 regla 3) |
| `src/server/services/checkout.service.ts` | regla de negocio que cruza `product.repository` + `order.repository`: relee precios/stock, arma las líneas, calcula totales |
| `src/modules/checkout/schemas/checkout.schema.ts` | Zod: `checkoutSessionSchema` |
| `src/modules/checkout/services/checkout.service.ts` | axios: `createCheckoutSession(items)` |
| `src/modules/checkout/hooks/use-checkout.ts` | `useMutation` — estado `pending`/`error` obligatorio |
| `src/modules/checkout/components/checkout-button.tsx` | `"use client"` — botón, loading, error |
| `src/app/api/checkout/session/route.ts` | `POST` — crea pedido + sesión |
| `src/app/api/webhooks/stripe/route.ts` | `POST` — confirma pago |
| `src/app/(storefront)/cart/page.tsx` | página del carrito (líneas del store + `<CheckoutButton>`) |
| `src/app/(storefront)/checkout/success/page.tsx` | "gracias"; lee `session_id`, muestra resumen. **No** cumple el pedido aquí. |
| `src/app/(storefront)/checkout/cancel/page.tsx` | "pago cancelado", vuelve al carrito |

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/proxy.ts` | añadir `/api/webhooks/stripe` a público (ya cubre `/api/webhooks(.*)` — **verificar**), y `/cart` + `/checkout(.*)` a `isPublicRoute` si se permite invitado; si el checkout exige sesión, `/checkout(.*)` queda protegido y `/cart` público |
| `src/server/db/schema/index.ts` | `export *` de las dos tablas nuevas |
| `src/modules/cart/components/cart-drawer.tsx:124` | el `<Link href="/cart">` ya existe; ahora `/cart` responde |
| `.env.example` | 2 claves nuevas vacías |

### Reutilizado tal cual

`productRepository.findById` / una consulta `inArray` para releer varias líneas,
`logAudit`, `db.transaction`, `requireAuth`, `authErrorResponse`, el patrón de
`route.ts` con `safeParse`, la instancia axios de `src/lib/axios.ts`,
`cartSubtotalCents` del store.

---

## 8. Crear la Checkout Session

`src/app/api/checkout/session/route.ts` (esqueleto — el `developer` lo completa
contra el spec aprobado):

```ts
import { NextResponse, type NextRequest } from "next/server";

import { authErrorResponse, requireAuth } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { checkoutSessionSchema } from "@/modules/checkout/schemas/checkout.schema";
import { createPendingOrder } from "@/server/services/checkout.service";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

export async function POST(request: NextRequest) {
  let userId: string;
  let email: string;
  try {
    const user = await requireAuth();          // D2: o permitir invitado
    userId = user.id;
    email = user.email;
  } catch (error) {
    return authErrorResponse(error);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  const parsed = checkoutSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    // Relee precios y stock de Postgres, valida disponibilidad, crea el pedido
    // `pending` + sus `order_items` con el precio congelado. Devuelve la fila y
    // las líneas ya recalculadas EN EL SERVIDOR.
    const { order, items } = await createPendingOrder({
      userId,
      email,
      requested: parsed.data.items,
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      // NO pasar payment_method_types: se activan desde el Dashboard (§ traps).
      line_items: items.map((item) => ({
        quantity: item.qty,
        price_data: {
          currency: order.currency,             // "pen"
          unit_amount: item.unitPriceCents,     // centavos enteros
          product_data: {
            name: item.productName,
            ...(item.imageUrl?.startsWith("http")
              ? { images: [item.imageUrl] }
              : {}),                             // Stripe exige URL absoluta
          },
        },
      })),
      customer_email: order.email,
      client_reference_id: order.id,            // nuestro id de pedido
      metadata: { orderId: order.id },          // llega en el webhook
      success_url: `${APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/checkout/cancel`,
      // API >= 2026-03-25.dahlia: etiqueta para comparar flujos en el Dashboard
      integration_identifier: "g1ecom_checkout_v1_abcdefgh",
      expires_at: Math.floor(Date.now() / 1000) + 60 * 30, // 30 min
    });

    await markOrderSession(order.id, session.id); // guarda stripe_checkout_session_id

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("POST /api/checkout/session", error);
    return NextResponse.json(
      { error: "No se pudo iniciar el pago" },
      { status: 500 },
    );
  }
}
```

Notas:

- **`unit_amount` en centavos.** Nuestros precios ya son enteros de centavos:
  cero conversión, cero `float`.
- **`currency: "pen"`** — minúscula. PEN tiene 2 decimales (no es zero-decimal).
- **Imágenes:** `product_data.images` exige URL **absoluta y pública**. Si
  `imageUrl` es una ruta local (`/products/x.png`), o se omite o se antepone
  `NEXT_PUBLIC_APP_URL` (y en local Stripe no la verá, da igual en test).
- **Sin `automatic_tax`.** Activarlo sin registro fiscal activo hace que Stripe
  no cobre impuesto mientras el equipo cree que sí. Fuera de alcance.
- **`expires_at`:** una sesión que caduca evita pedidos `pending` eternos.

---

## 9. Webhook — la única fuente de verdad del pago

`src/app/api/webhooks/stripe/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";

import { stripe } from "@/lib/stripe";
import { fulfillOrder } from "@/server/services/checkout.service";

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  const payload = await request.text();      // cuerpo CRUDO, no request.json()

  let event: import("stripe").Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature!, WEBHOOK_SECRET);
  } catch (error) {
    console.error("POST /api/webhooks/stripe — firma inválida", error);
    return new NextResponse("Invalid signature", { status: 400 });
  }

  try {
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object;
      // Gate: con métodos de pago diferidos, `completed` llega aún `unpaid`.
      if (session.payment_status !== "unpaid") {
        // Idempotente: si el pedido ya está `paid`, no hace nada.
        await fulfillOrder({
          sessionId: session.id,
          paymentIntentId:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : (session.payment_intent?.id ?? null),
        });
      }
    }

    if (event.type === "checkout.session.async_payment_failed") {
      // marcar el pedido cancelled / notificar; sin descontar stock
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    // 500 → Stripe reintenta con backoff. Nunca 200 optimista.
    console.error(`POST /api/webhooks/stripe — ${event.type}`, error);
    return new NextResponse("Handler failed", { status: 500 });
  }
}
```

`fulfillOrder` (en `src/server/services/checkout.service.ts`):

```
db.transaction(async (tx) => {
  const order = await orderRepo.findBySessionIdForUpdate(tx, sessionId);
  if (!order || order.status === "paid") return;      // idempotencia

  await orderRepo.markPaid(tx, order.id, paymentIntentId);

  for (const item of order.items) {
    // descuento condicional: WHERE stock >= qty
    const ok = await productRepo.decrementStock(tx, item.productId, item.qty);
    if (!ok) {
      // ponytail: sin reserva previa, el sobreventa es posible.
      // En esta fase: registrar en audit_logs con severity 'warning' y seguir;
      // el pago ya ocurrió. Resolución manual desde el panel.
    }
  }

  await logAudit(tx, {
    action: "order.paid",
    entityType: "order",
    entityId: order.id,
    actorId: order.userId,          // o null si invitado
    changes: { after: { status: "paid", total_cents: order.totalCents } },
    metadata: { stripe_payment_intent_id: paymentIntentId },
    // Sin PAN, sin secretos: solo ids de Stripe (docs/SETUP.md §5.2 regla 3)
  });
});
```

Reglas que aplican aquí (`docs/SETUP.md`):

- El log se escribe **en la misma transacción** que la mutación (§5.2 regla 2).
- `audit_logs` no guarda datos de tarjeta ni secretos — solo `cs_…` / `pi_…`
  (§5.2 regla 3).
- El cumplimiento **no** va en `/checkout/success`: el usuario puede pagar y
  cerrar el navegador antes de que cargue esa página.

---

## 10. Stock y concurrencia

- **No** se descuenta stock al crear la sesión: un carrito abandonado
  bloquearía inventario.
- Se descuenta en el webhook, con `UPDATE products SET stock = stock - $qty
  WHERE id = $id AND stock >= $qty`. Si afecta 0 filas, no había stock.
- `ponytail:` sin sistema de reserva, entre "crear sesión" y "webhook" otro
  cliente puede comprar la última unidad → sobreventa posible en la ventana de
  pago. Aceptado en esta fase (volumen bajo, catálogo pequeño). Camino de
  mejora: tabla `stock_reservations` con TTL, o `SELECT ... FOR UPDATE` sobre la
  fila del producto al crear la sesión. **No** construir esto ahora.
- La validación de stock "dura" al crear el pedido (`createPendingOrder`) evita
  el 99% de los casos: solo pasa si el stock baja justo durante el pago.

---

## 11. Pruebas en local

```bash
# Terminal 1 — app
npm run dev

# Terminal 2 — reenvía webhooks de Stripe a la app local
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# copia el whsec_... que imprime → STRIPE_WEBHOOK_SECRET en .env.local, reinicia dev
```

Flujo manual:

1. Añade productos al carrito, abre `/cart`, "Ir a pagar".
2. En el Checkout de Stripe usa una tarjeta de prueba:
   - **`4242 4242 4242 4242`** — pago OK (cualquier fecha futura, cualquier CVC, cualquier ZIP)
   - `4000 0000 0000 9995` — fondos insuficientes (declinada)
   - `4000 0025 0000 3155` — requiere autenticación 3DS
   - (skill `stripe:test-cards` para el listado completo)
3. Verifica: redirección a `/checkout/success`, evento `checkout.session.completed`
   en la Terminal 2, pedido `paid` en `npm run db:studio`, fila en `audit_logs`,
   `stock` descontado.
4. Disparo directo de un evento sin pasar por el checkout:
   ```bash
   stripe trigger checkout.session.completed
   ```

MCP del plugin de Stripe: útil para inspeccionar objetos (`stripe.sessions.list`,
`stripe.payment_intents.retrieve`) sin salir de la sesión. Requiere completar el
OAuth del servidor MCP la primera vez.

---

## 12. Fuera de alcance / futuro

| Tema | Cuándo | Nota |
|---|---|---|
| Persistir carrito (`carts`/`cart_items`) | spec 008 pendiente | hoy el carrito muere al recargar |
| Payment Element / checkout embebido | cuando se quiera pago sin salir del sitio | respaldarlo con Checkout Sessions `ui_mode: 'custom'`, no PaymentIntent crudo |
| Suscripciones / planes | producto nuevo | exige objetos `Price` en Stripe → recién ahí se sincroniza catálogo |
| Stripe Tax / IGV | cuando haya obligación fiscal | exige registro fiscal activo **antes** de `automatic_tax: true` |
| Envío / shipping | cuando haya logística | `shipping_address_collection`, `shipping_options` |
| Reembolsos desde el panel | tras MVP | por ahora, Dashboard de Stripe |
| Guardar tarjeta del cliente | tras cuentas de cliente | Setup Intents + Stripe Customer |
| Stripe Connect | si hay múltiples vendedores | no es el modelo actual (tienda propia) |
| Idempotencia con `svix-id` / `event.id` | si el volumen lo pide | hoy basta la idempotencia por `stripe_checkout_session_id` |

---

## 13. Decisiones abiertas para el usuario

Resolver antes de redactar el spec:

- **D1 — ¿Checkout exige sesión de Clerk, o se permite invitado?**
  Recomendado: **exigir sesión** (ya hay Clerk, el pedido se ata a `user_id`, el
  historial en `/perfil` › "Mis compras" sale gratis). Invitado añade columna
  `email` obligatoria y un flujo de "buscar mi pedido".
- **D2 — Moneda.** El storefront muestra `S/` (PEN). ¿Se confirma **PEN** como
  única moneda? Stripe la soporta. Adaptive pricing / multimoneda: fuera.
- **D3 — ¿`/checkout/success` muestra el detalle del pedido?**
  Recomendado: sí, leyendo el pedido por `session_id` (no por datos del
  cliente). Es solo lectura, no cumple nada.
- **D4 — Página de "Mis compras" en `/perfil`.**
  Hoy es un estado vacío (`perfil/page.tsx:136`). ¿Entra en esta fase conectar
  esa pestaña a `orders`, o es un spec aparte? Recomendado: spec aparte, esta
  fase deja los datos listos.
- **D5 — Correo de confirmación.**
  Stripe puede enviar el recibo (`payment_intent_data.receipt_email` /
  configuración del Dashboard). ¿Suficiente para el MVP, o correo propio? Correo
  propio = dependencia nueva (Resend/etc.) → fuera de alcance salvo que se pida.

---

## 14. Checklist de implementación

- [ ] `npm i stripe`
- [ ] `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` en `.env.local`; claves vacías en `.env.example`
- [ ] `src/lib/stripe.ts` — singleton que lanza si falta la clave
- [ ] Schema `orders` + `order_items`; barrel actualizado
- [ ] `npm run db:generate && npm run db:migrate`
- [ ] `order.repository.ts` — `createPending`, `findBySessionId(ForUpdate)`, `markPaid`, `listByUser`
- [ ] `checkout.service.ts` (server) — `createPendingOrder` (relee precios/stock), `fulfillOrder`
- [ ] `checkout.schema.ts` (Zod) — `checkoutSessionSchema`
- [ ] `POST /api/checkout/session` — auth + Zod + pedido + sesión Stripe
- [ ] `POST /api/webhooks/stripe` — verifica firma, gate `payment_status`, transacción + audit
- [ ] `src/proxy.ts` — `/api/webhooks/stripe` público (verificar `/api/webhooks(.*)`); `/cart`, `/checkout(.*)` según D1
- [ ] `checkout.service.ts` (cliente axios) + `use-checkout.ts` (mutation) + `<CheckoutButton>`
- [ ] `/cart/page.tsx`, `/checkout/success/page.tsx`, `/checkout/cancel/page.tsx` — con estados de carga y error
- [ ] `stripe listen` + prueba con `4242…` de punta a punta
- [ ] `npm run typecheck && npm run lint && npm run build` en verde

---

## 15. Checklist de seguridad

- [ ] `STRIPE_SECRET_KEY` sin `NEXT_PUBLIC_`; nunca en el cliente ni en el log
- [ ] Clave **restringida** (`rk_`), no `sk_`
- [ ] Webhook: firma verificada con `constructEvent` sobre el cuerpo **crudo** antes de tocar la BD
- [ ] Precio recalculado en servidor desde Postgres; el cliente solo manda `{ productId, qty }`
- [ ] `payment_method_types` **no** se pasa en ninguna llamada
- [ ] `audit_logs` sin PAN, sin CVC, sin secretos — solo ids `cs_…` / `pi_…`
- [ ] Cumplimiento en el webhook, no en la página de éxito
- [ ] Idempotencia: reprocesar un evento no duplica el descuento de stock ni el pago
- [ ] `success_url` / `cancel_url` construidas desde `NEXT_PUBLIC_APP_URL`, no de un header de la request

---

## 16. Referencias

- Checkout — https://docs.stripe.com/payments/checkout
- Checkout Session API — https://docs.stripe.com/api/checkout/sessions
- Cumplimiento (fulfillment) — https://docs.stripe.com/checkout/fulfillment
- Webhooks — https://docs.stripe.com/webhooks
- Tarjetas de prueba — https://docs.stripe.com/testing
- Stripe CLI — https://docs.stripe.com/stripe-cli
- Go-live checklist — https://docs.stripe.com/get-started/checklist/go-live
- Skills del plugin: `stripe:stripe-best-practices`, `stripe:stripe-docs`,
  `stripe:test-cards`, `stripe:explain-error`
