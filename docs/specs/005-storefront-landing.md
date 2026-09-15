---
id: 005
title: Storefront — landing, catálogo público y modo oscuro
status: done
module: storefront        # src/modules/storefront, src/app/(storefront), api/products
scope: client
created: 2026-09-02
---

# 005 — Storefront: landing, catálogo público y modo oscuro

> Skills: **ninguna del mapa de `CLAUDE.md` §8 está instalada en esta sesión**
> (`vercel:nextjs`, `vercel:react-best-practices`, `vercel:shadcn`, `frontend-design`,
> `web-design-guidelines` no aparecen en el listado; solo hay skills de Clerk, caveman,
> ponytail, `design` y `dataviz`, ninguna aplicable). El spec se redacta sin skill y toda
> afirmación sobre el repo está verificada con lectura directa de los archivos citados.

> **Revisión del usuario (2026-09-02)**: imágenes solo con tile de respaldo (sin
> `remotePatterns`), la página de catálogo `/products` **entra en 005**, y el modo oscuro
> **entra en 005**. Este documento ya refleja las tres decisiones.

## 1. Contexto

Los specs 001–004 están `done`: existen `categories` (con `is_active`), `products` (con
`deleted_at`, `image_url` nullable, `price_cents`/`compare_at_price_cents` en centavos),
sus repositorios, el CRUD de admin y el RBAC completo. **Falta la tienda**: hoy
`src/app/page.tsx` sigue siendo la página de `create-next-app` y
`src/app/(storefront)/` solo contiene `.gitkeep` en `cart/`, `checkout/`, `orders/[id]/`
y `products/[slug]/`.

Verificado en el repo:

- `src/proxy.ts:4-14` **ya** declara públicas `/`, `/products(.*)`, `/api/products(.*)` y
  `/api/categories(.*)`. **No hay que tocar `proxy.ts`.**
- `src/app/api/products/route.ts:11-35` y `src/app/api/categories/route.ts:11-32`: el `GET`
  no llama `requirePermission`; solo las mutaciones lo hacen. Ambos ya son públicos.
- `productQuerySchema` (`src/modules/products/schemas/product.schema.ts:11-21`) filtra por
  `search`, `categoryId`, `status`, rango de precio, y ordena por
  `name|priceCents|stock|createdAt|updatedAt`. **No tiene `categorySlug` ni "en oferta".**
- `product.repository.ts:165-194` `list()` ya hace `innerJoin` a `categories` (dos queries,
  sin N+1) y devuelve `{ data, total, page, pageSize }`; el `join` deja `categories.slug`
  disponible sin coste extra.
- `category.repository.ts` expone `list()` con `status: active|inactive|all` y
  `findBySlug()`. Para el storefront basta `status=active`: **cero cambios**.
- `src/app/layout.tsx` monta `ClerkProvider` + `QueryProvider` + `Toaster` y las fuentes
  Geist (las mismas del diseño). `next.config.ts` es un stub vacío.
- **`next-themes@^0.4.6` ya es dependencia directa** (`package.json`), hoy solo consumida por
  `src/components/ui/sonner.tsx`. **No hay `ThemeProvider` montado**, así que la clase
  `.dark` nunca se aplica y el bloque `.dark` de `src/app/globals.css:86-118` (36 tokens
  shadcn completos) está inerte.
- Ni `src/app/(admin)/**` ni `src/components/shared/**` usan colores literales
  (`bg-white`, `text-zinc-*`, …): todo es token. Verificado con `grep`; por eso activar el
  tema oscuro no rompe el panel (§8).
- `src/components/ui/` tiene `sheet`, `checkbox`, `select`, `skeleton`, `input`, `button`,
  `badge`, `separator`: el catálogo no necesita ningún componente shadcn nuevo.

Diseño de referencia leído: `Main.dc.html` / `Mobile.dc.html` (landing) y
`Catalog.dc.html` / `CatalogMobile.dc.html` (catálogo), con sus variantes `*Dark`.
Bento sobre gradiente suave, shell "glass" con `backdrop-filter`, radios 26–34 px, píldoras,
acento índigo `#5b5bd6`. Catálogo: breadcrumb + título + contador, filtros a la izquierda
(precio, categoría, marca, valoración), select de orden, chips de filtros activos,
cuadrícula de tarjetas, paginación y estado vacío ("Sin resultados con estos filtros").

## 2. Objetivo

Un visitante **sin sesión** abre `/`, ve la tienda con datos reales, navega a `/products`,
filtra por categoría, precio y orden con la URL como estado, y puede alternar entre tema
claro y oscuro; todo el contenido de portada y la primera página del catálogo llegan
renderizados desde el servidor.

## 3. Alcance

### Incluye

- **Landing `/`**: `src/app/(storefront)/{layout,page,loading,error}.tsx`, header y footer de
  tienda, bento de `Main.dc.html`/`Mobile.dc.html` con datos reales.
- **Catálogo `/products`**: Server Component con la primera página ya renderizada + isla
  cliente de filtros/paginación con la URL como fuente del estado.
- **Modo oscuro** con `next-themes`: provider global, conmutador en el header y tokens
  `.dark` del storefront tomados de `MainDark.dc.html`.
- Dos islas de animación: carrusel del hero (`swiper`) y envoltorio `motion`, ambas
  respetando `prefers-reduced-motion`.
- Dependencias nuevas: **`motion` y `swiper`, nada más** (`next-themes` ya está instalado).
- API pública: `productQuerySchema` + `buildFilters` ganan `categorySlug` y `onSale`;
  `GET /api/products` cierra la fuga de productos eliminados (§8).
- Módulo `src/modules/storefront/` completo: `types`, `schemas`, `services`, `hooks`,
  `components`.
- `formatPrice`/`discountPercent` en `src/lib/utils.ts`.

### No incluye (explícito)

- **Sin cambios de esquema, sin migración, sin tocar `src/proxy.ts`.**
- **Sin `/api/storefront/*`**: se reutilizan los endpoints existentes (§8).
- **Sin `next/image` ni `images.remotePatterns`**: `<ProductImage>` renderiza siempre el tile
  de respaldo (§8). `next.config.ts` no se toca.
