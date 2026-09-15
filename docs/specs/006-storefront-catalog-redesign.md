---
id: 006
title: Rediseño del storefront — catálogo con filtros y carrito
status: done
module: storefront        # src/modules/storefront, src/app/(storefront)/products, api/products
scope: client
created: 2026-09-06
---

# 006 — Rediseño del storefront: catálogo con filtros y carrito

> Skills: **ninguna de las del mapa de `CLAUDE.md` §8 está instalada** en esta sesión
> (`vercel:nextjs`, `vercel:shadcn`, `vercel:react-best-practices`, `frontend-design`,
> `web-design-guidelines` no aparecen en el listado). Se redacta sin skill de stack; la única
> activa es `ponytail` (hook de sesión), usada para recortar capas. Todo lo que este documento
> afirma del repo está verificado por lectura directa de los archivos citados.

## 0. Decisiones fijadas (respondidas por el usuario, 2026-09-06)

Las 7 decisiones abiertas están **cerradas**. El cuerpo del spec ya las refleja. Seis se
resolvieron como estaban recomendadas; **D4 cambió**: el seed pasa a ser destructivo.

| # | Decisión | Resolución |
|---|---|---|
| D1 | Moneda | **PEN global**. `formatPrice` → `Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" })` (`S/ 5,499.00`), un solo formateador para storefront y admin (T5). |
| D2 | Tokens | **Añadir, no mover**. `--radius-card` 26px, `--radius-pill`, `--storefront-sunk`, `--brand`/`--brand-foreground` a lima `#d7f24a`/`#12160a`. `--radius` intacto: `grep` confirma que `--brand` solo lo usa el storefront, `/admin` no se repinta (T6). |
| D3 | Carrito | **Drawer efímero en 006**. Zustand **sin `persist`**, `Sheet side="right"`, badge en `storefront-header`, "Ir a pagar" → `/cart` placeholder. Sin tablas ni API (T15–T17). |
| D4 | Seed | **LIMPIO / destructivo** *(cambia respecto a la recomendación inicial)*. `seed.ts` **borra** el catálogo existente (`DELETE FROM products` y después `DELETE FROM categories`, en ese orden por la FK `restrict`) y siembra los 5 + 7 del diseño. Cada corrida deja exactamente esos. Las fotos van a `public/products/<id>.jpg` (T4). |
| D5 | Filtro de marca | **Múltiple**, `?brand=Dell,LG` (coma). `listBrands()` en el repositorio, pasada como prop desde la página. Sin endpoint, service ni hook nuevos (T1, T3). |
| D6 | Rango de precio | **Chips preset que escriben `min`/`max`**. Cero parámetros nuevos en la API (T7, T11). |
| D7 | Landing | **Fuera de 006**. El drawer vive en el header compartido, así que la landing lo hereda; el restyle del bento de `Main.dc.html` queda como **006b**. |

## 1. Contexto

Spec 005 está `done`: `/` y `/products` existen y el módulo `src/modules/storefront/` está en su
sitio. Verificado hoy en el repo:

- `src/app/(storefront)/products/page.tsx` es Server Component, parsea la URL con
  `storefrontProductsQuerySchema`, lee productos + categorías por repositorio y se los pasa a
  `<CatalogView>` como `initialData` dentro de `<Suspense>`.
- `catalog-filters.tsx:127-148` — categoría de **selección única** con `<Checkbox>`;
  `:89-119` min/max libres con `useDebounce`; `:156-177` el `<Select>` de orden vive **dentro**
  del panel de filtros (el diseño lo pone en la cabecera de resultados).
- `storefront.schema.ts` — `sortValues = ["new","price-asc","price-desc"]`; `toProductQuery()`
  es el único traductor URL → API y fija `status:"available"`, `categoryActive:true`,
  `pageSize:12`.
- `productQuerySchema` (`product.schema.ts:13-30`) — tiene `search`, `categoryId`,
  `categorySlug`, `onSale`, `categoryActive`, `status`, `min/maxPriceCents`, `page`, `pageSize`,
  `sortBy ∈ productSortFields`. **No tiene `brand` ni `inStock` ni orden por descuento.**
- `product.repository.ts:119-162` `buildFilters` + `:179-208` `list()`: dos consultas
  (página + count) con `innerJoin` a `categories`. **No hay N+1 y no debe aparecer.**
- `products` (`src/server/db/schema/product.ts`) ya tiene `brand text` nullable, `stock integer
  notNull`, `price_cents`, `compare_at_price_cents`, `image_url`, `specs` (jsonb). **Cero cambios
  de esquema.** La FK `products.category_id → categories.id` es `onDelete: "restrict"`.
- `audit_logs` (`src/server/db/schema/audit-log.ts`) — `entity_id` es **`text` sin FK**; la única
  FK es `actor_id → users.id` con `onDelete: "set null"`. Borrar productos o categorías **no**
  viola ninguna restricción: deja filas de bitácora apuntando a ids inexistentes (§10).
