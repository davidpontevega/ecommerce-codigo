/**
 * `NEXT_PUBLIC_APP_URL` con la barra final recortada. Sin esto, un valor con
 * `/` al final (p. ej. Vercel: `https://app.vercel.app/`) produce URLs con
 * doble barra (`.../checkout//success`) al concatenar una ruta que empieza
 * con `/` — Next.js normaliza eso a un 404 real, no un typo cosmético.
 */
export function getAppUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(
    /\/+$/,
    "",
  );
}
