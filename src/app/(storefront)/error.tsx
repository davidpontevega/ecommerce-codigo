"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function StorefrontError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // El error nunca se traga: el detalle queda en el log del servidor/consola.
  useEffect(() => {
    console.error("Storefront", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-4 px-4 py-24 text-center">
      <h1 className="text-xl font-semibold">No pudimos cargar la tienda</h1>
      <p className="text-muted-foreground max-w-md text-sm">
        Hubo un problema al leer el catálogo. Vuelve a intentarlo en unos
        segundos.
      </p>
      <Button
        onClick={reset}
        className="bg-brand text-brand-foreground h-11 rounded-full px-6"
      >
        Reintentar
      </Button>
    </div>
  );
}
