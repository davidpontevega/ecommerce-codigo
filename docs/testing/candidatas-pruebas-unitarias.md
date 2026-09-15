# Funciones candidatas a pruebas unitarias

Inventario de las funciones del código actual que son **puras** (mismo input →
mismo output, sin tocar BD, Stripe, Clerk, el DOM ni el store en vivo) y por
tanto se pueden probar con `node:test` sin mocks pesados. Cero funciones de UI
(componentes, hooks de React) ni de orquestación entre capas (Route Handlers,
servicios que llaman a Postgres/Stripe).

Cómo correrlas hoy, sin instalar nada nuevo: `node --import tsx --test "src/**/*.test.ts"`
(`tsx` ya es dependencia del proyecto).

---

## 1. `src/lib/utils.ts` — utilidades de dominio

| Función | Qué hace |
|---|---|
| `formatPrice(cents: number): string` | Convierte centavos enteros a texto de moneda peruana (`S/ 5,499.00`) con `Intl.NumberFormat("es-PE")`. Es la única división por 100 de todo el proyecto. |
| `discountPercent(priceCents, compareAtCents): number \| null` | Calcula el `%` de descuento entre el precio y el precio tachado. Devuelve `null` si no hay `compareAtCents` o si no es mayor al precio (no hay descuento real que anunciar). |
| `stockNote(stock: number): string` | Da el texto de disponibilidad ("N en stock" / "Agotado") que se repite en tarjeta, ficha y buscador. |

> `cn()` (merge de clases Tailwind) se excluye a propósito: es una utilidad de estilos de UI, no lógica de dominio.

---

## 2. Storefront (`src/modules/storefront/`)

### 2.1 Traducción de query de URL (`schemas/storefront.schema.ts`)

| Función | Qué hace |
|---|---|
| `toProductQuery(params: StorefrontProductsQuery): ProductQueryInput` | Único traductor de los parámetros de la URL del catálogo (`?category=`, `?min=`, `?sort=`, …) al contrato que espera el repositorio de productos: resuelve el `sortMap`, pasa `min`/`max` de soles a centavos, fija `status: "available"` y el tamaño de página. |
| `hasActiveFilters(params: StorefrontProductsQuery): boolean` | Dice si el usuario tiene algún filtro puesto (para mostrar el botón "Limpiar filtros"); `page` y `sort` no cuentan como filtro. |
| `toggleValue(current: string[] \| undefined, value: string): string[] \| undefined` | Añade o quita un valor de un filtro multi-selección (marca, categoría); si la lista queda vacía devuelve `undefined` en vez de `[]`. |
| `listParam(max, pattern?)` *(privada)* | Fábrica de un `ZodType` que parte `"a,b,c"` en un arreglo, recorta valores que no matchean el patrón y degrada a `undefined` ante basura (`.catch()`) en vez de romper la página. Se prueba llamando `.safeParse()` sobre el schema que produce, no como función suelta. |

### 2.2 Serializadores (`serializers.ts`)

| Función | Qué hace |
|---|---|
| `toProductListResponse(result: ProductListResult): ProductListResponse` | Convierte las fechas `Date` que devuelve el repositorio a `string` ISO, igual que lo haría `NextResponse.json`, para poder usarse como `initialData` de TanStack Query sin mentir el tipo. |
| `toCategoryListResponse(result: CategoryListResult): CategoryListResponse` | Lo mismo que la anterior, para el listado de categorías. |

---

## 3. Productos (`src/modules/products/` + `src/server/repositories/product.repository.ts`)

### 3.1 Schema (`schemas/product.schema.ts`)

| Función | Qué hace |
|---|---|
| `commaList(max, item)` *(privada)* | Fábrica de `ZodType`: parte una lista separada por comas (`?categorySlug=a,b`), recorta espacios y valida cada elemento contra el schema `item`. Se prueba vía `.safeParse()` del schema resultante. |
| `comparePriceIsHigher(value): boolean` *(privada, usada en `.refine()`)* | Regla de negocio: un `compareAtPriceCents` (precio tachado) solo es válido si es mayor que `priceCents`; si no, es un error de captura, no un descuento. Hoy no está exportada — para probarla directo hay que exportarla o probarla indirectamente vía `productCreateSchema.safeParse(...)`. |

### 3.2 Repositorio (`server/repositories/product.repository.ts`)

