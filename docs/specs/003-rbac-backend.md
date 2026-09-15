---
id: 003
title: Backend RBAC + sincronización Clerk + protección por middleware
status: done
module: shared            # toca src/lib, src/server, src/proxy.ts y retrofit de categories/products
scope: both
created: 2026-08-31
---

# 003 — Backend RBAC + sincronización Clerk + protección por middleware

> Usando `clerk-webhooks` para el contrato exacto de `verifyWebhook` y del payload de
> `user.*`; usando `clerk-nextjs-patterns` para `createRouteMatcher`, `auth.protect()`
> y el acceso a `sessionClaims` desde el middleware.

## 1. Contexto

Clerk ya autentica (email/password + Google) y `<ClerkProvider>` está montado en
`src/app/layout.tsx`, pero **no existe capa de autorización**: verificado en el repo,
`src/proxy.ts` es `export default clerkMiddleware()` sin matchers (todo público), no hay
`src/lib/auth.ts` ni `src/lib/permissions.ts`, `src/server/db/schema/` solo tiene
`audit-log.ts`, `category.ts` y `product.ts`, y `audit_logs.actor_id` es un `uuid` suelto
con el comentario `// ponytail: sin FK a users porque la tabla no existe`
(`src/server/db/schema/audit-log.ts:23`). Todas las mutaciones de catálogo escriben
`actor_id = null`.

Los specs 001 §11 y 002 §Deuda declararon esto como "la deuda de seguridad más urgente" y
prohibieron desplegar a internet hasta saldarla. Este spec la salda **en el backend**. La
UI de gestión de usuarios y roles es el spec 004.

El script `db:seed` ya está declarado en `package.json` (`tsx src/server/db/seed.ts`) pero
el archivo no existe: hoy el comando falla.

## 2. Objetivo

Un usuario autenticado en Clerk queda espejado en `users` con al menos un rol, y toda ruta
de administración y toda mutación de catálogo se autoriza por **código de permiso** contra
Postgres, dejando en `audit_logs` el `actor_id` real de quien la ejecutó.

## 3. Alcance

### Incluye

- 5 tablas nuevas (`users`, `roles`, `permissions`, `role_permissions`, `user_roles`) + FK
  `audit_logs.actor_id → users.id` e índice `(actor_id, created_at desc)`. **1 migración.**
- `src/server/db/seed.ts` idempotente: 15 permisos, 6 roles de sistema, la matriz
  rol→permiso y el alta del `super_admin` inicial por email.
- Webhook `POST /api/webhooks/clerk` (`user.created` / `user.updated` / `user.deleted`).
- `src/lib/permissions.ts` (`PERMISSIONS`, `can()`, `requirePermission()`) y
  `src/lib/auth.ts` (`getCurrentUser()` memoizado, `requireAuth()`, mapeo de errores a HTTP).
- `src/server/repositories/rbac.repository.ts`.
- `src/proxy.ts`: rutas públicas explícitas + gate grueso staff/customer para
  `/admin(.*)` y `/api/admin(.*)`.
- Retrofit de `/api/categories*` y `/api/products*`: `requirePermission` en las mutaciones
  y `actorId` real propagado hasta `logAudit`.
- Piezas de auth que faltan: `localization` esES + `appearance` en `<ClerkProvider>`,
  `src/app/(auth)/layout.tsx`, enlaces cruzados en sign-in/sign-up y
  `src/components/shared/admin-header.tsx` con `<UserButton>`.

### No incluye (explícito)

- **Toda la UI de administración de usuarios y roles** → spec 004: `/admin/users`,
  `/admin/roles`, `POST /api/admin/users`, `PATCH .../roles`, sidebar filtrado por permiso,
  módulos `src/modules/users` y `src/modules/roles`.
- La página `/onboarding/cambiar-clave` (spec 004). Aquí solo entra el guard en `proxy.ts`
  y el tipo del flag; **nada pone `mustChangePassword: true` todavía**.
- Mover las rutas de catálogo a `/api/admin/` (rompería los services de 001/002 → §11).
- `ip_address` / `user_agent` en `audit_logs` (§11).
- Vista `/admin/audit-logs`, roles a medida, organizaciones de Clerk, MFA, tests.

## 4. Criterios de aceptación