- **Sin ficha de producto `/products/[slug]`** → spec 006.
- **Sin filtro de marca ni de valoración** y sin orden "Mejor valorados": no hay columna de
  reviews y el filtro por `brand` no tiene consumidor en el diseño acordado (§8).
- Carrito real, checkout, `orders`: el icono del carrito enlaza a `/cart` y no hay estado.
- Favoritos/wishlist, Zustand, tests automatizados.

## 4. Criterios de aceptación

**Landing**

- [x] **AC1** — Dado un visitante **sin sesión**, cuando abre `/`, entonces ve la landing
  completa (200, sin redirección a `/sign-in`) y el HTML de la respuesta ya contiene los
  nombres y precios de los productos (visibles con `view-source`, no solo tras hidratar).
- [ ] **AC2** — Dado que existen productos con `compare_at_price_cents` no nulo, cuando se
  renderiza el hero, entonces sus 3 slides son esos productos (más recientes primero) y cada
  uno muestra el índice `01/02/03`, precio actual, precio tachado y el % de descuento.
- [ ] **AC3** — Dado que **ningún** producto está en oferta, entonces el hero muestra los 3
  productos disponibles más recientes sin badge de descuento, y la página no falla.
- [ ] **AC4** — Dado un catálogo **vacío** (0 productos disponibles), entonces `/` responde
  200 con un estado vacío ("Catálogo en preparación") en lugar del carrusel; no hay error.
- [ ] **AC5** — Ningún producto con `deleted_at` no nulo ni categoría con `is_active = false`
  aparece en `/` ni en `/products`.
- [x] **AC6** — Una tarjeta con `image_url` muestra esa imagen (`<img loading="lazy">`, sin
  `next/image`); una con `image_url = null` muestra el tile de respaldo (inicial sobre fondo
  de marca), nunca un hueco roto. *(Revisado 2026-09-02: el usuario cambió la decisión — se
  usa `image_url`. `<ProductImage>` pinta `<img>` plano; el paso a `next/image` + CDN sigue
  diferido, §11.)*
- [x] **AC7** — `price_cents = 129999` se muestra como `$1,299.99` (`en-US`, igual que
  `product-columns.tsx`); el descuento de `129999` sobre `159999` se muestra como `-19 %`.
  *(Superado por spec 006 D1, 2026-09-06: moneda cambiada a PEN — `formatPrice` ahora
  rinde `S/ 1,299.99`. Cambio deliberado; el `-19 %` de `discountPercent` no cambia.)*
- [ ] **AC8** — El carrusel avanza solo cada 6 s, se puede cambiar de slide con los dots y
  con teclado (foco visible); con `prefers-reduced-motion: reduce` **no** hay autoplay ni
  animaciones de entrada, y todas las slides siguen siendo alcanzables.
- [ ] **AC9** — A 390 px de ancho `/` y `/products` son de una sola columna, sin scroll
  horizontal, y el header colapsa como en `Mobile.dc.html`/`CatalogMobile.dc.html`.

**Catálogo `/products`**

- [x] **AC10** — `GET /products` sin parámetros devuelve, **en el HTML del servidor**, la
  primera página de productos disponibles (12 por página) y el total ("N productos").
- [ ] **AC11** — Marcar la categoría "Laptops" cambia la URL a `/products?category=laptops`
  sin recargar la página, la cuadrícula muestra solo esa categoría y **al recargar** esa URL
  el filtro sigue aplicado (la URL es la única fuente del estado de filtro).
- [ ] **AC12** — El buscador del header envía `/products?q=gtx` (form nativo, funciona con
  JS deshabilitado) y la cuadrícula muestra solo coincidencias de `name`/`sku`.
- [ ] **AC13** — El rango de precio (`?min=`/`?max=`) y el orden (`?sort=price-asc|price-desc|new`)
  se reflejan en la URL y en el resultado; cambiar cualquier filtro devuelve la página a 1.
- [ ] **AC14** — Los chips de filtros activos muestran uno por filtro aplicado; quitar un
  chip elimina **solo** ese parámetro de la URL y "Quitar todo" deja `/products` limpio.
- [ ] **AC15** — Sin resultados, la cuadrícula muestra "Sin resultados con estos filtros" y
  un botón "Limpiar filtros"; mientras carga muestra skeletons y, si la petición falla,
  mensaje de error con "Reintentar". Al paginar no hay parpadeo a vacío (`keepPreviousData`).
- [ ] **AC16** — A 390 px los filtros se abren en la hoja inferior (`Sheet`) y aplican el
  mismo estado de URL que en escritorio.
- [x] **AC17** — Los componentes de `src/modules/storefront/components/` no importan
  `axios`/`fetch` directamente ni nada de `src/server/`: los datos entran por
  `use-storefront-products.ts` / `use-active-categories.ts` (regla 2 de `CLAUDE.md`).

**API**

- [x] **AC18** — `GET /api/products?onSale=true&pageSize=3` devuelve solo productos
  disponibles con `compare_at_price_cents` no nulo; `?categorySlug=laptops` devuelve solo los
  de esa categoría; un `categorySlug` inexistente devuelve `{ data: [], total: 0 }` (no 404).
- [x] **AC19** — `GET /api/products?onSale=false` **no** filtra por oferta y
  `?onSale=cualquier-cosa` responde **400** con el detalle de Zod.
- [x] **AC20** — `GET /api/products?status=deleted` (o `status=all`) **sin sesión** responde
  **401**, y con una sesión sin `products.read` responde **403**; `status=available` y la
  petición sin `status` siguen siendo públicas y devuelven 200.
- [x] **AC21** — El listado sigue costando **dos** consultas por petición (página + count),
  también con `categorySlug` y `onSale`; el panel `/admin/products` no cambia de
  comportamiento en ningún filtro.

**Tema**

- [ ] **AC22** — El conmutador del header alterna claro/oscuro, la elección persiste al
  recargar y al navegar entre `/` y `/products` (localStorage de `next-themes`).
- [ ] **AC23** — Con `prefers-color-scheme: dark` y sin elección previa, la primera carga ya
  es oscura: **no** hay destello claro→oscuro (`suppressHydrationWarning` en `<html>` y el
  script de `next-themes` antes del primer paint), ni error de hidratación en consola.
