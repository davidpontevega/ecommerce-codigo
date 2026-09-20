import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { can } from "@/lib/permissions";
import { ExpenseTable } from "@/modules/finance/components/expense-table";
import { FinanceSummaryCards } from "@/modules/finance/components/finance-summary-cards";

export const metadata: Metadata = {
  title: "Finanzas",
  description: "Resumen de caja del mes y gastos varios del negocio.",
};

export default async function AdminFinancePage() {
  // El middleware solo distingue staff de cliente: sin esto, cualquier miembro
  // del personal podría teclear la URL.
  if (!(await can("finance.manage"))) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Finanzas</h1>
        <p className="text-muted-foreground text-sm">
          Caja del mes en curso y registro de gastos varios. Los ingresos los
          mueve el pago de los pedidos, no se editan a mano.
        </p>
      </header>

      <FinanceSummaryCards />
      <ExpenseTable />
    </div>
  );
}