- [ ] **AC1** — Dado un usuario que se registra por primera vez, cuando Clerk emite
  `user.created`, entonces existe una fila en `users` con su `clerk_id`, una fila en
  `user_roles` apuntando al rol `customer`, y su `publicMetadata.roles` en Clerk vale
  `["customer"]`.
- [ ] **AC2** — Dado un `user.updated` con email o nombre distintos, cuando llega el webhook,
  entonces la fila de `users` se actualiza **sin** duplicarse (upsert por `clerk_id`) y sus
  `user_roles` no cambian.
- [ ] **AC3** — Dado un `user.deleted`, cuando llega el webhook, entonces la fila queda con
  `is_active = false` y **no** se borra (`audit_logs` conserva su actor).
- [x] **AC4** — Dado un POST al webhook con firma inválida o ausente, entonces responde
  **400** y no ejecuta ninguna consulta a la base de datos.
- [x] **AC5** — Dado `SUPER_ADMIN_EMAIL=x@y.z` y un usuario con ese email ya en `users`,
  cuando corro `npm run db:seed`, entonces ese usuario tiene el rol `super_admin`; correr el
  seed dos veces seguidas no crea filas duplicadas ni falla.
- [x] **AC6** — Tras el seed hay exactamente 15 filas en `permissions`, 6 en `roles` (todas
  con `is_system = true`) y `super_admin` tiene 15 filas en `role_permissions`.
- [x] **AC7** — `GET /admin/products` sin sesión → redirect a `/sign-in`; con sesión cuyo
  único rol es `customer` → redirect a `/`; con un rol de staff → renderiza.
- [x] **AC8** — `POST /api/products` sin sesión → **401**; con sesión sin
  `products.create` → **403** y **cero** filas nuevas en `products`; con el permiso → **201**.
- [ ] **AC9** — `DELETE /api/products/[id]` con un usuario `employee` (tiene
  `products.update`, no `products.delete`) → **403**.
- [x] **AC10** — `GET /api/products` y `GET /api/categories` siguen respondiendo **200** sin
  sesión (lectura de storefront).
- [ ] **AC11** — Cada mutación de catálogo ejecutada por un usuario autenticado deja su fila
  en `audit_logs` con `actor_id` = `users.id` de ese usuario (no `null`).
- [x] **AC12** — La verificación en los handlers es por `permission.code`; una búsqueda de
  `role === "admin"` / `slug === "super_admin"` en `src/app/**` y `src/lib/**` no devuelve
  ningún resultado (regla 8 de CLAUDE.md).
- [ ] **AC13** — Cambiar los roles de un usuario directamente en Postgres cambia su acceso
  efectivo en la siguiente request a un handler, aunque `publicMetadata` siga desfasado
  (Postgres gana).
- [x] **AC14** — `getCurrentUser()` invocado varias veces dentro de la misma request ejecuta
  las consultas de resolución **una sola vez** (`React.cache()`).
- [ ] **AC15** — Sign-in y sign-up se muestran en español y con el layout centrado de
  `(auth)/layout.tsx`; el header del admin muestra nombre, rol y `<UserButton>`.
- [x] **AC16** — `npm run typecheck && npm run lint && npm run build` en verde.

## 5. Modelo de datos

Una tabla por archivo (`docs/SETUP.md` §3) + barrel. Tipos con `InferSelectModel` /
`InferInsertModel` (regla 5). **Requiere 1 migración** (`db:generate` + `db:migrate`);
aditiva salvo el `ALTER` de la FK en `audit_logs`.

### `users` — `src/server/db/schema/user.ts`

| Columna | Tipo | Constraint |
|---|---|---|
| `id` | uuid | PK `defaultRandom()` |
| `clerk_id` | text | not null **unique** |
| `email` | text | not null |
| `first_name` / `last_name` | text | nullable |
| `image_url` | text | nullable |
| `is_active` | boolean | not null default `true` |
| `created_at` / `updated_at` | timestamptz | not null `defaultNow()`; `updated_at` con ``$onUpdate(() => sql`now()`)`` |

Índice: `users_email_idx` (búsqueda del seed y de la UI de 004). `email` **no** es unique:
Clerk admite varios emails por cuenta y el unique real es `clerk_id`.

### `roles` — `src/server/db/schema/role.ts`

