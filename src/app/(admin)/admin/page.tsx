import type { Metadata } from "next";

import { can } from "@/lib/permissions";
import { MetricsDashboard } from "@/modules/dashboard/components/metrics-dashboard";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Métricas de ventas, pedidos, productos y stock.",
};

export default async function AdminDashboardPage() {
  const allowed = await can("dashboard.read");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          Últimos 30 días. Se actualiza solo cada minuto.
        </p>
      </header>

      {allowed ? (
        <MetricsDashboard />
      ) : (
        // `/admin` es la portada del panel: un 404 aquí (el patrón de las
        // secciones) dejaría sin entrada a quien sí tiene otros permisos. Se
        // muestra el marco sin métricas; la API responde 403 igual.
        <p className="text-muted-foreground rounded-xl border p-6 text-sm">
          No tienes permiso para ver las métricas. Usa el menú lateral para ir a
          las secciones a las que sí tienes acceso.
        </p>
      )}
    </div>
  );
}
