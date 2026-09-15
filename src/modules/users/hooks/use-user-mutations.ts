"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError } from "@/lib/axios";

import type { UserCreateInput } from "../schemas/user.schema";
import {
  createUser,
  setUserActive,
  setUserRoles,
} from "../services/user.service";
import { usersQueryKey } from "./use-users";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UserCreateInput) => createUser(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: usersQueryKey });
      toast.success("Usuario creado");
    },
    onError: (error) => {
      // El 409 (email duplicado) lo pinta el formulario bajo el campo.
      if (error instanceof ApiError && error.status === 409) return;
      toast.error(errorMessage(error, "No se pudo crear el usuario"));
    },
  });
}

export function useSetUserActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      setUserActive(id, isActive),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: usersQueryKey });
      toast.success(
        variables.isActive ? "Usuario reactivado" : "Usuario desactivado",
      );
    },
    onError: (error) => {
      toast.error(errorMessage(error, "No se pudo cambiar el estado"));
    },
  });
}

export function useSetUserRoles() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, roleIds }: { id: string; roleIds: string[] }) =>
      setUserRoles(id, roleIds),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: usersQueryKey });
      toast.success("Roles actualizados");
    },
    onError: (error) => {
      // El 409 (uno mismo) lo pinta el diálogo, que permanece abierto.
      if (error instanceof ApiError && error.status === 409) return;
      toast.error(errorMessage(error, "No se pudieron cambiar los roles"));
    },
  });
}
