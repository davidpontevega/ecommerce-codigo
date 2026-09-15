# Diseño del storefront

Fuentes del lienzo publicado en
<https://claude.ai/code/artifact/9a141e37-b39d-4732-b0bf-3347d07ed304>.

**No es código de la app.** Son archivos `.dc.html` del editor de Claude Design:
HTML con `{{ holes }}`, `<sc-for>`, `<sc-if>` y `<dc-import>`, más una clase
`Component extends DCLogic` al final de cada archivo. Sirven como referencia
visual y de comportamiento; la implementación real va en `src/` siguiendo
`docs/SETUP.md`.

| Archivo            | Qué es                                                    |
| ------------------ | --------------------------------------------------------- |
| `Main.dc.html`     | Landing desktop 1440×900, bento, hero-carousel de ofertas |
| `Catalogo.dc.html` | Lista de productos con filtros a la izquierda, 1440×900   |
| `Mobile.dc.html`   | Landing mobile 390×844                                    |
| `Photo.dc.html`    | Componente de foto compartido, una rama por producto      |
| `canvas.json`      | Posición de cada artboard y las notas del lienzo          |
| `img/`             | Fotos de `products.image_url` del seed, ya descargadas    |

## Decisiones que hay que trasladar

- **Tokens.** El diseño se despega de `globals.css`: radio 26–28 px en tarjetas
  y 999 px en píldoras (contra `--radius: 0.625rem`), fondo con gradiente de
  croma ≤ 0.018, sin bordes (la separación la hace la sombra). Hay que decidir
  si se mueve `--radius` y se agregan `--page` / `--sunk` / `--accent`.
- **Acento.** Lima `#d7f24a` con texto `#12160a`. Cada acento viaja con su color
  de texto porque el contraste no se puede calcular en CSS. Las otras opciones
  están en la constante `ACCENTS` de cada artboard.
- **Precios.** Cada artboard replica `formatCents` de `src/lib/format.ts`. En la
  app se importa el original, no se copia.
- **Animación.** Los `@keyframes` son un mapa 1:1 a `motion.dev`; la
  equivalencia está en la nota "MOTION" del lienzo y en los comentarios de cada
  archivo. El truco de dos keyframes con nombre alterno (`sl-a` / `sl-b`) existe
  solo en el lienzo: en React se resuelve con `AnimatePresence` y una `key`.
- **Datos.** Productos, precios, marcas y stock salen de `src/server/db/seed.ts`.
  Son 7 productos reales, por eso la grilla no llena filas parejas.
- **`tech.`** es un logotipo de trabajo, no la marca definitiva.

## Abrir o editar

Los `.dc.html` no se abren en el navegador por su cuenta: necesitan el runtime
del lienzo. Para verlos, usá el link de arriba. Para regenerar el lienzo desde
estos archivos hace falta la skill `/design` de Claude Code, que arma el HTML
publicable a partir de los artboards, `canvas.json` y las imágenes.
