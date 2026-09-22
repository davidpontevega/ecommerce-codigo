import { z } from "zod";

export const productSortFields = [
  "name",
  "priceCents",
  "stock",
  "createdAt",
  "updatedAt",
  // Expresión, no columna: `(compare - price) / compare` con `coalesce` en el
  // repositorio. La tabla del panel no tiene cabecera para él (spec 006 §10).
  "discount",
] as const;

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Multi-valor por coma y no parámetro repetido: la query se lee con
 * `Object.fromEntries(searchParams)`, que se queda con el **último** valor de
 * una clave repetida y perdería filtros en silencio.
 */
export function commaList(max: number, item: z.ZodString) {
  return z
    .string()
    .trim()
    .max(max)
    .transform((value) =>
      value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean),
    )
    .pipe(z.array(item))
    .optional();
}

export const productQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  categoryId: z.uuid().optional(),
  categorySlug: commaList(560, z.string().max(140).regex(slugPattern)),
  brand: commaList(400, z.string().max(120)),
  // `z.stringbool()` y no `z.coerce.boolean()`: `Boolean("false") === true`
  // haría que `onSale=false` filtrara igual que `onSale=true`.
  onSale: z.stringbool().optional(),
  inStock: z.stringbool().optional(),
  // El storefront solo publica productos de categorías activas (spec 005 AC5);
  // ausente = sin filtro, así el panel no cambia de comportamiento.
  categoryActive: z.stringbool().optional(),
  status: z.enum(["available", "deleted", "all"]).default("available"),
  minPriceCents: z.coerce.number().int().min(0).optional(),
  maxPriceCents: z.coerce.number().int().min(0).optional(),
  // Tope de existencias para la vista de Inventario (spec 016): el toggle
  // "solo stock bajo" lo fija al umbral. Ausente = sin filtro.
  maxStock: z.coerce.number().int().min(0).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(productSortFields).default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

const productFields = z.object({
  categoryId: z.uuid("Selecciona una categoría"),
  sku: z.string().trim().min(2, "Mínimo 2 caracteres").max(60),
  name: z.string().trim().min(2, "Mínimo 2 caracteres").max(160),
  slug: z
    .string()
    .trim()
    .min(2, "Mínimo 2 caracteres")
    .max(180)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Solo minúsculas, números y guiones"),
  description: z.string().trim().max(2000).nullish(),
  // Sin `z.coerce`: el body es JSON y trae números; el formulario los convierte
  // con `valueAsNumber`. Coercionar aquí volvería `unknown` el tipo de entrada.
  priceCents: z
    .number("El precio es obligatorio")
    .int()
    .positive("El precio debe ser mayor a 0"),
  compareAtPriceCents: z.number().int().positive().nullish(),
  // Costo unitario en centavos (spec 019 D4). Opcional y sin `.default()`: en un
  // PATCH parcial un default lo pondría a 0, que no es lo mismo que "sin dato".
  costCents: z
    .number()
    .int("El costo va en centavos enteros")
    .positive("El costo debe ser mayor a 0")
    .nullish(),
  stock: z.number("El stock es obligatorio").int().min(0).default(0),
  brand: z.string().trim().max(120).nullish(),
  specs: z.record(z.string(), z.string()).nullish(),
  weightGrams: z.number().int().positive().nullish(),
  imageUrl: z.url("URL inválida").nullish(),
});

// Un precio tachado que no supera al de venta no es un descuento, es un error de captura.
export const comparePriceIsHigher = (value: {
  priceCents?: number;
  compareAtPriceCents?: number | null;
}) =>
  value.compareAtPriceCents == null ||
  value.priceCents == null ||
  value.compareAtPriceCents > value.priceCents;

const comparePriceError = {
  message: "Debe ser mayor que el precio",
  path: ["compareAtPriceCents"],
};

export const productCreateSchema = productFields.refine(
  comparePriceIsHigher,
  comparePriceError,
);

// `stock` se redeclara sin `.default()`: verificado que un default sobrevive a
// `.partial()` en Zod 4, así que `PATCH { name }` pondría el stock a 0 en silencio
// y `PATCH {}` se materializaría como `{ stock: 0 }`, burlando el refine de abajo.
export const productUpdateSchema = productFields
  .extend({ stock: z.number().int().min(0) })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Sin cambios que aplicar")
  .refine(comparePriceIsHigher, comparePriceError);

export const productIdSchema = z.uuid();

export type ProductQueryInput = z.infer<typeof productQuerySchema>;

/** Guarda el `sortBy` que llega de la cabecera de la tabla dentro del enum. */
export function isProductSortField(
  value: string,
): value is ProductQueryInput["sortBy"] {
  return (productSortFields as ReadonlyArray<string>).includes(value);
}

export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
export type ProductFormValues = z.input<typeof productCreateSchema>;
