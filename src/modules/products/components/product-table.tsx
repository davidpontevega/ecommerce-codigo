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

import { useActiveCategories } from "../hooks/use-active-categories";
import {
  useDeleteProduct,
  useRestoreProduct,
} from "../hooks/use-product-mutations";
import { useProducts } from "../hooks/use-products";
import {
  productSortFields,
  type ProductQueryInput,
} from "../schemas/product.schema";
import type { ProductDto } from "../types/product.types";
import { buildProductColumns } from "./product-columns";
import { ProductFormDialog } from "./product-form-dialog";

type ProductStatus = ProductQueryInput["status"];
type ProductSortField = ProductQueryInput["sortBy"];

const ALL_CATEGORIES = "all";

const statusOptions: ReadonlyArray<{ value: ProductStatus; label: string }> = [
  { value: "available", label: "Disponibles" },
  { value: "deleted", label: "Eliminados" },
  { value: "all", label: "Todos" },
];

const EMPTY_ROWS: ProductDto[] = [];

function isSortField(value: string): value is ProductSortField {
  return (productSortFields as ReadonlyArray<string>).includes(value);
}

/** El input de precio está en centavos; vacío o no numérico es "sin filtro". */
function toPriceCents(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

export function ProductTable() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ProductStatus>("available");
  const [categoryId, setCategoryId] = useState<string>(ALL_CATEGORIES);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });
  const [editing, setEditing] = useState<ProductDto | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ProductDto | null>(null);

  const debouncedSearch = useDebounce(search);
  const debouncedMinPrice = useDebounce(minPrice);
  const debouncedMaxPrice = useDebounce(maxPrice);

  const categoriesQuery = useActiveCategories();
  const deleteMutation = useDeleteProduct();
  const restoreMutation = useRestoreProduct();

  const resetPage = () =>
    setPagination((current) => ({ ...current, pageIndex: 0 }));

  const activeSort = sorting[0];
  const sortBy: ProductSortField =
    activeSort && isSortField(activeSort.id) ? activeSort.id : "createdAt";

  const params: ProductQueryInput = {
    search: debouncedSearch.trim() || undefined,
    categoryId: categoryId === ALL_CATEGORIES ? undefined : categoryId,
    status,
    minPriceCents: toPriceCents(debouncedMinPrice),
    maxPriceCents: toPriceCents(debouncedMaxPrice),
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    sortBy,
    sortDir: activeSort?.desc === false ? "asc" : "desc",
  };

  const query = useProducts(params);

  const columns = useMemo(
    () =>
      buildProductColumns({
        onEdit: (product) => {
          setEditing(product);
          setIsFormOpen(true);
        },
        onDelete: (product) => setPendingDelete(product),
        onRestore: (product) => restoreMutation.mutate(product.id),
      }),
    [restoreMutation],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              resetPage();
            }}
            placeholder="Buscar por nombre o SKU"
            aria-label="Buscar productos"
            className="w-56"
          />

          <Select
            value={categoryId}
            onValueChange={(value: string | null) => {
              setCategoryId(value ?? ALL_CATEGORIES);
              resetPage();
            }}
          >
            <SelectTrigger className="w-48" aria-label="Filtrar por categoría">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_CATEGORIES}>
                Todas las categorías
              </SelectItem>
              {(categoriesQuery.data?.data ?? []).map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={status}
            onValueChange={(value: ProductStatus | null) => {
              setStatus(value ?? "available");
              resetPage();
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

          <Input
            value={minPrice}
            onChange={(event) => {
              setMinPrice(event.target.value);
              resetPage();
            }}
            type="number"
            inputMode="numeric"
            placeholder="Precio mín. (centavos)"
            aria-label="Precio mínimo en centavos"
            className="w-44"
          />
          <Input
            value={maxPrice}
            onChange={(event) => {
              setMaxPrice(event.target.value);
              resetPage();
            }}
            type="number"
            inputMode="numeric"
            placeholder="Precio máx. (centavos)"
            aria-label="Precio máximo en centavos"
            className="w-44"
          />
        </div>

        <Button
          onClick={() => {
            setEditing(null);
            setIsFormOpen(true);
          }}
        >
          Nuevo producto
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
        emptyMessage="No hay productos que coincidan con el filtro."
      />

      <ProductFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        product={editing}
      />

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar el producto?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.name} dejará de estar disponible en el catálogo.
              Podrás restaurarlo más tarde desde el filtro «Eliminados».
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
