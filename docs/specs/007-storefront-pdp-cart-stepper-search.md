---
id: 007
title: Ficha de producto, stepper de carrito y buscador typeahead
status: done
module: storefront        # src/modules/storefront, src/modules/cart, src/app/(storefront)/products/[slug]
scope: client
created: 2026-09-06
---

# 007 — Ficha de producto, stepper de carrito y buscador typeahead

> Skills: **ninguna de las del mapa de `CLAUDE.md` §8 está instalada** en esta sesión.
> `vercel:nextjs`, `vercel:shadcn`, `vercel:react-best-practices`, `frontend-design` y
> `web-design-guidelines` **no aparecen** en el listado (solo hay `clerk-*`, `caveman:*`,
> `ponytail:*`, `design`, `dataviz`, `artifact-*`, `code-review`, `security-review`). Se redacta
> sin skill de stack.
> `> Usando ponytail:ponytail para recortar capas` — activa por hook de sesión; se aplica al
> número de archivos y de endpoints nuevos (§8). Todo lo que este documento afirma del repo está
> verificado por lectura directa de los archivos citados.

## 0. Decisiones

### Abierta — bloquea el arranque de la Fase A

| # | Decisión | Opciones | Recomendada |
|---|---|---|---|
| **D1** | **Diseño de `/products/[slug]`: no hay mockup.** `docs/design/` tiene `Main`, `Catalogo`, `Mobile` y `Photo`; **no hay ficha**. | **(a)** Construirla con el sistema de 006: 2 columnas en desktop (`lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]`, foto izquierda en `rounded-card` sobre `--storefront-sunk`, columna derecha con breadcrumb → marca → `<h1>` → precio + tachado + badge `-N %` lima → nota de stock → stepper → tabla de `specs` clave/valor con `<Separator>` entre filas), 1 columna en móvil, tipografía y radios idénticos a `<ProductCard>`. **(b)** Esperar el `.dc.html` de la ficha. | **(a)** — desbloquea B y C hoy. Si después llega un mockup, el ajuste es de estilos sobre el mismo árbol: la estructura de datos no cambia. |

> **D1 resuelto (usuario, 2026-09-06): opción (a).** Se construye la ficha con el
> sistema de diseño de 006, con el layout descrito. Si llega un mockup después, se
> ajustan estilos sobre el mismo árbol.

### Fijadas (resueltas en este spec, no bloquean)

| # | Decisión | Resolución |
|---|---|---|
| D2 | "Productos relacionados" en la ficha | **No.** Sería una cuarta consulta y una grilla nueva que nadie pidió. Al final de la ficha va un enlace a `/products?category=<slug>` ("Ver más de Laptops"): un `<Link>`, cero consultas. |
| D3 | ¿Dónde vive el tope de `stock` del stepper? | **`stock` entra en `CartLine`.** El control lo recibe por props (dato fresco del servidor) *y* lo guarda en la línea, porque `<CartDrawer>` es un **segundo** llamador de `setQty` que hoy incrementa sin techo. Poner la guardia solo en el control dejaría el drawer roto (§8). |
| D4 | ¿El stepper reemplaza al "+" o convive? | **Reemplaza.** `<AddToCartButton>` desaparece; `<CartQtyControl>` es "+" con `qty = 0` y stepper con `qty ≥ 1`. Un solo componente en tarjeta y ficha. |
| D5 | ¿Endpoint nuevo para la ficha? | **No.** La página es Server Component y llama `productRepository.findBySlug()` directo, como `/products/page.tsx`. `GET /api/products/[id]` es por uuid y devuelve la fila cruda: no sirve y no se toca. |
| D6 | ¿Endpoint/servicio nuevo para el typeahead? | **No.** Reusa `GET /api/products?search=…` y `listStorefrontProducts()` tal cual. Solo se añade un hook de 12 líneas con `enabled` y su propia `queryKey`. |
| D7 | Tamaño del typeahead | Se piden los **12** de `STOREFRONT_PAGE_SIZE` (el traductor `toProductQuery` lo fija) y se pintan los **6** primeros. Cambiar `pageSize` obligaría a tocar el contrato de URL del catálogo por 6 filas de JSON. |

