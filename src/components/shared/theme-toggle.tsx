"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Los dos iconos se renderizan siempre y es CSS (`dark:`) quien elige: leer
 * `resolvedTheme` para decidir el marcado provocaría un desajuste de hidratación
 * y un parpadeo en la primera carga.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label="Cambiar tema"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className={cn(
        "border-storefront-border bg-storefront-card size-11 rounded-full",
        className,
      )}
    >
      <Sun className="size-[18px] dark:hidden" />
      <Moon className="hidden size-[18px] dark:block" />
    </Button>
  );
}
