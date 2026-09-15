"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/axios";

import { useCreateUser } from "../hooks/use-user-mutations";
import { userCreateSchema } from "../schemas/user.schema";
import { RoleCheckboxGroup } from "./role-checkbox-group";

const emptyValues = {
  firstName: "",
  lastName: "",
  email: "",
  roleIds: [] as string[],
};

type UserFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * El contenedor lo remonta con una `key` nueva en cada apertura: así el
 * formulario y la contraseña temporal nacen limpios sin un efecto de reseteo.
 */
export function UserFormDialog({ open, onOpenChange }: UserFormDialogProps) {
  const createMutation = useCreateUser();
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(
    null,
  );
  const [copied, setCopied] = useState(false);

  const form = useForm({
    resolver: zodResolver(userCreateSchema),
    defaultValues: emptyValues,
  });

  const { setError } = form;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const response = await createMutation.mutateAsync({
        ...values,
        lastName: values.lastName?.length ? values.lastName : null,
      });
      setTemporaryPassword(response.temporaryPassword);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setError("email", { message: error.message });
        return;
      }
      // El toast lo emite el hook; el diálogo permanece abierto.
    }
  });

  const copyPassword = async () => {
    if (!temporaryPassword) return;

    try {
      await navigator.clipboard.writeText(temporaryPassword);
      setCopied(true);
    } catch (error) {
      console.error("No se pudo copiar la contraseña temporal", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {temporaryPassword ? (
          <>
            <DialogHeader>
              <DialogTitle>Usuario creado</DialogTitle>
              <DialogDescription>
                Copia esta contraseña y entrégasela a la persona. No se volverá
                a mostrar y no queda guardada en ningún sitio.
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-3">
              <code className="flex-1 font-mono text-sm break-all">
                {temporaryPassword}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void copyPassword()}
              >
                {copied ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
                {copied ? "Copiada" : "Copiar"}
              </Button>
            </div>

            <p className="text-sm text-muted-foreground">
              La primera vez que inicie sesión se le pedirá cambiarla.
            </p>

            <DialogFooter>
              <Button type="button" onClick={() => onOpenChange(false)}>
                Entendido
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Nuevo usuario</DialogTitle>
              <DialogDescription>
                Se creará la cuenta con una contraseña temporal que verás una
                sola vez.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={onSubmit} noValidate>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="user-first-name">Nombre</FieldLabel>
                  <Input
                    id="user-first-name"
                    autoComplete="off"
                    {...form.register("firstName")}
                  />
                  <FieldError errors={[form.formState.errors.firstName]} />
                </Field>

                <Field>
                  <FieldLabel htmlFor="user-last-name">Apellido</FieldLabel>
                  <Input
                    id="user-last-name"
                    autoComplete="off"
                    {...form.register("lastName")}
                  />
                  <FieldError errors={[form.formState.errors.lastName]} />
                </Field>

                <Field>
                  <FieldLabel htmlFor="user-email">
                    Correo electrónico
                  </FieldLabel>
                  <Input
                    id="user-email"
                    type="email"
                    autoComplete="off"
                    {...form.register("email")}
                  />
                  <FieldDescription>
                    Con este correo iniciará sesión.
                  </FieldDescription>
                  <FieldError errors={[form.formState.errors.email]} />
                </Field>

                <Field>
                  <FieldLabel>Roles</FieldLabel>
                  <FieldDescription>
                    Determinan qué puede ver y hacer dentro del panel.
                  </FieldDescription>
                  <Controller
                    control={form.control}
                    name="roleIds"
                    render={({ field }) => (
                      <RoleCheckboxGroup
                        idPrefix="create"
                        value={field.value}
                        onChange={field.onChange}
                        disabled={createMutation.isPending}
                      />
                    )}
                  />
                  <FieldError errors={[form.formState.errors.roleIds]} />
                </Field>
              </FieldGroup>

              <DialogFooter className="pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={createMutation.isPending}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creando…" : "Crear usuario"}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