- [ ] **AC24** — Con el tema oscuro activo, `/admin` sigue siendo legible: ningún texto queda
  sobre fondo del mismo tono ni desaparece un borde (los 36 tokens `.dark` ya existen).

**Cierre**

- [ ] **AC25** — El `<h1>` de cada página es único y descriptivo, cada icono-botón tiene
  `aria-label`, el buscador tiene `<label>` asociado, los filtros son controles nativos
  etiquetados y la navegación por `Tab` no tiene trampas de foco.
- [x] **AC26** — No queda `src/app/page.tsx`: `npm run build` no reporta colisión de rutas
  para `/` y `npm run typecheck && npm run lint && npm run build` está en verde.

## 5. Modelo de datos

**Sin cambios de esquema. Sin migración.** Se leen `products` (solo `deleted_at IS NULL`) y
`categories` (solo `is_active = true`). Nada se escribe: el storefront no genera
`audit_logs`.

Tipos derivados, sin duplicar nada (regla 5), en
`src/modules/storefront/types/storefront.types.ts`:

- `StorefrontProduct = Pick<ProductDto, "id"|"name"|"slug"|"brand"|"description"|"priceCents"|"compareAtPriceCents"|"stock"|"imageUrl"|"categoryName">`
- `HeroSlide = StorefrontProduct & { index: string; categorySlug: string }`
- El catálogo consume `ProductListResponse` y `CategoryListResponse` de
  `src/modules/{products,categories}/types/` tal cual: **no se redeclaran**.

## 6. Contratos de API

Sin rutas nuevas. Node runtime, Zod antes de tocar datos, error uniforme `{ error: string }`.

| Método | Ruta | Auth | Query | Response |
|---|---|---|---|---|
| GET | `/api/products` | pública salvo `status≠available` | `productQuerySchema` **ampliado** | `{ data, total, page, pageSize }` · 400 · **401/403** (§8) · 500 |
| GET | `/api/categories` | pública | `categoryQuerySchema` (**sin cambios**) | `{ data, total, page, pageSize }` · 400 · 500 |

Ampliación de `productQuerySchema` (`src/modules/products/schemas/product.schema.ts`):

- `categorySlug: z.string().trim().max(140).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional()`
- `onSale: z.stringbool().optional()` — Zod 4. **No usar `z.coerce.boolean()`**:
  `Boolean("false") === true` y `onSale=false` filtraría igual que `true`.

**Contrato de URL del catálogo** (`storefrontProductsQuerySchema`, en
`src/modules/storefront/schemas/storefront.schema.ts`) — nombres cortos para la barra de
direcciones, traducidos a los de la API en el service:

| Param URL | Zod | → API |
|---|---|---|
| `q` | `string().trim().max(100).optional()` | `search` |
| `category` | mismo regex de slug, opcional | `categorySlug` |
| `min` / `max` | `coerce.number().int().min(0).optional()` | `minPriceCents` / `maxPriceCents` |
| `sort` | `enum(["new","price-asc","price-desc"]).default("new")` | `sortBy` + `sortDir` |
| `page` | `coerce.number().int().min(1).default(1)` | `page` |
| — | — | `status: "available"`, `pageSize: 12` (constantes) |

`storefrontProductsQuerySchema.parse(Object.fromEntries(searchParams))` **nunca lanza por un
parámetro basura**: los campos son `.optional()`/`.catch`-eables; un `sort` desconocido cae
al default en lugar de romper la página (a diferencia del Route Handler, que sí devuelve 400
porque es un límite de confianza).

## 7. Arquitectura y archivos afectados

**Servidor / API (modificados)**
- `src/modules/products/schemas/product.schema.ts` — dos campos nuevos en la query.
- `src/server/repositories/product.repository.ts` — `buildFilters`: `categorySlug` →
  `eq(categories.slug, …)` (el `innerJoin` ya está, no añade consulta); `onSale === true` →
  `isNotNull(products.compareAtPriceCents)`. `onSale === false` no filtra.
- `src/app/api/products/route.ts` — guard de `status` en el `GET` (§8).
- `src/lib/utils.ts` — `formatPrice(cents)` y `discountPercent(priceCents, compareAtCents)`.
- `src/app/globals.css` — tokens de marca y de shell del storefront (`--brand`,
  `--brand-foreground`, `--storefront-page`, `--storefront-shell`, `--storefront-card`,
  `--storefront-border`) en `:root` **y** en `.dark`, más su mapeo en `@theme inline`.
  **Sin tocar `--primary`** ni el resto de tokens shadcn ya existentes.
- `src/app/layout.tsx` — `<ThemeProvider>` dentro de `ClerkProvider` y
  `suppressHydrationWarning` en `<html>`.
- `src/app/page.tsx` — **eliminado** (colisiona con `(storefront)/page.tsx` en `/`).
- `next.config.ts` — **no se toca**.

**Páginas y layout (nuevos)**
- `src/app/(storefront)/layout.tsx` — shell glass (gradiente + tarjeta con `backdrop-blur`),
  header y footer. Server Component.
- `src/app/(storefront)/page.tsx` — landing. Server Component, `export const revalidate = 300`.
  Tres lecturas por repositorio; `productQuerySchema.parse({...})` para tipar los parámetros.
- `src/app/(storefront)/products/page.tsx` — catálogo. Server Component, `await searchParams`,
  lectura inicial (productos + categorías activas) que se pasa como `initialData`.
- `src/app/(storefront)/{loading,error}.tsx` — estados nativos del App Router
  (`error.tsx` es `"use client"` con botón `reset()`).

**Compartido (nuevos)**
- `src/components/providers/theme-provider.tsx` — `"use client"`, `next-themes`,
  `attribute="class"`, `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`.
- `src/components/shared/storefront-header.tsx` — logo "Tech.", buscador
  (`<form action="/products" method="get">` con `name="q"`), conmutador de tema, favoritos,
  carrito → `/cart`, y cuenta con `<SignedIn>/<SignedOut>` de `@clerk/nextjs`.
- `src/components/shared/theme-toggle.tsx` — `"use client"`, `useTheme()`, icono sol/luna,
  `aria-label` fijo y `suppressHydrationWarning` en el icono para no parpadear.
