import { z } from "zod";

export const categorySortFields = ["name", "createdAt", "updatedAt"] as const;

export const categoryQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(["active", "inactive", "all"]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z.enum(categorySortFields).default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(2, "Mínimo 2 caracteres").max(120),
  slug: z
    .string()
    .trim()
    .min(2, "Mínimo 2 caracteres")
    .max(140)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Solo minúsculas, números y guiones"),
  description: z.string().trim().max(1000).nullish(),
  isActive: z.boolean().default(true),
});

// `isActive` se redeclara sin `.default()`: un default sobrevive a `.partial()` y
// haría que `PATCH {}` se materialice como `{ isActive: true }`, reactivando en
// silencio una categoría desactivada al editar cualquier otro campo.
export const categoryUpdateSchema = categoryCreateSchema
  .extend({ isActive: z.boolean() })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Sin cambios que aplicar");

export const categoryIdSchema = z.uuid();

export type CategoryQueryInput = z.infer<typeof categoryQuerySchema>;
export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;
export type CategoryFormValues = z.input<typeof categoryCreateSchema>;