- `src/server/db/seed.ts` siembra **solo** RBAC (permisos, roles, matriz, super admin). No hay
  ni una categoría ni un producto.
- `formatPrice` (`src/lib/utils.ts:11-19`) es `en-US`/USD → `$1,299.99`. Lo consumen el
  storefront y `product-columns.tsx` del panel.
- `product-image.tsx` pinta `<img>` plano; `next.config.ts` es un stub sin `remotePatterns`.
- `globals.css` — `--radius: 0.625rem`, tokens shadcn completos en `:root`/`.dark`, más
  `--brand`, `--brand-foreground`, `--storefront-page|shell|card|border` de 005. `grep brand`
  sobre `src/app/(admin)` y `src/components`: **un solo resultado**, `storefront-header.tsx`.
- `package.json`: `motion@13`, `swiper@14`, `zustand@5`, `next-themes` ya instalados. **No hace
  falta ninguna dependencia nueva.**
- `src/components/ui/`: hay `sheet`, `select`, `skeleton`, `button`, `badge`, `input`, `label`,
  `checkbox`, `separator`. Los chips del diseño son `<button aria-pressed>`: **no se instala
  ningún componente shadcn nuevo.**
- `src/proxy.ts:4-14` deja públicas `/products(.*)` y `/api/products(.*)`. **No se toca.**

Diseño leído entero: `docs/design/README.md`, `canvas.json` (notas PROTOTIPO / SISTEMA / DATOS /
MOTION), `Catalogo.dc.html` (filtros por chips, cabecera con orden de 4 opciones, grilla de 3,
nota de stock, botón "+", drawer de carrito), `Main.dc.html`, `Mobile.dc.html`, `Photo.dc.html`
y las 7 fotos de `img/`.

## 2. Objetivo

Un visitante sin sesión filtra `/products` por **categorías y marcas múltiples, rango de precio,
stock y ofertas**, ordena por precio o por descuento, todo desde la URL, y agrega productos a un
carrito lateral que muestra cantidades y total — con el look de `Catalogo.dc.html`.

## 3. Alcance

### Incluye

- **API**: `productQuerySchema` + `buildFilters` ganan `brand` (múltiple), `inStock`, y
  `sortBy: "discount"`; `listBrands()` en el repositorio de productos.
- **Datos**: 7 fotos a `public/products/`, y `seed.ts` pasa a **sembrar el catálogo desde cero**:
  borra productos y categorías existentes y deja los 5 + 7 del diseño (D4, destructivo).
- **Catálogo**: `catalog-filters` por chips, `catalog-active-filters` acorde, cabecera de
  resultados con el `<select>` de orden, `product-card` con nota de stock y botón "+",
  `product-image` con `next/image` para fotos locales.
- **Carrito efímero**: store Zustand, drawer (`Sheet side="right"`), badge en el header.
- **Visual**: tokens `--radius-card`/`--radius-pill`/`--storefront-sunk` y acento lima;
  `formatPrice` en PEN; animación de grilla y hover con `motion`, respetando
  `prefers-reduced-motion`.

### No incluye

- **Sin cambios de esquema, sin migración, sin tocar `src/proxy.ts` ni `middleware`.**
- **Sin `carts`/`cart_items`, sin checkout, sin `orders`** → spec 007. El carrito de 006 vive en
  memoria y se pierde al recargar.
- **Sin ficha `/products/[slug]`** (sigue cayendo en `not-found`) — deuda de 005.
- **Sin restyle de la landing** (bento de `Main.dc.html`, overlay de búsqueda) → 006b.
- **Sin limpieza de `audit_logs`**: es append-only (regla 9), las filas del catálogo borrado se
  quedan como están.
- Sin favoritos, sin selector de acento (lima fijo; el tema lo sigue dando `next-themes`), sin
  `images.remotePatterns`, sin tests automatizados (el proyecto no tiene runner).

## 4. Criterios de aceptación

**Filtros y orden**

- [ ] **AC1** — Dado el catálogo, cuando marco los chips "Laptops" y "Teclados", entonces la URL
  es `/products?category=laptops,teclados`, la grilla muestra productos de **ambas** categorías y
  al recargar esa URL los dos chips siguen activos.
- [ ] **AC2** — Dado el chip de marca "Dell" y "LG", entonces la URL lleva `brand=Dell,LG` y solo
  aparecen productos de esas marcas; combinar categoría + marca aplica **las dos** condiciones.
- [ ] **AC3** — Dado el chip "S/ 500 – 1.500", entonces la URL lleva `min=500&max=1500` (unidades
  de moneda, como hoy) y solo se ven productos en ese rango; "Todos" borra ambos params.
