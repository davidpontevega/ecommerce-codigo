import { z } from "zod";

export const userSortFields = ["createdAt", "email", "firstName"] as const;

export const userQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(["active", "inactive", "all"]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z.enum(userSortFields).default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

export const userCreateSchema = z.object({
  firstName: z.string().trim().min(2, "Mínimo 2 caracteres").max(80),
  lastName: z.string().trim().max(80).nullish(),
  email: z.email("Correo electrónico inválido"),
  roleIds: z.array(z.uuid()).min(1, "Selecciona al menos un rol"),
});

export const userStatusSchema = z.object({ isActive: z.boolean() });

export const userRolesSchema = z.object({
  roleIds: z.array(z.uuid()).min(1, "Selecciona al menos un rol"),
});

export const userIdSchema = z.uuid();

export type UserQueryInput = z.infer<typeof userQuerySchema>;
export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserStatusInput = z.infer<typeof userStatusSchema>;
export type UserRolesInput = z.infer<typeof userRolesSchema>;
export type UserFormValues = z.input<typeof userCreateSchema>;