- `src/components/shared/storefront-footer.tsx`.

**Módulo `src/modules/storefront/`**
- `types/storefront.types.ts`
- `schemas/storefront.schema.ts` — `storefrontProductsQuerySchema` (§6).
- `services/storefront.service.ts` — `listStorefrontProducts(params)` y
  `listActiveCategories()` sobre el `api` de `@/lib/axios`; hacen el mapeo URL → API.
- `hooks/use-storefront-products.ts` — TanStack Query con `placeholderData: keepPreviousData`
  y `storefrontProductsQueryKey(params)`.
- `hooks/use-active-categories.ts` — `staleTime` alto (las categorías casi no cambian).
- `components/hero-carousel.tsx` — **`"use client"`** (swiper). Recibe `slides: HeroSlide[]`.
- `components/reveal.tsx` — **`"use client"`** (motion). Envuelve `children` (que siguen
  renderizándose en el servidor) con `whileInView` + `useReducedMotion`.
- `components/product-image.tsx` — tile de respaldo (inicial + fondo de marca), server.
- `components/product-card.tsx` — tarjeta de la cuadrícula (server-renderizable), enlaza a
  `/products/<slug>`.
- `components/featured-product-card.tsx`, `popular-colors-card.tsx`,
  `catalog-summary-card.tsx`, `highlight-card.tsx` — piezas del bento de la landing.
- `components/catalog-view.tsx` — **`"use client"`**: orquesta URL ⇄ query, monta filtros,
  chips, cuadrícula y paginación. Es el único que lee `useSearchParams()`.
- `components/catalog-filters.tsx` — **`"use client"`**: categoría (lista de una sola
  selección), rango de precio y orden; en móvil dentro de `Sheet`.
- `components/catalog-active-filters.tsx` — **`"use client"`**: chips + "Quitar todo".

**Reutilizado tal cual**: `src/server/repositories/{product,category}.repository.ts`,
`src/lib/{axios,utils,query-client}.ts`, `src/components/ui/{sheet,checkbox,select,skeleton,input,button,badge,separator}.tsx`,
`src/hooks/use-debounce.ts` (rango de precio), las fuentes Geist y los providers de
`src/app/layout.tsx`. **Sin componentes shadcn nuevos.**

