import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatPrice, startOfLimaDay } from "@/lib/utils";

import {
  AXIS_PROPS,
  GRID_COLOR,
  SERIES_COLOR,
  SURFACE_COLOR,
  TOOLTIP_PROPS,
  compactPrice,
  longLimaDay,
  shortLimaDay,
} from "../constants";
import type { SalesPoint } from "../types/metrics.types";

type Props = { data: SalesPoint[] };

export function SalesChart({ data }: Props) {
  const total = data.reduce((sum, point) => sum + point.totalCents, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* La cifra de la ventana como número principal: la línea cuenta la
          forma, no el total, y leerlo del eje es adivinar. */}
      <p className="text-3xl font-semibold tracking-tight">
        {formatPrice(total)}
      </p>

      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID_COLOR} />
          <XAxis
            dataKey="date"
            minTickGap={24}
            tickFormatter={(date: string) => shortLimaDay(startOfLimaDay(date))}
            {...AXIS_PROPS}
          />
          <YAxis width={64} tickFormatter={compactPrice} {...AXIS_PROPS} />
          <Tooltip
            cursor={{ stroke: GRID_COLOR }}
            formatter={(value) => [formatPrice(Number(value)), "Ventas"]}
            labelFormatter={(date) => longLimaDay(startOfLimaDay(String(date)))}
            {...TOOLTIP_PROPS}
          />
          <Line
            type="linear"
            dataKey="totalCents"
            stroke={SERIES_COLOR}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            // Un punto por día son 30 puntos: pintarlos todos tapa la línea.
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: SURFACE_COLOR }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
