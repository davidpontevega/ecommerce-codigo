"use client";

import { ShoppingBag } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetTrigger } from "@/components/ui/sheet";

import { cartCount, useCartStore } from "../store/cart-store";
import { CartDrawer } from "./cart-drawer";

export function CartButton() {
  const count = useCartStore((state) => cartCount(state.lines));
  const reduced = useReducedMotion();

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button
            size="icon"
            aria-label={
              count > 0 ? `Carrito, ${count} artículos` : "Carrito, vacío"
            }
            className="bg-foreground text-background rounded-pill relative size-11"
          />
        }
      >
        <ShoppingBag className="size-[18px]" />
        {count > 0 ? (
          // `key={count}` reinicia el `bump` en cada alta.
          <motion.span
            key={count}
            animate={reduced ? undefined : { scale: [1, 1.32, 1] }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
            className="bg-brand text-brand-foreground rounded-pill absolute -top-0.5 -right-0.5 min-w-[19px] px-1.5 font-mono text-[10.5px] leading-[19px] font-semibold"
          >
            {count}
          </motion.span>
        ) : null}
      </SheetTrigger>
      <CartDrawer />
    </Sheet>
  );
}
