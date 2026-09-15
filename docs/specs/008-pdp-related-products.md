---
id: 008
title: Productos parecidos en la ficha + arreglos de tarjeta y ficha
status: done
module: storefront        # src/app/(storefront)/products/[slug], src/modules/cart
scope: client
created: 2026-09-07
---

# 008 — Productos parecidos en la ficha + arreglos de tarjeta y ficha

> Skills: ninguna del mapa de `CLAUDE.md` §8 aplicable está instalada en esta sesión
> (`vercel:nextjs`, `vercel:shadcn`, `frontend-design` no aparecen). Se redacta sin skill de stack.
> `ponytail` activa por hook: se aplica al número de archivos y consultas nuevas (D1, D2).

## 1. Contexto

Spec 007 §0 **D2 decidió NO poner productos relacionados**: al final de la ficha quedó solo un
`<Link href="/products?category=<slug>">` ("Ver más de {categoryName}", `page.tsx:168-174`).
**Este spec revierte D2** por petición explícita del usuario (2026-09-07): quiere ver los
productos parecidos en la propia ficha, no un enlace al catálogo.

Verificado en el repo hoy:

- `src/app/(storefront)/products/[slug]/page.tsx` es Server Component; `getProduct = cache(productRepository.findBySlug)`;
  `product` trae `id`, `categorySlug`, `categoryName`. El `grid lg:grid-cols-[...]` va de la línea 83 a la 176,
  dentro de un `<div className="flex flex-col gap-4 …">` raíz.
- `productRepository.list(params: ProductQueryInput)` → `{ data, total, page, pageSize }` en 2 queries
  (página + count). Filtra `categorySlug` (lista por coma), `status`, `categoryActive`, orden y paginación.
  **No admite excluir un id.**
- `list().data` ya tiene la forma `StorefrontProduct` que consume `<ProductCard>`: el catálogo y la landing
  lo usan así (`(storefront)/page.tsx:104-108`).
- Grilla de tarjetas ya usada en landing y catálogo: `grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3`.
- Los params se construyen con `productQuerySchema.parse({...})`, como `onSaleParams`/`featuredParams`
  de la landing.

**Dos bugs de QA (2026-09-07), specs 006/007, se corrigen en este spec:**
- **B1 — el stepper `− qty +` de `<CartQtyControl>` se desborda de la tarjeta del catálogo.**
  La causa: el `<span>` del número lleva `flex-1` dentro de una píldora sin ancho fijo, así
  que crece y estira la píldora más allá del hueco de la tarjeta.
- **B2 — en la ficha, "Agregar al carrito" y "Ver más de {categoría}" quedan en la misma
  línea, pegados**, cuando el producto no tiene `specs` (caso actual: el seed solo trae
  `specs.resumen`). La causa: el `<Link>` "Ver más" es `inline-flex`, no salta de línea.

## 2. Objetivo

Un visitante de `/products/[slug]` ve, al final de la página, hasta 3 productos disponibles de la
misma categoría distintos del que está viendo, y puede entrar a cualquiera desde ahí. El stepper
de la tarjeta se queda dentro de su hueco y el CTA de la ficha no se pega al enlace de categoría.

## 3. Alcance

Incluye:
- Una consulta extra en la ficha: productos de `product.categorySlug`, publicables, excluyendo el actual.
- Una sección nueva al final de la ficha con grilla de `<ProductCard>`.
- Si no hay parecidos, la sección no se renderiza.
- **B1**: en `src/modules/cart/components/cart-qty-control.tsx`, el `<span>` del número pasa de
  `flex-1 min-w-6` a ancho fijo (`w-8 shrink-0`), y el `<div>` píldora no crece.
- **B2**: en `page.tsx`, el `<Link>` "Ver más de {categoría}" pasa de `inline-flex` a `flex w-fit`
  (bloque, salta de línea) y su separación del CTA sube a `mt-8`.

No incluye:
- Cambios de esquema, endpoints, servicios, hooks, dependencias.
- Cambios en `product.repository.ts`, catálogo, landing o admin.
- Rediseñar el stepper o el CTA — solo que no se desborden / no se peguen.

## 4. Criterios de aceptación

- [ ] AC1 — Dado un producto cuya categoría tiene ≥ 4 productos publicables, cuando abro su ficha,
      entonces al final veo la sección "Productos parecidos" con exactamente 3 tarjetas.
      **No verificable con el seed actual**: ninguna categoría pasa de 2 productos. Queda para QA
      manual tras dar de alta ≥ 4 productos en una categoría desde el panel.
