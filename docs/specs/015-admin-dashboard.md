---
id: 015
title: Admin — Dashboard (métricas con auto-refresco)
status: done
module: dashboard
scope: client
---

# 015 — Admin: Dashboard

## Objetivo
Un miembro del staff con permiso abre `/admin` y ve 4 métricas de los últimos 30
días — ventas en el tiempo, pedidos por estado, top productos, aviso de stock
bajo — que se refrescan solas cada cierto tiempo sin recargar la página.

## Decisiones (resueltas con el usuario, brainstorming 2026-09-18)
- **D1 — "en vivo" = polling.** `refetchInterval` de TanStack Query (60s), sin
  websockets/SSE — el stack no tiene esa infraestructura y no se justifica para
  un dashboard de panel de bajo tráfico.
- **D2 — Las 4 métricas de `docs/SETUP.md` §6**: ventas, pedidos (por estado),
  top productos, stock bajo.
- **D3 — Ventana fija de 30 días**, sin selector de fecha en esta vuelta.
- **D4 — Umbral de stock bajo fijo (`stock <= 5`)**, constante de módulo, no
  configurable. Es un *teaser* que enlaza a la sección Inventario (próxima
  vuelta del admin) — cuando esa sección exista, decide el umbral de verdad
  (por producto, configurable); esto se realinea o se reemplaza entonces. No
  inventar aquí una configuración que la siguiente spec puede volver obsoleta.

## Alcance
Incluye: `GET /api/admin/metrics` (agrega las 4 consultas en una respuesta),
página `/admin/page.tsx` con 4 cards (una por métrica), permiso `dashboard.read`.

No incluye: selector de rango de fechas, exportar, drill-down por métrica,
configuración del umbral de stock bajo, alertas por email/push.

## Contexto verificado
- `src/app/(admin)/admin/page.tsx` **no existe** — solo hay `admin/layout.tsx`;
  es la página raíz del panel, hoy sin contenido.
- `src/app/api/admin/metrics/` solo tiene `.gitkeep`.
- `orders`/`order_items`/`products` ya existen (specs 001, 002, 010, 011); sin
  cambios de esquema.
- `order_items.productName`/`unitPriceCents` son precio y nombre **congelados**
  al momento de la compra (spec 010) — "top productos" agrupa por
  `product_id` pero lee el nombre de `order_items`, no de `products`: no hace
  falta join a `products` para esa métrica.
- `startOfLimaDay`/`endOfLimaDay` ya existen en `src/lib/utils.ts` (extraídos en
  spec 014 desde spec 012) — reutilizar para la ventana de 30 días, mismo
  criterio de zona horaria que Órdenes y Mis compras.
- `src/lib/permissions.ts` → `PERMISSIONS` no tiene ningún código `dashboard.*`.
- Recharts ya está en el stack (`docs/SETUP.md` §1/§5), sin instalar nada.
- Skill `dataviz` — **invocarla antes de escribir cualquier chart** (CLAUDE.md
  §8, mapa de skills: "Gráficos del dashboard (Recharts) → dataviz").

## Criterios de aceptación
- [x] AC1 — Un usuario con `dashboard.read` ve `/admin` con las 4 cards
      pobladas: línea de ventas, pedidos por estado, top productos, stock bajo.
- [x] AC2 — Ventas: un punto por día de los últimos 30 días (incluye días sin
      ventas como 0, no los omite), suma de `total_cents` de pedidos `paid`.
- [x] AC3 — Pedidos por estado: conteo de `pending`/`paid`/`cancelled` creados
      en los últimos 30 días.
- [x] AC4 — Top productos: hasta 5, por cantidad vendida (`SUM(qty)`) de
      líneas de pedidos `paid` en los últimos 30 días, nombre desde
      `order_items.productName`.
- [x] AC5 — Stock bajo: hasta 5 productos activos (`deleted_at IS NULL`) con
      `stock <= 5`, ordenados por stock ascendente; cada uno enlaza a su ficha
      en `/admin/products`. Sin productos bajo el umbral → estado vacío
      ("Todo con stock suficiente"), no una card rota.
- [x] AC6 — El dashboard se refresca solo cada 60s mientras la pestaña está
      abierta (sin recargar la página) — verificable por una segunda petición
      a `/api/admin/metrics` sin interacción del usuario.
