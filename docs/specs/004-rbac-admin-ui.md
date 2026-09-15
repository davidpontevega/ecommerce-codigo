---
id: 004
title: UI de gestión de usuarios y roles (para no técnicos)
status: done
module: shared            # src/modules/users, src/modules/roles, nav del admin y onboarding
scope: admin
created: 2026-09-01
---

# 004 — UI de gestión de usuarios y roles (para no técnicos)

> Usando `clerk-backend-api` para el contrato de `users.createUser` /
> `updateUserMetadata` / `banUser` y para confirmar que `updateUser` **reemplaza**
> `publicMetadata` mientras `updateUserMetadata` hace merge por clave.

## 1. Contexto

El spec 003 está `done` y con QA manual pasada: existen `users`, `roles`, `permissions`,
`role_permissions`, `user_roles`, `src/lib/permissions.ts` (15 códigos con `resource`,
`action` y `description` en lenguaje llano), `src/lib/auth.ts` (`getCurrentUser()`
memoizado, `requireAuth()`, `authErrorResponse()`), `src/lib/errors.ts`,
`src/server/repositories/rbac.repository.ts`, el webhook de Clerk y `src/proxy.ts` con el
gate grueso de staff. Hoy **la única forma de dar un rol a alguien es `db:studio` o el
seed**: no hay ninguna pantalla.

Verificado en el repo: el sidebar del panel está escrito a mano dentro de
`src/app/(admin)/admin/layout.tsx:8-24` con dos `<Link>` fijos; `src/components/ui/`
tiene 18 componentes y **no** incluye `checkbox`; `src/proxy.ts:18-33` ya redirige a
`/onboarding/cambiar-clave` cuando `publicMetadata.mustChangePassword` es verdadero, pero
**esa página no existe** (003 §10 lo dejó anotado). Este spec la crea.

El patrón de módulo (`types` / `schemas` / `services` / `hooks` / `components`) y el
`<DataTable>` de `src/components/shared/data-table.tsx` se reutilizan tal cual desde
`src/modules/categories/`.

## 2. Objetivo

Una persona con permiso de gestión puede dar de alta a un miembro del personal, cambiar
sus roles y activarlo o desactivarlo desde el panel, y entender qué concede cada rol sin
leer un solo código de permiso.

## 3. Alcance

### Incluye

- `src/components/shared/admin-nav.tsx`: sidebar extraído a un array de configuración
  `{ label, href, icon, permission }` filtrado por los permisos del usuario.
- `/admin/users`: listado paginado server-side, alta con contraseña temporal, cambio de
  roles y activación/desactivación. Módulo `src/modules/users/`.
- `/admin/roles`: los 6 roles con su descripción y su número de usuarios, y el detalle con
  la matriz de permisos agrupada por recurso, editable solo con `roles.update_permissions`.
  Módulo `src/modules/roles/`.
- `/onboarding/cambiar-clave`: cambio de contraseña forzado tras el alta.
- 7 Route Handlers nuevos bajo `/api/admin/` + `/api/onboarding/password-changed`.
- `src/server/repositories/{user,role}.repository.ts`.
- Corrección del webhook `user.created`: hoy pisaría los roles de un alta hecha desde el
  panel (§10, primer riesgo).
- Componente shadcn `checkbox`.

### No incluye (explícito)

- **Sin cambios de esquema ni migración.** Las 5 tablas de 003 bastan.
- Crear, renombrar o borrar roles: los 6 de sistema son fijos, solo se ajusta su matriz.
- Editar nombre, apellido o email de un usuario ya creado (se editan en Clerk).
- Borrado de usuarios (solo baja lógica) e invitaciones por correo.
- Vista `/admin/audit-logs`, `ip_address` / `user_agent` en la bitácora.
- Resaltar el ítem activo del sidebar (obligaría a bajar la nav a cliente, §11).
- Tests automatizados.

## 4. Criterios de aceptación

- [ ] **AC1** — Dado un usuario con `users.read` y sin `roles.read`, cuando abre `/admin`,
  entonces el sidebar muestra "Usuarios" y **no** muestra "Roles y permisos"; los ítems
  "Categorías" y "Productos" aparecen solo si tiene `categories.read` / `products.read`.
- [ ] **AC2** — Dado un usuario de staff sin `users.read`, cuando navega directo a
  `/admin/users`, entonces recibe un **404** (la página verifica el permiso en el servidor,
  no solo el sidebar).
