import { Skeleton } from "@/components/ui/skeleton";

/** Misma retícula que la ficha para que el salto sea de contenido, no de layout. */
export default function ProductDetailLoading() {
  return (
    <div className="flex flex-col gap-4 px-1 sm:px-3">
      <Skeleton className="h-4 w-64 rounded-full" />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <Skeleton className="rounded-card aspect-[4/3] w-full" />

        <div className="border-storefront-border bg-storefront-card rounded-card flex flex-col gap-3 border p-6 sm:p-8">
          <Skeleton className="h-3 w-20 rounded-full" />
          <Skeleton className="h-8 w-3/4 rounded-lg" />
          <Skeleton className="h-4 w-full rounded-full" />
          <Skeleton className="mt-3 h-9 w-44 rounded-lg" />
          <Skeleton className="h-3 w-24 rounded-full" />
          <Skeleton className="rounded-pill mt-3 h-13 w-full" />
          <Skeleton className="mt-5 h-3 w-32 rounded-full" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