- [ ] **AC4** — El chip "Con stock" (`stock=1`) oculta los productos con `stock = 0` y el chip
  "En oferta" (`deals=1`) deja solo los que tienen `compare_at_price_cents`; se pueden combinar.
- [x] **AC5** — El orden "Mayor descuento" (`sort=discount`) coloca primero el mayor
  `(compare - price) / compare`; los productos **sin** precio comparativo quedan al final y
  ninguno desaparece del listado.
- [ ] **AC6** — Cambiar cualquier filtro devuelve el listado a la página 1 y **no** recarga la
  página (`router.replace`, `scroll: false`).
- [ ] **AC7** — Los chips de filtros activos muestran uno por filtro aplicado, incluidos categoría
  y marca **por valor** (dos categorías = dos chips); quitar uno elimina solo ese valor y
  "Quitar todo" deja `/products` limpio.
- [ ] **AC8** — El buscador del header sigue enviando `/products?q=…` con `<form>` nativo y el
  término aparece como chip activo.

**API**

- [x] **AC9** — `GET /api/products?brand=Dell,LG` devuelve solo esas marcas;
  `?brand=` (vacío) y una marca inexistente devuelven `{ data: [], total: 0 }` sin 500.
- [x] **AC10** — `GET /api/products?inStock=true` excluye `stock = 0`; `inStock=false` **no**
  filtra; `inStock=basura` responde **400** con el detalle de Zod (`z.stringbool()`).
- [ ] **AC11** — `?sortBy=discount&sortDir=desc` ordena por descuento y el listado sigue costando
  **dos** consultas (página + count). `/admin/products` no cambia de comportamiento en ningún
  filtro ni orden.
- [x] **AC12** — `listBrands()` devuelve las marcas distintas, no nulas, de productos con
  `deleted_at IS NULL`, ordenadas alfabéticamente, en **una** consulta.

**Datos y fotos**

- [x] **AC13** — `npm run db:seed` deja **exactamente** 5 categorías y 7 productos: borra primero
  los productos y después las categorías existentes (ese orden; la FK es `restrict`) y siembra
  los del diseño con precios en centavos e `image_url = /products/<id>.jpg`. Correrlo **dos
  veces** da el mismo resultado y no falla. El bloque RBAC del seed sigue intacto y no borra
  usuarios, roles ni permisos.
- [x] **AC14** — Tras el seed, `audit_logs` **conserva todas sus filas** (append-only, sin FK a
  `products`/`categories`): el borrado no lanza error de integridad y las entradas viejas quedan
  con `entity_id` huérfano, que la vista de auditoría muestra sin romperse.
- [x] **AC15** — Una tarjeta con `image_url` que empieza por `/` se pinta con `next/image`; una
  con URL remota sigue usando `<img>` plano (sin `remotePatterns`, `next/image` fallaría en
  runtime); sin `image_url`, el tile de respaldo. Nunca un hueco roto.

**Tarjeta y carrito**

- [ ] **AC16** — Cada tarjeta muestra nombre, spec (de `specs`/`description`), nota de stock
  ("12 en stock" / "Agotado"), precio, precio tachado si aplica y badge `-N %`; con `stock = 0`
  la foto se atenúa y el botón "+" está `disabled`.
- [ ] **AC17** — Pulsar "+" suma el producto al carrito, el badge del header incrementa con la
  animación `bump` y el drawer lista la línea con stepper de cantidad y total; bajar la cantidad
  a 0 elimina la línea; el carrito vacío muestra "Todavía no hay nada acá".
- [ ] **AC18** — El total del drawer se calcula sumando **centavos enteros** (nunca `float`) y se
  formatea con `formatPrice`; "Ir a pagar" enlaza a `/cart`.
- [ ] **AC19** — El drawer se abre desde el icono del carrito en `/` y en `/products`, se cierra
  con Escape y con clic en el overlay, y devuelve el foco al botón que lo abrió.

**Presentación**

- [ ] **AC20** — `price_cents = 549900` se muestra como `S/ 5,499.00` en el catálogo **y** en
  `/admin/products` (un solo formateador).
- [ ] **AC21** — Con `prefers-reduced-motion: reduce` no hay entrada de grilla, ni `bump`, ni
  hover animado; el contenido es visible siempre (nunca se anima `opacity` a 0 sin garantía).
- [ ] **AC22** — A 390 px: una columna, filtros en `Sheet` inferior con el mismo estado de URL,
  drawer a ancho completo, sin scroll horizontal. En oscuro, chips y acento lima mantienen
  contraste legible.