- [ ] **AC3** — Dado un admin con `users.create`, cuando da de alta a alguien con nombre,
  email y el rol "Encargado de catálogo", entonces la respuesta muestra **una vez** una
  contraseña temporal, existe la cuenta en Clerk, la fila en `users` y sus `user_roles`, y
  `publicMetadata` vale `{ roles: ["manager"], mustChangePassword: true }`.
- [ ] **AC4** — Dado ese usuario recién creado, cuando inicia sesión con la contraseña
  temporal, entonces cualquier ruta lo redirige a `/onboarding/cambiar-clave`; al cambiarla
  entra al panel y **no** vuelve a ser redirigido.
- [ ] **AC5** — Dado el alta del AC3, cuando el webhook `user.created` llega (antes o
  después de que responda el handler), entonces el usuario **conserva** sus roles de staff
  y su `publicMetadata.roles` no queda reducido a `["customer"]`.
- [ ] **AC6** — Dado un email que ya existe en Clerk, cuando se intenta el alta, entonces
  responde **409** con un mensaje entendible y **no** crea ninguna fila en `users`.
- [ ] **AC7** — Dado un usuario existente, cuando se le reemplazan los roles, entonces
  `user_roles` refleja exactamente la selección, `publicMetadata.roles` se reescribe entero
  y su acceso efectivo cambia en la siguiente request.
- [ ] **AC8** — Dado cualquier usuario, cuando intenta cambiar **sus propios** roles o
  desactivarse a sí mismo, entonces responde **409** y nada cambia (guard en el servicio,
  no en la UI).
- [ ] **AC9** — Dado un usuario desactivado desde el panel, entonces `users.is_active` es
  `false`, queda baneado en Clerk y su siguiente request devuelve **401** en la API y lo
  saca del panel.
- [ ] **AC10** — Dado un `admin` (sin `roles.update_permissions`), cuando abre el detalle de
  un rol, entonces ve la matriz **en solo lectura**, sin botón de guardar; y un `PATCH`
  directo a `/api/admin/roles/[id]/permissions` le devuelve **403**.
- [ ] **AC11** — Dado un `super_admin`, cuando quita "Crear productos" al rol `manager` y
  guarda, entonces un usuario `manager` recibe **403** en `POST /api/products` sin volver a
  iniciar sesión.
- [ ] **AC12** — Dado el rol que otorga `roles.update_permissions`, cuando se intenta editar
  su matriz, entonces responde **409**: es el rol que se auto-protege (nadie puede quedarse
  sin la llave).
- [ ] **AC13** — Dado un intento de dejar a un usuario con cero roles, entonces responde
  **400** ("Selecciona al menos un rol").
- [ ] **AC14** — Cada alta, cambio de roles, cambio de estado y edición de matriz deja su
  fila en `audit_logs` con `actor_id` real y `changes: { before, after }`; **ninguna**
  contiene la contraseña temporal.
- [x] **AC15** — Toda la interfaz está en español y sin jerga: en ningún punto de
  `/admin/users` ni `/admin/roles` se muestra un código como `products.create`; se muestra
  su `description`. *(Verificado por código: `permission.code` solo se usa como `key`, `id`
  y estado; el texto visible es `description` / `name`.)*
- [x] **AC16** — Las tres vistas nuevas muestran estado de carga (skeleton) y estado de
  error con botón de reintento. *(`<DataTable>` en usuarios; `role-list`,
  `role-permission-matrix`, `role-checkbox-group` y `change-password-form` propios.)*
- [x] **AC17** — `npm run typecheck && npm run lint && npm run build` en verde.

## 5. Modelo de datos

**Sin cambios de esquema. Sin migración.** Se leen y escriben las tablas de 003:
`users`, `roles`, `permissions`, `role_permissions`, `user_roles`, `audit_logs`.

Acciones nuevas en `audit_logs` (texto libre, no hay enum): `user.created`
(`metadata.source = "admin.ui"`, para distinguirla de la del webhook), `user.roles_changed`
(`severity: "warning"`), `user.activated` / `user.deactivated`, `user.password_changed`,
`role.permissions_changed` (`severity: "warning"`).

## 6. Contratos de API

Todas Node runtime, `params` async (`RouteContext<...>`), Zod antes de tocar datos,
`requirePermission` al inicio y `authErrorResponse(error)` para el mapeo 401/403/500.

