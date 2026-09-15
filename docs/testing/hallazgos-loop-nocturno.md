# Hallazgos del loop nocturno de pruebas unitarias

Bitácora para revisar de una sentada mañana. Cada entrada es un hallazgo real
que un test dejó **rojo a propósito** (skill `test-unit`: "si sale rojo, la
prueba encontró un error de verdad... NO cambies el número esperado para que
pase") o una observación documentada en un test verde sin arreglar producción
— nada de esto se tocó en `src/` fuera de los archivos `*.test.ts`.

---

## Módulo 1/7 — `src/lib/utils.ts` (DONE, 0 bugs)

Sin hallazgos. Detalle no-bug documentado en el test: `Intl.NumberFormat("es-PE")`
separa el símbolo de moneda con espacio duro (`U+00A0`), no espacio normal —
las aserciones lo declaran explícito (`const NBSP = " "`).

## Módulo 2/7 — `src/modules/storefront/schemas/storefront.schema.ts` (DONE, 1 test rojo a propósito)

**Bug real:** `listParam` (usado por el storefront público) acota la longitud
de la cadena completa (`?category=a,b,c`) pero no la de **cada elemento**
individual. El contrato equivalente del panel (`commaList` en
`product.schema.ts`) sí valida cada elemento (`.max(140)`/`.max(120)`). Un
`?category=<slug de 200 caracteres>` que matchea `slugPattern` pasa el schema
del storefront (que documenta explícitamente "un parámetro basura no puede
romper la página") y llega a `GET /api/products`, donde el schema del panel
SÍ lo rechaza → **400** → el catálogo se rompe con una URL fabricada.

- Severidad: baja (requiere URL fabricada a mano, no un flujo normal de usuario).
- Test rojo dejado a propósito: `listParam / storefrontProductsQuerySchema › drops list values longer than the products API accepts` en `src/modules/storefront/schemas/storefront.schema.test.ts`.
- Archivos involucrados: `src/modules/storefront/schemas/storefront.schema.ts:27-42`, `src/modules/products/schemas/product.schema.ts:21-39`.
- Fix sugerido (no aplicado, fuera de alcance de este loop): pasar un límite de longitud por elemento a `listParam` (como ya hace `commaList`), o alinear ambos schemas.

Quirks menores documentados en tests **verdes** (no bloqueantes, no arreglados):
- `?min=` vacío → se coerciona a `0`, no a `undefined` → `hasActiveFilters` da `true` sin filtro real puesto.
- `?q=` de solo espacios → sobrevive al trim como `""` y también cuenta como filtro activo.

## Módulo 3/7 — `src/modules/storefront/serializers.ts` (DONE, 0 bugs)

Sin hallazgos. `toProductListResponse`/`toCategoryListResponse` se comportan
como documenta el inventario; verificado con fixtures de `Date` reales
(`ProductWithCategory`, `Category`), no strings ISO a mano.

## Módulo 4/7 — `src/modules/products/schemas/product.schema.ts` (DONE, 0 bugs)

Sin hallazgos. Confirma que la asimetría del módulo 2 es real: `commaList`
(este módulo, panel) SÍ rechaza un elemento individual demasiado largo
(`.pipe(z.array(item))` con `item.max()`); `listParam` (módulo 2, storefront)
NO lo hace — es la causa exacta del bug ya documentado arriba.
Divergencia de diseño anotada (no bug): `?categorySlug=` vacío da `[]` aquí
(el repositorio lo trata como "ningún valor coincide", intencional), vs
`undefined` en el storefront.

## Módulo 5/7 — `src/server/repositories/product.repository.ts` (DONE, sin bugs bloqueantes)

Bloqueo de entorno resuelto antes de este módulo: `npm run test` ahora carga
`.env.local` (`--env-file`, nativo de Node) porque este archivo importa `db`,
que lanza sin `DATABASE_URL` aunque el test nunca haga una query real.

Sin bugs bloqueantes. Dos observaciones de diseño documentadas en tests
**verdes** (fijan el comportamiento actual, no lo cambian):
- `mapDbError` con `23505` de una constraint **desconocida** cae por defecto al
  mensaje "slug duplicado" (rama `else`). Hoy `products` solo tiene las dos
  constraints que ya contempla, así que no falla en la práctica — pero si se
  agrega otra `UNIQUE` en el futuro, el mensaje mentirá en silencio.
- `isDifferent` (compara por `JSON.stringify`) marca cambio si un `jsonb`
  trae las mismas claves en **otro orden** (`{ram,cpu}` vs `{cpu,ram}` → "cambió").
  Falla hacia el lado seguro (un `UPDATE` + auditoría de más, nunca de menos).

## Módulo 6/7 — `src/server/repositories/category.repository.ts` (DONE, 0 bugs)

Sin hallazgos bloqueantes. Observación de diseño documentada en test verde:
`buildFilters` interpola el texto de búsqueda directo en el patrón `ILIKE`
(`%...%`) — sin riesgo de inyección (es parámetro ligado), pero si el usuario
escribe `%` o `_` actúa como comodín de SQL (busca "50%" matchea de más).
Mismo patrón exacto en `product.repository.ts` — si se corrige, es en los dos.

## Módulo 7/7 — `src/server/repositories/user.repository.ts` (DONE, 0 bugs)

Sin hallazgos bloqueantes. Mismo comodín `ILIKE` sin escapar que en products/categories (tercera aparición del mismo patrón — candidato real a extraer si se corrige, ver arriba).

---

## Cierre — inventario completo

Los 7 módulos de `docs/testing/candidatas-pruebas-unitarias.md` tienen pruebas
unitarias reales. Verificado de punta a punta tras el último módulo:
`typecheck` ✓ · `lint` ✓ · `build` ✓.

```
tests 137 · pass 136 · fail 1 · todo 0
```

**Arreglado (2026-09-12).** `listParam` gana un tercer parámetro `itemMax`:
descarta también los elementos que excedan ese límite, igual que ya hacía con
el patrón — misma filosofía "degrada, no rompe" del archivo, no invalida el
parámetro entero. Call sites actualizados a los mismos límites que `commaList`
del panel: `category: listParam(560, slugPattern, 140)`,
`brand: listParam(400, undefined, 120)`. El test que había quedado en rojo a
propósito (`drops list values longer than the products API accepts`) pasa a
verde **sin haberlo tocado** — ya especificaba el comportamiento correcto.
`typecheck`/`lint`/`test`/`build` verdes: **137/137**.

**Patrón repetido en 3 módulos, candidato a extraer si se toca:** `buildFilters`
de `products`, `categories` y `users` interpola el texto de búsqueda del
usuario directo en el patrón `ILIKE`, así que `%`/`_` actúan como comodín de
SQL (sin riesgo de inyección, solo de match más amplio de lo esperado).
