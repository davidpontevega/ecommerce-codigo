import type { Metadata } from "next";

import { CategoryTable } from "@/modules/categories/components/category-table";

export const metadata: Metadata = {
  title: "Categorías",
  description: "Gestión de la taxonomía del catálogo.",
};

export default function CategoriesPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Categorías</h1>
        <p className="text-sm text-muted-foreground">
          Crea, edita y desactiva las categorías del catálogo.
        </p>
      </header>

      <CategoryTable />
    </div>
  );
}
