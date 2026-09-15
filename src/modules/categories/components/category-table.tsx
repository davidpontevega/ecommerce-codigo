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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDebounce } from "@/hooks/use-debounce";

import { useCategories } from "../hooks/use-categories";
import { useSetCategoryActive } from "../hooks/use-category-mutations";
import {
  categorySortFields,
  type CategoryQueryInput,
} from "../schemas/category.schema";
import type { CategoryDto } from "../types/category.types";
import { buildCategoryColumns } from "./category-columns";
import { CategoryFormDialog } from "./category-form-dialog";

type CategoryStatus = CategoryQueryInput["status"];
type CategorySortField = CategoryQueryInput["sortBy"];

const statusOptions: ReadonlyArray<{ value: CategoryStatus; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "active", label: "Activas" },
  { value: "inactive", label: "Inactivas" },
];

const EMPTY_ROWS: CategoryDto[] = [];

function isSortField(value: string): value is CategorySortField {
  return (categorySortFields as ReadonlyArray<string>).includes(value);
}

export function CategoryTable() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CategoryStatus>("all");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [editing, setEditing] = useState<CategoryDto | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [pendingToggle, setPendingToggle] = useState<CategoryDto | null>(null);

  const debouncedSearch = useDebounce(search);
  const setActiveMutation = useSetCategoryActive();

  const activeSort = sorting[0];
  const sortBy: CategorySortField =
    activeSort && isSortField(activeSort.id) ? activeSort.id : "createdAt";

  const params: CategoryQueryInput = {
    search: debouncedSearch.trim() || undefined,
    status,
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    sortBy,
    sortDir: activeSort?.desc === false ? "asc" : "desc",
  };

  const query = useCategories(params);

  const columns = useMemo(
    () =>
      buildCategoryColumns({
        onEdit: (category) => {
          setEditing(category);
          setIsFormOpen(true);
        },
        onToggleActive: (category) => {
          if (category.isActive) {
            setPendingToggle(category);
            return;
          }
          setActiveMutation.mutate({ id: category.id, isActive: true });
        },
      }),
    [setActiveMutation],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPagination((current) => ({ ...current, pageIndex: 0 }));
            }}
            placeholder="Buscar por nombre o slug"
            aria-label="Buscar categorías"
            className="w-64"
          />
          <Select
            value={status}
            onValueChange={(value: CategoryStatus | null) => {
              setStatus(value ?? "all");
              setPagination((current) => ({ ...current, pageIndex: 0 }));
            }}
          >
            <SelectTrigger className="w-40" aria-label="Filtrar por estado">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={() => {
            setEditing(null);
            setIsFormOpen(true);
          }}
        >
          Nueva categoría
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
        emptyMessage="No hay categorías que coincidan con el filtro."
      />

      <CategoryFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        category={editing}
      />

      <AlertDialog
        open={pendingToggle !== null}
        onOpenChange={(open) => {
          if (!open) setPendingToggle(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar la categoría?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingToggle?.name} dejará de estar disponible en el catálogo.
              Podrás reactivarla más tarde.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!pendingToggle) return;
                setActiveMutation.mutate({
                  id: pendingToggle.id,
                  isActive: false,
                });
                setPendingToggle(null);
              }}
            >
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