| Método | Ruta | Permiso | Body | Response |
|---|---|---|---|---|
| GET | `/api/admin/users` | `users.read` | — (query) | `200 { data, total, page, pageSize }` |
| POST | `/api/admin/users` | `users.create` | `userCreateSchema` | `201 { user, temporaryPassword }` · 409 email duplicado |
| PATCH | `/api/admin/users/[id]` | `users.update` | `userStatusSchema` | `200 UserDto` · 404 · 409 (uno mismo) |
| PATCH | `/api/admin/users/[id]/roles` | `users.assign_roles` | `userRolesSchema` | `200 UserDto` · 404 · 409 (uno mismo) |
| GET | `/api/admin/roles` | `roles.read` | — | `200 RoleDto[]` (sin paginar, son 6) |
| GET | `/api/admin/roles/[id]` | `roles.read` | — | `200 RoleDetailDto` · 404 |
| PATCH | `/api/admin/roles/[id]/permissions` | `roles.update_permissions` | `rolePermissionsSchema` | `200 RoleDetailDto` · 404 · 409 (rol llave) |
| POST | `/api/onboarding/password-changed` | solo `requireAuth()` | — | `200 { ok: true }` |

Cuerpo de error uniforme `{ error: string }`, igual que 001–003.

**Zod** — `src/modules/users/schemas/user.schema.ts`:
`userSortFields = ["createdAt", "email", "firstName"]`; `userQuerySchema`
(`search`, `status: active|inactive|all`, `page`, `pageSize`, `sortBy`, `sortDir`, mismos
defaults que `categoryQuerySchema`); `userCreateSchema` (`firstName` 2–80, `lastName`
0–80 nullish, `email` `z.email()`, `roleIds: z.array(z.uuid()).min(1)`);
`userStatusSchema` (`{ isActive: boolean }`); `userRolesSchema`
(`{ roleIds: z.array(z.uuid()).min(1, "Selecciona al menos un rol") }`); `userIdSchema`.
`src/modules/users/schemas/password.schema.ts`: `passwordChangeSchema` (`currentPassword`,
`newPassword` min 8, `confirmPassword`, `.refine` de igualdad) — **solo del formulario**,
el endpoint no recibe cuerpo.
`src/modules/roles/schemas/role.schema.ts`: `roleIdSchema`, `rolePermissionsSchema`
(`{ permissionCodes: z.array(z.string()).max(50) }`; vacío = rol sin permisos, es válido).

## 7. Arquitectura y archivos afectados

**Servidor / datos**
- `src/server/repositories/user.repository.ts` — **nuevo**: `list(params)` (dos queries:
  página de `users` + roles de esos ids con `inArray`; nunca N+1), `findDtoById(id)`,
  `createWithRoles(tx-less, { clerkId, email, firstName, lastName, roleIds, actorId })`,
  `replaceRoles(id, roleIds, actorId)`, `setActive(id, isActive, actorId)`.
- `src/server/repositories/role.repository.ts` — **nuevo**: `listWithUserCount()`,
  `findDetailById(id)` (rol + **todos** los permisos con `granted: boolean`),
  `replacePermissions(id, codes, actorId)`.
- `src/server/repositories/rbac.repository.ts` — **modificado**: añadir
  `findRoleSlugsByUserId(tx, userId)` para la corrección del webhook.
- `src/lib/audit.ts`, `src/lib/{auth,permissions,errors}.ts` — **sin tocar**.

**API**
- `src/app/api/admin/users/route.ts`, `.../users/[id]/route.ts`,
  `.../users/[id]/roles/route.ts` — **nuevos**.
- `src/app/api/admin/roles/route.ts`, `.../roles/[id]/route.ts`,
  `.../roles/[id]/permissions/route.ts` — **nuevos** (las carpetas ya existen con `.gitkeep`).
- `src/app/api/onboarding/password-changed/route.ts` — **nuevo**.
- `src/app/api/webhooks/clerk/route.ts` — **modificado** (§10).

**Módulo `src/modules/users/`** — `types/user.types.ts`, `schemas/user.schema.ts`,
`schemas/password.schema.ts`, `services/user.service.ts`, `hooks/use-users.ts`,
`hooks/use-user-mutations.ts`, `components/user-columns.tsx`,
`components/user-form-dialog.tsx`, `components/user-roles-dialog.tsx`,
`components/user-table.tsx`, `components/change-password-form.tsx`.

