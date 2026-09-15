import { api } from "@/lib/axios";

import type {
  UserCreateInput,
  UserQueryInput,
} from "../schemas/user.schema";
import type {
  UserCreatedResponse,
  UserDto,
  UserListResponse,
} from "../types/user.types";

const RESOURCE = "/admin/users";

export async function listUsers(
  params: UserQueryInput,
): Promise<UserListResponse> {
  const { data } = await api.get<UserListResponse>(RESOURCE, { params });
  return data;
}

export async function createUser(
  input: UserCreateInput,
): Promise<UserCreatedResponse> {
  const { data } = await api.post<UserCreatedResponse>(RESOURCE, input);
  return data;
}

export async function setUserActive(
  id: string,
  isActive: boolean,
): Promise<UserDto> {
  const { data } = await api.patch<UserDto>(`${RESOURCE}/${id}`, { isActive });
  return data;
}

export async function setUserRoles(
  id: string,
  roleIds: string[],
): Promise<UserDto> {
  const { data } = await api.patch<UserDto>(`${RESOURCE}/${id}/roles`, {
    roleIds,
  });
  return data;
}
