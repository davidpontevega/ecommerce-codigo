import type { Role } from "@/server/db/schema";

export type { Role };

/** Un permiso del catálogo con su estado en el rol que se está mirando. */
export type RolePermissionRef = {
  code: string;
  resource: string;
  action: string;
  description: string | null;
  granted: boolean;
};

type SerializedRole = Omit<Role, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

export type RoleDto = SerializedRole & { userCount: number };

export type RoleDetailDto = SerializedRole & {
  permissions: RolePermissionRef[];
};
