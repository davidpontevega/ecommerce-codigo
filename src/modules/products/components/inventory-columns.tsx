"use client";

import { createColumnHelper } from "@tanstack/react-table";

import {
  dataTableFeatures,
  type DataTableColumnDef,
} from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LOW_STOCK_THRESHOLD } from "@/lib/constants";

import type { ProductDto } from "../types/product.types";

const helper = createColumnHelper<typeof dataTableFeatures, ProductDto>();

export const isLowStock = (stock: number): boolean =>
  stock <= LOW_STOCK_THRESHOLD;

export function buildInventoryColumns(
  onEdit: (product: ProductDto) => void,
): ReadonlyArray<DataTableColumnDef<ProductDto>> {
  return helper.columns([
    helper.accessor("name", { header: "Producto" }),
    helper.accessor("sku", {
      header: "SKU",
      enableSorting: false,
      cell: (info) => (
        <span className="text-muted-foreground font-mono text-xs">
          {info.getValue()}
        </span>
      ),
    }),
    helper.accessor("categoryName", {
      header: "Categoría",
      enableSorting: false,
    }),
    helper.accessor("stock", {
      header: "Stock",
      cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
    }),
    helper.display({
      id: "stockStatus",
      header: "Estado",
      cell: ({ row }) =>
        isLowStock(row.original.stock) ? (
          <Badge variant="destructive">Bajo</Badge>
        ) : (
          <Badge variant="secondary">Normal</Badge>
        ),
    }),
    helper.display({
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(row.original)}
          >
            Editar
          </Button>
        </div>
      ),
    }),
  ]);
}
