---
id: 009
title: Vista de perfil del cliente (perfil, favoritos, compras)
status: done
module: auth
scope: client
---

# 009 — Vista de perfil del cliente (perfil, favoritos, compras)

## Objetivo
Un cliente con sesión puede abrir `/perfil` desde el menú del `UserButton` y ver sus
datos de Clerk, más las secciones de favoritos y compras (aún sin datos).

## Alcance
Incluye:
- Ruta `/perfil` dentro de `(storefront)`, con 3 pestañas: Mi perfil · Mis favoritos · Mis compras.
- "Mi perfil": lectura de `currentUser()` (avatar, nombre, email, alta, último acceso).
- Favoritos y compras: solo estado vacío con CTA al catálogo.
- Entrada "Mi perfil" en el dropdown del `UserButton`.

No incluye:
- Edición de datos: ya la resuelve "Gestionar cuenta" del propio `UserButton`.
- Tablas, schema, repos, endpoints o hooks de favoritos/pedidos.
- Cambios en `src/proxy.ts`: `/perfil` no está en `isPublicRoute`, así que
  `auth.protect()` ya la protege (verificado en `proxy.ts:57`).

## Criterios de aceptación
- [x] AC1 — Dado un usuario con sesión, cuando entra a `/perfil`, entonces ve 3 pestañas con "Mi perfil" activa por defecto.
- [x] AC2 — Dado "Mi perfil", cuando carga, entonces muestra avatar, nombre completo, email principal, fecha de alta y último acceso, en solo lectura y en español (`es-PE`).
- [x] AC3 — Dado un visitante sin sesión, cuando pide `/perfil`, entonces Clerk lo manda a `/sign-in` y tras entrar vuelve a `/perfil`.
- [x] AC4 — Dado "Mis favoritos", cuando carga, entonces muestra icono + mensaje "Aún no tienes favoritos" + botón "Explorar catálogo" hacia `/products`.
- [x] AC5 — Dado "Mis compras", cuando carga, entonces muestra icono + mensaje "Aún no tienes compras" + botón "Explorar catálogo" hacia `/products`.
- [x] AC6 — Dado el dropdown del `UserButton`, cuando se abre, entonces incluye "Mi perfil" (navega a `/perfil`) y conserva "Gestionar cuenta" y "Cerrar sesión".
- [x] AC7 — Dado un fallo de `currentUser()`, cuando ocurre, entonces cae en `(storefront)/error.tsx`; durante la navegación se ve el skeleton propio de `/perfil`, no el de la landing.
- [x] AC8 — En móvil (360px) las 3 pestañas y las tarjetas se ven sin scroll horizontal.

## Datos
Sin cambios de esquema.

## API
Sin endpoints nuevos. Sin Zod: no hay entrada de usuario en esta vista.

## Reutilizar
- `src/components/ui/tabs.tsx` — `Tabs/TabsList/TabsTrigger/TabsContent` (base-ui: `defaultValue` en `Tabs`, `value` en trigger y content).
- `src/components/ui/card.tsx`, `avatar.tsx`, `separator.tsx`, `badge.tsx`, `skeleton.tsx` — ya instalados.
- `src/components/ui/button.tsx` — para enlaces usar `nativeButton={false}` + `render={<Link href="..." />}` (patrón de `storefront-header.tsx:50-59`).
- `src/app/(storefront)/error.tsx` y `layout.tsx` — cubren error y shell; no crear nada equivalente.
- `@clerk/nextjs/server` → `currentUser()` (export verificado en la v7 instalada).
- `@clerk/nextjs` → `UserButton.MenuItems` y `UserButton.Link` con props `{ href, label, labelIcon }` (verificado en `@clerk/react/dist/index.d.mts`).
- Iconos de `lucide-react` (ya en uso): `User`, `Heart`, `Package`.
No hace falta instalar ningún componente shadcn.

## Tareas
- [x] T1 — Página server-side con las 3 pestañas: `currentUser()`, `if (!user) redirect("/sign-in")`, tarjeta de datos en la primera pestaña y un helper local `EmptySection` (icono, título, texto, CTA a `/products`) reutilizado en favoritos y compras · `src/app/(storefront)/perfil/page.tsx`
- [x] T2 — Skeleton propio de la ruta (encabezado + fila de pestañas + tarjeta) · `src/app/(storefront)/perfil/loading.tsx`
- [x] T3 — Añadir `<UserButton.MenuItems><UserButton.Link href="/perfil" label="Mi perfil" labelIcon={<User className="size-4" />} /></UserButton.MenuItems>` como hijo del `<UserButton />` existente · `src/components/shared/storefront-header.tsx`

Verificación final: `npm run typecheck && npm run lint` (el `build` lo corre el reviewer)

## Notas
- `currentUser()` vuelve dinámica la ruta: es lo esperado, `/perfil` no puede ser estática.
- `user.createdAt` / `lastSignInAt` son epoch en ms (`number | null`): formatear con
  `Intl.DateTimeFormat("es-PE", { dateStyle: "long" })` y ocultar el campo si es `null`.
- Todo dentro de un panel de `Tabs` se renderiza en el servidor y se pasa como
  `children`; no marcar `page.tsx` con `"use client"`.
- Contrato futuro (no implementar): las pestañas 2 y 3 se rellenarán con
  `useFavorites()` / `useOrders()` sobre `GET /api/favorites` y `GET /api/orders`;
  el `EmptySection` queda como estado vacío de esos listados.