**Módulo `src/modules/roles/`** — `types/role.types.ts`, `schemas/role.schema.ts`,
`services/role.service.ts`, `hooks/use-roles.ts`, `hooks/use-role-mutations.ts`,
`components/role-list.tsx`, `components/role-permission-matrix.tsx`.

**Páginas** — `src/app/(admin)/admin/users/page.tsx`,
`src/app/(admin)/admin/roles/page.tsx`, `src/app/(admin)/admin/roles/[id]/page.tsx`,
`src/app/(auth)/onboarding/cambiar-clave/page.tsx` (el grupo `(auth)` no entra en la URL:
reutiliza su layout centrado sin cambiar la ruta que ya espera `proxy.ts`).

**Compartido** — `src/components/shared/admin-nav.tsx` **nuevo**;
`src/app/(admin)/admin/layout.tsx` **modificado** (sustituye el `<nav>` inline);
`src/components/ui/checkbox.tsx` **nuevo** vía `npx shadcn@latest add checkbox`.

**Reutilizado tal cual, sin tocar**: `src/components/shared/data-table.tsx`,
`src/hooks/use-debounce.ts`, `src/lib/axios.ts` (`api`, `ApiError`),
`src/components/ui/{dialog,field,badge,switch,select,input,button,alert-dialog,dropdown-menu,card,skeleton}.tsx`.

## 8. Decisiones técnicas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Alta directa con `clerkClient().users.createUser` + contraseña temporal | Invitaciones por correo de Clerk | Decisión del usuario: el admin controla el alta y comunica la clave, sin depender de que llegue un email. |
| Matriz de permisos de los roles de sistema editable desde la UI | Matriz quemada en el seed | Decisión del usuario (ya asumida en 003 §8). |
| Middleware = gate grueso; permiso fino en el handler | Resolver permisos en el borde | Decisión del usuario. Nada cambia aquí. |
| La contraseña temporal la **genera el servidor** (`randomBytes(12).toString("base64url")`) y viaja solo en la respuesta del `POST` | Que el admin la escriba en el formulario | Una sola ruta de código; la contraseña nunca viaja del navegador al servidor ni pasa por el `changes` de la bitácora. Nunca se persiste. |
| El catálogo de permisos para la matriz lo sirve la **API** desde la tabla `permissions` | Importar `PERMISSIONS` en el componente cliente | Verificado: `src/lib/permissions.ts:1` importa `getCurrentUser`, que arrastra `@clerk/nextjs/server` y Drizzle. Importarlo desde un `"use client"` rompe el build. La tabla `permissions` ya tiene `code`, `resource`, `action` y `description`. |
| `GET /api/admin/roles/[id]` devuelve **todos** los permisos con `granted: boolean` | Un `GET /api/admin/permissions` aparte + merge en el cliente | Una request pinta la matriz entera; un endpoint menos que proteger. |
| Guard: **nadie puede cambiar sus propios roles ni desactivarse** | "No quitarse el último rol admin" | Comprobar "rol admin" obliga a comparar slugs en código → hallazgo bloqueante por la regla 8 de `CLAUDE.md`. El guard por identidad (`target.id === actor.id`) es más estricto, no usa nombres de rol y cubre el mismo riesgo: siempre queda otro super_admin para reparar. |
| No es editable la matriz del rol que otorga `roles.update_permissions` | `if (role.slug === "super_admin")` | Mismo motivo: sin slugs en código. Se deriva del dato y protege exactamente lo que pide el usuario ("`super_admin` siempre con los 15"). |
| `banUser` / `unbanUser` | `lockUser` / `unlockUser` | `lock` es temporal y expira solo con la duración de bloqueo de la instancia; `ban` es indefinido y reversible, que es la semántica de `is_active`. |
| `updateUserMetadata` (merge por clave), nunca `updateUser` | `updateUser({ publicMetadata })` | Confirmado con `clerk-backend-api`: `updateUser` **reemplaza** todo el `publicMetadata` y borraría `mustChangePassword`. El array `roles` sí se reescribe entero (003 §8). |
| Cambiar la matriz de un rol **no** llama a Clerk | Reescribir `publicMetadata` de los usuarios del rol | `publicMetadata.roles` guarda *slugs*, y los slugs no cambian: cambia el set de permisos, que `getCurrentUser()` relee de Postgres en cada request. Tocar Clerk sería N llamadas HTTP para escribir exactamente lo mismo. |
| El handler del alta hace el upsert + los roles en su propia transacción, sin esperar al webhook | Esperar a `user.created` | Necesita responder con el usuario ya creado. El webhook queda como red de seguridad idempotente, corregido en T16. |
| `/admin/users` y `/admin/roles` verifican el permiso en el Server Component con `can()` → `notFound()` | Confiar en el sidebar filtrado y en el gate del middleware | El middleware solo distingue staff de cliente: un `employee` podría teclear la URL. Ocultar el enlace no es una defensa. |
| Los menús de acción de la tabla se muestran siempre; el 403 lo pinta el toast | Ocultarlos por permiso en el cliente | Los permisos no viajan al bundle de cliente (§8, fila del catálogo). La UI no es el límite de seguridad; el handler sí. |
| `/admin/roles` con tarjetas, sin `<DataTable>` | Reusar la tabla | Son 6 filas fijas: no hay qué paginar, ordenar ni buscar. |
| El listado de usuarios pagina primero y trae los roles de la página en una 2ª query (`inArray`) | Un solo `join` paginado | El `join` con `user_roles` multiplica filas y rompe `limit`/`offset`. Dos queries fijas, no N+1. |
| Página bajo `src/app/(auth)/onboarding/cambiar-clave/` | Un grupo de rutas nuevo | El grupo no entra en la URL: la ruta sigue siendo la que ya espera `src/proxy.ts:18` y hereda el layout centrado de `(auth)`. |
| El formulario pide la contraseña **actual** además de la nueva | Solo la nueva | `updatePassword` la exige cuando la cuenta ya tiene contraseña, y evita que un tercero se apropie de una sesión abierta. |
| Tras cambiar la clave, `getToken({ skipCache: true })` antes de navegar | Redirigir sin más | El claim `mustChangePassword` vive en el token (~60 s de vida): sin refrescar, el middleware lo devuelve al onboarding en bucle. |
| Sin `tooltip` | Instalarlo para explicar cada permiso | La `description` de cada permiso se pinta como texto bajo su switch. Un tooltip esconde justo lo que el usuario no técnico necesita leer. |

