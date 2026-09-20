"use client";

import type { PaginationState, SortingState } from "@tanstack/react-table";
import { useMemo, useState } from "react";

import { DataTable } from "@/components/shared/data-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { LOW_STOCK_THRESHOLD } from "@/lib/constants";
import { useDebounce } from "@/hooks/use-debounce";

import { useActiveCategories } from "../hooks/use-active-categories";
import { useProducts } from "../hooks/use-products";
import {
  isProductSortField,
  type ProductQueryInput,
} from "../schemas/product.schema";
import type { ProductDto } from "../types/product.types";
import { buildInventoryColumns } from "./inventory-columns";
import { ProductFormDialog } from "./product-form-dialog";

const ALL_CATEGORIES = "all";

const EMPTY_ROWS: ProductDto[] = [];

export function InventoryTable() {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string>(ALL_CATEGORIES);
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "stock", desc: false },
  ]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });
  const [editing, setEditing] = useState<ProductDto | null>(null);

  const debouncedSearch = useDebounce(search);
  const categoriesQuery = useActiveCategories();

  const resetPage = () =>
    setPagination((current) => ({ ...current, pageIndex: 0 }));

  const activeSort = sorting[0];
  const sortBy: ProductQueryInput["sortBy"] =
    activeSort && isProductSortField(activeSort.id) ? activeSort.id : "stock";

  // `status: "available"` deja fuera el catálogo borrado: no hay que reponer lo
  // que ya no se vende.
  const params: ProductQueryInput = {
    search: debouncedSearch.trim() || undefined,
    categoryId: categoryId === ALL_CATEGORIES ? undefined : categoryId,
    status: "available",
    maxStock: onlyLowStock ? LOW_STOCK_THRESHOLD : undefined,
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    sortBy,
    sortDir: activeSort?.desc === true ? "desc" : "asc",
  };

  const query = useProducts(params);

  // El diálogo comparte la mutación de `admin/products`, que invalida la clave
  // `["products"]` completa: esta tabla se refresca sola al guardar (AC5).
  const columns = useMemo(() => buildInventoryColumns(setEditing), []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
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
            <SelectItem value={ALL_CATEGORIES}>Todas las categorías</SelectItem>
            {(categoriesQuery.data?.data ?? []).map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Switch
            id="inventory-only-low-stock"
            checked={onlyLowStock}
            onCheckedChange={(next: boolean) => {
              setOnlyLowStock(next);
              resetPage();
            }}
          />
          <Label htmlFor="inventory-only-low-stock">
            Solo stock bajo ({LOW_STOCK_THRESHOLD} o menos)
          </Label>
        </div>
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
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        product={editing}
      />
    </div>
  );
}
