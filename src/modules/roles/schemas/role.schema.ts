import { z } from "zod";

export const roleIdSchema = z.uuid();

/** Un array vacío es válido: un rol puede quedarse sin permisos. */
export const rolePermissionsSchema = z.object({
  permissionCodes: z.array(z.string()).max(50),
});

export type RolePermissionsInput = z.infer<typeof rolePermissionsSchema>;