- [x] AC2 — Dado cualquier producto, cuando se pinta la sección, entonces el producto actual **no** aparece en ella.
      Verificado: `/products/xps13` lista solo `ideapad`; `/products/mxkeys` solo `k2`.
- [x] AC3 — Dado un producto que es el único publicable de su categoría, cuando abro su ficha,
      entonces no se pinta la sección (ni título ni estado vacío).
      Verificado: `ug27`, `xm5` y `980pro` no pintan la sección.
- [x] AC4 — Dado un producto de la sección, cuando hago clic en su tarjeta, entonces navego a su ficha.
      Verificado el `href="/products/<slug>"` renderizado; la tarjeta es `<ProductCard>` sin tocar.
- [x] AC5 — La sección solo lista productos con `status: available` y de categoría activa
      (no borrados, no de categoría inactiva), ordenados por `createdAt desc`.
      Garantizado por los defaults de `productQuerySchema` + `buildFilters`. El seed no tiene filas
      borradas ni categorías inactivas, así que la exclusión no se pudo comprobar con datos.
- [x] AC6 — La ficha sigue haciendo **una sola** consulta de parecidos (sin N+1) y el enlace
      "Ver más de {categoryName}" (línea 168) sigue existiendo.
- [ ] AC7 — **B1**: en el catálogo, al pulsar "+" en una tarjeta, el stepper `− qty +` queda
      dentro de la tarjeta sin desbordar por los lados, en `sm:grid-cols-2` y `lg:grid-cols-3`,
      y el "−"/"+" siguen sin burbujear al `<Link>` de la tarjeta.
      El stepper solo existe tras un clic en cliente: pendiente de QA visual.
      `handle()` con `preventDefault`/`stopPropagation` intacto.
- [x] AC8 — **B2**: en la ficha de un producto sin `specs` extra, "Agregar al carrito" y
      "Ver más de {categoría}" están en líneas distintas con separación clara.
      Verificado en el HTML servido: el `<a>` sale con `mt-8 flex w-fit`.
- [x] AC9 — `npm run typecheck && npm run lint` en verde (el `build` lo corre el reviewer).

## 5. Modelo de datos

Sin cambios de esquema. Sin migración.

## 6. Contratos de API

Ninguno. La página es Server Component y llama al repositorio directo, igual que
`(storefront)/products/page.tsx` y la landing (007 D5).

Params exactos (vía `productQuerySchema.parse`, evaluados dentro del render porque dependen del slug):

```
{ categorySlug: product.categorySlug, categoryActive: "true", pageSize: "4" }
```

`status: "available"`, `sortBy: "createdAt"`, `sortDir: "desc"`, `page: 1` los pone el default del schema.

## 7. Arquitectura y archivos afectados

| Archivo | Cambio |
|---|---|
| `src/app/(storefront)/products/[slug]/page.tsx` | Modificado: 1 llamada a `productRepository.list(...)`, filtro del id actual, `slice(0, 3)` y sección nueva **después** del `</div>` del grid (línea 176), dentro del `flex flex-col gap-4` raíz. |

| `src/modules/cart/components/cart-qty-control.tsx` | Modificado (B1): el `<span>` del número pasa a `w-8 shrink-0`. |
| `src/modules/storefront/components/product-card.tsx` | Modificado (B1): `min-w-0` en la columna de precio del row inferior. Necesario para el desborde real: la píldora ya era `shrink-0` y quien no encogía era esa columna. |

Reutilizado tal cual (verificado):
- `src/modules/storefront/components/product-card.tsx` — la tarjeta; recibe `product: StorefrontProduct`,
  que es la forma de `list().data`.
- `src/modules/products/schemas/product.schema.ts` → `productQuerySchema` — construir los params.
- `src/server/repositories/product.repository.ts` → `list` — sin tocar.

Sin componentes shadcn nuevos.

## 8. Decisiones técnicas

