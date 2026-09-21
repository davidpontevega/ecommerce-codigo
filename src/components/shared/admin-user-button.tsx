"use client";

import { UserButton } from "@clerk/nextjs";
import { useSyncExternalStore } from "react";

import { Skeleton } from "@/components/ui/skeleton";

const subscribeNoop = () => () => {};

/**
 * `UserButton` monta su UI vía un host div que Clerk solo puede crear en el
 * cliente (no hay nada que renderizar en SSR); si se monta directo, el primer
 * render del cliente ya trae ese div y React lo compara contra un servidor
 * que nunca lo tuvo → hydration mismatch. `useSyncExternalStore` con snapshots
 * de servidor/cliente distintos es el patrón recomendado por React para esto:
 * SSR y el primer render del cliente coinciden en no mostrar nada; recién
 * después de hidratar se revela el botón real, como una actualización normal.
 */
export function AdminUserButton() {
  const isClient = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );

  if (!isClient) return <Skeleton className="size-7 rounded-full" />;

  return <UserButton />;
}