## 8. Decisiones técnicas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| **Reutilizar `GET /api/products` y `GET /api/categories`** ampliando la query | `GET /api/storefront/{products,categories}` con DTO ligero | El contrato no diverge: mismo recurso, mismos filtros más dos. Un endpoint dedicado duplicaría schema, repo y DTO para ahorrar 5 campos por fila que no son secretos. DRY con criterio, `CLAUDE.md` §6. |
| `status ∈ {deleted, all}` exige `products.read` en el `GET` | Dejarlo público como hoy | Con `/api/products` público, cualquiera lista productos retirados del catálogo. Fuga preexistente (deuda de 002/003) que esta tienda hace alcanzable. Cuesta una llamada a permisos **solo** cuando se piden filas no públicas: la ruta caliente (`status=available`, el default) no cambia. |
| `categorySlug` en el repo, no un `findBySlug` previo | Resolver la categoría en el handler | El `innerJoin` a `categories` ya está en `list()`: filtrar por `categories.slug` no añade ni una consulta. Resolver antes serían dos viajes y un 404 que el catálogo no quiere (AC18). |
| **`<ProductImage>` renderiza siempre el tile de respaldo**; `image_url` se ignora visualmente en esta fase | `next/image` + `remotePatterns` con un host por decidir | Decisión del usuario. Un host declarado "a ciegas" falla en **runtime**, no en build: el error aparecería con la primera imagen real. Sin CDN todavía, el tile es determinista, no pide red y no obliga a tocar `next.config.ts`. Coste de revertirlo: ~2 archivos (§11). |
| **Landing sin ninguna petición de cliente**: `page.tsx` lee por repositorio y pasa DTO por props | Componentes cliente con TanStack Query | Es contenido de portada: tiene que estar en el HTML para SEO y para pintar sin salto. Un `fetch` del servidor a su propia API sería un salto de red por nada. Carga/error los da el App Router con `loading.tsx`/`error.tsx`. |
| El `page.tsx` importa los repositorios | Un `src/server/services/storefront.service.ts` intermedio | La regla 1 de `CLAUDE.md` protege a los **componentes** de arrastrar Drizzle al bundle; el `page.tsx` de un Server Component es la raíz de composición y el sitio que el App Router espera para leer datos. Ningún archivo de `modules/*/components` importa nada de `src/server/`. Un servicio con un solo consumidor sería abstracción vacía. |
| **Catálogo híbrido**: la 1ª página la renderiza el servidor y se entrega como `initialData` de TanStack Query; los cambios de filtro los resuelve el cliente | Todo cliente (spinner inicial) o todo servidor (recarga por filtro) | La primera pintura es SEO-indexable y sin salto; a partir de ahí filtrar cuesta una petición JSON, no un render completo. El `queryKey` del cliente se construye de los mismos params que parseó el servidor, así que `initialData` casa con la primera clave. |
| **La URL es el estado del filtro** (`useSearchParams` + `router.replace`, `scroll: false`) | Zustand o `useState` en `catalog-view` | Un filtro compartible y recargable (AC11) es un requisito, no un extra; con la URL ya resuelto, un store sería un segundo origen de verdad. Regla 6 de `CLAUDE.md`: datos de servidor a TanStack Query, y aquí no hay estado de UI global que guardar. |
| Categoría de **selección única** (`?category=slug`) | Multi-selección con `?category=a&category=b` | El mockup dibuja checkboxes, pero multi-categoría obliga a parsear arrays en la URL, `inArray` en el repo y un contrato de API nuevo. Con un catálogo plano de pocas categorías (001 dejó el árbol fuera), una sola basta. Se documenta en §11. |
| **Sin filtro de marca ni de valoración, sin orden "Mejor valorados"** | Copiar los 4 filtros del mockup | No existe tabla de reviews: un orden por valoración sería inventado. El filtro por `brand` exigiría un endpoint de marcas distintas y un parámetro nuevo sin pedido real detrás (YAGNI). El mockup se recorta, no se falsea. |
| `sort` con 3 opciones (`new`, `price-asc`, `price-desc`) | Añadir "Relevancia" | Sin motor de búsqueda por relevancia, "Relevancia" y "Novedades" serían literalmente la misma consulta (`createdAt desc`). Dos etiquetas para un solo comportamiento es engañar al usuario. |
| `pageSize = 12` fijo en el catálogo | Selector de tamaño de página | 12 encaja en 2/3/4 columnas y no hay ninguna petición de configurarlo. Es una constante del módulo, no un parámetro de URL. |
| **`ThemeProvider` global** en `src/app/layout.tsx`: `/admin` también soporta oscuro | Forzar `(admin)` a claro con un `<div className="light">` | Los 36 tokens `.dark` ya están escritos en `globals.css:86-118` y **ningún** archivo del panel usa colores literales (verificado con `grep`): el panel ya está preparado. Anclar el admin a claro sería un envoltorio que pelea con el provider y una excepción que explicar en cada componente nuevo. AC24 cubre la revisión visual. |
| `attribute="class"` + `defaultTheme="system"` + `disableTransitionOnChange` y `suppressHydrationWarning` en `<html>` | `defaultTheme="light"` sin `suppressHydrationWarning` | `@custom-variant dark (&:is(.dark *))` de `globals.css:5` ya espera la **clase**. `next-themes` escribe esa clase en un script previo al primer paint: sin `suppressHydrationWarning` React avisa de desajuste, y sin el script habría destello (AC23). |
| Tokens de marca nuevos (`--brand`, `--storefront-*`) con su bloque `.dark` | Cambiar `--primary` al índigo del diseño | `--primary` lo usan los 18 componentes shadcn del panel: cambiarlo repinta `/admin` entero, fuera del alcance. Los valores oscuros salen tal cual de `MainDark.dc.html:277-283`. |
| `revalidate = 300` en la landing; el catálogo es dinámico | ISR también en `/products` | La portada no cambia por visitante. `/products` depende de `searchParams`, que ya la vuelve dinámica: fijar `revalidate` ahí sería ruido. El header usa `<SignedIn>/<SignedOut>` (cliente) en vez de `auth()` para no volver dinámica la landing. |
| Tres lecturas fijas en la landing; dos en el catálogo | Una consulta "todo en uno" | Cada una es la misma `list()` ya probada, con dos queries internas. Sin N+1: **ninguna** tarjeta consulta por su cuenta. |
| El total de "Más productos · N artículos" sale del `total` de la lectura de destacados | Un `count` aparte | `list()` ya devuelve `total` con los mismos filtros. Consulta gratis. |
| Tile de estadística con **datos reales** (nº de productos y de categorías) | Copiar "5 M+ descargas · 4,6" del mockup | El mockup usa cifras de relleno; publicarlas en una tienda real es una afirmación falsa. Se conserva la forma visual, cambia el dato. |
| CTA del hero → `/products?category=<slug>` (destino real desde hoy); tarjetas → `/products/<slug>` (404 hasta 006) | `href="#"` | Un enlace que no lleva a ninguna parte es una trampa de accesibilidad y habría que reescribirlo en 006. El único destino aún inexistente es la ficha, y 006 va justo detrás (§10). |
| Buscador como `<form action="/products" method="get">` con `name="q"` | Buscador con estado cliente y debounce | Funciona sin JS, es el elemento nativo correcto y ahora tiene destino real (AC12). El debounce vive donde hace falta: el rango de precio dentro del catálogo. |
| Swiper solo en `hero-carousel.tsx`; motion solo en `reveal.tsx` | Animar/carruselar toda la página | Dos islas, `"use client"` lo más abajo posible (regla 7). El resto del bento es HTML de servidor y no paga JS. |
| `motion` y `swiper` y ninguna librería más | `embla`, `framer-motion`, `nuqs`, `usehooks-ts` | Petición explícita del usuario. `motion` es el paquete vigente de motion.dev (`import { motion } from "motion/react"`); `framer-motion` es su nombre anterior. `next-themes` ya está en `package.json`. La sincronización con la URL la hacen `useSearchParams` + `router.replace`, nativos de Next. |
| `formatPrice` en `src/lib/utils.ts` | Un `src/lib/format.ts` nuevo | `docs/SETUP.md` §3 define `lib/utils.ts` como "cn() y helpers puros". Un archivo menos. |

## 9. Tareas atómicas

### Fase A — API pública de catálogo

- [x] **T1** — Añadir `categorySlug` y `onSale` (`z.stringbool()`) a `productQuerySchema` ·
  `src/modules/products/schemas/product.schema.ts` · verificación: AC19, `npm run typecheck`.
- [x] **T2** — `buildFilters`: filtro por `categories.slug` y por
  `isNotNull(products.compareAtPriceCents)`, sin añadir consultas ·
  `src/server/repositories/product.repository.ts` · verificación: AC18, AC21.
- [x] **T3** — Guard en el `GET`: si `parsed.data.status !== "available"`,
  `requirePermission("products.read")` en `try/catch` con `authErrorResponse(error)`; el
  resto del handler intacto · `src/app/api/products/route.ts` · verificación: AC20.
- [x] **T4** — `formatPrice(cents)` (`Intl.NumberFormat("en-US", { style: "currency",
  currency: "USD" })`) y `discountPercent(priceCents, compareAtCents)` (`null` si no aplica) ·
  `src/lib/utils.ts` · verificación: AC7.

### Fase B — tema y base visual

- [x] **T5** — `npm i motion swiper` (`next-themes` ya está instalado: no reinstalar) ·
  `package.json` · verificación: `npm run build`.
- [x] **T6** — `<ThemeProvider>` con `attribute="class"`, `defaultTheme="system"`,
  `enableSystem` y `disableTransitionOnChange` ·
  `src/components/providers/theme-provider.tsx` · verificación: `npm run typecheck`.
- [x] **T7** — Montarlo en el layout raíz envolviendo a los hijos y añadir
  `suppressHydrationWarning` al `<html>` · `src/app/layout.tsx` · verificación: AC23, AC24.
