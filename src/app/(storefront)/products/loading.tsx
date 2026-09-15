import { Skeleton } from "@/components/ui/skeleton";

export default function ProductsLoading() {
  return (
    <div className="grid gap-3.5 lg:grid-cols-[1fr_340px]">
      <Skeleton className="h-[470px] rounded-[26px]" />
      <div className="flex flex-col gap-3.5">
        <Skeleton className="h-24 rounded-[26px]" />
        <Skeleton className="h-40 rounded-[26px]" />
        <Skeleton className="h-64 rounded-[26px]" />
      </div>
      <div className="grid gap-3.5 sm:grid-cols-3 lg:col-start-1">
        <Skeleton className="h-32 rounded-[26px]" />
        <Skeleton className="h-32 rounded-[26px]" />
        <Skeleton className="h-32 rounded-[26px]" />
      </div>
    </div>
  );
}
