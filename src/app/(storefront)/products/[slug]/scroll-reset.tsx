"use client";

import { useEffect } from "react";

/**
 * Al volver de `loading.tsx` en esta ruta, el App Router de Next deja el scroll a
 * media página (cae sobre "Productos parecidos"). Forzamos el tope al montar la
 * ficha real; `key` por producto para que se repita en cada navegación entre
 * fichas.
 *
 * ponytail: workaround de scroll del framework; si Next lo arregla, se borra el
 * archivo y su uso en `page.tsx`.
 */
export function ScrollReset({ slug }: { slug: string }) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  return null;
}
