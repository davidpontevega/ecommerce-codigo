// Swatches decorativos del diseño: no hay atributo de color en `products`,
// así que no pretenden filtrar nada.
const COLORS = [
  "oklch(0.55 0.2 264)",
  "oklch(0.72 0.17 60)",
  "oklch(0.65 0.19 150)",
  "oklch(0.6 0.22 20)",
  "oklch(0.78 0.13 195)",
];

export function PopularColorsCard() {
  return (
    <section className="border-storefront-border bg-storefront-card rounded-[26px] border px-6 py-5">
      <h2 className="mb-4 text-sm font-semibold">Colores populares</h2>
      <div aria-hidden className="flex gap-3">
        {COLORS.map((color) => (
          <span
            key={color}
            className="size-8 rounded-full"
            style={{ background: color }}
          />
        ))}
      </div>
    </section>
  );
}
