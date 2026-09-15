"use client";

import { useQuery } from "@tanstack/react-query";

import { getRole, listRoles } from "../services/role.service";

export const rolesQueryKey = ["roles"] as const;

export function useRoles() {
  return useQuery({
    queryKey: rolesQueryKey,
    queryFn: listRoles,
  });
}

export function useRole(id: string) {
  return useQuery({
    queryKey: [...rolesQueryKey, id],
    queryFn: () => getRole(id),
  });
}
