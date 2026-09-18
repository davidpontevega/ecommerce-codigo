import { getCurrentUser } from "@/lib/auth";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import type { UserAccess } from "@/server/repositories/rbac.repository";

/**
 * Catálogo de permisos del dominio. Nace en el código y se siembra en la tabla
 * `permissions` (`db:seed`); los roles se componen desde la UI. La verificación
 * siempre es por `code`, nunca por nombre de rol.
 */
export const PERMISSIONS = {
  "categories.read": {
    resource: "categories",
    action: "read",
    description: "Ver el listado y el detalle de categorías",
  },
  "categories.create": {
    resource: "categories",
    action: "create",
    description: "Crear categorías nuevas",
  },
  "categories.update": {
    resource: "categories",
    action: "update",
    description: "Editar los datos de una categoría",
  },
  "categories.delete": {
    resource: "categories",
    action: "delete",
    description: "Desactivar o reactivar una categoría",
  },
  "products.read": {
    resource: "products",
    action: "read",
    description: "Ver el listado y el detalle de productos",
  },
  "products.create": {
    resource: "products",
    action: "create",
    description: "Crear productos nuevos",
  },
  "products.update": {
    resource: "products",
    action: "update",
    description: "Editar los datos de un producto",
  },
  "products.delete": {
    resource: "products",
    action: "delete",
    description: "Eliminar y restaurar productos",
  },
  "users.read": {
    resource: "users",
    action: "read",
    description: "Ver el listado y el detalle de usuarios",
  },
  "users.create": {
    resource: "users",
    action: "create",
    description: "Dar de alta usuarios del personal",
  },
  "users.update": {
    resource: "users",
    action: "update",
    description: "Editar los datos y el estado de un usuario",
  },
  "users.assign_roles": {
    resource: "users",
    action: "assign_roles",
    description: "Asignar y revocar roles de un usuario",
  },
  "orders.read": {
    resource: "orders",
    action: "read",
    description: "Ver el listado y el detalle de pedidos",
  },
  "roles.read": {
    resource: "roles",
    action: "read",
    description: "Ver los roles y su matriz de permisos",
  },
  "roles.update_permissions": {
    resource: "roles",
    action: "update_permissions",
    description: "Cambiar los permisos que otorga un rol",
  },
  "audit.read": {
    resource: "audit",
    action: "read",
    description: "Consultar la bitácora de auditoría",
  },
} as const;

export type PermissionCode = keyof typeof PERMISSIONS;

export { ForbiddenError, UnauthorizedError } from "@/lib/errors";

export async function can(code: PermissionCode): Promise<boolean> {
  const user = await getCurrentUser();

  return user?.permissions.includes(code) ?? false;
}

/**
 * Guard de los Route Handlers. Devuelve el usuario para propagar su `id` como
 * `actorId` de la bitácora. Lanza; el handler traduce con `authErrorResponse`.
 */
export async function requirePermission(
  code: PermissionCode,
): Promise<UserAccess> {
  const user = await getCurrentUser();

  if (!user) {
    throw new UnauthorizedError();
  }

  if (!user.permissions.includes(code)) {
    throw new ForbiddenError(code);
  }

  return user;
}
