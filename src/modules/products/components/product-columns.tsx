"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";

import {
  dataTableFeatures,
  type DataTableColumnDef,
} from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatPrice } from "@/lib/utils";

import type { ProductDto } from "../types/product.types";

const helper = createColumnHelper<typeof dataTableFeatures, ProductDto>();

export type ProductRowActions = {
  onEdit: (product: ProductDto) => void;
  onDelete: (product: ProductDto) => void;
  onRestore: (product: ProductDto) => void;
};

export function buildProductColumns({
  onEdit,
  onDelete,
  onRestore,
}: ProductRowActions): ReadonlyArray<DataTableColumnDef<ProductDto>> {
  return helper.columns([
    helper.accessor("name", { header: "Nombre" }),
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
    helper.accessor("priceCents", {
      header: "Precio",
      cell: (info) => (
        <span className="tabular-nums">
          {formatPrice(info.getValue())}
        </span>
      ),
    }),
    helper.accessor("stock", {
      header: "Stock",
      cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
    }),
    helper.accessor("deletedAt", {
      header: "Estado",
      enableSorting: false,
      cell: (info) => (
        <Badge variant={info.getValue() ? "secondary" : "default"}>
          {info.getValue() ? "Eliminado" : "Disponible"}
        </Badge>
      ),
    }),
    helper.display({
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const isDeleted = row.original.deletedAt !== null;

        return (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Abrir acciones"
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  disabled={isDeleted}
                  onClick={() => onEdit(row.original)}
                >
                  Editar
                </DropdownMenuItem>
                {isDeleted ? (
                  <DropdownMenuItem onClick={() => onRestore(row.original)}>
                    Restaurar
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => onDelete(row.original)}>
                    Eliminar
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    }),
  ]);
}
