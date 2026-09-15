import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * Imagen del producto desde `image_url`. Si no hay URL, cae a un tile
 * determinista con la inicial.
 *
 * `next/image` **solo** para rutas locales (`/products/x.jpg`): `next.config.ts`
 * no declara `images.remotePatterns`, así que una URL externa —que el panel
 * puede teclear— reventaría en runtime. Esas siguen con `<img>` plano.
 *
 * El recorte lo hace el `<div>` contenedor (`aspect-*` + `overflow-hidden`), no
 * el `<img>`: `aspect-ratio` sobre un elemento reemplazado con dimensiones
 * intrínsecas no siempre se respeta.
 */
export function ProductImage({
  name,
  imageUrl,
  className,
  sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
}: {
  name: string;
  imageUrl?: string | null;
  className?: string;
  sizes?: string;
}) {
  if (imageUrl) {
    return (
      <div
        className={cn(
          "bg-storefront-sunk relative aspect-square w-full overflow-hidden",
          className,
        )}
      >
        {imageUrl.startsWith("/") ? (
          <Image
            src={imageUrl}
            alt={name}
            fill
            sizes={sizes}
            className="object-cover"
          />
        ) : (
          // `absolute` para que la altura intrínseca de la foto no estire el
          // contenedor: manda el `aspect-*`.
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={imageUrl}
            alt={name}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 size-full object-cover"
          />
        )}
      </div>
    );
  }

  const initial = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div
      aria-hidden
      className={cn(
        "bg-storefront-sunk text-muted-foreground grid aspect-square w-full place-items-center",
        className,
      )}
    >
      <span className="text-4xl font-semibold tracking-tight">{initial}</span>
    </div>
  );
}