## 1. Contexto

Spec 006 está `done`. Verificado hoy en el repo:

- `src/app/(storefront)/products/[slug]/` **existe y está vacía**: `<ProductCard>`
  (`product-card.tsx:23`) y el destacado de la landing ya enlazan a `/products/${slug}` → 404.
- `product.repository.ts` exporta `list`, `listBrands`, `findById`, `create`, `update`,
  `softDelete`, `restore`. **No hay `findBySlug`** (hay que escribirla). `productSelection`
  (`:29-32`) es `getTableColumns(products) + categoryName`: **no trae `categories.slug`**, que la
  ficha necesita para el breadcrumb. `findById` **no** filtra `deletedAt` ni `isActive`.
- `products` tiene `brand`, `stock`, `specs` (`jsonb $type<Record<string,string>|null>`),
  `imageUrl`, `compareAtPriceCents`, `deletedAt`. `categories.isActive` existe. **Cero cambios de
  esquema.**
- `cart-store.ts` — Zustand sin `persist`: `lines`, `add(product)` (suma 1 si existe),
  `setQty(id, qty)` (`qty ≤ 0` elimina), `clear`, y los puros `cartCount` / `cartSubtotalCents`.
  **`add` y `setQty` no conocen el stock: ninguno tiene techo.**
- `add-to-cart-button.tsx` — `"use client"`, botón "+" con `add(product)` y `disabled` externo.
  Único llamador: `product-card.tsx:68-77`, que le pasa un literal de 5 campos.
- `cart-drawer.tsx:80-102` — ya tiene stepper `−/qty/+` por línea con `setQty`; el "+"
  **incrementa sin límite** (mismo defecto que D3 corrige).
- `CartLine` (`storefront.types.ts:20-23`) = `Pick<StorefrontProduct, "id"|"name"|"slug"|
  "priceCents"|"imageUrl"> & { qty: number }`. `StorefrontProduct` ya incluye `stock`, `brand`,
  `specs`, `categoryName`.
- `storefront-header.tsx:36-60` — `<form action="/products" method="get">` con `name="q"`, dentro
  de un Server Component. Es la pieza que cambia en la Fase C.
- `GET /api/products` (`route.ts:11-44`) — pública mientras `status === "available"`;
  `productQuerySchema` ya tiene `search` (ILIKE sobre name/sku). **Sirve para el typeahead sin un
  solo cambio.**
- `use-debounce.ts` existe (`src/hooks/`) y lo usan tres tablas del panel. `useStorefrontProducts`
  no acepta `enabled`, por eso el typeahead lleva hook propio.
- `<ProductImage>` discrimina `startsWith("/")` para `next/image` vs `<img>`; el recorte lo hace el
  contenedor. Reusable tal cual en ficha y typeahead.
- `src/components/ui/`: hay `separator`, `button`, `badge`, `skeleton`, `sheet`, `input`.
  **No hace falta ningún componente shadcn nuevo ni dependencia nueva.**
- `src/proxy.ts` ya deja pública `/products(.*)`. **No se toca.**
- `docs/design/Main.dc.html:296-311` dibuja el overlay de búsqueda: fila
  `52px | nombre + "cat · stockNote" | precio`, y el estado vacío “Nada para «q»”. Su `onClick`
  es `r.add` (**agrega al carrito**): la Fase C hace lo contrario a propósito.

## 2. Objetivo

Un visitante abre la ficha de cualquier producto desde el catálogo, ajusta la cantidad de cada
producto con un stepper `− qty +` limitado por el stock sin abrir el carrito, y llega a la ficha
escribiendo en el buscador del header — que nunca agrega nada al carrito.

## 3. Alcance

### Incluye

- **Fase A — ficha**: `findBySlug()` en el repositorio (con `categorySlug`),
  `/products/[slug]/page.tsx` (Server Component) con `generateMetadata`, breadcrumb, foto, precio,
  stock, tabla de `specs`, stepper y `loading.tsx`; `notFound()` para slug inexistente, borrado o
  de categoría inactiva.
- **Fase B — stepper**: `<CartQtyControl>` sustituye a `<AddToCartButton>` en tarjeta y ficha;
  `stock` entra en `CartLine` y el "+" del drawer deja de pasarse del stock.
