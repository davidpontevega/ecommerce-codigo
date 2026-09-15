import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-2xl font-semibold">Página no encontrada</h1>
      <p className="text-muted-foreground">
        El recurso que buscas no existe o fue movido.
      </p>
      <Link href="/" className="underline underline-offset-4">
        Volver al inicio
      </Link>
    </main>
  );
}
