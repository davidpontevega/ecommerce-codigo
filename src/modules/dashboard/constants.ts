/**
 * Cromo compartido por los tres charts (skill `dataviz`): una sola serie por
 * chart, así la identidad la da el eje y no hace falta leyenda ni paleta
 * categórica. Los colores salen de los tokens del tema para que el modo oscuro
 * sea un paso propio y no un inverso automático.
 */
export const SERIES_COLOR = "var(--color-chart-1)";
export const GRID_COLOR = "var(--color-border)";
/** El anillo de 2px que separa el marcador de la línea que cruza. */
export const SURFACE_COLOR = "var(--color-card)";

/** Ejes recesivos: sin línea de eje ni marcas, tinta apagada. */
export const AXIS_PROPS = {
  tickLine: false,
  axisLine: false,
  tick: { fill: "var(--color-muted-foreground)", fontSize: 12 },
} as const;

export const TOOLTIP_PROPS = {
  contentStyle: {
    background: "var(--color-popover)",
    color: "var(--color-popover-foreground)",
    border: "1px solid var(--color-border)",
    borderRadius: "0.5rem",
    fontSize: "0.75rem",
    padding: "0.5rem 0.75rem",
  },
  labelStyle: { color: "var(--color-muted-foreground)" },
  itemStyle: { color: "var(--color-popover-foreground)" },
} as const;

const shortDayFormatter = new Intl.DateTimeFormat("es-PE", {
  day: "numeric",
  month: "short",
  timeZone: "America/Lima",
});

const longDayFormatter = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "long",
  timeZone: "America/Lima",
});

export const shortLimaDay = (at: Date) => shortDayFormatter.format(at);
export const longLimaDay = (at: Date) => longDayFormatter.format(at);

// El eje no aguanta "S/ 12,345.00" en cada marca; el valor exacto vive en el
// tooltip y en el total de la card.
const compactFormatter = new Intl.NumberFormat("es-PE", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function compactPrice(cents: number): string {
  return `S/ ${compactFormatter.format(cents / 100)}`;
}