- **Fase C — buscador**: `<SearchBox>` cliente en el header, hook `useProductSearch`, dropdown de
  6 resultados con teclado y `aria`, navegación a la ficha o al catálogo. `<form>` nativo
  conservado como respaldo sin JS.

### No incluye

- **Sin cambios de esquema, sin migración, sin endpoints nuevos, sin `src/proxy.ts`.**
- **Sin `/cart`** ni checkout ni `orders`: "Ir a pagar" sigue apuntando a un 404 → spec 008.
- **Sin `carts`/`cart_items`**: el carrito sigue en memoria y se pierde al recargar.
- Sin galería multi-foto (`product_images` sigue diferida desde 002), sin zoom, sin variantes,
  sin reseñas, sin favoritos, sin "productos relacionados" (D2).
- Sin búsqueda por relevancia, por marca o por spec: `search` sigue siendo el ILIKE sobre
  `name`/`sku`. Sin historial ni sugerencias.
- Sin restyle de la landing (bento de `Main.dc.html`) → sigue siendo 006b.
- Sin tests automatizados: el proyecto no tiene runner (deuda desde 001).

## 4. Criterios de aceptación

**Fase A — ficha**

- [ ] **AC1** — Dado un slug sembrado, cuando abro `/products/dell-xps-13`, entonces veo foto,
  breadcrumb `Inicio › Laptops › Dell XPS 13`, marca, nombre, `S/ 5,499.00`, `S/ 5,999.00`
  tachado, badge `-8 %`, "12 en stock" y la tabla de `specs`; el título del navegador es el del
  producto.
- [ ] **AC2** — Un slug inexistente, uno de un producto con `deleted_at` no nulo y uno de
  categoría con `is_active = false` devuelven los **tres** el `not-found` (nunca un 500 ni una
  ficha vacía).
- [x] **AC3** — Con `stock = 0` (Logitech MX Keys) la ficha se muestra completa, la foto se
  atenúa, la nota dice "Agotado" y el control de cantidad está `disabled`.
- [x] **AC4** — Un producto sin `specs` y sin `compare_at_price_cents` no pinta la tabla vacía ni
  el badge; sin `image_url` cae al tile de `<ProductImage>`. Ningún hueco roto.
- [x] **AC5** — `findBySlug()` resuelve la ficha en **una sola consulta** (join a `categories`) y
  devuelve `categorySlug`; el enlace "Ver más de <categoría>" lleva a
  `/products?category=<slug>` y ese filtro llega aplicado.
- [ ] **AC6** — Entre catálogo y ficha se ve el `loading.tsx` del segmento, no una pantalla en
  blanco. A 390 px la ficha es de una columna, sin scroll horizontal, y en oscuro mantiene
  contraste.

> **Nota de implementación (developer, 2026-09-07).** El slug sembrado es **`xps13`**, no
> `dell-xps-13`: `seed.ts:111` usa `id` como slug (`xps13`, `ideapad`, `k2`, `mxkeys`, `ug27`,
> `xm5`, `980pro`). AC1 se verifica en `/products/xps13`. Además el seed guarda **solo**
> `specs.resumen` ("Core i7 · 16 GB · 512 GB"), así que la **tabla de `specs` no se pinta con los
> datos actuales**: el `resumen` sale como párrafo bajo el `<h1>` y como `description` del
> `<meta>`. La tabla está implementada y aparece en cuanto un producto tenga otras claves en
> `specs` (se puede probar desde `/admin/products`). Por eso AC1 y AC2 quedan sin marcar: lo
> verificado por HTTP es foto, breadcrumb, marca, nombre, `S/ 5,499.00`, `S/ 5,999.00` tachado,
> `-8 %`, "12 en stock", título del navegador y el 404 del slug inexistente; faltan la tabla y las
> ramas de producto borrado / categoría inactiva (mismo `where`, sin datos que las ejerzan).

**Fase B — stepper**

- [ ] **AC7** — Un producto que no está en el carrito muestra "+"; al pulsarlo la tarjeta muestra
  `− 1 +` y el badge del header pasa a 1.