- [x] AC7 — Sin `dashboard.read` → 403 en la API; `/admin` sigue accesible
      como layout pero sin las cards (o redirige a la primera sección con
      permiso — el `developer` decide el patrón ya usado por el layout admin).
- [x] AC8 — Estados de carga (skeleton) y de error (con reintento) en las 4
      cards.
- [x] AC9 — `npm run typecheck && npm run lint && npm run test && npm run build`
      en verde.

## Datos
Sin migración. `orders`, `order_items`, `products` ya existen tal cual.

## API
| Método | Ruta | Auth | Response |
|---|---|---|---|
| GET | `/api/admin/metrics` | `requirePermission('dashboard.read')` | `{ salesByDay: {date, totalCents}[], ordersByStatus: {status, count}[], topProducts: {productId, name, qty}[], lowStock: {productId, name, slug, stock}[] }` · 403 |

Sin body ni query params en esta vuelta (ventana fija, D3) — sin Zod de entrada
más allá de la ausencia de parámetros.

## Reutilizar
- `startOfLimaDay`/`endOfLimaDay` (`src/lib/utils.ts`) para la ventana de 30 días.
- `requirePermission`/`authErrorResponse` (`src/lib/auth.ts`, `src/lib/permissions.ts`).
- `formatPrice` (`src/lib/utils.ts`).
- `db` (`src/server/db/index.ts`), tipos inferidos de `src/server/db/schema`.
- Skill `dataviz` para paleta, ejes, leyendas, tooltips de los 3 charts (ventas,
  pedidos por estado, top productos) — el aviso de stock bajo es una lista, no
  un chart.
- Componentes shadcn ya instalados: `card`, `skeleton`, `badge`, `alert`.

## Tareas
- [x] T1 — `dashboard.read` en `PERMISSIONS` (`src/lib/permissions.ts`) + seed
      (se deriva solo, como `orders.read` en spec 014).
- [x] T2 — `src/server/repositories/metrics.repository.ts`: `salesByDay(from,to)`,
      `ordersByStatus(from,to)`, `topProducts(from,to,limit)`,
      `lowStockProducts(threshold,limit)` · verif: AC2-AC5.
- [x] T3 — `GET /api/admin/metrics` · `src/app/api/admin/metrics/route.ts` ·
      verif: AC1, AC7, AC9.
- [x] T4 — Módulo cliente `src/modules/dashboard/`: schema (tipos de respuesta),
      service (axios), hook `useAdminMetrics` con `refetchInterval: 60_000` ·
      verif: AC6.
- [x] T5 — Invocar skill `dataviz`, luego construir los 3 charts (ventas, pedidos
      por estado, top productos) + la card de stock bajo (lista) ·
      `src/modules/dashboard/components/` · verif: AC1-AC5.
- [x] T6 — `admin/page.tsx`: grid de las 4 cards, estados de carga/error ·
      verif: AC1, AC8.
- [x] T7 — Pruebas unitarias de cualquier función pura extraíble de
      `metrics.repository.ts` (p. ej. el cálculo de la ventana de 30 días si no
      lo cubre ya `startOfLimaDay`/`endOfLimaDay`) — si toda la lógica queda en
      SQL/agregación sin una función pura nueva, decirlo y no forzar un test
      artificial · verif: AC9.
- [x] T8 — `npm run typecheck && npm run lint && npm run test && npm run build`
      en verde.

## Implementación (2026-09-18)

`npm run typecheck` ✓ · `npm run lint` ✓ · `npm run test` ✓ (151 pruebas, 0 fallos;
147 previas + 4 nuevas) · `npm run build` ✓ (`/admin` y `/api/admin/metrics` como
`ƒ`). Sin migración: `drizzle/` intacto.

Archivos:
- `src/lib/permissions.ts` — `dashboard.read` (recurso `dashboard`). El seed
  deriva los códigos de `PERMISSIONS`, así que no hubo nada que tocar en
  `seed.ts`: basta **volver a correr `npm run db:seed`** para que
  `super_admin`/`admin` lo reciban. El resto de roles de sistema se conceden
  desde `/admin/roles`.
- `src/modules/roles/components/role-permission-matrix.tsx` — etiqueta «Tablero»
  para el recurso nuevo (si no, la matriz muestra `dashboard` en crudo).
