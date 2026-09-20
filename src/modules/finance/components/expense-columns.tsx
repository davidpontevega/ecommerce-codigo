"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";

import {
  dataTableFeatures,
  type DataTableColumnDef,
} from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatPrice } from "@/lib/utils";

import type { ExpenseDto } from "../types/finance.types";

const helper = createColumnHelper<typeof dataTableFeatures, ExpenseDto>();

const dateFormatter = new Intl.DateTimeFormat("es", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export type ExpenseRowActions = {
  onEdit: (expense: ExpenseDto) => void;
  onDelete: (expense: ExpenseDto) => void;
};

export function buildExpenseColumns({
  onEdit,
  onDelete,
}: ExpenseRowActions): ReadonlyArray<DataTableColumnDef<ExpenseDto>> {
  return helper.columns([
    helper.accessor("date", {
      header: "Fecha",
      // `T12:00:00` y no la fecha pelada: `new Date("2026-09-01")` se interpreta
      // como UTC y en Lima retrocedería al 31 de agosto.
      cell: (info) => dateFormatter.format(new Date(`${info.getValue()}T12:00:00`)),
    }),
    helper.accessor("concept", { header: "Concepto", enableSorting: false }),
    helper.accessor("category", {
      header: "Categoría",
      enableSorting: false,
      cell: (info) => (
        <span className="text-muted-foreground">{info.getValue() ?? "—"}</span>
      ),
    }),
    helper.accessor("amountCents", {
      header: "Monto",
      cell: (info) => (
        <span className="tabular-nums">{formatPrice(info.getValue())}</span>
      ),
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
              <DropdownMenuItem onClick={() => onDelete(row.original)}>
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    }),
  ]);
}