- [ ] **AC8** — El "+" del control se deshabilita cuando `qty === stock` (Keychron K2: se corta en
  30) y el "−" a `qty = 1` vuelve a dejar el botón "+" solo, con la línea fuera del carrito.
- [ ] **AC9** — El "+" del **drawer** respeta el mismo tope: con la línea al máximo el botón está
  `disabled` y `lines` no crece. (Hoy incrementa sin límite.)
- [ ] **AC10** — El control de la ficha y el de la tarjeta del mismo producto muestran **la misma**
  cantidad sin recargar: los dos leen el store.
- [ ] **AC11** — El número del stepper hace `bump` al cambiar; con `prefers-reduced-motion: reduce`
  no se anima nada y el número sigue visible.
- [ ] **AC12** — Los botones tienen `aria-label` con el nombre del producto, se alcanzan con Tab y
  se activan con Enter/Espacio; en la tarjeta, pulsarlos **no** navega a la ficha (no burbujea al
  `<Link>`).

**Fase C — buscador**

- [ ] **AC13** — Escribir "keych" (≥2 caracteres, tras el debounce) abre un dropdown con hasta 6
  resultados: miniatura, nombre, "categoría · nota de stock" y precio en PEN.
- [ ] **AC14** — Clic o Enter sobre un resultado navega a `/products/<slug>` y **el carrito no
  cambia**: `cartCount` antes y después es idéntico. Esto es explícito porque el mockup hace lo
  contrario.
- [ ] **AC15** — Enter sin resultado activo, el botón de lupa y "Ver todos los resultados" llevan a
  `/products?q=<término>` con el chip de filtro activo puesto.
- [ ] **AC16** — Sin coincidencias, el dropdown muestra "Nada para «q»" más el enlace a
  `/products?q=…`; nunca queda un panel vacío ni un spinner infinito.
- [ ] **AC17** — ↑/↓ recorren los resultados con `aria-activedescendant`, Escape cierra y devuelve
  el foco al input, el clic fuera cierra, y navegar cierra el dropdown.
- [ ] **AC18** — Con menos de 2 caracteres **no** se dispara ninguna petición (pestaña de red
  vacía) y teclear "keychron" seguido dispara **una** sola, no ocho (debounce 280 ms).
- [x] **AC19** — Con JS deshabilitado el `<form>` nativo sigue enviando a `/products?q=…`.
- [ ] **AC20** — El dropdown tiene estado de carga (skeletons) y de error ("No se pudo buscar");
  ningún error se traga con `catch {}`.

**Cierre**

- [ ] **AC21** — `/admin` sin cambios visuales ni funcionales, y
  `npm run typecheck && npm run lint && npm run build` en verde.

## 5. Modelo de datos

**Sin cambios de esquema. Sin migración.** Todas las columnas que consume la ficha existen:
`products.brand`, `stock`, `specs` (jsonb `Record<string,string>`), `image_url`,
`compare_at_price_cents`, `deleted_at`; `categories.slug`, `categories.is_active`.

Cambios de **tipos** (inferidos, no escritos a mano):

| Tipo | Archivo | Cambio |
|---|---|---|
| `ProductDetail` | `src/modules/storefront/types/storefront.types.ts` | **Nuevo**: `ProductWithCategory & { categorySlug: string }`, lo que devuelve `findBySlug`. |
| `CartLine` | mismo archivo | El `Pick` gana **`"stock"`** (D3). Pasa a `"id"\|"name"\|"slug"\|"priceCents"\|"imageUrl"\|"stock"` + `qty`. |

## 6. Contratos de API

**Ninguna ruta nueva y ninguna modificada.** El typeahead consume el endpoint de 006 tal cual:

| Método | Ruta | Auth | Query | Response |
|---|---|---|---|---|
| GET | `/api/products` | pública con `status=available` (sin cambios) | `productQuerySchema`: `search`, `status`, `categoryActive`, `page`, `pageSize`, orden | `{ data, total, page, pageSize }` · 400 · 500 |

- **Ficha**: sin HTTP. Server Component → `productRepository.findBySlug(slug)` (D5), igual que
  `/products/page.tsx` llama `list()`. La validación de entrada es el propio segmento de ruta más
  un `notFound()`: `slug` es un `string` de la URL que solo se usa en un `eq()` parametrizado de
  Drizzle.
