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

import type { CategoryDto } from "../types/category.types";

const helper = createColumnHelper<typeof dataTableFeatures, CategoryDto>();

const dateFormatter = new Intl.DateTimeFormat("es", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export type CategoryRowActions = {
  onEdit: (category: CategoryDto) => void;
  onToggleActive: (category: CategoryDto) => void;
};

export function buildCategoryColumns({
  onEdit,
  onToggleActive,
}: CategoryRowActions): ReadonlyArray<DataTableColumnDef<CategoryDto>> {
  return helper.columns([
    helper.accessor("name", { header: "Nombre" }),
    helper.accessor("slug", {
      header: "Slug",
      enableSorting: false,
      cell: (info) => (
        <span className="font-mono text-xs text-muted-foreground">
          {info.getValue()}
        </span>
      ),
    }),
    helper.accessor("isActive", {
      header: "Estado",
      enableSorting: false,
      cell: (info) => (
        <Badge variant={info.getValue() ? "default" : "secondary"}>
          {info.getValue() ? "Activa" : "Inactiva"}
        </Badge>
      ),
    }),
    helper.accessor("createdAt", {
      header: "Creada",
      cell: (info) => dateFormatter.format(new Date(info.getValue())),
    }),
    helper.display({
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon" aria-label="Abrir acciones">
                  <MoreHorizontal className="size-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(row.original)}>
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onToggleActive(row.original)}>
                {row.original.isActive ? "Desactivar" : "Reactivar"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    }),
  ]);
}
