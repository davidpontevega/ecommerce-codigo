"use client";

import type { PaginationState, SortingState } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/use-debounce";

import { ORDER_STATUS_LABELS } from "../constants";
import { useAdminOrders } from "../hooks/use-admin-orders";
import {
  ADMIN_ORDER_STATUSES,
  adminOrderSortFields,
  type AdminOrderDto,
  type AdminOrderStatus,
  type AdminOrdersQueryInput,
} from "../schemas/admin-order.schema";
import { adminOrderColumns } from "./admin-order-columns";

type SortField = AdminOrdersQueryInput["sortBy"];

const EMPTY_ROWS: AdminOrderDto[] = [];

function isSortField(value: string): value is SortField {
  return (adminOrderSortFields as ReadonlyArray<string>).includes(value);
}

export function AdminOrderTable({ canUpdate }: { canUpdate: boolean }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statuses, setStatuses] = useState<AdminOrderStatus[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const debouncedSearch = useDebounce(search);
  const columns = useMemo(() => adminOrderColumns({ canUpdate }), [canUpdate]);

  const activeSort = sorting[0];
  const sortBy: SortField =
    activeSort && isSortField(activeSort.id) ? activeSort.id : "createdAt";

  // Un rango invertido no se envía: el servidor lo rechazaría con un 400 y la
  // tabla mostraría un error donde solo falta terminar de elegir fechas.
  const isRangeValid = !from || !to || from <= to;

  const query = useAdminOrders({
    search: debouncedSearch.trim() || undefined,
    status: statuses.length > 0 ? statuses : undefined,
    from: isRangeValid ? from || undefined : undefined,
    to: isRangeValid ? to || undefined : undefined,
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    sortBy,
    sortDir: activeSort?.desc === false ? "asc" : "desc",
  });

  const resetPage = () =>
    setPagination((current) => ({ ...current, pageIndex: 0 }));

  const toggleStatus = (status: AdminOrderStatus) => {
    setStatuses((current) =>
      current.includes(status)
        ? current.filter((item) => item !== status)
        : [...current, status],
    );
    resetPage();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            resetPage();
          }}
          placeholder="Buscar por cliente o correo"
          aria-label="Buscar pedidos por cliente"
          className="w-64"
        />

        <div className="flex flex-col gap-1">
          <label htmlFor="orders-from" className="text-muted-foreground text-xs">
            Desde
          </label>
          <Input
            id="orders-from"
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
          <label htmlFor="orders-to" className="text-muted-foreground text-xs">
            Hasta
          </label>
          <Input
            id="orders-to"
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

        <div className="flex flex-wrap gap-2">
          {ADMIN_ORDER_STATUSES.map((status) => {
            const isSelected = statuses.includes(status);

            return (
              <Button
                key={status}
                type="button"
                size="sm"
                variant={isSelected ? "default" : "outline"}
                aria-pressed={isSelected}
                onClick={() => toggleStatus(status)}
              >
                {ORDER_STATUS_LABELS[status]}
              </Button>
            );
          })}
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
        onRowClick={(order) => router.push(`/admin/orders/${order.id}`)}
        emptyMessage="No hay pedidos que coincidan con el filtro."
      />
    </div>
  );
}
