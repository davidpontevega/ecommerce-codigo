import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { can } from "@/lib/permissions";
import { AdminOrderTable } from "@/modules/orders-admin/components/admin-order-table";

export const metadata: Metadata = {
  title: "Órdenes",
  description: "Listado de órdenes con filtros de fecha, estado y cliente.",
};

export default async function AdminOrdersPage() {
  // El middleware solo distingue staff de cliente: sin esto, cualquier miembro
  // del personal podría teclear la URL.
  if (!(await can("orders.read"))) {
    notFound();
  }

  const canUpdate = await can("orders.update");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Órdenes</h1>
        <p className="text-muted-foreground text-sm">
          Consulta las órdenes de la tienda. El pago mueve el estado solo;
          {canUpdate ? " también puedes cambiarlo a mano." : " no se edita."}
        </p>
      </header>

      <AdminOrderTable canUpdate={canUpdate} />
    </div>
  );
}
