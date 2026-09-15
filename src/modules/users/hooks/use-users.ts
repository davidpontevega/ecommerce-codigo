"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { UserQueryInput } from "../schemas/user.schema";
import { listUsers } from "../services/user.service";

export const usersQueryKey = ["users"] as const;

export function useUsers(params: UserQueryInput) {
  return useQuery({
    queryKey: [...usersQueryKey, params],
    queryFn: () => listUsers(params),
    // Evita el parpadeo a skeleton al paginar u ordenar.
    placeholderData: keepPreviousData,
  });
}
