import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { can } from "@/lib/permissions";
import { IGV_RATE_PERCENT } from "@/lib/tax";
import { UnitMarginTable } from "@/modules/finance/components/unit-margin-table";

export const metadata: Metadata = {
  title: "Precio unitario",
  description: "Precio, costo y margen por producto del catálogo activo.",
};

export default async function AdminUnitPricePage() {
  // El costo es dato financiero: el gate es `finance.manage`, no `products.read`.
  if (!(await can("finance.manage"))) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Precio unitario</h1>
        <p className="text-muted-foreground text-sm">
          Margen por producto sobre el precio sin IGV ({IGV_RATE_PERCENT} %). El
          costo se carga al editar el producto; sin costo no hay margen que
          mostrar.
        </p>
      </header>

      <UnitMarginTable />
    </div>
  );
}