- `src/lib/utils.ts` — `limaDay(at?)`: el día local de Lima en `YYYY-MM-DD`
  (`Intl` con `en-CA`, que da justo ese formato). Es la pieza que faltaba junto a
  `startOfLimaDay`/`endOfLimaDay` para cerrar la ventana en zona Lima.
- `src/modules/dashboard/types/metrics.types.ts` — contrato de la respuesta.
  Vive en el módulo cliente y lo importa el repositorio con `import type` (se
  borra al compilar), igual que `order.repository` importa su query de
  `orders-admin`: una sola definición, sin DTO duplicado.
- `src/server/repositories/metrics.repository.ts` — `salesByDay`,
  `ordersByStatus`, `topProducts`, `lowStockProducts` y `getDashboardMetrics`
  (las cuatro en `Promise.all` sobre **una** ventana común: calcularla por
  consulta dejaría dos cards midiendo días distintos). Constantes de módulo
  `WINDOW_DAYS = 30` (D3) y `LOW_STOCK_THRESHOLD = 5` (D4). Agrupación por
  `to_char(created_at at time zone 'America/Lima', 'YYYY-MM-DD')`, no por UTC.
  `topProducts` no hace join a `products`: agrupa por `product_id` y lee
  `max(product_name)` de `order_items` (nombre congelado, spec 010; el `max` es
  por si el catálogo renombró el producto después de la venta).
- `src/server/repositories/metrics.repository.test.ts` — `windowDays` (longitud,
  extremos, cruce de mes) y `fillSalesSeries` (día sin ventas ⇒ 0, orden de la
  ventana, filas fuera de ventana ignoradas). T7 sí tenía función pura que
  extraer: el relleno de AC2 y el cálculo de los 30 días.
- `src/app/api/admin/metrics/route.ts` — `requirePermission('dashboard.read')` →
  repositorio. Sin Zod de entrada porque no hay entrada (D3, ventana fija).
- `src/modules/dashboard/services/metrics.service.ts` y
  `hooks/use-admin-metrics.ts` — axios + `useQuery` con
  `refetchInterval: 60_000` (AC6, D1).
- `src/modules/dashboard/constants.ts` — cromo compartido de los charts
  (color de serie, ejes recesivos, tooltip temado, formateadores de fecha Lima y
  de precio compacto).
- `src/modules/dashboard/components/` — `sales-chart.tsx` (línea),
  `orders-status-chart.tsx` (columnas), `top-products-chart.tsx` (barras
  horizontales), `low-stock-list.tsx` (lista), `empty-metric.tsx` (hueco vacío
  común) y `metrics-dashboard.tsx` (el único `"use client"` del árbol: hook +
  grid de 4 cards + skeleton + error con «Reintentar»).
- `src/app/(admin)/admin/page.tsx` — Server Component con `can('dashboard.read')`.
- `src/components/shared/admin-nav.tsx` — entrada «Tablero» → `/admin`, filtrada
  por `dashboard.read` (antes no había ningún enlace a la portada del panel).
- `src/app/globals.css` — `--chart-1` pasa de gris a azul (`#2a78d6` claro /
  `#3987e5` oscuro).

Decisiones de implementación:
- **AC7 — `/admin` no hace `notFound()`**, a diferencia de las secciones
  (`/admin/orders`, `/admin/products`). Es la portada del panel: devolver 404 ahí
  dejaría sin puerta de entrada a un miembro del staff que sí tiene otros
  permisos. Se renderiza el marco (header + sidebar con sus secciones) y, en
  lugar de las cards, un aviso que remite al menú lateral. Tampoco redirige a
  «la primera sección con permiso»: esa regla obliga a mantener un orden de
  preferencia entre secciones que hoy no existe en ningún sitio. La API sigue
  respondiendo **403** sin el permiso, que es la defensa real.
- **Skill `dataviz`** (obligatoria por el spec y CLAUDE.md §8): una sola serie por
  chart y la identidad en el eje ⇒ no hace falta paleta categórica ni leyenda
  (la regla es «leyenda solo con 2+ series»). El azul se tomó de la paleta de
  referencia de la skill y se validó con `scripts/validate_palette.js` **contra
  las superficies reales del proyecto** (`--card`: `#ffffff` en claro,
  `#343434` en oscuro): banda de luminosidad, croma y contraste ≥ 3:1 pasan en
  ambos modos. El paso oscuro es propio, no el claro invertido. Aplicado además:
  gridlines hairline sin verticales, ejes sin línea ni marcas en tinta
  `muted-foreground`, línea de 2px sin puntos con `activeDot` de 4px y anillo de
  2px del color de la superficie, barras de 24px máximo con extremo redondeado
  de 4px, etiquetas directas en las barras (no en los 30 puntos de la línea),
  tooltip temado con el valor por delante y el texto siempre en tokens de texto,
  nunca en el color de la serie. Sin eje secundario en ningún chart.
