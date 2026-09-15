"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError } from "@/lib/axios";

import { setRolePermissions } from "../services/role.service";
import { rolesQueryKey } from "./use-roles";

export function useSetRolePermissions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      permissionCodes,
    }: {
      id: string;
      permissionCodes: string[];
    }) => setRolePermissions(id, permissionCodes),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: rolesQueryKey });
      toast.success("Permisos actualizados");
    },
    onError: (error) => {
      toast.error(
        error instanceof ApiError
          ? error.message
          : "No se pudieron cambiar los permisos",
      );
    },
  });
}