| Función | Qué hace |
|---|---|
| `mapDbError(error: unknown)` | Traduce un error de restricción única de Postgres (`23505`) al mensaje HTTP correcto: distingue si chocó el `sku` o el `slug` y devuelve `{status: 409, message}`; para `23503` (categoría inexistente) devuelve `400`. Es la única fuente de verdad de ese mapeo. |
| `findPostgresError(error: unknown)` *(privada)* | Recorre la cadena `error.cause` hasta encontrar el primer error con un `code` de Postgres. La usa `mapDbError`. |
| `buildFilters(params: ProductQueryInput)` *(privada)* | Arma la condición `WHERE` combinando búsqueda, categoría, marca, stock, descuento y estado — dado el mismo `params` siempre arma la misma condición. Se prueba inspeccionando el SQL/los parámetros que produce Drizzle, no ejecutando contra la BD. |
| `isDifferent(before, after): boolean` *(privada)* | Compara dos valores por `JSON.stringify` (jsonb y fechas no comparan bien con `!==`). La usa `update()` para no tocar la fila ni auditar si el `PATCH` no cambió nada real. |

---

## 4. Categorías (`src/server/repositories/category.repository.ts`)

| Función | Qué hace |
|---|---|
| `isUniqueViolation(error: unknown): boolean` | Recorre `error.cause` buscando el código `23505` (violación de unicidad) de Postgres. Mismo patrón que `findPostgresError` de productos, pero solo devuelve un booleano. |
| `buildFilters(params: CategoryQueryInput)` *(privada)* | Arma el `WHERE` de búsqueda (nombre/slug) + estado activo/inactivo. Determinística dado `params`. |

---

## 5. Usuarios — panel admin (`src/server/repositories/user.repository.ts`)

| Función | Qué hace |
|---|---|
| `buildFilters(params: UserQueryInput)` *(privada)* | Arma el `WHERE` de búsqueda (email/nombre/apellido) + filtro de activo/inactivo. Mismo patrón que el de productos y categorías. |

---

## 6. Carrito (`src/modules/cart/store/cart-store.ts`)

| Función | Qué hace |
|---|---|
| `cartCount(lines: CartLine[]): number` | Suma las cantidades de todas las líneas del carrito. |
| `cartSubtotalCents(lines: CartLine[]): number` | Suma `priceCents * qty` de cada línea, en centavos enteros — nunca hace la división por 100. |
| Lógica interna de `add` / `setQty` del store *(no son funciones sueltas, sino el cuerpo de las acciones de Zustand)* | `add` no crea línea si `stock === 0` y suma 1 topando en `line.stock`; `setQty` acota el resultado a `[0, stock]` y elimina la línea si baja a 0 o menos. Es lógica pura de transición de estado (dado `lines` + una acción, produce el `lines` siguiente): se puede probar llamando `useCartStore.getState().add(...)` y leyendo `useCartStore.getState().lines`, sin renderizar nada. |

---

## Qué se excluyó y por qué

| Categoría excluida | Ejemplos | Motivo |
|---|---|---|
| Hooks de React | `use-debounce.ts`, todos los `use-*.ts` de `modules/*/hooks/` | Dependen del ciclo de vida de React; son "flujo entre componentes", explícitamente fuera de este documento. |
| Componentes | Todo `.tsx` bajo `components/` | UI, fuera de alcance por pedido explícito. |
| Servicios de servidor (`server/services/*.ts`) | `createPendingOrder`, `fulfillOrder`, `cancelOrder`, `ensureStripeCustomer`, `savePaymentMethodFromSetupSession`, `removePaymentMethod` | Todas llaman a Postgres (`db.transaction`) y/o a la API de Stripe: no son unitarias sin mockear I/O externo — son candidatas a pruebas de integración, no unitarias. |
| Repositorios (el resto de sus funciones) | `list`, `create`, `update`, `softDelete`, … de cada `*.repository.ts` | Ejecutan queries reales contra Drizzle/Postgres. |
| Route Handlers | Todo `src/app/api/**/route.ts` | Orquestan auth + validación + repositorio + Stripe; son el objeto de pruebas de integración/E2E, no unitarias. |
| Validaciones Zod anónimas inline | `.refine((v) => v.newPassword === v.confirmPassword, …)` en `password.schema.ts`, el `.refine` de fechas en `orders/schema.ts`, el de productos repetidos en `checkout/schema.ts` | Son *callbacks* anónimos, no funciones nombradas reutilizables; se prueban indirectamente llamando `.safeParse()` sobre el schema completo, no de forma aislada. |
| `src/lib/errors.ts`, `src/lib/audit.ts`, `src/lib/auth.ts`, `src/lib/permissions.ts`, `src/lib/stripe.ts`, `src/lib/axios.ts`, `src/lib/query-client.ts` | — | Clases de error, wrappers de I/O (BD, Stripe, Clerk) o configuración — nada que calcule algo por sí solo. |
| `src/server/db/schema/*.ts` | — | Declaraciones de tabla Drizzle, no funciones. |