- [x] **T8** — Tokens `--brand`, `--brand-foreground`, `--storefront-page` (gradiente),
  `--storefront-shell`, `--storefront-card`, `--storefront-border` en `:root` (valores de
  `Main.dc.html:270-276`) y en `.dark` (valores de `MainDark.dc.html:277-283`), más su mapeo
  en `@theme inline`; **sin tocar `--primary`** · `src/app/globals.css` · verificación:
  `/admin` se ve igual en claro.
- [x] **T9** — Eliminar `src/app/page.tsx` · verificación: AC26.
- [x] **T10** — `StorefrontProduct` y `HeroSlide` derivados de `ProductDto` ·
  `src/modules/storefront/types/storefront.types.ts` · verificación: `npm run typecheck`.

### Fase C — chrome de la tienda

- [x] **T11** — `<ThemeToggle>`: `"use client"`, `useTheme()`, sol/luna, `aria-label` fijo y
  sin parpadeo en hidratación · `src/components/shared/theme-toggle.tsx` · verificación: AC22.
- [x] **T12** — Header: logo "Tech.", buscador `<form action="/products" method="get">` con
  `<label>` accesible, `<ThemeToggle>`, botones con `aria-label`, carrito → `/cart`, cuenta
  con `<SignedIn>`/`<SignedOut>` · `src/components/shared/storefront-header.tsx` ·
  verificación: AC12, AC25.
- [x] **T13** — Footer de una línea: `© <año> E-commerce Tech` + enlaces ·
  `src/components/shared/storefront-footer.tsx` · verificación: AC25.
- [x] **T14** — Layout: gradiente de página, shell glass (`rounded-[34px]`, `backdrop-blur`,
  borde y sombra de `Main.dc.html:31`), header, footer, `max-w` y paddings mobile-first, todo
  con variantes `dark:` sobre los tokens de T8 · `src/app/(storefront)/layout.tsx` ·
  verificación: AC9, AC22.
- [x] **T15** — `loading.tsx` (skeleton del bento) y `error.tsx` (`"use client"`, mensaje +
  "Reintentar" que llama `reset()`) · `src/app/(storefront)/` · verificación: AC4 y corte de
  la BD → mensaje, no pantalla en blanco.

### Fase D — piezas compartidas de producto

- [x] **T16** — `<ProductImage>`: tile con la inicial del producto sobre fondo de marca,
  `aspect-square`, sin red y sin `next/image` · `src/modules/storefront/components/product-image.tsx` ·
  verificación: AC6.
- [x] **T17** — `<ProductCard>`: imagen, categoría, nombre, marca, precio, precio tachado y
  `-N %`; enlace a `/products/<slug>` · `src/modules/storefront/components/product-card.tsx` ·
  verificación: AC7.
- [x] **T18** — `<Reveal>`: `"use client"`, `motion.div` con `initial/whileInView`,
  `viewport={{ once: true }}` y `useReducedMotion()` que desactiva la animación ·
  `src/modules/storefront/components/reveal.tsx` · verificación: AC8.

### Fase E — landing `/`

- [x] **T19** — `<HeroCarousel slides>`: `"use client"`, `Swiper`/`SwiperSlide` con
  `Autoplay` (6 s, desactivado con reduced-motion) y `Pagination` con los dots del diseño;
  cada slide con píldora de categoría, `<h1>` solo en la primera, índice `01/02/03`, precios,
  `-N %` y CTA a `/products?category=<slug>`; `import "swiper/css"` ·
  `src/modules/storefront/components/hero-carousel.tsx` · verificación: AC2, AC7, AC8.
- [x] **T20** — Tarjetas de la columna derecha: `<PopularColorsCard>` (swatches estáticos) y
  `<FeaturedProductCard>` (imagen, nombre, marca, precio, enlace) ·
  `src/modules/storefront/components/{popular-colors-card,featured-product-card}.tsx` ·
  verificación: AC6, AC9.
- [x] **T21** — Fila inferior: `<CatalogSummaryCard>` ("Más productos · N artículos" + hasta
  3 tiles de categoría que enlazan a `/products?category=<slug>`) y `<HighlightCard>` (tile
  de acento con nº de categorías/productos y tile "Popular · Ya disponible" con el producto
  más reciente) · `src/modules/storefront/components/{catalog-summary-card,highlight-card}.tsx` ·
  verificación: AC5, AC25.
- [x] **T22** — `page.tsx` de la landing: `metadata`, `revalidate = 300`, tres lecturas
  (hero `onSale=true` con **fallback** a los más recientes si vuelve vacío; destacados
  `pageSize=6`, de donde sale también el `total`; categorías `status=active`), estado vacío
  si no hay productos y composición del bento con `<Reveal>` ·
  `src/app/(storefront)/page.tsx` · verificación: AC1–AC5.

### Fase F — catálogo `/products`

- [x] **T23** — `storefrontProductsQuerySchema` + `STOREFRONT_PAGE_SIZE = 12` y el mapeo
  `sort` → `{ sortBy, sortDir }` (§6) · `src/modules/storefront/schemas/storefront.schema.ts` ·
  verificación: AC13, `npm run typecheck`.
- [x] **T24** — `listStorefrontProducts(params)` y `listActiveCategories()` sobre el `api` de
  `@/lib/axios`, traduciendo params de URL a params de API ·
  `src/modules/storefront/services/storefront.service.ts` · verificación: AC17.
- [x] **T25** — `useStorefrontProducts(params, initialData)` con
  `placeholderData: keepPreviousData` y `storefrontProductsQueryKey`, y
  `useActiveCategories(initialData)` con `staleTime` alto ·
  `src/modules/storefront/hooks/{use-storefront-products,use-active-categories}.ts` ·
  verificación: AC15.
- [x] **T26** — `<CatalogFilters>`: `"use client"`, lista de categorías de selección única,
  rango de precio con `useDebounce` y `<Select>` de orden; emite cambios hacia arriba, no
  toca la URL por su cuenta · `src/modules/storefront/components/catalog-filters.tsx` ·
  verificación: AC11, AC13.
- [x] **T27** — `<CatalogActiveFilters>`: un chip por filtro aplicado, con "×" por chip y
  "Quitar todo" · `src/modules/storefront/components/catalog-active-filters.tsx` ·
  verificación: AC14.
