"use client";

import type { PaginationState, SortingState } from "@tanstack/react-table";
import { useMemo, useState } from "react";

import { DataTable } from "@/components/shared/data-table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/use-debounce";

import { useDeleteExpense } from "../hooks/use-expense-mutations";
import { useExpenses } from "../hooks/use-expenses";
import {
  isExpenseSortField,
  type ExpenseQueryInput,
} from "../schemas/expense.schema";
import type { ExpenseDto } from "../types/finance.types";
import { buildExpenseColumns } from "./expense-columns";
import { ExpenseFormDialog } from "./expense-form-dialog";

type SortField = ExpenseQueryInput["sortBy"];

const EMPTY_ROWS: ExpenseDto[] = [];

export function ExpenseTable() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "date", desc: true },
  ]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [editing, setEditing] = useState<ExpenseDto | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ExpenseDto | null>(null);

  const debouncedSearch = useDebounce(search);
  const debouncedCategory = useDebounce(category);
  const deleteMutation = useDeleteExpense();

  const activeSort = sorting[0];
  const sortBy: SortField =
    activeSort && isExpenseSortField(activeSort.id) ? activeSort.id : "date";

  // Un rango invertido no se envía: el servidor lo rechazaría con un 400 y la
  // tabla mostraría un error donde solo falta terminar de elegir fechas.
  const isRangeValid = !from || !to || from <= to;

  const query = useExpenses({
    search: debouncedSearch.trim() || undefined,
    category: debouncedCategory.trim() || undefined,
    from: isRangeValid ? from || undefined : undefined,
    to: isRangeValid ? to || undefined : undefined,
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    sortBy,
    sortDir: activeSort?.desc === false ? "asc" : "desc",
  });

  const resetPage = () =>
    setPagination((current) => ({ ...current, pageIndex: 0 }));

  const columns = useMemo(
    () =>
      buildExpenseColumns({
        onEdit: (expense) => {
          setEditing(expense);
          setIsFormOpen(true);
        },
        onDelete: setPendingDelete,
      }),
    [],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              resetPage();
            }}
            placeholder="Buscar por concepto"
            aria-label="Buscar gastos por concepto"
            className="w-56"
          />

          <Input
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
              resetPage();
            }}
            placeholder="Categoría"
            aria-label="Filtrar por categoría"
            className="w-40"
          />

          <div className="flex flex-col gap-1">
            <label
              htmlFor="expenses-from"
              className="text-muted-foreground text-xs"
            >
              Desde
            </label>
            <Input
              id="expenses-from"
              type="date"
              value={from}
              max={to || undefined}
              onChange={(event) => {
                setFrom(event.target.value);
                resetPage();
              }}
              className="w-40"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="expenses-to"
              className="text-muted-foreground text-xs"
            >
              Hasta
            </label>
            <Input
              id="expenses-to"
              type="date"
              value={to}
              min={from || undefined}
              onChange={(event) => {
                setTo(event.target.value);
                resetPage();
              }}
              className="w-40"
            />
          </div>
        </div>

        <Button
          onClick={() => {
            setEditing(null);
            setIsFormOpen(true);
          }}
        >
          Nuevo gasto
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={query.data?.data ?? EMPTY_ROWS}
        rowCount={query.data?.total ?? 0}
        sorting={sorting}
        onSortingChange={setSorting}
        pagination={pagination}
        onPaginationChange={setPagination}
        isPending={query.isPending}
        isError={query.isError}
        onRetry={() => void query.refetch()}
        emptyMessage="No hay gastos que coincidan con el filtro."
      />

      <ExpenseFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        expense={editing}
      />

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar el gasto?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.concept} dejará de contar en el resumen del mes.
              El registro se conserva en la base de datos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!pendingDelete) return;
                deleteMutation.mutate(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