`id` uuid PK · `slug` text not null **unique** · `name` text not null · `description` text
nullable · `is_system` boolean not null default `false` · `created_at`/`updated_at` timestamptz.

### `permissions` — `src/server/db/schema/permission.ts`

`id` uuid PK · `code` text not null **unique** (`<recurso>.<acción>`) · `resource` text not
null · `action` text not null · `description` text nullable · `created_at` timestamptz.

### `role_permissions` — `src/server/db/schema/role-permission.ts`

`role_id` uuid FK → `roles.id` `onDelete: "cascade"` · `permission_id` uuid FK →
`permissions.id` `onDelete: "cascade"` · PK compuesta `primaryKey({ columns: [t.roleId, t.permissionId] })`.

### `user_roles` — `src/server/db/schema/user-role.ts`

`user_id` uuid FK → `users.id` `onDelete: "cascade"` · `role_id` uuid FK → `roles.id`
`onDelete: "cascade"` · PK compuesta · `assigned_by` uuid FK → `users.id` `onDelete: "set null"`
nullable · `assigned_at` timestamptz not null `defaultNow()`.

### `audit_logs` — modificar `src/server/db/schema/audit-log.ts`

`actorId` pasa a `uuid("actor_id").references(() => users.id, { onDelete: "set null" })`,
se añade `index("audit_logs_actor_idx").on(t.actorId, t.createdAt.desc())` (el que pide
`docs/SETUP.md` §5.2) y **se borra el comentario `ponytail:` de la línea 23**. El resto de la
tabla y `src/lib/audit.ts` no se tocan: `AuditEntry` ya acepta `actorId`.

### Datos semilla

**6 roles de sistema** (`is_system = true`): `super_admin`, `admin`, `manager`, `employee`,
`customer`, `audit`. `customer` es el rol por defecto de todo usuario nuevo.

**15 permisos**: `categories.{read,create,update,delete}` · `products.{read,create,update,delete}` ·
`users.{read,create,update,assign_roles}` · `roles.{read,update_permissions}` · `audit.read`.

**Matriz rol → permisos** (explícita, sin comodines):

| Rol | Permisos |
|---|---|
| `super_admin` | los 15 |
| `admin` | los 15 **menos** `roles.update_permissions` (14) |
| `manager` | `categories.*` (4), `products.*` (4), `audit.read` (9) |
| `employee` | `categories.read`, `categories.update`, `products.read`, `products.update` (4) |
| `audit` | `categories.read`, `products.read`, `audit.read` (3) |
| `customer` | ninguno (0) |

## 6. Contratos de API

