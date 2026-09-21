"use client";

import { createColumnHelper } from "@tanstack/react-table";
import Link from "next/link";

import {
  dataTableFeatures,
  type DataTableColumnDef,
} from "@/components/shared/data-table";
import { formatPrice } from "@/lib/utils";

import { limaDateTimeFormatter } from "../constants";
import type { AdminOrderDto } from "../schemas/admin-order.schema";
import { AdminOrderStatusSelect } from "./admin-order-status-select";

const helper = createColumnHelper<typeof dataTableFeatures, AdminOrderDto>();

export function orderReference(order: AdminOrderDto): string {
  return `#${order.id.slice(0, 8).toUpperCase()}`;
}

export function adminOrderColumns({
  canUpdate,
}: {
  canUpdate: boolean;
}): ReadonlyArray<DataTableColumnDef<AdminOrderDto>> {
  return helper.columns([
    helper.accessor("createdAt", {
      header: "Fecha",
      cell: (info) => limaDateTimeFormatter.format(new Date(info.getValue())),
    }),
    helper.display({
      id: "customer",
      header: "Cliente",
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate text-sm">
            {row.original.customerEmail ?? "Invitado sin correo"}
          </p>
          {row.original.customerName ? (
            <p className="text-muted-foreground truncate text-xs">
              {row.original.customerName}
            </p>
          ) : null}
        </div>
      ),
    }),
    helper.accessor("itemCount", {
      header: "Líneas",
      enableSorting: false,
      cell: (info) => info.getValue(),
    }),
    helper.accessor("totalCents", {
      header: "Total",
      cell: (info) => (
        <span className="font-mono">{formatPrice(info.getValue())}</span>
      ),
    }),
    helper.accessor("status", {
      header: "Estado",
      enableSorting: false,
      cell: (info) => (
        <AdminOrderStatusSelect
          orderId={info.row.original.id}
          status={info.getValue()}
          canUpdate={canUpdate}
        />
      ),
    }),
    helper.display({
      id: "actions",
      header: "",
      cell: ({ row }) => (
        // Enlace real además del clic en la fila: teclado y lector de pantalla
        // necesitan algo enfocable.
        <div className="flex justify-end">
          <Link
            href={`/admin/orders/${row.original.id}`}
            className="text-sm hover:underline"
          >
            Ver detalle
            <span className="sr-only"> del pedido {orderReference(row.original)}</span>
          </Link>
        </div>
      ),
    }),
  ]);
}