- **Total de la ventana como cifra principal** de la card de ventas: la línea
  cuenta la forma, y leer el total del eje es adivinar.
- **Estados vacíos por card** (`empty-metric.tsx`): sin pedidos, sin ventas y
  «Todo con stock suficiente» (AC5) ocupan el mismo alto que el chart, así el
  grid no salta cuando una métrica se queda sin datos.
- **`ordersByStatus` rellena los tres estados** desde `orderStatus.enumValues`:
  un estado sin pedidos vale 0, no desaparece del eje (mismo criterio que AC2).

Pendiente de QA manual (necesita BD y sesión reales):
- `npm run db:seed` para sembrar `dashboard.read` y concederlo desde
  `/admin/roles` a los roles que toque.
- AC1-AC5 con datos reales, incluido el caso de 30 días con huecos (la línea no
  debe cortarse) y un pedido creado a las 20:00 hora Lima (debe caer en su día,
  no en el siguiente).
- AC6: dejar `/admin` abierta y confirmar en la pestaña de red una segunda
  petición a `/api/admin/metrics` al minuto, sin recargar.
- AC7 con un usuario del staff **sin** `dashboard.read`: 403 en la API, `/admin`
  con el aviso y sin la entrada «Tablero» en el sidebar.
- Paso 7 de `dataviz` («renderízalo y míralo»): revisar en pantalla, en claro y
  en oscuro, que no se solapen las marcas del eje X de 30 días ni las etiquetas
  de los nombres largos de producto.
- AC5, matiz: el admin **no tiene ficha por producto** (`/admin/products/[id]`
  no existe; la edición es un `Dialog` sobre la tabla, y la tabla guarda sus
  filtros en `useState`, no en la URL). Cada ítem de stock bajo enlaza a
  `/admin/products` a secas. Llevar el filtro a la URL para poder enlazar al
  producto concreto es trabajo de la sección Inventario, no de este spec.

## Notas
- **Días sin ventas = 0, no ausentes** (AC2): si se arma la serie con un
  `GROUP BY date_trunc('day', ...)` plano, un día sin pedidos `paid` no
  produce fila — hay que rellenar los 30 días en el servidor o el chart
  (`dataviz` puede guiar cuál de los dos) para que la línea no se vea
  entrecortada.
- **Zona horaria**: agrupar por día en `America/Lima`, no UTC — mismo cuidado
  que specs 012/014 (un pedido de las 20:00 Lima no debe caer en el día
  siguiente).
- **Umbral de stock bajo es deuda declarada** (D4): fijo hoy, la sección
  Inventario (próxima vuelta) decide si se vuelve configurable.

## Cierre

Reviewer: **APROBADO** iteración 1/2 (tope de 5 rondas de `subagent-driven-development`,
no se necesitó ninguna). typecheck / lint / test (151/151) / build — verdes,
corridos por el propio reviewer.

Hallazgos menores, no bloqueantes:
- La afirmación de haber corrido `scripts/validate_palette.js` no se pudo
  verificar mecánicamente (el script no existe en el repo) — el reviewer
  verificó el contraste de los colores declarados de forma independiente y dio
  correcto, pero para specs futuras conviene adjuntar la salida real del
  validador, no solo afirmarlo.
- Los enlaces de "stock bajo" van a `/admin/products` sin deep-link al producto
  (no existe `/admin/products/[id]` ni filtros en la URL del listado hoy) —
  aceptable, consistente con el resto del admin; si se quiere el deep-link
  real, es trabajo natural de la sección Inventario (spec 016).

Pendiente de QA manual (necesita BD y sesión real): `npm run db:seed` para que
`dashboard.read` llegue a `super_admin`/`admin`; recorrido de AC1-AC5 con datos
reales (un pedido de las 20:00 Lima, una ventana de 30 días con huecos);
AC6 en la pestaña de red; AC7 con un usuario sin el permiso; revisión visual del
render en claro y oscuro (colisión de marcas de eje).