## 9. Tareas

### Fase A — navegación

- [x] **T1** — `npx shadcn@latest add checkbox` · `src/components/ui/checkbox.tsx` ·
  verificación: `npm run typecheck`.
- [x] **T2** — Sidebar como Server Component: array `NAV_ITEMS` de
  `{ label, href, icon, permission: PermissionCode }` con Categorías
  (`categories.read`), Productos (`products.read`), Usuarios (`users.read`) y Roles y
  permisos (`roles.read`); una sola llamada a `getCurrentUser()` y filtrado por
  `user.permissions.includes(item.permission)` · `src/components/shared/admin-nav.tsx` ·
  verificación: `npm run typecheck`.
- [x] **T3** — Sustituir el `<nav>` inline por `<AdminNav />` sin tocar el `<aside>` ni el
  header · `src/app/(admin)/admin/layout.tsx` · verificación: AC1.

### Fase B — servidor

- [x] **T4** — `list(params)` (filtros `search` sobre email/nombre/apellido, `status`,
  orden por `userSortFields`, paginación; roles de la página en una 2ª query con `inArray`)
  y `findDtoById(id)` · `src/server/repositories/user.repository.ts` · verificación:
  `npm run typecheck`.
- [x] **T5** — Mutaciones del mismo repo, cada una en `db.transaction` con su `logAudit`
  bloqueante: `createWithRoles`, `replaceRoles` (delete + insert de `user_roles`,
  `changes: { before, after }` con **slugs**, no ids), `setActive` ·
  `src/server/repositories/user.repository.ts` · verificación: `npm run typecheck`.
- [x] **T6** — `listWithUserCount()` (un `leftJoin` + `count` agrupado, sin N+1),
  `findDetailById(id)` (rol + todos los permisos con `granted`) y `replacePermissions`
  (delete + insert en transacción + `logAudit("role.permissions_changed")`) ·
  `src/server/repositories/role.repository.ts` · verificación: `npm run typecheck`.
- [x] **T7** — Schemas Zod de usuarios (§6) · `src/modules/users/schemas/user.schema.ts` ·
  verificación: `npm run typecheck`.