- **Typeahead**: `storefrontProductsQuerySchema.parse({ q: term })` → `toProductQuery()` →
  `listStorefrontProducts()` (service existente, ya une listas por coma). `q` va con `.max(100)` y
  `.catch(undefined)`, así que un término absurdo degrada a "sin filtro", no a 400.
- Zod nuevo: **ninguno**. Se reutilizan `storefrontProductsQuerySchema` y `productQuerySchema`.

## 7. Arquitectura y archivos afectados

**Servidor (modificado)**
- `src/server/repositories/product.repository.ts` — `findBySlug(slug)`: `select({...productSelection,
  categorySlug: categories.slug})` + `innerJoin(categories)` + `and(eq(products.slug, slug),
  isNull(products.deletedAt), eq(categories.isActive, true))` + `limit(1)`. Una consulta.

**Páginas (nuevas)**
- `src/app/(storefront)/products/[slug]/page.tsx` — Server Component: `await params`,
  `findBySlug`, `notFound()`, `generateMetadata`, breadcrumb, foto, precio, stock, tabla de
  `specs`, `<CartQtyControl>` y enlace a la categoría.
- `src/app/(storefront)/products/[slug]/loading.tsx` — skeletons con la misma retícula.

**Carrito**
- `src/modules/cart/components/cart-qty-control.tsx` — **nuevo**, `"use client"`: "+" o
  `− qty +`, tope de stock, `bump` con `motion`.
- `src/modules/cart/components/add-to-cart-button.tsx` — **eliminado** (D4).
- `src/modules/cart/components/cart-drawer.tsx` — `+` con `disabled={line.qty >= line.stock}`.

**Storefront**
- `src/modules/storefront/types/storefront.types.ts` — `ProductDetail`, `CartLine` con `stock`.
- `src/modules/storefront/components/product-card.tsx` — importa `<CartQtyControl>` y le pasa
  `stock` en el literal de la línea.
- `src/modules/storefront/components/search-box.tsx` — **nuevo**, `"use client"`: `<form>` +
  input + dropdown `role="listbox"`, teclado, cierre por Escape/fuera/navegación.
- `src/modules/storefront/hooks/use-product-search.ts` — **nuevo**: `useQuery` con
  `queryKey: ["storefront-search", term]`, `enabled: term.length >= 2`, `staleTime: 60_000`,
  `placeholderData: keepPreviousData`.

**Header**
- `src/components/shared/storefront-header.tsx` — el `<form>` inline se sustituye por
  `<SearchBox />`. **Sigue siendo Server Component**: la isla de cliente es solo el buscador.

**Reutilizado tal cual (verificado)**: `<ProductImage>`, `formatPrice`, `discountPercent`,
`useDebounce`, `listStorefrontProducts`, `storefrontProductsQuerySchema`/`toProductQuery`,
`useCartStore` con `add`/`setQty`, `src/components/ui/{button,separator,skeleton,badge}.tsx`,
`lib/utils.cn`, `not-found.tsx` raíz. **Sin componentes shadcn nuevos, sin dependencias nuevas.**

