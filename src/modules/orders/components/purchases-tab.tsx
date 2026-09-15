"use client";

import { useState } from "react";

import type { OrdersQuery } from "../schemas/order.schema";
import { currentMonthRange, PurchaseFilters } from "./purchase-filters";
import { PurchaseList } from "./purchase-list";

/** Frontera cliente de la pestaña: la página `/perfil` sigue siendo Server Component. */
export function PurchasesTab() {
  const [range, setRange] = useState<OrdersQuery>(currentMonthRange);

  return (
    <div className="flex flex-col gap-5">
      <PurchaseFilters onChange={setRange} />
      <PurchaseList range={range} />
    </div>
  );
}
