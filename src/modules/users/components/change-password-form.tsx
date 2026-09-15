"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/axios";

import { passwordChangeSchema } from "../schemas/password.schema";

/** Extrae el mensaje que Clerk devuelve en `errors[].longMessage`. */
function clerkErrorMessage(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("errors" in error)) {
    return null;
  }

  const { errors } = error as { errors: unknown };
  const first = Array.isArray(errors) ? errors[0] : null;

  if (typeof first !== "object" || first === null) {
    return null;
  }

  const { longMessage, message } = first as {
    longMessage?: unknown;
    message?: unknown;
  };

  if (typeof longMessage === "string") return longMessage;
  return typeof message === "string" ? message : null;
}

export function ChangePasswordForm() {
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const router = useRouter();

  const form = useForm({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    if (!user) return;

    try {
      await user.updatePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
        signOutOfOtherSessions: true,
      });
    } catch (error) {
      form.setError("currentPassword", {
        message:
          clerkErrorMessage(error) ??
          "No se pudo cambiar la contraseña. Revisa la actual e inténtalo de nuevo.",
      });
      return;
    }

    try {
      // Baja el flag en `publicMetadata` y deja la fila en la bitácora.
      await api.post("/onboarding/password-changed");

      // El claim `mustChangePassword` vive en el token (~60 s): sin refrescarlo
      // el middleware devolvería aquí en bucle.
      await getToken({ skipCache: true });
    } catch (error) {
      form.setError("root", {
        message:
          "La contraseña se cambió, pero no pudimos confirmarlo. Recarga la página.",
      });
      console.error("Confirmación del cambio de contraseña", error);
      return;
    }

    router.replace("/admin");
  });

  if (!isLoaded) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-muted-foreground">
          No pudimos cargar tu sesión.
        </p>
        <Button variant="outline" size="sm" onClick={() => router.refresh()}>
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="current-password">Contraseña actual</FieldLabel>
          <Input
            id="current-password"
            type="password"
            autoComplete="current-password"
            {...form.register("currentPassword")}
          />
          <FieldDescription>
            La contraseña temporal que te entregaron.
          </FieldDescription>
          <FieldError errors={[form.formState.errors.currentPassword]} />
        </Field>

        <Field>
          <FieldLabel htmlFor="new-password">Contraseña nueva</FieldLabel>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            {...form.register("newPassword")}
          />
          <FieldDescription>Mínimo 8 caracteres.</FieldDescription>
          <FieldError errors={[form.formState.errors.newPassword]} />
        </Field>

        <Field>
          <FieldLabel htmlFor="confirm-password">
            Repite la contraseña nueva
          </FieldLabel>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            {...form.register("confirmPassword")}
          />
          <FieldError errors={[form.formState.errors.confirmPassword]} />
        </Field>

        <FieldError errors={[form.formState.errors.root]} />

        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Guardando…" : "Cambiar contraseña"}
        </Button>
      </FieldGroup>
    </form>
  );
}
