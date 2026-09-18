import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { can } from "@/lib/permissions";
import { AdminOrderDetail } from "@/modules/orders-admin/components/admin-order-detail";

export const metadata: Metadata = {
  title: "Detalle del pedido",
  description: "Líneas, cliente y referencias de pago de un pedido.",
};

export default async function AdminOrderDetailPage({
  params,
}: PageProps<"/admin/orders/[id]">) {
  const { id } = await params;

  if (!(await can("orders.read"))) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Link
          href="/admin/orders"
          className="text-muted-foreground text-sm hover:underline"
        >
          ← Pedidos
        </Link>
        <h1 className="text-2xl font-semibold">Detalle del pedido</h1>
        <p className="text-muted-foreground text-sm">
          Solo lectura: las referencias de Stripe sirven para rastrear el pago.
        </p>
      </header>

      <AdminOrderDetail orderId={id} />
    </div>
  );
}
