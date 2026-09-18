import {
  Bar,
  BarChart,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AXIS_PROPS, SERIES_COLOR, TOOLTIP_PROPS } from "../constants";
import type { TopProduct } from "../types/metrics.types";
import { EmptyMetric } from "./empty-metric";

type Props = { data: TopProduct[] };

/** El eje de categorías no da para más; el nombre completo va en el tooltip. */
function truncate(name: string): string {
  return name.length > 22 ? `${name.slice(0, 21)}…` : name;
}

export function TopProductsChart({ data }: Props) {
  if (data.length === 0) {
    return <EmptyMetric>Aún no hay ventas en los últimos 30 días.</EmptyMetric>;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      {/* Barras horizontales: los nombres de producto son largos y en
          columnas verticales se solaparían o saldrían rotados. */}
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 32, left: 0, bottom: 0 }}
      >
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="name"
          width={150}
          tickFormatter={truncate}
          {...AXIS_PROPS}
        />
        <Tooltip
          cursor={{ fill: "var(--color-muted)" }}
          formatter={(value) => [String(value), "Unidades"]}
          {...TOOLTIP_PROPS}
        />
        <Bar
          dataKey="qty"
          fill={SERIES_COLOR}
          radius={[0, 4, 4, 0]}
          maxBarSize={24}
        >
          <LabelList
            dataKey="qty"
            position="right"
            className="fill-muted-foreground"
            fontSize={12}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