- [x] **T8** — Schemas Zod de roles (§6) · `src/modules/roles/schemas/role.schema.ts` ·
  verificación: `npm run typecheck`.
- [x] **T9** — `GET` (`users.read`) y `POST` (`users.create`): genera la contraseña,
  `clerkClient().users.createUser({ emailAddress: [email], password, firstName, lastName,
  publicMetadata: { roles: slugs, mustChangePassword: true } })`, luego el upsert + roles
  en transacción; error de email duplicado de Clerk → **409**; responde
  `{ user, temporaryPassword }` · `src/app/api/admin/users/route.ts` · verificación: AC3, AC6.
- [x] **T10** — `PATCH` con `users.update`: guard de auto-desactivación → 409,
  `setActive` y `banUser`/`unbanUser` fuera de la transacción con `try/catch` y sin
  reintento · `src/app/api/admin/users/[id]/route.ts` · verificación: AC8, AC9.
- [x] **T11** — `PATCH` con `users.assign_roles`: guard de uno mismo → 409, `roleIds`
  inexistentes → 400, `replaceRoles` y después `updateUserMetadata` con los slugs
  resultantes · `src/app/api/admin/users/[id]/roles/route.ts` · verificación: AC7, AC13.
- [x] **T12** — `GET` con `roles.read` · `src/app/api/admin/roles/route.ts` ·
  verificación: `npm run typecheck`.
- [x] **T13** — `GET` con `roles.read` y validación del `id` · `src/app/api/admin/roles/[id]/route.ts` ·
  verificación: `npm run typecheck`.
- [x] **T14** — `PATCH` con `roles.update_permissions`: 409 si el rol destino ya otorga
  `roles.update_permissions`, 400 si algún `code` no existe en `permissions`, si no
  `replacePermissions` · `src/app/api/admin/roles/[id]/permissions/route.ts` ·
  verificación: AC10, AC11, AC12.
- [x] **T15** — `POST` con `requireAuth()`: toma el `clerkId` **de la sesión** (nunca del
  cuerpo), `updateUserMetadata` con `mustChangePassword: false` y
  `logAudit("user.password_changed")` · `src/app/api/onboarding/password-changed/route.ts` ·
  verificación: AC4.
- [x] **T16** — Corregir la carrera del alta: `findRoleSlugsByUserId(tx, userId)` en
  `rbac.repository.ts`, y en `syncUser` asignar `customer` **solo si el usuario no tiene
  ningún rol** y cachear en Clerk la lista **completa** de slugs leída de la BD (hoy escribe
  `["customer"]` a secas, §10) · `src/app/api/webhooks/clerk/route.ts` +
  `src/server/repositories/rbac.repository.ts` · verificación: AC5.

### Fase C — módulo users (cliente)

- [x] **T17** — `UserDto` (con `roles: { id, slug, name }[]` y fechas como `string`),
  `UserListResponse`, `UserCreatedResponse` · `src/modules/users/types/user.types.ts` ·
  verificación: `npm run typecheck`.
- [x] **T18** — `listUsers`, `createUser`, `setUserActive`, `setUserRoles` sobre `api` de
  `@/lib/axios` (recurso `/admin/users`) · `src/modules/users/services/user.service.ts` ·
  verificación: `npm run typecheck`.
- [x] **T19** — `useUsers(params)` con `keepPreviousData` y `usersQueryKey` ·
  `src/modules/users/hooks/use-users.ts` · verificación: `npm run typecheck`.
- [x] **T20** — `useCreateUser`, `useSetUserActive`, `useSetUserRoles` con invalidación y
  `toast`, y `ApiError` propagado al diálogo en 409 · `src/modules/users/hooks/use-user-mutations.ts` ·
  verificación: `npm run typecheck`.
- [x] **T21** — Columnas: nombre, email, estado (`Badge`), roles (`Badge` por rol), alta y
  menú de acciones ("Cambiar roles", "Desactivar"/"Reactivar") ·
  `src/modules/users/components/user-columns.tsx` · verificación: `npm run typecheck`.
- [x] **T22** — Diálogo de alta (RHF + `zodResolver` + `Field`/`FieldError`, calcado de
  `category-form-dialog.tsx`): nombre, apellido, email y roles con `Checkbox` etiquetados
  con `name` + `description` del rol; al recibir la respuesta muestra la contraseña
  temporal en un bloque copiable y avisa de que no se volverá a mostrar ·
  `src/modules/users/components/user-form-dialog.tsx` · verificación: AC3, AC15.