- [ ] **AC23** — Estados de carga (skeletons), error ("Reintentar") y vacío ("Nada con estos
  filtros" + "Limpiar filtros") presentes; al paginar no hay parpadeo a vacío.
- [ ] **AC24** — `/admin` se ve **igual** que antes en claro y oscuro (`--radius` intacto,
  `--brand` no lo usa el panel) y `npm run typecheck && npm run lint && npm run build` en verde.

## 5. Modelo de datos

**Sin cambios de esquema. Sin migración.** Todas las columnas necesarias existen:
`products.brand` (text nullable), `products.stock` (integer notNull), `price_cents`,
`compare_at_price_cents`, `image_url`, `specs` (jsonb).

`seed.ts` gana un bloque de catálogo **destructivo-idempotente** (D4), después del bloque RBAC,
que no se toca:

1. `await db.delete(products)` — primero, porque `products.category_id` referencia a `categories`
   con `onDelete: "restrict"`: al revés, Postgres aborta.
2. `await db.delete(categories)`.
3. `insert` de las 5 categorías y los 7 productos.

Los tres pasos van en **una transacción** (`db.transaction`): si el insert falla, no queda una
tienda vacía. `audit_logs` no se toca (append-only, `entity_id` sin FK).

- **Categorías** (5): Laptops, Teclados, Monitores, Audio, Almacenamiento — `slug` kebab,
  `is_active = true`.
- **Productos** (7), `Catalogo.dc.html:317-325`, precios **en centavos** tal cual:
  `xps13` Dell XPS 13 · Laptops · 549900 / 599900 · stock 12 ·
  `ideapad` Lenovo IdeaPad Gaming 3 · Laptops · 399900 / — · 7 ·
  `k2` Keychron K2 · Teclados · 42900 / 49900 · 30 ·
  `mxkeys` Logitech MX Keys · Teclados · 39900 / — · **0** ·
  `ug27` LG UltraGear 27" · Monitores · 129900 / 149900 · 9 ·
  `xm5` Sony WH-1000XM5 · Audio · 179900 / — · 15 ·
  `980pro` Samsung 980 Pro 1TB · Almacenamiento · 49900 / 59900 · 25.
  `sku` = id en mayúsculas, `slug` = id kebab, `image_url = /products/<id>.jpg`,
  `specs = { resumen: "<spec del diseño>" }`.

Tipos: se siguen infiriendo de Drizzle vía `ProductDto`/`StorefrontProduct`. Tipo nuevo, en
`src/modules/storefront/types/storefront.types.ts`:

- `CartLine = Pick<StorefrontProduct, "id"|"name"|"slug"|"priceCents"|"imageUrl"> & { qty: number }`

## 6. Contratos de API

Sin rutas nuevas. Node runtime, Zod antes de tocar datos, error uniforme `{ error: string }`.

| Método | Ruta | Auth | Query | Response |
|---|---|---|---|---|
| GET | `/api/products` | pública salvo `status ≠ available` (sin cambios) | `productQuerySchema` **ampliado** | `{ data, total, page, pageSize }` · 400 · 401/403 · 500 |
| GET | `/api/categories` | pública | sin cambios | sin cambios |

Ampliación de `productQuerySchema`:

- `brand: z.string().trim().max(400).optional()` → `.transform(v => v.split(",").map(s => s.trim()).filter(Boolean))`; lista vacía = sin filtro.
- `categorySlug`: mismo tratamiento (pasa de slug único a lista separada por comas, un valor
  sigue siendo válido → la landing no se rompe).
- `inStock: z.stringbool().optional()` — **nunca `z.coerce.boolean()`** (`Boolean("false") === true`).
- `productSortFields` gana `"discount"`.

**Contrato de URL del catálogo** (`storefrontProductsQuerySchema`), todo `.catch()` como hoy:

| Param URL | Zod | → API |
|---|---|---|
| `q` | string ≤100 | `search` |
| `category` | lista de slugs por coma | `categorySlug` |
| `brand` | lista de marcas por coma, ≤400 | `brand` |
| `min` / `max` | int ≥0 (unidades de moneda) | `minPriceCents` / `maxPriceCents` (×100) |
| `stock` | `"1"` ⇒ true | `inStock` |
| `deals` | `"1"` ⇒ true | `onSale` |
| `sort` | `enum(["new","price-asc","price-desc","discount"]).default("new")` | `sortBy` + `sortDir` |
| `page` | int ≥1, default 1 | `page` |
| — | — | `status:"available"`, `categoryActive:true`, `pageSize:12` (constantes) |

Marcas: **no hay endpoint**. `listBrands()` del repositorio la lee la página y la pasa como prop
a `<CatalogView>` (§8, D5).

## 7. Arquitectura y archivos afectados

**Servidor / API (modificados)**
- `src/modules/products/schemas/product.schema.ts` — `brand`, `inStock`, `sortBy: "discount"`.
- `src/server/repositories/product.repository.ts` — `buildFilters`: `inArray(products.brand, …)`,
  `inArray(categories.slug, …)`, `gt(products.stock, 0)`; `sortColumns.discount` como expresión
  `coalesce((compare - price)::numeric / nullif(compare, 0), 0)`; `listBrands()` nueva.
- `src/server/db/seed.ts` — bloque de catálogo destructivo-idempotente (§5).
- `src/lib/utils.ts` — `formatPrice` a `es-PE`/`PEN`.
- `src/app/globals.css` — `--radius-card`, `--radius-pill`, `--storefront-sunk` y `--brand`
  lima en `:root` y `.dark`, mapeados en `@theme inline`. **`--radius` y los tokens shadcn no
  se tocan.**
- `public/products/{xps13,ideapad,k2,mxkeys,ug27,xm5,980pro}.jpg` — copiadas de
  `docs/design/img/` (`ssd980.jpg` → `980pro.jpg`, para que el nombre case con el `sku`).

**Módulo `src/modules/storefront/` (modificados)**
- `schemas/storefront.schema.ts` — contrato de URL de §6, `toProductQuery`, `hasActiveFilters`,
  `PRICE_RANGES` (presets del diseño) y `storefrontSortOptions` con las 4 etiquetas.
- `services/storefront.service.ts` — serializa `brand`/`categorySlug` como cadena unida por comas
  antes de axios (§10).
- `components/catalog-filters.tsx` — chips (categoría múltiple, precio preset, marca múltiple,
  disponibilidad). **Pierde el `<select>` de orden**, que sube a la cabecera.
- `components/catalog-active-filters.tsx` — un chip por **valor**, no por parámetro.
- `components/catalog-view.tsx` — cabecera "N de M productos" + `<Select>` de orden, grilla
  animada con `motion` (stagger por índice), estados y paginación.
- `components/product-card.tsx` — nota de stock, botón "+", radios del diseño, `lift`/`zoom`.
- `components/product-image.tsx` — `next/image` cuando la ruta es local; `<img>` si es remota.
- `types/storefront.types.ts` — `CartLine`.

**Nuevos**
- `src/modules/cart/store/cart-store.ts` — `"use client"`, Zustand: `lines`, `add`, `setQty`,
  `clear`, selectores `count` y `subtotalCents`. Sin `persist` (§11).
- `src/modules/cart/components/cart-drawer.tsx` — `"use client"`, `Sheet side="right"` con
  líneas, stepper, total y "Ir a pagar" → `/cart`.
- `src/modules/cart/components/cart-button.tsx` — `"use client"`, icono + badge con `bump`;
  abre el drawer. Sustituye al enlace `/cart` del header.

**Páginas**
- `src/app/(storefront)/products/page.tsx` — tercera lectura (`listBrands()`) y `brands` como
  prop de `<CatalogView>`.
- `src/components/shared/storefront-header.tsx` — `<CartButton />` en lugar del enlace.

**Reutilizado tal cual**: `product.repository.list()`, `category.repository.list()`,
`use-storefront-products.ts`, `use-active-categories.ts`, `serializers.ts`,
`src/components/ui/{sheet,select,button,skeleton,badge,separator}.tsx`, `lib/axios`,
`lib/utils.cn`, `discountPercent`. **Sin componentes shadcn nuevos y sin dependencias nuevas.**

## 8. Decisiones técnicas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| **Multi-valor por coma** (`?category=a,b`, `?brand=Dell,LG`) | Param repetido (`?brand=a&brand=b`) | Todo el proyecto lee la query con `Object.fromEntries(searchParams)`, que **se queda con el último valor** de una clave repetida: el param repetido perdería filtros en silencio en el Route Handler y en la página. La coma es un solo `string` que sobrevive a `fromEntries`, a axios y al `queryKey`. |
| **`listBrands()` en el repo, pasada como prop desde la página** | `GET /api/products/brands` + service + hook | La lista de marcas no cambia mientras el usuario filtra: es contenido de la página, ya renderizada en servidor. Un endpoint serían 3 archivos y una petición extra para el mismo dato. Si algún día hace falta en cliente, se añade el endpoint sin tocar el filtro. |
| **Presets de precio que escriben `min`/`max`** | `?price=500-1500` con su propio parseo | `min`/`max` ya existen, ya se traducen a centavos y ya tienen chip activo. Los presets son solo etiquetas sobre esos dos números: cero contrato nuevo, y quien quiera un rango a mano puede seguir escribiéndolo en la URL. |
| Orden por descuento como **expresión con `coalesce`**, no como columna | `ORDER BY … DESC NULLS LAST` | En Postgres `DESC` pone los `NULL` **primero**: los productos sin oferta encabezarían el "Mayor descuento". `coalesce(…, 0)` los manda al final sin cláusula extra y sin ramas en `list()`. Sigue siendo `ORDER BY` sobre las mismas dos consultas. |
| `inStock` como `z.stringbool()` y `gt(stock, 0)` | Reutilizar `minStock` numérico | El diseño ofrece un interruptor, no un umbral. Un número obligaría a decidir qué significa "poco stock" sin que nadie lo haya pedido. |
| **Carrito en Zustand, no en TanStack Query ni en la URL** | Query (no hay servidor) o `useState` en el layout | Regla 6 de `CLAUDE.md`: datos de servidor a Query, **estado de UI a Zustand**. Un carrito sin backend es exactamente estado de UI. La URL queda libre para los filtros, que sí deben ser compartibles. |
| Carrito **sin `persist`** | `persist` en localStorage | 007 mueve el carrito a `carts`/`cart_items`: persistir ahora crearía una segunda fuente de verdad que habría que migrar y un riesgo de mismatch de hidratación. Se pierde al recargar y se documenta (§11). |
| `next/image` **solo para rutas locales** (`imageUrl.startsWith("/")`) | `next/image` siempre | `next.config.ts` no declara `remotePatterns`: con una `image_url` remota `next/image` falla **en runtime**, no en build. Tras el seed limpio todas las fotos son locales, pero el panel puede volver a teclear una URL externa mañana: la condición de una línea evita que eso tumbe el catálogo. |
| **`--brand` repuntado a lima**, `--radius` intacto, `--radius-card`/`--radius-pill` nuevos | Mover `--radius` a 26px | `--radius` alimenta los 18 componentes shadcn del panel (`--radius-sm…4xl` derivan de él): moverlo repinta `/admin` entero, fuera de alcance. `--brand`, en cambio, `grep` confirma que solo lo usa el storefront. El par acento/texto viaja junto (`--brand-foreground`), como pide el `canvas.json`. |
| **`formatPrice` único en PEN** | Un formateador `S/` solo para el storefront | Los precios están en una única moneda en la BD; dos formateadores harían que el panel y la tienda mostraran cifras distintas del mismo entero. Se usa `Intl` con `es-PE` (`S/ 5,499.00`), no el `formatCents` a mano del lienzo: ese replica agrupación `es-ES` (`5.499,00`), que no es la convención peruana. |
| El `<select>` de orden **sube a la cabecera de resultados** | Dejarlo dentro del panel de filtros | Es lo que dibuja `Catalogo.dc.html:187-196`, y además el orden no es un filtro: no aparece en los chips activos ni lo borra "Limpiar". |
| Chips como `<button aria-pressed>` | Instalar `toggle-group` de shadcn | Un `<button>` con `aria-pressed` es el patrón nativo accesible para un interruptor de filtro; `toggle-group` añade dependencia y roles de radiogroup que no encajan con multi-selección libre. |
| La grilla se anima con `motion` **solo en `y`** y con `useReducedMotion` | `opacity: 0` inicial + `whileInView` | Lección de 005 §14.4: animar `opacity` desde 0 deja contenido invisible si el observador no dispara. El stagger por índice reproduce `gr-a`/`gr-b` del lienzo; en React basta una `key` derivada del filtro (nota MOTION del canvas). |
| El drawer vive en el **header compartido** | Uno por página | El header ya está en el layout del storefront: el carrito funciona en `/` y en `/products` sin duplicar nada, y 006b/007 no tendrán que moverlo. |
| **Seed destructivo** (`DELETE` de productos y categorías antes de sembrar), en transacción | Upsert idempotente que respeta los datos existentes | Decisión del usuario (D4). El catálogo de prueba ("Categoria 1-23", "Review2 Check", GTX) no representa nada real y convivir con él dejaba el storefront con productos sin foto ni marca, imposible de revisar contra el diseño. Con `DELETE` cada corrida deja un catálogo idéntico al del lienzo. `products` primero: la FK es `restrict`. |
| `audit_logs` **no se limpia** | Borrar las entradas del catálogo eliminado | Regla 9: la bitácora es append-only. `entity_id` es `text` sin FK, así que el borrado no falla; quedan referencias a ids inexistentes, que es exactamente lo que una bitácora debe conservar (§10). |

## 9. Tareas atómicas

### Fase A — API y datos

- [x] **T1** — `brand` (lista por coma), `categorySlug` (lista por coma), `inStock`
  (`z.stringbool()`) y `"discount"` en `productSortFields` ·
  `src/modules/products/schemas/product.schema.ts` · verificación: AC9, AC10, `npm run typecheck`.
- [x] **T2** — `buildFilters`: `inArray` para marca y slug, `gt(products.stock, 0)` para
  `inStock === true`; `sortColumns.discount` con `coalesce(…)`, sin añadir consultas ·
  `src/server/repositories/product.repository.ts` · verificación: AC5, AC11.
- [x] **T3** — `listBrands()`: `SELECT DISTINCT brand … WHERE deleted_at IS NULL AND brand IS NOT
  NULL ORDER BY brand` · `src/server/repositories/product.repository.ts` · verificación: AC12.
- [x] **T4** — Copiar las 7 fotos a `public/products/` (`ssd980.jpg` → `980pro.jpg`) ·
  verificación: los 7 archivos existen y `next/image` los sirve.
- [x] **T5** — **Seed destructivo del catálogo**: en una transacción, `delete(products)` →
  `delete(categories)` → insert de 5 categorías + 7 productos (§5). El bloque RBAC no se toca.
  Dejar un aviso en consola (`"db:seed borra el catálogo existente"`) y anotarlo en el comentario
  de cabecera del archivo · `src/server/db/seed.ts` · verificación: AC13, AC14 (correr
  `npm run db:seed` dos veces y revisar `audit_logs`).

### Fase B — base visual

- [x] **T6** — `formatPrice` a `Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" })` ·
  `src/lib/utils.ts` · verificación: AC20.
- [x] **T7** — `--radius-card: 1.625rem`, `--radius-pill: 999px`, `--storefront-sunk` y `--brand`
  /`--brand-foreground` lima en `:root` y `.dark`, mapeados en `@theme inline`; `--radius` sin
  tocar · `src/app/globals.css` · verificación: AC22, AC24.

### Fase C — contrato de URL

- [x] **T8** — Contrato de §6 (`category`/`brand` lista, `stock`, `deals`, `sort` con
  `discount`), `PRICE_RANGES`, `storefrontSortOptions` de 4 etiquetas, `toProductQuery` y
  `hasActiveFilters` actualizados · `src/modules/storefront/schemas/storefront.schema.ts` ·
  verificación: AC1–AC5, `npm run typecheck`.
- [x] **T9** — Serializar `brand` y `categorySlug` como cadena unida por comas antes de axios
  (por defecto axios manda `brand[]=`, que el handler ignora) ·
  `src/modules/storefront/services/storefront.service.ts` · verificación: AC2 con la pestaña de
  red abierta.

### Fase D — piezas de producto

- [x] **T10** — `<ProductImage>`: `next/image` con `fill` + `sizes` cuando `imageUrl` empieza por
  `/`; `<img>` si es remota; tile si es `null` ·
  `src/modules/storefront/components/product-image.tsx` · verificación: AC15.
- [x] **T11** — `<ProductCard>`: radio `--radius-card`, badge `-N %`, spec, nota de stock,
  precio + tachado, botón "+" (`disabled` con `stock = 0`, foto atenuada), `lift`/`zoom` en hover ·
  `src/modules/storefront/components/product-card.tsx` · verificación: AC16, AC17.

### Fase E — catálogo

- [x] **T12** — `<CatalogFilters>` por chips: categoría múltiple, precio preset, marca múltiple,
  "Con stock"/"En oferta"; `<button aria-pressed>`; sin el `<select>` de orden; sigue emitiendo
  el cambio hacia arriba · `src/modules/storefront/components/catalog-filters.tsx` ·
  verificación: AC1–AC4, AC22.
- [x] **T13** — `<CatalogActiveFilters>`: un chip por **valor** (categoría y marca incluidas), "×"
  por chip y "Quitar todo" · `src/modules/storefront/components/catalog-active-filters.tsx` ·
  verificación: AC7.
- [x] **T14** — `<CatalogView>`: cabecera "N de M productos" + `<Select>` de orden, grilla con
  entrada `motion` en `y` con stagger y `useReducedMotion`, estados carga/error/vacío y
  paginación · `src/modules/storefront/components/catalog-view.tsx` · verificación: AC5, AC6,
  AC21, AC23.
- [x] **T15** — Página: tercera lectura `listBrands()` y `brands` como prop; breadcrumb con
  multi-categoría (la primera o "Catálogo") · `src/app/(storefront)/products/page.tsx` ·
  verificación: AC12, AC1.

### Fase F — carrito efímero

- [x] **T16** — `useCartStore` (Zustand): `lines`, `add`, `setQty` (0 = eliminar), `clear`,
  `count`, `subtotalCents` en enteros · `src/modules/cart/store/cart-store.ts` · verificación:
  AC18.
- [x] **T17** — `<CartDrawer>`: `Sheet side="right"`, líneas con foto, stepper, total y "Ir a
  pagar" → `/cart`; estado vacío "Todavía no hay nada acá" ·
  `src/modules/cart/components/cart-drawer.tsx` · verificación: AC17, AC19.
- [x] **T18** — `<CartButton>` con badge y `bump` (sin animación con reduced-motion), montado en
  el header en lugar del enlace a `/cart` ·
  `src/modules/cart/components/cart-button.tsx` + `src/components/shared/storefront-header.tsx` ·
  verificación: AC17, AC19, AC21.

### Fase G — cierre

- [x] **T19** — `npm run typecheck && npm run lint && npm run build` en verde (reviewer, iteración 1).
  Recorrido manual de los AC de UI (teclado, 390 px, claro/oscuro, `/admin` sin cambios) queda como
  QA manual pendiente; el código de soporte está auditado y correcto.

**Total: 19 tareas.**

## 10. Riesgos

- **Axios serializa arrays como `brand[]=`.** El Route Handler lee
  `Object.fromEntries(searchParams)`: la clave `brand[]` no existe en el schema y el filtro se
  pierde **en silencio** (200 con resultados de más). Por eso T9 une con comas en el service; es
  el fallo más probable de toda la fase C-D.
- **`next/image` con `image_url` remota** revienta en runtime (`hostname not configured`), no en
  build. Tras el seed limpio todas las fotos son locales, pero basta que alguien cargue una URL
  externa desde `/admin` para tumbar el catálogo si T10 no discrimina por `startsWith("/")`.
- **`DESC` y `NULL` en Postgres.** Sin el `coalesce` de T2, "Mayor descuento" mostraría primero
  los productos **sin** oferta. Es un fallo silencioso: se ve raro, no rompe.
- **`npm run db:seed` ahora BORRA el catálogo.** Deja de ser una operación segura: cualquier
  producto o categoría creado a mano desde `/admin` desaparece en la siguiente corrida, y no hay
  papelera (el `DELETE` es físico, no el soft-delete de `deleted_at`). Riesgo real si alguien lo
  ejecuta contra una base con datos que importan. Mitigación en T5: transacción + aviso explícito
  en consola y en el comentario de cabecera del archivo. **Antes de la primera corrida, avisar al
  usuario de que sus datos de prueba se pierden.**
- **Orden del borrado.** `products.category_id` es FK `onDelete: "restrict"`: borrar categorías
  primero aborta la transacción entera con un 23503. El orden productos → categorías no es
  estilo, es obligatorio.
- **`audit_logs` queda con `entity_id` huérfano.** No hay FK (`entity_id` es `text`), así que el
  borrado no falla; lo que queda son entradas de bitácora que apuntan a productos que ya no
  existen. Es aceptable por append-only (regla 9), pero la vista de auditoría del panel no debe
  intentar resolver esos ids a un nombre: verificar en AC14 que no rompe.
- **Cambio de moneda visible en el panel.** T6 toca `formatPrice`, que consume
  `product-columns.tsx`: `/admin/products` pasa a mostrar `S/`. Es intencional (D1).
- **Carrito volátil.** Recargar la página vacía el carrito (sin `persist`, §8). Si en QA se
  percibe como bug, la salida barata es `persist` con `skipHydration`, no adelantar 007.
- **`productSortFields` lo usa `product-table.tsx`** para validar el `sortBy` de la URL del panel:
  tras T1 aceptará `?sortBy=discount`, que no tiene columna en la tabla. No rompe (el listado se
  ordena, la cabecera no marca nada), pero conviene mirarlo en AC24.
- **Contraste del acento lima.** `#d7f24a` sobre blanco no llega a 4.5:1 para texto: solo se usa
  como **fondo** con `--brand-foreground` (`#12160a`) encima, nunca como color de texto. Si algún
  componente heredado usa `text-brand` (hoy lo hacen `catalog-filters` y `catalog-active-filters`),
  hay que cambiarlo en T12/T13 o el texto queda ilegible.
- **`useSearchParams()` sigue exigiendo `<Suspense>`**: `<CatalogView>` continúa siendo el único
  que lo llama y la página ya lo envuelve. No mover esa llamada a los filtros.

## 11. Fuera de alcance / deuda aceptada

- **Spec 007**: carrito real (`carts`/`cart_items`, fusión al iniciar sesión, badge desde la BD),
  checkout y `orders`. El store de 006 se reemplaza; `CartLine` es el mismo contrato que
  consumirán los componentes.
- **Spec 006b**: restyle de la landing (bento de `Main.dc.html`, overlay de búsqueda,
  hero-carousel con el nuevo sistema de tokens) y `Mobile.dc.html`.
- **Ficha `/products/[slug]`**: sigue en `not-found` (deuda arrastrada de 005).
- **Seed con `--keep` o entorno de guardia**: el seed borra siempre; no se añade flag ni
  comprobación de `NODE_ENV` hasta que exista un despliegue real que proteger.
- **Selector de acento** (eléctrico/violeta/coral del lienzo): se implementa **solo lima**; los
  otros tres viven en `ACCENTS` del diseño por si alguna vez hay tematización de marca.
- **Favoritos**, `remotePatterns`/CDN, tabla `product_images` y galería.
- **Búsqueda por relevancia**: `q` sigue siendo el `ILIKE` sobre `name`/`sku`; el buscador del
  diseño también filtra por marca y spec, esto no.
- **Marcas normalizadas**: `brand` es texto libre; "dell" y "Dell" serían dos chips. Sin tabla de
  marcas hasta que duela.
- **Tests automatizados**: el proyecto sigue sin runner (deuda desde 001).
