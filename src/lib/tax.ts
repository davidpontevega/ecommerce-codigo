/**
 * IGV peruano y margen unitario (spec 019). Los precios del catálogo y los
 * totales de los pedidos **ya incluyen** el impuesto: de ahí que todo se
 * despeje sobre el bruto (`/118`) y no se sume sobre el neto.
 *
 * Funciones puras y en centavos enteros: el redondeo ocurre aquí, una vez, y
 * nunca en un repositorio ni en un componente.
 */

export const IGV_RATE_PERCENT = 18;

const GROSS_PERCENT = 100 + IGV_RATE_PERCENT;

/** Impuesto contenido en un importe que ya lo incluye. */
export function igvFromGross(grossCents: number): number {
  return Math.round((grossCents * IGV_RATE_PERCENT) / GROSS_PERCENT);
}

/** El mismo importe sin el impuesto que lleva dentro. */
export function netFromGross(grossCents: number): number {
  return Math.round((grossCents * 100) / GROSS_PERCENT);
}

export type UnitMargin = {
  priceNetCents: number;
  /** `null` cuando el producto no tiene costo cargado: es "sin dato", no cero. */
  marginCents: number | null;
  /** Proporción sobre el precio neto (`0.5` = 50 %). Puede ser negativa. */
  marginPercent: number | null;
};

export function unitMargin(
  priceCents: number,
  costCents: number | null,
): UnitMargin {
  const priceNetCents = netFromGross(priceCents);

  if (costCents === null) {
    return { priceNetCents, marginCents: null, marginPercent: null };
  }

  const marginCents = priceNetCents - costCents;

  return {
    priceNetCents,
    marginCents,
    // Un precio neto de 0 no admite porcentaje: dividir daría ±Infinity o NaN.
    marginPercent: priceNetCents === 0 ? null : marginCents / priceNetCents,
  };
}
