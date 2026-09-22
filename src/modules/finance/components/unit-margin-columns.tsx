"use client";

import { createColumnHelper } from "@tanstack/react-table";

import {
  dataTableFeatures,
  type DataTableColumnDef,
} from "@/components/shared/data-table";
import { formatPrice } from "@/lib/utils";

import type { UnitMarginDto } from "../types/finance.types";

const helper = createColumnHelper<typeof dataTableFeatures, UnitMarginDto>();

const percentFormatter = new Intl.NumberFormat("es-PE", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Sin costo cargado no hay margen: se dice "—", nunca 0 (spec 019 D5). */
const NO_DATA = "—";

const Cents = ({ cents }: { cents: number | null }) => (
  <span className="tabular-nums">
    {cents === null ? NO_DATA : formatPrice(cents)}
  </span>
);

export const unitMarginColumns: ReadonlyArray<
  DataTableColumnDef<UnitMarginDto>
> = helper.columns([
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
  helper.accessor("priceCents", {
    header: "Precio",
    cell: (info) => <Cents cents={info.getValue()} />,
  }),
  helper.accessor("priceNetCents", {
    header: "Precio sin IGV",
    enableSorting: false,
    cell: (info) => <Cents cents={info.getValue()} />,
  }),
  helper.accessor("costCents", {
    header: "Costo",
    cell: (info) => <Cents cents={info.getValue()} />,
  }),
  helper.accessor("marginCents", {
    header: "Margen",
    cell: (info) => {
      const cents = info.getValue();

      return (
        <span
          // Un margen negativo es información válida, no un error: se señala.
          className={cents !== null && cents < 0 ? "text-destructive" : undefined}
        >
          <Cents cents={cents} />
        </span>
      );
    },
  }),
  helper.accessor("marginPercent", {
    header: "Margen %",
    cell: (info) => {
      const percent = info.getValue();

      return (
        <span className="tabular-nums">
          {percent === null ? NO_DATA : percentFormatter.format(percent)}
        </span>
      );
    },
  }),
]);
