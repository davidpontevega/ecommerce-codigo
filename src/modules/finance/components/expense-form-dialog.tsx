"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

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
import { limaDay } from "@/lib/utils";

import {
  useCreateExpense,
  useUpdateExpense,
} from "../hooks/use-expense-mutations";
import {
  expenseCreateSchema,
  type ExpenseFormValues,
} from "../schemas/expense.schema";
import type { ExpenseDto } from "../types/finance.types";

function toFormValues(expense: ExpenseDto | null): ExpenseFormValues {
  if (!expense) {
    // El gasto más común es el de hoy; la fecha sigue siendo editable.
    return { concept: "", amountCents: 0, date: limaDay(), category: "" };
  }

  return {
    concept: expense.concept,
    amountCents: expense.amountCents,
    date: expense.date,
    category: expense.category ?? "",
  };
}

type ExpenseFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `null` abre el diálogo en modo creación. */
  expense: ExpenseDto | null;
};

export function ExpenseFormDialog({
  open,
  onOpenChange,
  expense,
}: ExpenseFormDialogProps) {
  const createMutation = useCreateExpense();
  const updateMutation = useUpdateExpense();

  const form = useForm({
    resolver: zodResolver(expenseCreateSchema),
    defaultValues: toFormValues(null),
  });

  const { reset } = form;

  useEffect(() => {
    if (!open) return;
    reset(toFormValues(expense));
  }, [open, expense, reset]);

  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = form.handleSubmit(async (values) => {
    const input = {
      ...values,
      category: values.category?.length ? values.category : null,
    };

    try {
      if (expense) {
        await updateMutation.mutateAsync({ id: expense.id, input });
      } else {
        await createMutation.mutateAsync(input);
      }
      onOpenChange(false);
    } catch {
      // El toast lo emite el hook de mutación; el diálogo permanece abierto.
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{expense ? "Editar gasto" : "Nuevo gasto"}</DialogTitle>
          <DialogDescription>
            {expense
              ? "Modifica los datos del gasto."
              : "Registra un gasto del negocio: alquiler, insumos, servicios."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="expense-concept">Concepto</FieldLabel>
              <Input
                id="expense-concept"
                autoComplete="off"
                {...form.register("concept")}
              />
              <FieldError errors={[form.formState.errors.concept]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="expense-amount">Monto</FieldLabel>
              <Input
                id="expense-amount"
                type="number"
                inputMode="numeric"
                autoComplete="off"
                {...form.register("amountCents", { valueAsNumber: true })}
              />
              <FieldDescription>
                En centavos: 129999 se muestra como S/ 1,299.99.
              </FieldDescription>
              <FieldError errors={[form.formState.errors.amountCents]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="expense-date">Fecha</FieldLabel>
              <Input id="expense-date" type="date" {...form.register("date")} />
              <FieldError errors={[form.formState.errors.date]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="expense-category">Categoría</FieldLabel>
              <Input
                id="expense-category"
                autoComplete="off"
                {...form.register("category")}
              />
              <FieldDescription>
                Opcional. Texto libre: alquiler, insumos, servicios…
              </FieldDescription>
              <FieldError errors={[form.formState.errors.category]} />
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
