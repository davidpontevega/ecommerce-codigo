"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { useAdminMetrics } from "../hooks/use-admin-metrics";
import { LowStockList } from "./low-stock-list";
import { OrdersStatusChart } from "./orders-status-chart";
import { SalesChart } from "./sales-chart";
import { TopProductsChart } from "./top-products-chart";

const GRID = "grid gap-4 lg:grid-cols-2";

export function MetricsDashboard() {
  // Se refresca sola cada 60s (D1); `useQuery` conserva los datos previos
  // durante el refetch, así que la vista no parpadea a skeleton.
  const query = useAdminMetrics();

  if (query.isPending) {
    return (
      <div className={GRID}>
        {[0, 1, 2, 3].map((slot) => (
          <Skeleton key={slot} className="h-[320px] w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl border p-6">
        <p className="text-muted-foreground text-sm">
          No se pudieron cargar las métricas.
        </p>
        <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
          Reintentar
        </Button>
      </div>
    );
  }

  const metrics = query.data;

  return (
    <div className={GRID}>
      <MetricCard
        title="Ventas"
        description="Órdenes pagadas, últimos 30 días"
        className="lg:col-span-2"
      >
        <SalesChart data={metrics.salesByDay} />
      </MetricCard>

      <MetricCard title="Órdenes por estado" description="Últimos 30 días">
        <OrdersStatusChart data={metrics.ordersByStatus} />
      </MetricCard>

      <MetricCard
        title="Top productos"
        description="Unidades vendidas, últimos 30 días"
      >
        <TopProductsChart data={metrics.topProducts} />
      </MetricCard>

      <MetricCard
        title="Stock bajo"
        description="Productos activos con 5 unidades o menos"
        className="lg:col-span-2"
      >
        <LowStockList data={metrics.lowStock} />
      </MetricCard>
    </div>
  );
}

function MetricCard({
  title,
  description,
  className,
  children,
}: {
  title: string;
  description: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
