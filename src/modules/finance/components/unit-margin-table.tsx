"use client";

import type { ColumnSort, PaginationState, SortingState } from "@tanstack/react-table";
import { useMemo, useState } from "react";

import { DataTable } from "@/components/shared/data-table";

import { useUnitMargins } from "../hooks/use-unit-margins";
import type { UnitMarginDto } from "../types/finance.types";
import { unitMarginColumns } from "./unit-margin-columns";

const EMPTY_ROWS: UnitMarginDto[] = [];

type SortKey = keyof Pick<
  UnitMarginDto,
  "name" | "priceCents" | "costCents" | "marginCents" | "marginPercent"
>;

/**
 * Orden y paginación en cliente: el endpoint devuelve el catálogo activo entero
 * y el margen es un derivado, no una columna que Postgres pueda ordenar sin
 * recalcularlo. Las filas "sin dato" van siempre al final, en cualquier sentido.
 */
function sortRows(
  rows: UnitMarginDto[],
  sort: ColumnSort | undefined,
): UnitMarginDto[] {
  if (!sort) return rows;

  const key = sort.id as SortKey;
  const direction = sort.desc ? -1 : 1;

  return [...rows].sort((a, b) => {
    const left = a[key];
    const right = b[key];

    if (left === null) return right === null ? 0 : 1;
    if (right === null) return -1;

    const delta =
      typeof left === "string"
        ? left.localeCompare(String(right), "es")
        : left - Number(right);

    return delta * direction;
  });
}

export function UnitMarginTable() {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "marginPercent", desc: true },
  ]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });

  const query = useUnitMargins();
  const rows = query.data?.data ?? EMPTY_ROWS;

  const sorted = useMemo(() => sortRows(rows, sorting[0]), [rows, sorting]);
  const page = useMemo(
    () =>
      sorted.slice(
        pagination.pageIndex * pagination.pageSize,
        (pagination.pageIndex + 1) * pagination.pageSize,
      ),
    [sorted, pagination],
  );

  return (
    <DataTable
      columns={unitMarginColumns}
      data={page}
      rowCount={sorted.length}
      sorting={sorting}
      onSortingChange={setSorting}
      pagination={pagination}
      onPaginationChange={setPagination}
      isPending={query.isPending}
      isError={query.isError}
      onRetry={() => void query.refetch()}
      emptyMessage="No hay productos activos en el catálogo."
    />
  );
}
