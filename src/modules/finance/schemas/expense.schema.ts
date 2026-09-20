import { z } from "zod";

export const expenseSortFields = ["date", "amountCents", "createdAt"] as const;

/**
 * `from`/`to` son días en `YYYY-MM-DD` y se comparan contra `expenses.date`,
 * que ya es una columna `date`: aquí no hay offset que aplicar, a diferencia de
 * los pedidos (spec 014).
 */
export const expenseQuerySchema = z
  .object({
    search: z.string().trim().max(100).optional(),
    category: z.string().trim().max(60).optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
    sortBy: z.enum(expenseSortFields).default("date"),
    sortDir: z.enum(["asc", "desc"]).default("desc"),
  })
  // `YYYY-MM-DD` ordena igual lexicográfica que cronológicamente.
  .refine((range) => !range.from || !range.to || range.from <= range.to, {
    message: "El rango termina antes de empezar",
    path: ["to"],
  });

const expenseFields = z.object({
  concept: z.string().trim().min(2, "Mínimo 2 caracteres").max(160),
  // Sin `z.coerce`: el body es JSON y trae números; el formulario los convierte
  // con `valueAsNumber`. Coercionar volvería `unknown` el tipo de entrada.
  amountCents: z
    .number("El monto es obligatorio")
    .int("El monto va en centavos enteros")
    .positive("El monto debe ser mayor a 0"),
  date: z.iso.date("Fecha inválida"),
  category: z.string().trim().max(60).nullish(),
});

export const expenseCreateSchema = expenseFields;

// Ningún campo lleva `.default()`: un default sobrevive a `.partial()` y haría
// que `PATCH { concept }` reescribiera en silencio el resto de la fila.
export const expenseUpdateSchema = expenseFields
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Sin cambios que aplicar");

export const expenseIdSchema = z.uuid();

export type ExpenseQueryInput = z.infer<typeof expenseQuerySchema>;
export type ExpenseCreateInput = z.infer<typeof expenseCreateSchema>;
export type ExpenseUpdateInput = z.infer<typeof expenseUpdateSchema>;
export type ExpenseFormValues = z.input<typeof expenseCreateSchema>;

/** Guarda el `sortBy` que llega de la cabecera de la tabla dentro del enum. */
export function isExpenseSortField(
  value: string,
): value is ExpenseQueryInput["sortBy"] {
  return (expenseSortFields as ReadonlyArray<string>).includes(value);
}