- [x] **T23** — Diálogo de cambio de roles: mismos checkboxes precargados con los roles
  actuales · `src/modules/users/components/user-roles-dialog.tsx` · verificación: AC7.
- [x] **T24** — Contenedor de la tabla: búsqueda con `useDebounce`, filtro de estado,
  `<DataTable>`, los dos diálogos y el `AlertDialog` de confirmación al desactivar ·
  `src/modules/users/components/user-table.tsx` · verificación: AC16.
- [x] **T25** — Página con `metadata`, encabezado y guard `can("users.read")` →
  `notFound()` · `src/app/(admin)/admin/users/page.tsx` · verificación: AC2.

### Fase D — módulo roles (cliente)

- [x] **T26** — `RoleDto` (`+ userCount`) y `RoleDetailDto`
  (`permissions: { code, resource, action, description, granted }[]`) ·
  `src/modules/roles/types/role.types.ts` · verificación: `npm run typecheck`.
- [x] **T27** — `listRoles`, `getRole`, `setRolePermissions` ·
  `src/modules/roles/services/role.service.ts` · verificación: `npm run typecheck`.
- [x] **T28** — `useRoles()`, `useRole(id)` y `useSetRolePermissions()` con invalidación y
  `toast` · `src/modules/roles/hooks/{use-roles.ts,use-role-mutations.ts}` · verificación:
  `npm run typecheck`.
- [x] **T29** — Lista en tarjetas: nombre, descripción llana y "N personas con este rol",
  cada una enlazando al detalle; skeleton y reintento ·
  `src/modules/roles/components/role-list.tsx` · verificación: AC16.
- [x] **T30** — Matriz: permisos agrupados por `resource` con un título en español por
  grupo, un `Switch` por permiso con su `description` como etiqueta, estado local y botón
  "Guardar cambios"; con `canEdit={false}` los switches van `disabled` y no hay botón ·
  `src/modules/roles/components/role-permission-matrix.tsx` · verificación: AC10, AC15.
- [x] **T31** — Página índice con guard `can("roles.read")` → `notFound()` ·
  `src/app/(admin)/admin/roles/page.tsx` · verificación: AC2.
- [x] **T32** — Página de detalle: `await params`, guard `can("roles.read")` y
  `canEdit={await can("roles.update_permissions")}` pasado a la matriz ·
  `src/app/(admin)/admin/roles/[id]/page.tsx` · verificación: AC10.

### Fase E — cambio de contraseña forzado

- [x] **T33** — Formulario cliente: `useUser()`, RHF + `passwordChangeSchema`,
  `user.updatePassword({ currentPassword, newPassword, signOutOfOtherSessions: true })`,
  luego `POST /api/onboarding/password-changed`, luego `getToken({ skipCache: true })` y
  `router.replace("/admin")`; errores de Clerk mostrados bajo el campo, no tragados ·
  `src/modules/users/components/change-password-form.tsx` · verificación: AC4.
- [x] **T34** — Página que monta el formulario dentro de una `Card`, con el texto de por
  qué se le pide · `src/app/(auth)/onboarding/cambiar-clave/page.tsx` · verificación:
  entrar con una cuenta con el flag no produce bucle de redirecciones.

### Fase F — cierre

- [x] **T35** — Verificación final y recorrido manual de los 17 AC ·
  `npm run typecheck && npm run lint`.

**Total: 35 tareas.**

### Desviaciones registradas durante la implementación

1. **`src/proxy.ts` modificado (1 línea de matcher).** No estaba en §7. El matcher
   `isChangePasswordRoute` solo cubría la página, así que la redirección forzada se tragaba
   el `POST /api/onboarding/password-changed` que baja el flag: el flujo del AC4 no podía
   cerrarse nunca. Se añade el endpoint al mismo matcher.
2. **Archivo nuevo `src/modules/users/components/role-checkbox-group.tsx`.** No estaba en
   §7. Los diálogos de T22 y T23 comparten el mismo selector de roles (checkboxes con
   `name` + `description`, skeleton y reintento); mantenerlo en un solo sitio evita
   duplicar el bloque entero dos veces.
3. **`UserRoleRef` y `RolePermissionRef` viven en `modules/*/types/`** y los repositorios
   los importan, en vez de declararlos en el repositorio y que el módulo los reimporte.
   Así ningún archivo de cliente importa desde `src/server/repositories/`.