| # | Decisión | Resolución |
|---|---|---|
| D1 | ¿Cómo excluir el producto actual? | **Pedir `pageSize: 4` y filtrar `p.id !== product.id` en la página, quedándose con 3.** Añadir `excludeId` a `ProductQueryInput` + `buildFilters` sería más limpio pero toca schema y repositorio por un solo consumidor. Si el actual no viene en los 4 (posible), sobran y se cortan igual. |
| D2 | ¿Componente `<RelatedProducts>` nuevo? | **No.** Son ~10 líneas de JSX con un solo consumidor: van inline en `page.tsx`. Se extrae si aparece un segundo llamador. |
| D3 | Título | **"Productos parecidos"** — el literal que pidió el usuario. |
| D4 | Grilla y cantidad | **3 productos** con `grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3`, la misma que landing y catálogo: cero valores de layout nuevos y `<ProductCard>` se ve con el ancho para el que está diseñada. |
| D5 | Orden | **`createdAt desc`** (default del schema): "parecidos" = mismos de categoría, lo más nuevo primero. Ordenar por precio insinuaría un criterio de similitud que no existe. |
| D6 | ¿`cache()` para esta consulta? | **No.** `generateMetadata` no la usa: es una sola llamada por render. |
| D7 | ¿Se quita el enlace "Ver más de {categoryName}"? | **No.** Es la salida al catálogo filtrado y no compite con la sección. |

## 9. Tareas atómicas

- [x] T1 — En `page.tsx`, tras el `notFound()`, llamar `productRepository.list(productQuerySchema.parse({ categorySlug: product.categorySlug, categoryActive: "true", pageSize: "4" }))` y derivar `related = data.filter(p => p.id !== product.id).slice(0, 3)` · `src/app/(storefront)/products/[slug]/page.tsx`
- [x] T2 — En el mismo archivo, renderizar `related.length > 0 ? <section>` con `<h2>Productos parecidos</h2>` y la grilla de `<ProductCard>`, después del grid principal (línea 176) · `src/app/(storefront)/products/[slug]/page.tsx`
- [x] T3 — **B1**: `cart-qty-control.tsx` — el `<span>` contenedor del número deja `flex-1 min-w-6` y pasa a `w-8 shrink-0 text-center`; comprobar que la píldora no crece en la tarjeta ni pierde el `w-full` de la ficha (ahí `<CartQtyControl>` no recibe `w-full`, revisar) · `src/modules/cart/components/cart-qty-control.tsx` · verificación: AC7
      Añadido además `min-w-0` a la columna de precio de `<ProductCard>`: la píldora ya era
      `shrink-0`, así que el desborde real lo causaba esa columna al no poder encogerse.
- [x] T4 — **B2**: `page.tsx` — el `<Link>` "Ver más de {categoryName}" pasa de `inline-flex` a `flex w-fit`, `mt-8` · `src/app/(storefront)/products/[slug]/page.tsx` · verificación: AC8
- [x] T5 — Verificar `npm run typecheck && npm run lint` (el `build` lo corre el reviewer)

## 10. Riesgos

- `categorySlug` del schema es lista por coma (`commaList`): pasar un slug suelto es válido, pero
  el tipo esperado tras el `parse` es `string[]`; construir los params con `productQuerySchema.parse`
  (y no a mano) evita el desajuste de tipos.
- La consulta depende de `product`, así que va secuencial tras `getProduct`: no se puede meter en el
  `Promise.all` inicial. Es 1 query añadida al render, aceptable.

## 11. Fuera de alcance

- Similitud real (embeddings, tags, "quienes compraron X"): aquí "parecido" es *misma categoría*.
- Carrusel/slider: grilla estática de 3.
- Paginar o mostrar más de 3 parecidos.
- Tocar catálogo, landing o admin.

## 12. Cierre

Reviewer: **APROBADO** iteración 1. typecheck / lint / build en verde.

Implementado:
- **Productos parecidos** en la ficha: consulta secuencial `list({ categorySlug, categoryActive, pageSize:4 })` tras `getProduct`, se filtra el id actual, `slice(0,3)`, sección "Productos parecidos" con grilla `<ProductCard>` `sm:grid-cols-2 lg:grid-cols-3`. Sin sección si `related.length === 0`.
- **B1**: `<CartQtyControl>` — número con `w-8 shrink-0` (era `flex-1 min-w-6`); `product-card.tsx` — `min-w-0` en la columna de precio + `truncate` en los precios (hallazgo menor del reviewer, aplicado). La píldora del stepper queda ~110px fija, no desborda la tarjeta.
- **B2**: el `<Link>` "Ver más de {categoría}" pasa a `mt-8 flex w-fit` (bloque, línea propia).

Pendiente de QA manual: AC1 (categoría con ≥4 productos → 3 tarjetas; el seed tiene máx 2/categoría), AC5 (exclusión de borrados/inactivos, sin datos que lo ejerzan), AC7 (visual del stepper tras clic en el catálogo). Con el seed actual cada producto tiene 0-1 parecidos.