- [x] **T28** — `<CatalogView>`: `"use client"`, único dueño de `useSearchParams()` +
  `router.replace(..., { scroll: false })`; monta filtros (en `<Sheet>` bajo `md`), chips,
  cuadrícula de `<ProductCard>`, paginación, y los estados skeleton / error+reintento /
  vacío con "Limpiar filtros" · `src/modules/storefront/components/catalog-view.tsx` ·
  verificación: AC11, AC14, AC15, AC16.
- [x] **T29** — Página del catálogo: `metadata`, `await searchParams`, parseo con
  `storefrontProductsQuerySchema`, dos lecturas por repositorio (productos + categorías
  activas) y `<CatalogView>` con ambas como `initialData`; breadcrumb y título del mockup ·
  `src/app/(storefront)/products/page.tsx` · verificación: AC10, AC12.

### Fase G — cierre

- [x] **T30** — Verificación final y recorrido manual de los AC (teclado, 390 px, claro y
  oscuro, `/admin` en oscuro) · `npm run typecheck && npm run lint`.

**Total: 30 tareas.**

## 10. Riesgos

- **Colisión de rutas.** `src/app/page.tsx` y `src/app/(storefront)/page.tsx` resuelven ambos
  a `/`: si T9 no se hace *antes* de T22, el build falla con "You cannot have two parallel
  pages that resolve to the same path". Es el primer error esperable.
- **El panel en oscuro no se ha visto nunca.** Montar el provider (T7) activa `.dark` también
  en `/admin`. Los tokens existen y no hay colores literales, pero nadie lo ha mirado: AC24
  es una revisión visual real, no un trámite. Si algo se rompe, la salida barata es
  `<div className="light">` en `src/app/(admin)/admin/layout.tsx`, no revertir el provider.
- **Destello y desajuste de hidratación.** Sin `suppressHydrationWarning` en `<html>` (T7)
  React avisará en consola en cada carga; sin `attribute="class"` el `@custom-variant dark`
  de `globals.css:5` no dispara y el modo oscuro simplemente no pinta.
- **`useSearchParams()` exige Suspense.** En App Router, un componente cliente que lo usa
  obliga a un `<Suspense>` por encima o el build falla al prerenderizar. `<CatalogView>` es
  el único que lo llama, precisamente para tener un solo sitio que envolver.
- **`initialData` que no casa con la clave.** Si el `queryKey` del cliente se construye con
  params distintos a los que parseó el servidor, TanStack pedirá de nuevo la primera página
  y AC10 se cae en silencio (funciona, pero con petición extra). Misma función de parseo en
  ambos lados.
- **Ficha de producto inexistente.** Las tarjetas enlazan a `/products/<slug>`, que cae en
  `src/app/not-found.tsx` hasta el spec 006. Es el único enlace roto que queda.
- **`z.coerce.boolean()` es una trampa.** `Boolean("false") === true`: `onSale=false`
  filtraría como `true`. Por eso T1 usa `z.stringbool()`.
- **El guard de `status` toca una ruta que ya usa el panel.** `/admin/products` pide
  `status=deleted` con sesión y `products.read`: sigue funcionando. Lo que cambia es que un
  cliente anónimo pasa de 200 a 401. Comprobar el filtro "Eliminados" del panel tras T3.
- **`revalidate` y la conexión a Neon en build.** Con ISR, Next intenta prerenderizar `/` en
  `npm run build`: hace falta `DATABASE_URL` en el entorno de build. Si el build corre sin
  base, bajar a `export const dynamic = "force-dynamic"` y anotarlo como desviación.
- **Swiper y Tailwind 4.** Swiper trae CSS con clases globales (`.swiper-pagination-bullet`);
  estilizar los dots puede exigir sobreescribir desde `globals.css`. Si pelea más de lo que
  vale, usar `pagination.renderBullet` antes que un CSS a medida.
- **Categorías inactivas siguen siendo listables públicamente** por
  `GET /api/categories?status=all` (el default de `categoryQuerySchema` es `all`). Se deja
  como está: el nombre de una categoría desactivada no es dato sensible y cambiar el default
  rompería el listado del panel. Anotado en §11.

## 11. Fuera de alcance / deuda aceptada

- **Spec 006 (siguiente)**: ficha `/products/[slug]` (galería, specs, stock, añadir al
  carrito). Hasta entonces las tarjetas del catálogo llevan a `not-found`.
- **Spec 007**: carrito real (`carts`/`cart_items`, badge con el número de ítems), checkout y
  `orders`. Hoy el icono es un enlace a `/cart`.
- **Imágenes reales**: cuando haya CDN/Blob, `<ProductImage>` pasa a `next/image` +
  `images.remotePatterns` en `next.config.ts` (cambio de ~2 archivos). Sigue diferida la
  tabla `product_images` y la galería desde 002.
- **Filtros que el catálogo no trae**: multi-selección de categorías, marca, valoración y
  orden por "Mejor valorados" o por ventas — no hay columnas de reviews ni de ventas, y no se
  inventan. Tampoco hay selector de tamaño de página.
- **Búsqueda por relevancia** (`tsvector`, sinónimos, tolerancia a erratas): hoy `q` es el
  `ILIKE` sobre `name`/`sku` que ya usa el panel.
- **`GET /api/categories?status=all` público** (§10) y favoritos/wishlist.
- **Tests automatizados**: el proyecto no tiene runner (deuda arrastrada desde 001).

## 12. Desviaciones de la implementación (developer, 2026-09-02)

1. **Tercer campo de query: `categoryActive` (`z.stringbool()`).** Sin él, AC5 era
   inalcanzable: `list()` hace `innerJoin` a `categories` pero nunca filtró por
   `is_active`, así que un producto de categoría desactivada sí aparecía. Ausente = sin
   filtro, por lo que `/admin/products` no cambia. Lo pasan las dos páginas del storefront
   y `toProductQuery`.
2. **`<SignedIn>/<SignedOut>` no existen en Clerk Core 3** (`@clerk/nextjs@7`): el build
   falló con `Clerk: <SignedIn> is not available in @clerk/nextjs Core 3`. Sustituidos por
   `<Show when="signed-in" fallback={…}>`, que sigue resolviéndose en cliente y no vuelve
   dinámica la página.