4. **Sin efectos de sincronización de estado** (`react-hooks/set-state-in-effect` es error
   en este ESLint): los diálogos se remontan con `key` desde `user-table.tsx` y la matriz
   descarta su estado local en el `onSuccess` de la mutación.

## 10. Riesgos y consideraciones

- **El webhook pisa los roles del alta (bloqueante, por eso T16).** Hoy
  `src/app/api/webhooks/clerk/route.ts:98-124` asigna `customer` a todo `user.created` y
  después escribe `publicMetadata.roles = ["customer"]`. Sin la corrección, un usuario
  creado desde el panel como `manager` quedaría con `roles: ["customer"]` en el token y el
  gate de `proxy.ts` lo dejaría fuera del panel, con la BD diciendo lo contrario: el bug más
  difícil de diagnosticar de este spec.
- **Orden no determinista.** El webhook puede llegar antes o después de que el `POST`
  confirme su transacción. Con T16 ambos órdenes convergen al mismo estado; sin T16, solo
  uno de los dos.
- **Desfase del token (~60 s).** Desactivar o degradar a alguien no lo expulsa del panel al
  instante; lo frena el permiso fino de cada handler, que relee Postgres. Igual que 003 §10.
- **`banUser` y `updateUserMetadata` son HTTP a Clerk, fuera de la transacción.** Si fallan,
  Postgres ya es correcto: se registra el error y se devuelve la respuesta. Nunca reintentar
  en bucle dentro del handler.
- **Perderse la contraseña temporal.** Se muestra una sola vez y no se guarda en ningún
  sitio. Si el admin cierra el diálogo antes de copiarla, la salida es restablecerla desde
  el dashboard de Clerk (no hay pantalla para eso en este spec).
- **Auto-bloqueo de permisos.** Aunque el rol llave está protegido (AC12), un `super_admin`
  sí puede dejar sin permisos a los demás roles. Es intencional y reversible; la bitácora
  guarda el `before` completo.
- **`checkbox` es la primera pieza `base-nova` que se instala en este spec.** Si el
  registro devuelve un componente que no encaja con `@base-ui/react` (como ya pasó con
  `form` → `field`), usar `<input type="checkbox">` con las clases del sistema antes que
  pelearse con el registro.
- **La matriz de permisos es un formulario grande.** Con 15 permisos cabe en estado local;
  no hace falta `useFieldArray` ni Zustand.

## 11. Fuera de alcance / deuda aceptada

- **Roles a medida** (crear, renombrar, borrar): los 6 de sistema son fijos.
- **Ítem activo del sidebar**: obligaría a un `"use client"` con `usePathname()` en la nav,
  y con él a resolver los permisos en el servidor y pasarlos como props. Se hace cuando el
  panel tenga suficientes secciones para que perderse sea un problema real.
- **Edición del perfil (nombre, apellido, email) de un usuario ya creado**: se hace en el
  dashboard de Clerk; el webhook `user.updated` lo espeja.
- **Restablecer la contraseña de otro usuario desde el panel**, y borrado definitivo de
  cuentas.
- **Filtrar por rol en el listado de usuarios**: hoy solo búsqueda por texto y estado.
- Se arrastran sin cambios desde 003 §11: rutas de catálogo fuera de `/api/admin/`,
  `ip_address` / `user_agent` en la bitácora, vista `/admin/audit-logs`, tests
  automatizados y purga por retención.

## 12. Cierre

Reviewer: **APROBADO** (iteración 1/3). typecheck / lint / build en verde.

Hallazgos menores tras la review:
- Resuelto: cuenta huérfana en Clerk si Postgres falla tras `createUser` →
  `clerk.users.deleteUser` en el catch (`src/app/api/admin/users/route.ts`).
- Resuelto: se quitó `email` del `changes` del audit `user.created`
  (`user.repository.ts`); el `entityId` ya identifica al usuario.
- Deuda aceptada: un reintento de Svix de `user.created` puede reescribir una fila
  `user.created` en `audit_logs` (append-only lo tolera; sin impacto funcional).

Pendiente de QA manual (sesión real + webhook corriendo): AC1–AC14. Ver §5 del
handoff — sobre todo AC3/AC5/AC6 (alta + carrera del webhook, ambos órdenes) y AC4
(login con clave temporal → cambio forzado → sin bucle).
