import type { User } from "@/server/db/schema";

export type { User };

/** Rol tal y como lo pinta la UI: sin fechas ni `isSystem`. */
export type UserRoleRef = { id: string; slug: string; name: string };

/**
 * Lo que realmente recibe el cliente: `NextResponse.json` serializa las
 * columnas `timestamptz` a string ISO, no a `Date`.
 */
export type UserDto = Omit<User, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
  roles: UserRoleRef[];
};

export type UserListResponse = {
  data: UserDto[];
  total: number;
  page: number;
  pageSize: number;
};

/** La contraseña temporal se muestra una sola vez y no se guarda en ningún sitio. */
export type UserCreatedResponse = {
  user: UserDto;
  temporaryPassword: string;
};
