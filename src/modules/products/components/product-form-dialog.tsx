"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/axios";

import { useActiveCategories } from "../hooks/use-active-categories";
import { useProduct } from "../hooks/use-product";
import {
  useCreateProduct,
  useUpdateProduct,
} from "../hooks/use-product-mutations";
import {
  productCreateSchema,
  type ProductFormValues,
} from "../schemas/product.schema";
import type {
  ProductDto,
  ProductWithCostDto,
} from "../types/product.types";

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const emptyValues: ProductFormValues = {
  categoryId: "",
  sku: "",
  name: "",
  slug: "",
  description: "",
  priceCents: 0,
  compareAtPriceCents: null,
  costCents: null,
  stock: 0,
  brand: "",
  specs: null,
  weightGrams: null,
  imageUrl: "",
};

/** Un input vacío es "sin valor", no `NaN`. */
const optionalNumber = {
  setValueAs: (value: string) => (value === "" ? null : Number(value)),
};

type SpecPair = { key: string; value: string };

function toSpecPairs(specs: Record<string, string> | null): SpecPair[] {
  return specs
    ? Object.entries(specs).map(([key, value]) => ({ key, value }))
    : [];
}

function toSpecsRecord(pairs: SpecPair[]): Record<string, string> | null {
  const entries = pairs
    .map(({ key, value }) => [key.trim(), value.trim()] as const)
    .filter(([key]) => key.length > 0);

  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

function toFormValues(product: ProductWithCostDto | null): ProductFormValues {
  if (!product) return emptyValues;

  return {
    categoryId: product.categoryId,
    sku: product.sku,
    name: product.name,
    slug: product.slug,
    description: product.description ?? "",
    priceCents: product.priceCents,
    compareAtPriceCents: product.compareAtPriceCents,
    costCents: product.costCents,
    stock: product.stock,
    brand: product.brand ?? "",
    specs: product.specs,
    weightGrams: product.weightGrams,
    imageUrl: product.imageUrl ?? "",
  };
}

type ProductFormProps = {
  /** `null` abre el formulario en modo creación. */
  product: ProductWithCostDto | null;
  onClose: () => void;
};

// Se monta al abrir el diálogo y se desmonta al cerrarlo: los valores iniciales
// se calculan una vez, sin efecto de sincronización ni `reset`.
function ProductForm({ product, onClose }: ProductFormProps) {
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const categoriesQuery = useActiveCategories();
  const [specPairs, setSpecPairs] = useState<SpecPair[]>(() =>
    toSpecPairs(product?.specs ?? null),
  );

  const form = useForm({
    resolver: zodResolver(productCreateSchema),
    defaultValues: toFormValues(product),
  });

  const { setError } = form;
  // En cuanto el usuario escribe el slug a mano deja de autogenerarse.
  const isSlugDirty = form.formState.dirtyFields.slug === true;

  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = form.handleSubmit(async (values) => {
    const input = {
      ...values,
      description: values.description?.length ? values.description : null,
      brand: values.brand?.length ? values.brand : null,
      imageUrl: values.imageUrl?.length ? values.imageUrl : null,
      specs: toSpecsRecord(specPairs),
    };

    try {
      if (product) {
        await updateMutation.mutateAsync({ id: product.id, input });
      } else {
        await createMutation.mutateAsync(input);
      }
      onClose();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setError(error.message.includes("SKU") ? "sku" : "slug", {
          message: error.message,
        });
        return;
      }
      // El toast lo emite el hook de mutación; el diálogo permanece abierto.
    }
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {product ? "Editar producto" : "Nuevo producto"}
        </DialogTitle>
        <DialogDescription>
          {product
            ? "Modifica los datos del producto."
            : "Añade un producto al catálogo."}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="product-name">Nombre</FieldLabel>
            <Input
              id="product-name"
              autoComplete="off"
              {...form.register("name", {
                onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
                  if (product || isSlugDirty) return;
                  form.setValue("slug", slugify(event.target.value), {
                    shouldValidate: form.formState.isSubmitted,
                  });
                },
              })}
            />
            <FieldError errors={[form.formState.errors.name]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="product-slug">Slug</FieldLabel>
            <Input
              id="product-slug"
              autoComplete="off"
              {...form.register("slug")}
            />
            <FieldDescription>
              Se usa en la URL. Solo minúsculas, números y guiones.
            </FieldDescription>
            <FieldError errors={[form.formState.errors.slug]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="product-sku">SKU</FieldLabel>
            <Input
              id="product-sku"
              autoComplete="off"
              {...form.register("sku")}
            />
            <FieldError errors={[form.formState.errors.sku]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="product-category">Categoría</FieldLabel>
            <Controller
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <Select
                  value={field.value || null}
                  onValueChange={(value: string | null) =>
                    field.onChange(value ?? "")
                  }
                >
                  <SelectTrigger id="product-category">
                    <SelectValue placeholder="Selecciona una categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {(categoriesQuery.data?.data ?? []).map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {categoriesQuery.isError ? (
              <FieldDescription>
                No se pudieron cargar las categorías.
              </FieldDescription>
            ) : null}
            <FieldError errors={[form.formState.errors.categoryId]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="product-price">Precio</FieldLabel>
            <Input
              id="product-price"
              type="number"
              inputMode="numeric"
              autoComplete="off"
              {...form.register("priceCents", { valueAsNumber: true })}
            />
            <FieldDescription>
              En centavos: 129999 se muestra como $1,299.99.
            </FieldDescription>
            <FieldError errors={[form.formState.errors.priceCents]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="product-compare-price">
              Precio de comparación
            </FieldLabel>
            <Input
              id="product-compare-price"
              type="number"
              inputMode="numeric"
              autoComplete="off"
              {...form.register("compareAtPriceCents", optionalNumber)}
            />
            <FieldDescription>
              Opcional, en centavos. Debe ser mayor que el precio.
            </FieldDescription>
            <FieldError errors={[form.formState.errors.compareAtPriceCents]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="product-cost">Costo (centavos)</FieldLabel>
            <Input
              id="product-cost"
              type="number"
              inputMode="numeric"
              autoComplete="off"
              {...form.register("costCents", optionalNumber)}
            />
            <FieldDescription>
              Opcional. Lo que cuesta el producto sin IGV; solo se usa para
              calcular el margen en Finanzas.
            </FieldDescription>
            <FieldError errors={[form.formState.errors.costCents]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="product-stock">Stock</FieldLabel>
            <Input
              id="product-stock"
              type="number"
              inputMode="numeric"
              autoComplete="off"
              {...form.register("stock", { valueAsNumber: true })}
            />
            <FieldError errors={[form.formState.errors.stock]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="product-brand">Marca</FieldLabel>
            <Input
              id="product-brand"
              autoComplete="off"
              {...form.register("brand")}
            />
            <FieldError errors={[form.formState.errors.brand]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="product-weight">Peso (gramos)</FieldLabel>
            <Input
              id="product-weight"
              type="number"
              inputMode="numeric"
              autoComplete="off"
              {...form.register("weightGrams", optionalNumber)}
            />
            <FieldError errors={[form.formState.errors.weightGrams]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="product-image">Imagen (URL)</FieldLabel>
            <Input
              id="product-image"
              autoComplete="off"
              {...form.register("imageUrl")}
            />
            <FieldError errors={[form.formState.errors.imageUrl]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="product-description">Descripción</FieldLabel>
            <Input
              id="product-description"
              autoComplete="off"
              {...form.register("description")}
            />
            <FieldError errors={[form.formState.errors.description]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="product-specs-key-0">
              Especificaciones
            </FieldLabel>
            <FieldDescription>
              Pares clave/valor, por ejemplo: RAM / 16 GB.
            </FieldDescription>
            <div className="flex flex-col gap-2">
              {specPairs.map((pair, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    id={`product-specs-key-${index}`}
                    value={pair.key}
                    placeholder="Clave"
                    aria-label={`Clave de la especificación ${index + 1}`}
                    onChange={(event) =>
                      setSpecPairs((current) =>
                        current.map((item, i) =>
                          i === index
                            ? { ...item, key: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                  <Input
                    value={pair.value}
                    placeholder="Valor"
                    aria-label={`Valor de la especificación ${index + 1}`}
                    onChange={(event) =>
                      setSpecPairs((current) =>
                        current.map((item, i) =>
                          i === index
                            ? { ...item, value: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Quitar la especificación ${index + 1}`}
                    onClick={() =>
                      setSpecPairs((current) =>
                        current.filter((_item, i) => i !== index),
                      )
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() =>
                  setSpecPairs((current) => [
                    ...current,
                    { key: "", value: "" },
                  ])
                }
              >
                Añadir especificación
              </Button>
            </div>
          </Field>
        </FieldGroup>

        <DialogFooter className="pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

type ProductFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `null` abre el diálogo en modo creación. */
  product: ProductDto | null;
};

/**
 * En edición espera al detalle antes de montar el formulario: la fila de la
 * tabla no trae el costo (spec 019 D8) y los `defaultValues` se calculan una
 * sola vez, al montar.
 */
export function ProductFormDialog({
  open,
  onOpenChange,
  product,
}: ProductFormDialogProps) {
  const detailQuery = useProduct(product?.id ?? null, open);
  const detail = product ? (detailQuery.data ?? null) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {!open ? null : product && !detail ? (
          <>
            <DialogHeader>
              <DialogTitle>Editar producto</DialogTitle>
              <DialogDescription>
                {detailQuery.isError
                  ? "No se pudo cargar el producto."
                  : "Cargando los datos del producto…"}
              </DialogDescription>
            </DialogHeader>
            {detailQuery.isError ? (
              <Button
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() => void detailQuery.refetch()}
              >
                Reintentar
              </Button>
            ) : (
              <div className="flex flex-col gap-3">
                {[0, 1, 2, 3].map((slot) => (
                  <Skeleton key={slot} className="h-10 w-full" />
                ))}
              </div>
            )}
          </>
        ) : (
          <ProductForm product={detail} onClose={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}