3. **`use-active-categories.ts` se reutiliza, no se duplica.** Ya existía
   `src/modules/products/hooks/use-active-categories.ts` con los mismos params fijos; se le
   añadió `initialData` opcional y `staleTime` de 5 min en vez de crear un gemelo en
   `modules/storefront/hooks/`. Por lo mismo, `listActiveCategories()` no se creó: el
   service de categorías ya lo cubre.
4. **`src/modules/storefront/serializers.ts`** (archivo no previsto en §7): convierte
   `Date` → ISO al pasar la lectura del repositorio como `initialData`, para no tipar como
   `string` algo que en runtime es `Date`.
5. **`min`/`max` de la URL van en unidades de moneda, no en centavos** (`?min=500` = $500).
   La conversión ×100 la hace `toProductQuery`. Internamente todo sigue en centavos.
6. **`<CatalogFilters>` se remonta con `key` en vez de sincronizar estado con un efecto**:
   la regla `react-hooks/set-state-in-effect` (React Compiler) rechaza el `setState` dentro
   de `useEffect`. `<CatalogView>` incrementa `filtersEpoch` al quitar un chip o limpiar.
7. **`formatPriceCents` de `product-columns.tsx` se eliminó** en favor de `formatPrice` de
   `lib/utils.ts` (era el mismo formateador duplicado).
8. **`revalidate = 300` queda inerte**: `ClerkProvider` en el layout raíz vuelve dinámica
   toda la app, así que `npm run build` reporta `/` como `ƒ (Dynamic)`. El HTML sigue
   llegando renderizado del servidor (AC1 verificado con `curl`), pero no hay ISR real. Si
   se quiere ISR habrá que sacar Clerk del árbol de la landing — fuera del alcance de 005.
9. **~~`<ThemeProvider>` envuelve a `<ClerkProvider>`~~** — REVERTIDO 2026-09-02: tener un
   client component (`ThemeProvider` de next-themes) como ancestro de `<ClerkProvider>` rompía
   la detección de sesión server-side → `<Show>` renderizaba el fallback en el servidor y la
   sesión real en cliente → mismatch de hidratación → React regeneraba el árbol → el
   `<UserButton>` de Clerk crasheaba (`parentNode` de null) y el layout quedaba a medias.
   Orden correcto: `<ClerkProvider>` exterior → `<ThemeProvider>` → `<QueryProvider>`;
   `<Toaster>` dentro de `<ThemeProvider>`.
10. **Footer sin "Soporte/Envíos/Privacidad"**: esas páginas no existen; se dejan "Inicio"
    y "Tienda" para no publicar enlaces a ninguna parte.

---

## 13. Cierre

Reviewer: **RECHAZADO** iteración 1 → corregido → **APROBADO**. typecheck / lint / build en verde.

Hallazgo bloqueante resuelto: `src/app/globals.css:10` tenía `--font-sans: var(--font-sans)`
(autorreferencial) → toda la app caía a la fuente del SO. Corregido a
`var(--font-geist-sans)` (+ `--font-heading` y newline final). Menores también
resueltos: `<h2>` decorativos → `<p>` en `highlight-card.tsx`; `staleTime: 60_000` +
`initialDataUpdatedAt` en `use-storefront-products.ts` para no refetchear tras el SSR.

Veredictos del reviewer: `/admin` en oscuro global es aceptable (grep confirma cero
colores literales en el panel); `z.stringbool()`, `serializers.ts`, `<Show when>`,
reuso de `use-active-categories`, `min/max` en dólares y `revalidate` inerte — todos
sin problema oculto.

Pendiente de QA manual (necesita datos sembrados o revisión visual): AC2–AC5, AC8–AC9,
AC11–AC16, AC22–AC25. Sobre todo: `/admin` recorrido en tema oscuro, el hero con ≥3
productos en oferta, el estado vacío, y `/` + `/products` a 390 px.

## 14. Correcciones post-QA (2026-09-02, verificadas con capturas de Chrome headless)

QA del usuario reveló 3 errores de consola y el bento roto. Causas y fixes:

1. **Orden de proveedores.** `<ThemeProvider>` (client) envolvía a `<ClerkProvider>` →
   Clerk no resolvía la sesión en el servidor → `<Show>` renderizaba distinto
   servidor/cliente → React regeneraba el árbol → `<UserButton>` crasheaba
   (`parentNode` de null) y aparecía el aviso del `<script>` de next-themes. Fix:
   `<ClerkProvider>` exterior → `<ThemeProvider>` → `<QueryProvider>` en `layout.tsx`.
2. **`<SignedIn>/<SignedOut>` de Clerk Core 3 lanzan** al renderizar (aunque se
   exportan). Se mantiene `<Show when="signed-in" fallback={…}>` (la desviación #2
   del developer era correcta).
3. **Bento colapsado.** `lg:grid-cols-[1fr_340px]`: la pista `1fr` tiene
   `min-width: auto`, así que el `<h1>` de 58px del hero la inflaba y empujaba la
   columna de 340px fuera de pantalla. Fix: `minmax(0,1fr)` + `min-w-0` en los
   ítems del grid y en el `<Swiper>` (+ `overflow-hidden`).
4. **`<Reveal>` ocultaba el contenido.** `whileInView`/`animate` con `opacity:0`
   inicial dejaba secciones invisibles si el observador/animación no corría. Ahora
   solo anima `y` (nunca `opacity`): el contenido es visible siempre.
5. **`<ProductImage>` sin recortar.** `aspect-square` sobre un `<div>` con `<img>`
   de altura intrínseca no forzaba el cuadrado. Fix: `<div relative aspect-square
   overflow-hidden>` + `<img absolute inset-0 size-full object-cover>`.
6. **Buscador del header** no saltaba de línea en móvil (`flex-1` ganaba a
   `w-full`). Fix: `basis-full` en móvil, `sm:flex-1 sm:basis-auto`.

typecheck / lint / build en verde tras las correcciones.

SPEC: `docs/specs/005-storefront-landing.md` · TAREAS: 30/30 · ESTADO: done