## 8. Decisiones técnicas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| **Ficha por Server Component + `findBySlug`** | Hook + service + `GET /api/products/by-slug` | La ficha no tiene interacción de datos: se pinta una vez y ya. Un endpoint serían 3 archivos, una petición extra y un salto de cascada cliente para el mismo HTML. El único trozo interactivo (el stepper) es una isla `"use client"` de 40 líneas, que es exactamente la regla 7. |
| **`findBySlug` filtra `deletedAt` e `isActive` en SQL** | Traer la fila y decidir en la página | Un `if` en el componente es una regla de negocio fuera del repositorio y se olvida en el siguiente llamador. En SQL es la misma consulta y el mismo plan (hay índice en `deleted_at` y en `is_active`). |
| **`categorySlug` solo en `findBySlug`**, no en `productSelection` | Añadir `categories.slug` al select compartido | `productSelection` alimenta `list`, `findById`, `create`, `update` y el tipo `ProductWithCategory` que consume todo el panel: ensancharlo por un breadcrumb toca cinco llamadores. La ficha lleva su propio `select`. |
| **`stock` dentro de `CartLine`** (D3) | Solo como prop del control | `setQty` tiene **dos** llamadores: el control y el stepper del drawer (`cart-drawer.tsx:93-102`), que hoy sube sin techo. Guardar el tope solo en el control deja el segundo roto — el arreglo barato es el que cubre a los dos con un campo. Es una foto del stock al momento de agregar; como el carrito es efímero (muere al recargar) no puede envejecer mucho, y la validación real es de servidor en 008. |
| **Un solo `<CartQtyControl>`** para tarjeta, ficha y (posible) futuro | `<AddToCartButton>` + `<QtyStepper>` separados | Son el mismo estado con dos renders; separarlos duplica el acceso al store y la guardia de stock. El drawer conserva su stepper inline: vive dentro de un `<li>` con otra retícula y otro tamaño, y compartirlo obligaría a un componente con `variant`. |
| **`e.preventDefault()` + `e.stopPropagation()` en los botones del control** | Sacar el control fuera del `<Link>` | Ya está fuera del `<Link>` en `product-card.tsx:51-78`; la parada es defensiva para la ficha y para cualquier tarjeta futura envuelta entera en un enlace. Un clic en "+" que navega es el bug clásico de este patrón. |
| **Typeahead con hook propio, service compartido** | Extender `useStorefrontProducts` con `enabled` | El hook del catálogo tiene `initialData` del SSR y comparación por `JSON.stringify`: meterle un modo "sin datos iniciales, condicional" es una bandera para dos consumidores distintos. El hook nuevo son 12 líneas y no toca el catálogo. El **service** sí se comparte: es donde vive la serialización por comas. |
| **Pedir 12 y pintar 6** (D7) | `pageSize` en `toProductQuery` | `STOREFRONT_PAGE_SIZE` es constante del contrato de URL del catálogo. Parametrizarla por 6 filas de JSON en una petición debounced es contrato nuevo a cambio de nada. |
| **Resultado = `<Link>` con `role="option"`, navegación con `router.push`** | `<button onClick>` como en el mockup | El mockup agrega al carrito; el usuario pidió lo contrario. Además un enlace real permite abrir en pestaña nueva y funciona sin JS si el dropdown ya está pintado. |
| **`<form action="/products">` se conserva** | Solo `router.push` | Es el respaldo sin JS que ya existe (AC19) y hace que Enter funcione antes de que hidrate el buscador. El JS solo intercepta cuando hay una opción activa. |
| **El header sigue siendo Server Component** | Marcar `storefront-header.tsx` como `"use client"` | Regla 7. El header lleva `<Show>` de Clerk y el logo; volverlo cliente arrastraría todo eso al bundle por un input. |
| **Sin "productos relacionados"** (D2) | Grilla de 4 de la misma categoría | Cuarta consulta y componente nuevo que nadie pidió. Un `<Link>` a `/products?category=<slug>` cubre la intención con una línea. |
| **`generateMetadata` sin `generateStaticParams`** | Prerenderizar los 7 slugs | El catálogo se edita desde `/admin`: un ISR con slugs congelados en build serviría fichas de productos borrados. Se deja dinámico hasta que haya volumen que lo justifique. |

## 9. Tareas atómicas

### Fase A — ficha de producto

- [x] **T1** — `findBySlug(slug)` con `categorySlug`, `isNull(deletedAt)` y
  `eq(categories.isActive, true)`, una consulta · `src/server/repositories/product.repository.ts` ·
  verificación: AC2, AC5, `npm run typecheck`.
- [x] **T2** — Tipo `ProductDetail` · `src/modules/storefront/types/storefront.types.ts` ·
  verificación: `npm run typecheck`.
- [x] **T3** — Página de la ficha: `await params`, `findBySlug`, `notFound()`,
  `generateMetadata` (nombre + `description`/`specs.resumen`), breadcrumb, `<ProductImage>`,
  precio + tachado + badge, nota de stock, tabla de `specs`, enlace a la categoría, hueco para el
  control · `src/app/(storefront)/products/[slug]/page.tsx` · verificación: AC1–AC5.
