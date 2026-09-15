import { api } from "@/lib/axios";

import type { RoleDetailDto, RoleDto } from "../types/role.types";

const RESOURCE = "/admin/roles";

export async function listRoles(): Promise<RoleDto[]> {
  const { data } = await api.get<RoleDto[]>(RESOURCE);
  return data;
}

export async function getRole(id: string): Promise<RoleDetailDto> {
  const { data } = await api.get<RoleDetailDto>(`${RESOURCE}/${id}`);
  return data;
}

export async function setRolePermissions(
  id: string,
  permissionCodes: string[],
): Promise<RoleDetailDto> {
  const { data } = await api.patch<RoleDetailDto>(
    `${RESOURCE}/${id}/permissions`,
    { permissionCodes },
  );
  return data;
}