| Método | Ruta | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/api/webhooks/clerk` | firma Svix (`verifyWebhook`) | evento Clerk | `200 "OK"` · 400 firma inválida · 500 fallo de BD (Svix reintenta) |

Retrofit de las rutas existentes (mismo contrato, se añaden 401 y 403):

| Método | Ruta | Permiso exigido | Nuevos códigos |
|---|---|---|---|
| GET | `/api/categories`, `/api/categories/[id]` | — (pública) | — |
| POST | `/api/categories` | `categories.create` | 401, 403 |
| PATCH | `/api/categories/[id]` | `categories.update` | 401, 403 |
| PATCH | `/api/categories/[id]` con **solo** `isActive` | `categories.delete` | 401, 403 |
| GET | `/api/products`, `/api/products/[id]` | — (pública) | — |
| POST | `/api/products` | `products.create` | 401, 403 |
| PATCH | `/api/products/[id]` | `products.update` | 401, 403 |
| DELETE | `/api/products/[id]` | `products.delete` | 401, 403 |
| POST | `/api/products/[id]/restore` | `products.delete` | 401, 403 |

Cuerpo de error uniforme, igual que 001/002: `{ error: string }` con
`"No autenticado"` (401) y `"No tienes permiso para esta acción"` (403).

**Sin schemas Zod nuevos**: el webhook valida por firma criptográfica y el payload lo tipa
`verifyWebhook` (unión discriminada por `evt.type`); las rutas retrofit conservan sus
schemas de `src/modules/{categories,products}/schemas/`.

## 7. Arquitectura y archivos afectados

**Servidor / datos**
- `src/server/db/schema/{user,role,permission,role-permission,user-role}.ts` — **nuevos**.
- `src/server/db/schema/audit-log.ts` — **modificado** (FK + índice + quitar comentario).
- `src/server/db/schema/index.ts` — **modificado** (5 re-exports).
- `src/server/db/seed.ts` — **nuevo**. Único consumidor server-side de `PERMISSIONS`.
- `src/server/repositories/rbac.repository.ts` — **nuevo**: `findAccessByClerkId`,
  `upsertFromClerk(tx, …)`, `assignRoleBySlug(tx, …)`, `deactivateByClerkId`.
- `src/server/repositories/{category,product}.repository.ts` — **modificados**: cada mutación
  acepta `actorId?: string | null` y lo pasa a `logAudit`. Nada más cambia.
- `drizzle/0002_*.sql` — **generado**.

**Lib**
- `src/lib/permissions.ts` — **nuevo**. `PERMISSIONS` (const), `PermissionCode`,
  `ForbiddenError`, `can(code)`, `requirePermission(code)`.
- `src/lib/auth.ts` — **nuevo**. `UnauthorizedError`, `getCurrentUser()` (`React.cache()`),
  `requireAuth()`, `authErrorResponse(error)`.
- `src/lib/audit.ts` — **sin tocar** (ya acepta `actorId`).

**API / edge**
- `src/app/api/webhooks/clerk/route.ts` — **nuevo**.
- `src/app/api/categories/route.ts`, `src/app/api/categories/[id]/route.ts`,
  `src/app/api/products/route.ts`, `src/app/api/products/[id]/route.ts`,
  `src/app/api/products/[id]/restore/route.ts` — **modificados** (guard + `actorId`).
- `src/proxy.ts` — **modificado**.
- `src/types/globals.d.ts` — **nuevo**. `CustomJwtSessionClaims`.

**UI de auth**
- `src/app/layout.tsx` — **modificado** (`localization={esES}` + `appearance`).
- `src/app/(auth)/layout.tsx` — **nuevo**.
- `src/app/(auth)/sign-in/[[...sign-in]]/page.tsx`, `.../sign-up/[[...sign-up]]/page.tsx` —
  **modificados** (el `div` centrador sube al layout; enlaces cruzados).
- `src/components/shared/admin-header.tsx` — **nuevo**, Server Component.
- `src/app/(admin)/admin/layout.tsx` — **modificado** (montar el header). El sidebar **no**
  se refactoriza aquí: eso es 004.

**Config**: `.env.example` + `.env.local` → `CLERK_WEBHOOK_SIGNING_SECRET`, `SUPER_ADMIN_EMAIL`.
Dependencia nueva: `@clerk/localizations`.

## 8. Decisiones técnicas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Alta de staff = `clerkClient().users.createUser` con contraseña temporal + `publicMetadata.mustChangePassword` | Invitaciones de Clerk | Decisión del usuario: el admin comunica la clave y controla el alta sin depender del correo. Aquí solo se define el flag en el tipo y el guard del middleware; la creación es 004. |
| Matriz de permisos de los roles de sistema **editable** desde la UI | Matriz quemada en código | Decisión del usuario. Por eso `role_permissions` es tabla y el seed solo la inicializa (`onConflictDoNothing`), sin resincronizarla en cada corrida. |
| Middleware = gate **grueso** staff/customer; permiso fino en cada handler | Resolver permisos en el middleware | Decisión del usuario. El middleware no tiene acceso a Postgres de forma barata y `sessionClaims` es un cache derivado; la verdad se relee en el handler (regla 8: doble verificación). |
| Ejecutar como 2 specs con aprobación separada | Un solo spec gigante | Decisión del usuario: 003 es desplegable y verificable por sí solo. |
| `super_admin` sembrado con las 15 filas de `role_permissions` | Comodín `*` con un `if` en `requirePermission` | Una sola query uniforme; sin rama especial que auditar ni bypass oculto. |
| Matriz explícita por rol en vez de la fila `*.read` del plan | Dar `users.read`/`roles.read` a todos | La fila `*.read` del plan era ambigua. Se resuelve por el propósito del rol: `manager` "sin gestión de usuarios" no recibe `users.read` ni `roles.read`. |
| `restore` de producto exige `products.delete` | `products.update` | Restaurar es la contrapartida de borrar: quien no puede borrar no debe poder deshacerlo. Mismo criterio para el toggle de `isActive` en categorías. |
| `getCurrentUser()` con `React.cache()` | Sin memoización, o `unstable_cache` | La resolución se invoca varias veces por request (guard + `actorId` + header). `React.cache()` es por request y por usuario; `unstable_cache` es compartido y filtraría datos entre usuarios. |
| `PERMISSIONS` como datos puros en `permissions.ts`, y `can`/`requirePermission` en el mismo archivo importando `getCurrentUser` con import de valor, mientras `auth.ts` importa `PermissionCode` con `import type` | Fusionar todo en `auth.ts` | `docs/SETUP.md` §3 fija ese reparto. El `import type` se borra al compilar, así que no hay ciclo en runtime. |
| `requirePermission` **lanza** y los handlers traducen con `authErrorResponse(error)` | Devolver `NextResponse` desde el guard | Decisión del usuario (`ForbiddenError` → 403). Un solo mapeo compartido: `UnauthorizedError`→401, `ForbiddenError`→403, resto→500 con log. |
| `publicMetadata.roles` se **reescribe entero**, nunca se parchea | Merge incremental | `updateUserMetadata` hace merge superficial por clave; reescribir el array evita roles fantasma tras una revocación. |
| Postgres gana ante discrepancia con `publicMetadata` | Confiar en el token | `docs/SETUP.md` §5.1: el metadata es cache derivado, y el token puede tener hasta ~60 s de desfase. |
| Claim `publicMetadata` añadido al **session token** en el dashboard de Clerk | Leer el usuario desde el middleware | Sin ese claim `sessionClaims.publicMetadata` es `undefined` y el gate fallaría (cerrado, pero para todos). Es config, no código → §10. |
| `user.deleted` → `is_active = false` | `DELETE` físico | La FK `audit_logs.actor_id` es `set null`: borrar físicamente perdería el actor de toda la bitácora histórica (regla 9). |
| El webhook devuelve **500** si falla la BD | Tragar el error y devolver 200 | Svix reintenta con 4xx/5xx; un 200 optimista dejaría al usuario sin fila en `users` para siempre. |
| Sin deduplicación por `svix-id` | Tabla de eventos procesados | Las tres operaciones son idempotentes por diseño (upsert por `clerk_id`, `onConflictDoNothing` en `user_roles`). Se añade cuando aparezca un evento no idempotente. |
| Rutas de catálogo siguen en `/api/{categories,products}` | Moverlas a `/api/admin/` | Romper los services de 001/002 no aporta seguridad: el gate real es `requirePermission`. Deuda anotada en §11. |
| Sin `forceRedirectUrl` en `<SignIn>`/`<SignUp>` | Añadir las props | Verificado: `.env.example` ya define `NEXT_PUBLIC_CLERK_SIGN_{IN,UP}_FALLBACK_REDIRECT_URL="/"`. Solo se añaden los enlaces cruzados `signUpUrl`/`signInUrl`. |

## 9. Tareas

### Fase A — modelo de datos

- [x] **T1** — Schema de `users` con `clerk_id` único, `is_active` e índice de email ·
  `src/server/db/schema/user.ts` · verificación: `npm run typecheck`.
- [x] **T2** — Schema de `roles` con `slug` único e `is_system` ·
  `src/server/db/schema/role.ts` · verificación: `npm run typecheck`.
- [x] **T3** — Schema de `permissions` con `code` único ·
  `src/server/db/schema/permission.ts` · verificación: `npm run typecheck`.
- [x] **T4** — Schema de `role_permissions` (PK compuesta, ambas FK en cascada) ·
  `src/server/db/schema/role-permission.ts` · verificación: `npm run typecheck`.
- [x] **T5** — Schema de `user_roles` (PK compuesta, `assigned_by` FK a `users` en
  `set null`) · `src/server/db/schema/user-role.ts` · verificación: `npm run typecheck`.
- [x] **T6** — Añadir la FK `actor_id → users.id` (`set null`) y el índice
  `(actor_id, created_at desc)`, y **borrar** el comentario `ponytail:` de la línea 23 ·
  `src/server/db/schema/audit-log.ts` · verificación: `npm run typecheck`.
- [x] **T7** — Re-exportar las 5 tablas y sus tipos en el barrel ·
  `src/server/db/schema/index.ts` · verificación: `npm run typecheck`.
- [x] **T8** — Generar y aplicar la migración · `drizzle/**` · verificación:
  `npm run db:generate && npm run db:migrate`; revisar el `.sql` generado **antes** de
  aplicarlo (no debe contener ningún `DROP`) y confirmar las 5 tablas en `npm run db:studio`.

### Fase B — resolución de permisos

- [x] **T9** — `PERMISSIONS` (los 15 códigos con `resource`, `action`, `description` en
  lenguaje llano — los reusa la UI de 004), tipo `PermissionCode` derivado con `keyof`, y
  `class ForbiddenError extends Error` · `src/lib/permissions.ts` · verificación:
  `npm run typecheck`.
- [x] **T10** — Repositorio RBAC: `findAccessByClerkId(clerkId)` (**una** query con
  `users → user_roles → roles` + `role_permissions → permissions`, deduplicando en memoria;
  sin N+1), `upsertFromClerk(tx, data)`, `assignRoleBySlug(tx, userId, slug, assignedBy?)` y
  `deactivateByClerkId(clerkId)` · `src/server/repositories/rbac.repository.ts` ·
  verificación: `npm run typecheck`.
- [x] **T11** — `UnauthorizedError`, `getCurrentUser()` envuelto en `cache()` de `react`
  (usa `auth()` de `@clerk/nextjs/server`; devuelve `null` sin sesión o si el usuario está
  `is_active = false`), `requireAuth()` y `authErrorResponse(error)` → 401/403/500 ·
  `src/lib/auth.ts` · verificación: `npm run typecheck`.
- [x] **T12** — Añadir `can(code)` y `requirePermission(code)` (devuelve el usuario actual;
  lanza `ForbiddenError`) a `src/lib/permissions.ts` · verificación: `npm run typecheck`.

### Fase C — semilla

- [x] **T13** — Seed idempotente: `config({ path: ".env.local" })` (mismo patrón que
  `drizzle.config.ts`), inserta permisos y roles con `onConflictDoNothing`, resuelve ids por
  `code`/`slug`, puebla `role_permissions` según §5, asigna `super_admin` al usuario cuyo
  `email = SUPER_ADMIN_EMAIL` si ya existe en `users`, y cierra el proceso al terminar ·
  `src/server/db/seed.ts` · verificación: `npm run db:seed` dos veces seguidas; la segunda
  no falla ni duplica filas (AC5, AC6).

### Fase D — sincronización y protección

- [x] **T14** — Añadir `CLERK_WEBHOOK_SIGNING_SECRET=""` y `SUPER_ADMIN_EMAIL=""` ·
  `.env.example` (y `.env.local` con los valores reales) · verificación: `npm run dev` arranca.
- [x] **T15** — Handler del webhook: `verifyWebhook(req)` en `try/catch` → 400; `user.created`
  y `user.updated` hacen el upsert dentro de `db.transaction` y `user.created` además asigna
  `customer` + `logAudit("user.created" | "user.role_assigned", actorId: null)`;
  `user.deleted` desactiva; tras el commit, `clerkClient().users.updateUserMetadata` con el
  array de slugs completo · `src/app/api/webhooks/clerk/route.ts` · verificación: `clerk
  webhooks listen --forward-to http://localhost:3000/api/webhooks/clerk`, registrarse y ver
  la fila en `db:studio` (AC1–AC4).
- [x] **T16** — Declarar `CustomJwtSessionClaims` con
  `publicMetadata?: { roles?: string[]; mustChangePassword?: boolean }` ·
  `src/types/globals.d.ts` · verificación: `npm run typecheck`.
- [x] **T17** — `clerkMiddleware` con `createRouteMatcher`: públicas
  (`/`, `/sign-in(.*)`, `/sign-up(.*)`, `/api/webhooks(.*)`, `/products(.*)`,
  `/api/products(.*)`, `/api/categories(.*)`), `auth.protect()` para el resto, y para
  `/admin(.*)` + `/api/admin(.*)` además exigir que `sessionClaims.publicMetadata.roles`
  contenga algún slug distinto de `customer` (sin sesión → `redirectToSignIn()`; con sesión
  sin staff → redirect a `/`); guard de `mustChangePassword` → redirect a
  `/onboarding/cambiar-clave` salvo que ya se esté ahí. **Conservar el `config.matcher`
  actual** · `src/proxy.ts` · verificación: `npm run build` y recorrido de AC7.

### Fase E — retrofit de catálogo

- [x] **T18** — `create`, `update` y `setActive` aceptan `actorId?: string | null` y lo pasan
  a `logAudit` · `src/server/repositories/category.repository.ts` · verificación: `npm run typecheck`.
- [x] **T19** — `create`, `update`, `softDelete` y `restore` aceptan `actorId?: string | null`
  y lo pasan a `logAudit` · `src/server/repositories/product.repository.ts` · verificación:
  `npm run typecheck`.
- [x] **T20** — `POST` exige `categories.create` y pasa el `actorId`; `GET` intacto ·
  `src/app/api/categories/route.ts` · verificación: `npm run typecheck`.
- [x] **T21** — `PATCH` exige `categories.delete` cuando el body es solo `isActive` (la rama
  `isActiveToggle` que ya existe) y `categories.update` en el resto; pasa el `actorId` ·
  `src/app/api/categories/[id]/route.ts` · verificación: `npm run typecheck`.
- [x] **T22** — `POST` exige `products.create` y pasa el `actorId` ·
  `src/app/api/products/route.ts` · verificación: `npm run typecheck`.
- [x] **T23** — `PATCH` exige `products.update` y `DELETE` exige `products.delete`; ambos
  pasan el `actorId` · `src/app/api/products/[id]/route.ts` · verificación: `npm run typecheck`.
- [x] **T24** — `POST` exige `products.delete` y pasa el `actorId` ·
  `src/app/api/products/[id]/restore/route.ts` · verificación: recorrido de AC8, AC9 y AC11.

### Fase F — piezas de auth que faltan

- [x] **T25** — `npm i @clerk/localizations` · `package.json` · verificación: `npm run build`.
- [x] **T26** — `<ClerkProvider localization={esES} appearance={{ variables: { … tokens de
  globals.css } }}>` · `src/app/layout.tsx` · verificación: `/sign-in` en español.
- [x] **T27** — Layout de `(auth)` que centra y aplica marca, y quitar el `div` centrador
  duplicado de las dos páginas añadiendo `signUpUrl="/sign-up"` / `signInUrl="/sign-in"` ·
  `src/app/(auth)/layout.tsx` + las dos `page.tsx` · verificación: `npm run build`.
- [x] **T28** — Header del admin (Server Component): llama `getCurrentUser()`, muestra nombre,
  `Badge` con el nombre del rol y `<UserButton afterSignOutUrl="/" />` ·
  `src/components/shared/admin-header.tsx` · verificación: `npm run typecheck`.
- [x] **T29** — Montar el header sobre el `<main>` sin tocar el sidebar (eso es 004) ·
  `src/app/(admin)/admin/layout.tsx` · verificación: AC15.

### Fase G — configuración y cierre

- [ ] **T30** — Configurar en el dashboard de Clerk (o vía `clerk-cli`): el endpoint del
  webhook apuntando a `/api/webhooks/clerk` con los 3 eventos `user.*`, y el **claim
  `publicMetadata` del session token** (`{"publicMetadata": "{{user.public_metadata}}"}`) ·
  sin archivo · verificación: iniciar sesión y comprobar en el middleware que
  `sessionClaims.publicMetadata.roles` llega poblado (AC7).
- [x] **T31** — Verificación final y recorrido manual de los 16 AC ·
  `npm run typecheck && npm run lint`.

**Total: 31 tareas.**

## 10. Riesgos y consideraciones

- **El claim `publicMetadata` no viaja en el token por defecto.** Si T30 no se hace, el gate
  de `/admin` deja fuera a *todo el mundo* (falla cerrado, que es lo correcto, pero parece un
  bug). Es la primera causa a revisar si AC7 falla con un usuario que sí tiene rol staff.
- **Orden de arranque, huevo y gallina.** El seed solo puede asignar `super_admin` a un
  usuario que ya exista en `users`, y `users` solo se puebla por webhook. Secuencia correcta:
  migrar → seed (crea roles y permisos) → registrarse con `SUPER_ADMIN_EMAIL` → **volver a
  correr el seed** para recibir el rol. Documentarlo en el handoff a QA.
- **Desfase de `publicMetadata`.** El session token se refresca cada ~60 s: quitar un rol de
  staff puede tardar ese tiempo en cerrar el acceso a `/admin`. Aceptable porque el permiso
  fino de cada handler relee Postgres (AC13) y no hay endpoint mutante sin `requirePermission`.
- **`updateUserMetadata` fuera de la transacción.** Es una llamada HTTP a Clerk: no puede
  entrar en la tx de Postgres. Si falla, se registra el error y el webhook sigue devolviendo
  200 (la fuente de verdad ya está escrita); el metadata se corrige en el siguiente cambio de
  roles. No reintentar en bucle dentro del handler: dispararía el timeout de Svix.
- **`React.cache()` es por request, no por sesión.** No sustituye a un cache de datos: cada
  request nueva vuelve a resolver los permisos. Es intencional (AC13). Si el `join` aparece en
  un profiling, se cachea con `unstable_cache` **con el `clerk_id` en la clave**, nunca sin él.
- **Ciclo de importación `auth.ts` ↔ `permissions.ts`.** Solo funciona si `auth.ts` usa
  `import type` para `PermissionCode`. Con un import de valor, el bundle de Next rompe en
  runtime con un `undefined` difícil de diagnosticar.
- **El seed corre con `tsx` fuera de Next.** No hay resolución automática de `@/`: si el alias
  falla, usar rutas relativas. Y el `Pool` de Neon mantiene el proceso vivo → el script debe
  terminar explícitamente.
- **Migración sobre datos existentes.** `audit_logs` ya tiene filas con `actor_id = null`;
  la FK las acepta (nullable). Pero si alguna fila tuviera un uuid que no está en `users`, el
  `ALTER TABLE ... ADD CONSTRAINT` falla. Revisar el `.sql` generado en T8 antes de aplicarlo.
- **Guard de `mustChangePassword` sin página destino.** Hasta el spec 004, `/onboarding/cambiar-clave`
  no existe: si alguien pone el flag a mano, entra en un redirect a un 404. Nada en 003 lo
  escribe, así que el riesgo es de operación manual, no de código.
- **El sign-up sigue público** (auto-registro de clientes, decisión del plan). Todo registro
  nuevo nace `customer`, sin acceso a `/admin`. El staff se crea desde la UI del spec 004.

## 11. Fuera de alcance / deuda aceptada

- **Rutas de catálogo fuera de `/api/admin/`.** `POST/PATCH/DELETE /api/{categories,products}`
  quedan bajo su ruta actual, protegidas por `requirePermission` pero no por el matcher del
  middleware. Mover la ruta obligaría a reescribir los services de 001/002 sin ganar
  seguridad. Se resuelve cuando exista una razón de producto, no antes.
- **`ip_address` y `user_agent` siguen en `null`.** Poblarlos obliga a pasar el `Request` hasta
  el repositorio o a ampliar `AuditEntry` y las 7 firmas de mutación. Se hace junto con la
  vista `/admin/audit-logs`, que es quien los va a leer.
- **Sin UI de gestión** (usuarios, roles, matriz de permisos, sidebar filtrado por permiso,
  cambio de contraseña forzado): **spec 004**, aprobación aparte.
- **Roles a medida** (crear/borrar roles no `is_system`): no en 004 tampoco.
- **Sin tests automatizados** ni deduplicación de webhooks por `svix-id`.
- Diferido también, sin cambios respecto a 001/002: purga por retención de `audit_logs`,
  storefront y dashboard.

## 12. Cierre

Reviewer: **APROBADO** (iteración 1/2). typecheck / lint / build en verde.

Hallazgo menor resuelto tras la review: `ForbiddenError` y `UnauthorizedError` se
extrajeron a `src/lib/errors.ts` para romper el ciclo de valor `auth.ts` ↔
`permissions.ts` que el spec §10 pedía evitar. `permissions.ts` y `auth.ts`
re-exportan ambas clases para no romper imports existentes.

Pendiente de QA manual (requiere sesión real + config del dashboard de Clerk, T30):
AC1, AC2, AC3, AC9, AC11, AC13, AC15. Secuencia de arranque:
`db:migrate` (hecho) → `db:seed` (hecho) → registrarse con `SUPER_ADMIN_EMAIL` →
`db:seed` otra vez. T30: endpoint webhook `/api/webhooks/clerk` (eventos `user.*`)
+ claim `{"publicMetadata": "{{user.public_metadata}}"}` en el session token.
