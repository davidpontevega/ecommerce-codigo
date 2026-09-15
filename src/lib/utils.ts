import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Un único formateador para tienda y panel: dos mostrarían cifras distintas del
// mismo entero. `es-PE` da `S/ 5,499.00` (coma de millares, punto decimal), la
// convención peruana.
const priceFormatter = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
})

/** Los precios viajan en centavos; el formateo es la única división por 100. */
export function formatPrice(cents: number): string {
  return priceFormatter.format(cents / 100)
}

/** Mismo texto de stock en tarjeta, ficha y buscador. */
export function stockNote(stock: number): string {
  return stock > 0 ? `${stock} en stock` : "Agotado"
}

/** `null` cuando no hay descuento real que anunciar. */
export function discountPercent(
  priceCents: number,
  compareAtCents: number | null | undefined,
): number | null {
  if (!compareAtCents || compareAtCents <= priceCents) {
    return null
  }

  return Math.round(((compareAtCents - priceCents) / compareAtCents) * 100)
}
