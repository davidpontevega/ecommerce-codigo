"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { OrdersQuery } from "../schemas/order.schema";

/** `en-CA` formatea `YYYY-MM-DD`, el mismo formato que acepta la API. */
const limaDayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Lima",
});

/**
 * El «hoy» del navegador puede ser otro día que el de Lima; el mes se calcula
 * con el mismo huso con el que la lista agrupa y el servidor filtra.
 */
export function currentMonthRange(): OrdersQuery {
  const today = limaDayFormatter.format(new Date());
  return { from: `${today.slice(0, 8)}01`, to: today };
}

type Mode = "month" | "range";

const MODE_LABELS: Record<Mode, string> = {
  month: "Mes actual",
  range: "Rango de fechas",
};

export function PurchaseFilters({
  onChange,
}: {
  onChange: (range: OrdersQuery) => void;
}) {
  const [mode, setMode] = useState<Mode>("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const invalid = from !== "" && to !== "" && from > to;

  const applyRange = (nextFrom: string, nextTo: string) => {
    setFrom(nextFrom);
    setTo(nextTo);

    // Un rango invertido no se consulta: la API lo rechazaría con 400 y el
    // usuario vería un error en vez de la nota de abajo.
    if (nextFrom !== "" && nextTo !== "" && nextFrom > nextTo) return;

    onChange({ from: nextFrom || undefined, to: nextTo || undefined });
  };

  const applyMode = (next: Mode) => {
    setMode(next);
    if (next === "month") {
      onChange(currentMonthRange());
    } else {
      applyRange(from, to);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="purchases-period" className="text-xs">
            Periodo
          </Label>
          <Select
            value={mode}
            onValueChange={(value: Mode | null) => applyMode(value ?? "month")}
          >
            <SelectTrigger id="purchases-period" className="h-10 w-52">
              <SelectValue>
                {(value: Mode) => MODE_LABELS[value] ?? MODE_LABELS.month}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">{MODE_LABELS.month}</SelectItem>
              <SelectItem value="range">{MODE_LABELS.range}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {mode === "range" ? (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="purchases-from" className="text-xs">
                Desde
              </Label>
              <Input
                id="purchases-from"
                type="date"
                value={from}
                max={to || undefined}
                aria-invalid={invalid}
                onChange={(event) => applyRange(event.target.value, to)}
                className="h-10 w-40"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="purchases-to" className="text-xs">
                Hasta
              </Label>
              <Input
                id="purchases-to"
                type="date"
                value={to}
                min={from || undefined}
                aria-invalid={invalid}
                onChange={(event) => applyRange(from, event.target.value)}
                className="h-10 w-40"
              />
            </div>
          </>
        ) : null}
      </div>

      {invalid ? (
        <p className="text-destructive text-xs">
          La fecha «desde» no puede ser posterior a «hasta».
        </p>
      ) : null}
    </div>
  );
}