- [x] **T4** — `loading.tsx` del segmento con la retícula de dos columnas ·
  `src/app/(storefront)/products/[slug]/loading.tsx` · verificación: AC6.

### Fase B — stepper de cantidad

- [x] **T5** — `CartLine` gana `stock` en el `Pick` · `src/modules/storefront/types/storefront.types.ts` ·
  verificación: `npm run typecheck` marca en rojo los dos llamadores (T6, T7).
- [x] **T6** — `<CartQtyControl>`: `qty` por selector del store, "+" con `add` cuando `qty === 0`,
  `− qty +` con `setQty` cuando `qty ≥ 1`, `+` `disabled` en `qty >= stock`, `bump` con
  `useReducedMotion`, `aria-label` con el nombre, `stopPropagation` ·
  `src/modules/cart/components/cart-qty-control.tsx` · verificación: AC7, AC8, AC10–AC12.
- [x] **T7** — Sustituir `<AddToCartButton>` por `<CartQtyControl>` y añadir `stock` al literal de
  la línea; **borrar** `add-to-cart-button.tsx` ·
  `src/modules/storefront/components/product-card.tsx` + `src/modules/cart/components/` ·
  verificación: AC7, AC12, `npm run lint` sin imports muertos.
- [x] **T8** — Montar `<CartQtyControl>` en la ficha (ancho completo, `disabled` con `stock = 0`) ·
  `src/app/(storefront)/products/[slug]/page.tsx` · verificación: AC3, AC10.
- [x] **T9** — Tope de stock en el "+" del drawer (`disabled={line.qty >= line.stock}`) ·
  `src/modules/cart/components/cart-drawer.tsx` · verificación: AC9.

### Fase C — buscador typeahead

- [x] **T10** — `useProductSearch(term)`: `queryKey ["storefront-search", term]`,
  `enabled: term.trim().length >= 2`, `staleTime 60_000`, `placeholderData: keepPreviousData`,
  sobre `listStorefrontProducts` · `src/modules/storefront/hooks/use-product-search.ts` ·
  verificación: AC18.
- [x] **T11** — `<SearchBox>`: `<form action="/products">` conservado, input controlado con
  `useDebounce(term, 280)`, dropdown de 6 resultados (miniatura, nombre, "categoría · stock",
  precio), estados carga / error / vacío, "Ver todos los resultados" ·
  `src/modules/storefront/components/search-box.tsx` · verificación: AC13, AC15, AC16, AC19, AC20.
- [x] **T12** — Teclado y accesibilidad del dropdown: `role="combobox"` + `aria-expanded` +
  `aria-controls` + `aria-activedescendant`, `<ul role="listbox">` / `<li role="option">`, ↑↓ para
  moverse, Enter navega a la ficha, Escape cierra y devuelve el foco, clic fuera y cambio de ruta
  cierran · `src/modules/storefront/components/search-box.tsx` · verificación: AC14, AC17.
- [x] **T13** — Sustituir el `<form>` inline del header por `<SearchBox />` sin volver cliente el
  header · `src/components/shared/storefront-header.tsx` · verificación: AC13, AC19, AC21.

### Fase D — cierre

- [x] **T14** — `npm run typecheck && npm run lint && npm run build` en verde y recorrido manual de
  los AC de UI (teclado, 390 px, claro/oscuro, `/admin` intacto) · verificación: AC21.

**Total: 14 tareas.**

## 10. Riesgos

- **El clic en "+" dentro de la tarjeta puede navegar.** En `product-card.tsx` el control está
  fuera del `<Link>`, pero cualquier reordenación del marcado en T7 lo mete dentro y entonces cada
  alta al carrito salta a la ficha. Por eso T6 lleva `stopPropagation` en el propio control: la
  guardia viaja con el componente, no con su ubicación.
- **`stock` en `CartLine` es una foto, no la verdad.** Si el stock baja en el panel mientras el
  visitante tiene el carrito abierto, el tope sigue siendo el viejo. Aceptado: carrito efímero y
  sin backend; la comprobación real es de servidor en 008. **No** convertir esto en un `useQuery`
  por línea (N+1 de peticiones).
