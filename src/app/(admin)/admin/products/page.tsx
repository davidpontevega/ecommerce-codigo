import type { Metadata } from "next";

import { ProductTable } from "@/modules/products/components/product-table";

export const metadata: Metadata = {
  title: "Productos",
  description: "Gestión del catálogo de productos.",
};

export default function ProductsPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Productos</h1>
        <p className="text-muted-foreground text-sm">
          Crea, edita, elimina y restaura los productos del catálogo.
        </p>
      </header>

      <ProductTable />
    </div>
  );
}
