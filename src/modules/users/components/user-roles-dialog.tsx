"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field";
import { ApiError } from "@/lib/axios";

import { useSetUserRoles } from "../hooks/use-user-mutations";
import type { UserDto } from "../types/user.types";
import { fullName } from "./user-columns";
import { RoleCheckboxGroup } from "./role-checkbox-group";

type UserRolesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserDto | null;
};

/**
 * El contenedor lo remonta con la `key` del usuario seleccionado: la selección
 * arranca precargada sin un efecto que la sincronice.
 */
export function UserRolesDialog({
  open,
  onOpenChange,
  user,
}: UserRolesDialogProps) {
  const mutation = useSetUserRoles();
  const [roleIds, setRoleIds] = useState<string[]>(
    () => user?.roles.map((role) => role.id) ?? [],
  );
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!user) return;

    if (roleIds.length === 0) {
      setError("Selecciona al menos un rol");
      return;
    }

    setError(null);

    try {
      await mutation.mutateAsync({ id: user.id, roleIds });
      onOpenChange(false);
    } catch (caught) {
      // 409: cambiar los propios roles. El diálogo permanece abierto con el
      // motivo a la vista, el hook no emite toast para este caso.
      if (caught instanceof ApiError && caught.status === 409) {
        setError(caught.message);
        return;
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cambiar roles</DialogTitle>
          <DialogDescription>
            {user
              ? `Define qué puede hacer ${fullName(user)} dentro del panel.`
              : "Selecciona un usuario."}
          </DialogDescription>
        </DialogHeader>

        <RoleCheckboxGroup
          idPrefix="edit"
          value={roleIds}
          onChange={setRoleIds}
          disabled={mutation.isPending}
        />

        <FieldError errors={error ? [{ message: error }] : undefined} />

        <DialogFooter className="pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void onSubmit()}
            disabled={mutation.isPending || !user}
          >
            {mutation.isPending ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
