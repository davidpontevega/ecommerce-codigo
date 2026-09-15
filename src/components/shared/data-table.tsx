"use client";

import {
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type OnChangeFn,
  type PaginationState,
  type RowData,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Estático: recrearlo en cada render invalidaría los modelos de la tabla.
// Sin slots de row model porque Postgres ya devuelve la página ordenada.
export const dataTableFeatures = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
});

export type DataTableFeatures = typeof dataTableFeatures;

export type DataTableColumnDef<TData extends RowData> = ColumnDef<
  DataTableFeatures,
  TData
>;

type DataTableProps<TData extends RowData> = {
  columns: ReadonlyArray<DataTableColumnDef<TData>>;
  data: TData[];
  rowCount: number;
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  pagination: PaginationState;
  onPaginationChange: OnChangeFn<PaginationState>;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  emptyMessage: string;
};

const SKELETON_ROWS = 5;

export function DataTable<TData extends RowData>({
  columns,
  data,
  rowCount,
  sorting,
  onSortingChange,
  pagination,
  onPaginationChange,
  isPending,
  isError,
  onRetry,
  emptyMessage,
}: DataTableProps<TData>) {
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data,
    rowCount,
    manualSorting: true,
    manualPagination: true,
    state: { sorting, pagination },
    onSortingChange,
    onPaginationChange,
  });

  const pageCount = table.getPageCount();
  const firstRow = rowCount === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1;
  const lastRow = Math.min((pagination.pageIndex + 1) * pagination.pageSize, rowCount);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();

                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1.5 font-medium hover:text-foreground"
                        >
                          <table.FlexRender header={header} />
                          {sorted === "asc" ? (
                            <ArrowUp className="size-3.5" aria-hidden />
                          ) : sorted === "desc" ? (
                            <ArrowDown className="size-3.5" aria-hidden />
                          ) : (
                            <ChevronsUpDown
                              className="size-3.5 opacity-50"
                              aria-hidden
                            />
                          )}
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {isError ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center align-middle"
                >
                  <div className="flex flex-col items-center gap-3">
                    <p className="text-sm text-muted-foreground">
                      No se pudieron cargar los datos.
                    </p>
                    <Button variant="outline" size="sm" onClick={onRetry}>
                      Reintentar
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : isPending ? (
              Array.from({ length: SKELETON_ROWS }, (_, rowIndex) => (
                <TableRow key={`skeleton-${rowIndex}`}>
                  {columns.map((_column, columnIndex) => (
                    <TableCell key={`skeleton-${rowIndex}-${columnIndex}`}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center align-middle text-sm text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getAllCells().map((cell) => (
                    <TableCell key={cell.id}>
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {rowCount === 0
            ? "Sin resultados"
            : `Mostrando ${firstRow}–${lastRow} de ${rowCount}`}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Página {pagination.pageIndex + 1} de {Math.max(pageCount, 1)}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  );
}
