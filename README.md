# E-commerce Tech

Tienda de tecnología — storefront + panel de administración. Next.js 16, React 19,
TypeScript estricto, Neon Postgres + Drizzle, Clerk, Stripe Checkout.

Documentación de arranque y arquitectura completa: **[docs/SETUP.md](docs/SETUP.md)**.

---

## Cómo se construye este proyecto: SDD

Este repo se desarrolla con **Spec-Driven Development (SDD)**: antes de escribir
código, el requerimiento se convierte en un **spec** escrito — contexto verificado
contra el código real, criterios de aceptación, modelo de datos, contratos de API,
tareas atómicas — que vive en `docs/specs/NNN-slug.md` y queda como documentación
permanente de por qué el código es como es, no solo qué hace.

```
Prompt del usuario
        │
        ▼
  ┌──────────────┐
  │ orchestrator │  clasifica cada petición: ¿spec (SDD) o cambio directo (BUILD)?
  └──────┬───────┘
         │
   ┌─────┴──────────────────────────────┐
   │                                    │
 MODO: SDD                          MODO: BUILD
   │                                    │
   ▼                                    ▼
 spec ──► ⏸ APROBACIÓN HUMANA ──► developer ⇄ reviewer ──► done
                                                 (bucle, máx. 3 iteraciones)
```

- **`orchestrator`** clasifica cada petición antes de tocar código: una feature
  nueva, un cambio de modelo de datos o de contrato de API pasa por spec; un fix
  puntual de un archivo, acotado y sin ambigüedad, se ejecuta directo.
- **`spec`** entiende el requerimiento, lee el código actual (nunca asume), y
  escribe el spec con tareas atómicas. **Se detiene y espera aprobación humana
  explícita** — ningún código se escribe sobre un spec sin aprobar.
- **`developer`** implementa las tareas del spec aprobado, reutilizando lo que ya
  existe antes de crear algo nuevo.
- **`reviewer`** audita la implementación contra el spec y la arquitectura del
  proyecto; si encuentra hallazgos bloqueantes, vuelven al `developer`. Máximo 3
  vueltas antes de escalar a una persona.

`docs/specs/` es la documentación viva del proyecto: cada feature construida deja
su spec con las decisiones tomadas y por qué — es la fuente para entender el
diseño, no el historial de commits.

## Reglas al usar IA como fuente de verdad del código

- **El código y los specs, no la memoria del modelo, son la fuente de verdad.**
  Antes de proponer una implementación se lee el archivo real; un spec que
  afirma algo del repo lo cita con `archivo:línea`.
- **Arquitectura no negociable**: `docs/SETUP.md` define la estructura de
  carpetas y el flujo de datos (componente → hook → service → Route Handler →
  repositorio → Drizzle → Postgres). Un componente nunca importa `db` ni un
  repositorio directo; toda consulta a base de datos vive en
  `src/server/repositories/`.
- **Puerta de aprobación humana**: ningún spec pasa de `draft` a `approved` sin
  que una persona lo confirme explícitamente. La IA no se autoaprueba.
- **Auditoría, no confianza ciega**: cada mutación relevante escribe en
  `audit_logs` dentro de la misma transacción; permisos se verifican por código
  (`requirePermission('products.create')`), nunca comparando nombres de rol en
  el código.
- **Skills sobre memoria**: antes de resolver con conocimiento del modelo, se
  revisa si hay una skill instalada que traiga documentación vigente del stack
  (Next.js, Clerk, Stripe, etc.) — la memoria del modelo se desactualiza, la
  skill no.
- **Pruebas unitarias con criterio, no de relleno**: solo se prueban funciones
  puras (sin I/O); ver `docs/testing/candidatas-pruebas-unitarias.md` para el
  inventario y `docs/SETUP.md` §3 para la convención de archivos. Un test rojo
  que encuentra un bug real **no se maquilla para que pase** — se documenta
  (`docs/testing/hallazgos-loop-nocturno.md`) y se corrige el código, no la
  aserción.

## Arranque rápido

```bash
npm install
npm run dev          # servidor de desarrollo
npm run typecheck && npm run lint && npm run test   # verificación antes de cerrar cualquier tarea
```

Variables de entorno y checklist completo de arranque: [docs/SETUP.md](docs/SETUP.md).
