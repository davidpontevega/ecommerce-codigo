import Link from "next/link";

import { Badge } from "@/components/ui/badge";

import type { LowStockProduct } from "../types/metrics.types";
import { EmptyMetric } from "./empty-metric";

type Props = { data: LowStockProduct[] };

export function LowStockList({ data }: Props) {
  if (data.length === 0) {
    return <EmptyMetric>Todo con stock suficiente.</EmptyMetric>;
  }

  return (
    <ul className="flex flex-col">
      {data.map((product) => (
        <li key={product.productId}>
          <Link
            href="/admin/products"
            className="hover:bg-muted flex items-center justify-between gap-3 rounded-md px-2 py-2 text-sm"
          >
            <span className="truncate">{product.name}</span>
            <Badge variant={product.stock === 0 ? "destructive" : "secondary"}>
              {product.stock === 0 ? "Agotado" : `${product.stock} u.`}
            </Badge>
          </Link>
        </li>
      ))}
    </ul>
  );
}
