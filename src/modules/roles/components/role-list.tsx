"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { useRoles } from "../hooks/use-roles";

export function RoleList() {
  const query = useRoles();

  if (query.isPending) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-32 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-lg border p-6">
        <p className="text-sm text-muted-foreground">
          No se pudieron cargar los roles.
        </p>
        <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {query.data.map((role) => (
        <Card
          key={role.id}
          className="relative transition-colors hover:bg-muted/40"
        >
          <CardHeader>
            <CardTitle>
              <Link
                href={`/admin/roles/${role.id}`}
                // El enlace cubre la tarjeta entera: el destino es uno solo.
                className="after:absolute after:inset-0 focus-visible:underline"
              >
                {role.name}
              </Link>
            </CardTitle>
            <CardDescription>{role.description}</CardDescription>
            <p className="pt-2 text-sm text-muted-foreground">
              {role.userCount === 1
                ? "1 persona con este rol"
                : `${role.userCount} personas con este rol`}
            </p>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}
