"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";

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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ApiError } from "@/lib/axios";

import {
  useCreateCategory,
  useUpdateCategory,
} from "../hooks/use-category-mutations";
import {
  categoryCreateSchema,
  type CategoryFormValues,
} from "../schemas/category.schema";
import type { CategoryDto } from "../types/category.types";

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const emptyValues: CategoryFormValues = {
  name: "",
  slug: "",
  description: "",
  isActive: true,
};

type CategoryFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `null` abre el diálogo en modo creación. */
  category: CategoryDto | null;
};

export function CategoryFormDialog({
  open,
  onOpenChange,
  category,
}: CategoryFormDialogProps) {
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();

  const form = useForm({
    resolver: zodResolver(categoryCreateSchema),
    defaultValues: emptyValues,
  });

  const { reset, setError } = form;
  // Suscripción explícita: en cuanto el usuario escribe el slug a mano, deja de
  // autogenerarse desde el nombre.
  const isSlugDirty = form.formState.dirtyFields.slug === true;

  useEffect(() => {
    if (!open) return;

    reset(
      category
        ? {
            name: category.name,
            slug: category.slug,
            description: category.description ?? "",
            isActive: category.isActive,
          }
        : emptyValues,
    );
  }, [open, category, reset]);

  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = form.handleSubmit(async (values) => {
    const input = {
      ...values,
      description: values.description?.length ? values.description : null,
    };

    try {
      if (category) {
        await updateMutation.mutateAsync({ id: category.id, input });
      } else {
        await createMutation.mutateAsync(input);
      }
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setError("slug", { message: error.message });
        return;
      }
      // El toast lo emite el hook de mutación; el diálogo permanece abierto.
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {category ? "Editar categoría" : "Nueva categoría"}
          </DialogTitle>
          <DialogDescription>
            {category
              ? "Modifica los datos de la categoría."
              : "Crea una categoría para clasificar el catálogo."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="category-name">Nombre</FieldLabel>
              <Input
                id="category-name"
                autoComplete="off"
                {...form.register("name", {
                  onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
                    if (category || isSlugDirty) return;
                    form.setValue("slug", slugify(event.target.value), {
                      shouldValidate: form.formState.isSubmitted,
                    });
                  },
                })}
              />
              <FieldError errors={[form.formState.errors.name]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="category-slug">Slug</FieldLabel>
              <Input
                id="category-slug"
                autoComplete="off"
                {...form.register("slug")}
              />
              <FieldDescription>
                Se usa en la URL. Solo minúsculas, números y guiones.
              </FieldDescription>
              <FieldError errors={[form.formState.errors.slug]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="category-description">
                Descripción
              </FieldLabel>
              <Input
                id="category-description"
                autoComplete="off"
                {...form.register("description")}
              />
              <FieldError errors={[form.formState.errors.description]} />
            </Field>

            <Field orientation="horizontal">
              <Controller
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <Switch
                    id="category-is-active"
                    checked={field.value ?? true}
                    onCheckedChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              />
              <FieldLabel htmlFor="category-is-active">Activa</FieldLabel>
            </Field>
          </FieldGroup>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
