import { Skeleton } from "@/components/ui/skeleton";

/** Misma retícula que `/perfil`: encabezado, fila de pestañas y tarjeta. */
export default function ProfileLoading() {
  return (
    <div className="flex flex-col gap-4 px-1 sm:px-3">
      <Skeleton className="h-8 w-44 rounded-lg" />

      <Skeleton className="h-8 w-full rounded-lg" />

      <div className="border-storefront-border bg-storefront-card rounded-card flex flex-col gap-3 border p-6 sm:p-8">
        <div className="flex items-center gap-4">
          <Skeleton className="size-16 rounded-full" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-40 rounded-full" />
            <Skeleton className="h-4 w-56 rounded-full" />
          </div>
        </div>

        <Skeleton className="my-3 h-px w-full rounded-none" />

        <div className="grid gap-5 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="flex flex-col gap-2">
              <Skeleton className="h-3 w-24 rounded-full" />
              <Skeleton className="h-4 w-40 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