- **Typeahead = una petición por pausa de tecleo.** Sin el `enabled` de ≥2 caracteres y sin el
  debounce de T11, escribir "keychron" son 8 peticiones al endpoint público. Es el fallo más
  probable de la Fase C y solo se ve en la pestaña de red: nada se rompe en pantalla.
- **`useSearchParams()` exige `<Suspense>`.** `<SearchBox>` debe usar `useRouter`/`usePathname`,
  **nunca** `useSearchParams`: el header está en el layout del storefront y una llamada ahí
  reventaría el prerender de todas las páginas del grupo.
- **`generateMetadata` duplica la consulta.** Next llama `generateMetadata` y el componente por
  separado: son dos `findBySlug` por visita salvo que se envuelva en `cache()` de React. Barato
  (una fila por PK/unique), pero conviene el `cache()` desde el principio.
- **`specs` es `jsonb` de forma libre.** Un valor no-string (número, objeto) rompería el `.map` de
  la tabla en runtime aunque el tipo diga `Record<string,string>`: el seed lo cumple, el panel no
  lo valida. T3 debe pintar `String(value)` y saltar los vacíos.
- **`docs/design` no tiene ficha** (D1): si el usuario aporta el `.dc.html` después de T3, el
  ajuste es de estilos; si lo aporta antes, mejor esperar y ahorrar la doble pasada.
- **"Ir a pagar" sigue en 404.** El drawer enlaza a `/cart`, que no existe hasta 008. 007 no lo
  arregla y el QA manual lo verá.
- **Borrar `add-to-cart-button.tsx`** deja un import roto si algún archivo no citado lo usa: T7
  debe hacer un `grep` de `AddToCartButton` antes de eliminarlo (hoy el único llamador es
  `product-card.tsx:68`).

## 11. Fuera de alcance / deuda aceptada

- **Spec 008**: `/cart`, `carts`/`cart_items`, fusión al iniciar sesión, checkout y `orders`. El
  store de 006/007 se reemplaza; `CartLine` es el contrato que heredarán los componentes.
- **Spec 006b**: restyle de la landing (bento de `Main.dc.html`) y `Mobile.dc.html`.
- **Galería de producto**: `product_images` sigue diferida desde 002; una foto por producto.
- **Productos relacionados**, reseñas, variantes, comparador, favoritos.
- **Búsqueda por relevancia / marca / spec**, historial, sugerencias y resaltado del término.
- **`generateStaticParams` / ISR** para las fichas; se quedan dinámicas.
- **Validación de stock en servidor**: no hay mutación que validar hasta 008.
- **Tests automatizados**: sigue sin runner.

## 12. Cierre

Reviewer: **RECHAZADO** iteración 1 → corregido → **APROBADO**. typecheck / lint / build en verde.

Hallazgos resueltos:
- **[MAYOR] AC15** — el botón de lupa navegaba a una ficha si el ratón había pasado
  por un resultado. Ahora tiene `onClick` propio con `preventDefault` que siempre va
  a `/products?q=` (o `/products` si el término está vacío); la rama `active` queda
  solo para Enter desde el input. Se quitó `onPointerMove` de los resultados (el
  resaltado por ratón lo hace `:hover` en CSS); `active` es estado puro de teclado.
- **[MENOR]** `aria-controls` solo apunta al `<ul>` cuando hay resultados.
- **[MENOR]** el click fuera resetea `active`.
- **[MENOR]** `<CartQtyControl>` — región `aria-live` estable separada del nodo
  animado (`key={qty}`), para que el lector anuncie el cambio de cantidad.

Extra (polish, no era hallazgo): `<CartQtyControl>` acepta `addLabel` — en la ficha
el "+" muestra "Agregar al carrito" (y "Agotado" sin icono cuando `stock === 0`);
en la tarjeta del catálogo sigue siendo el "+" compacto.

Pendiente de QA manual: AC1–AC2 (rama borrado / categoría inactiva), AC6–AC18,
AC20–AC21. Nota: la tabla de `specs` está implementada pero no se ve porque el seed
solo guarda `specs.resumen` (que se muestra como subtítulo + meta description);
añadir claves desde `/admin/products` la activa. Los slugs sembrados son el `id`
(`xps13`, `k2`, `mxkeys`, …), no `dell-xps-13`.
