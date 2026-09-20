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
import { formatPrice } from "@/lib/utils";

import { useFinanceSummary } from "../hooks/use-finance-summary";

const GRID = "grid gap-4 sm:grid-cols-3";

const monthFormatter = new Intl.DateTimeFormat("es", {
  month: "long",
  year: "numeric",
});

/** `YYYY-MM` → "septiembre de 2026". El día 1 evita el corrimiento de zona. */
function monthLabel(month: string): string {
  return monthFormatter.format(new Date(`${month}-01T12:00:00`));
}

export function FinanceSummaryCards() {
  const query = useFinanceSummary();

  if (query.isPending) {
    return (
      <div className={GRID}>
        {[0, 1, 2].map((slot) => (
          <Skeleton key={slot} className="h-[130px] w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl border p-6">
        <p className="text-muted-foreground text-sm">
          No se pudo cargar el resumen de caja.
        </p>
        <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
          Reintentar
        </Button>
      </div>
    );
  }

  const { month, incomeCents, expenseCents, netCents } = query.data;
  const label = monthLabel(month);

  return (
    <div className={GRID}>
      <SummaryCard
        title="Ingresos"
        description={`Pedidos pagados de ${label}`}
        cents={incomeCents}
      />
      <SummaryCard
        title="Egresos"
        description={`Gastos registrados de ${label}`}
        cents={expenseCents}
      />
      <SummaryCard
        title="Neto"
        description="Ingresos menos egresos"
        cents={netCents}
        // Un neto negativo es información, no un error: se señala en color.
        className={netCents < 0 ? "text-destructive" : undefined}
      />
    </div>
  );
}

function SummaryCard({
  title,
  description,
  cents,
  className,
}: {
  title: string;
  description: string;
  cents: number;
  className?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className={`text-2xl font-semibold tabular-nums ${className ?? ""}`}>
          {formatPrice(cents)}
        </p>
      </CardContent>
    </Card>
  );
}
