import type { Metadata } from "next";

import { CartLines } from "@/modules/cart/components/cart-lines";

export const metadata: Metadata = {
  title: "Carrito — E-commerce Tech",
  description: "Revisa tus productos antes de pagar.",
};

export default function CartPage() {
  return (
    <div className="flex flex-col gap-4 px-1 sm:px-3">
      <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">
        Carrito
      </h1>
      <CartLines />
    </div>
  );
}
