import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { can } from "@/lib/permissions";
import { InventoryTable } from "@/modules/products/components/inventory-table";

export const metadata: Metadata = {
  title: "Inventario",
  description: "Existencias del catálogo activo, de menor a mayor stock.",
};

export default async function AdminInventoryPage() {
  // El endpoint compartido no exige permiso para `status=available`, así que la
  // puerta de esta vista es esta comprobación, no el middleware.
  if (!(await can("products.read"))) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Inventario</h1>
        <p className="text-muted-foreground text-sm">
          Catálogo activo ordenado por existencias. Corrige el stock con
          «Editar».
        </p>
      </header>

      <InventoryTable />
    </div>
  );
}
