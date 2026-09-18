import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ORDER_STATUS_LABELS } from "@/modules/orders-admin/constants";

import { AXIS_PROPS, GRID_COLOR, SERIES_COLOR, TOOLTIP_PROPS } from "../constants";
import type { StatusCount } from "../types/metrics.types";
import { EmptyMetric } from "./empty-metric";

type Props = { data: StatusCount[] };

export function OrdersStatusChart({ data }: Props) {
  if (data.every((row) => row.count === 0)) {
    return <EmptyMetric>Sin pedidos en los últimos 30 días.</EmptyMetric>;
  }

  const rows = data.map((row) => ({
    label: ORDER_STATUS_LABELS[row.status],
    count: row.count,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={rows} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID_COLOR} />
        <XAxis dataKey="label" {...AXIS_PROPS} />
        <YAxis width={40} allowDecimals={false} {...AXIS_PROPS} />
        <Tooltip
          cursor={{ fill: "var(--color-muted)" }}
          formatter={(value) => [String(value), "Pedidos"]}
          {...TOOLTIP_PROPS}
        />
        <Bar
          dataKey="count"
          fill={SERIES_COLOR}
          radius={[4, 4, 0, 0]}
          maxBarSize={24}
        >
          {/* Tres barras: la etiqueta directa cabe y ahorra ir al tooltip. */}
          <LabelList
            dataKey="count"
            position="top"
            className="fill-muted-foreground"
            fontSize={12}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
