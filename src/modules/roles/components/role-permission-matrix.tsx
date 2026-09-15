"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldDescription, FieldLabel } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";

import { useSetRolePermissions } from "../hooks/use-role-mutations";
import { useRole } from "../hooks/use-roles";
import type { RolePermissionRef } from "../types/role.types";

/** Nadie fuera de este archivo necesita leer el `resource` en crudo. */
const RESOURCE_LABELS: Record<string, string> = {
  categories: "Categorías",
  products: "Productos",
  users: "Usuarios",
  roles: "Roles y permisos",
  audit: "Bitácora de auditoría",
};

type Group = { resource: string; label: string; items: RolePermissionRef[] };

function groupByResource(permissions: RolePermissionRef[]): Group[] {
  const groups = new Map<string, Group>();

  for (const permission of permissions) {
    const existing = groups.get(permission.resource);

    if (existing) {
      existing.items.push(permission);
      continue;
    }

    groups.set(permission.resource, {
      resource: permission.resource,
      label: RESOURCE_LABELS[permission.resource] ?? permission.resource,
      items: [permission],
    });
  }

  return [...groups.values()];
}

type RolePermissionMatrixProps = {
  roleId: string;
  /** `false` deja la matriz en solo lectura y sin botón de guardar. */
  canEdit: boolean;
};

export function RolePermissionMatrix({
  roleId,
  canEdit,
}: RolePermissionMatrixProps) {
  const query = useRole(roleId);
  const mutation = useSetRolePermissions();
  const [granted, setGranted] = useState<string[] | null>(null);

  const serverGranted = useMemo(
    () =>
      query.data?.permissions
        .filter((permission) => permission.granted)
        .map((permission) => permission.code) ?? null,
    [query.data],
  );

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-40 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-lg border p-6">
        <p className="text-sm text-muted-foreground">
          No se pudieron cargar los permisos del rol.
        </p>
        <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
          Reintentar
        </Button>
      </div>
    );
  }

  // `null` = sin ediciones pendientes: manda lo que dice el servidor.
  const selected = granted ?? serverGranted ?? [];
  const groups = groupByResource(query.data.permissions);
  const isDirty =
    serverGranted !== null &&
    (selected.length !== serverGranted.length ||
      selected.some((code) => !serverGranted.includes(code)));

  const toggle = (code: string, next: boolean) => {
    setGranted(
      next ? [...selected, code] : selected.filter((item) => item !== code),
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        {groups.map((group) => (
          <Card key={group.resource}>
            <CardHeader>
              <CardTitle>{group.label}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {group.items.map((permission) => {
                const inputId = `permission-${permission.code}`;

                return (
                  <div key={permission.code} className="flex items-start gap-3">
                    <Switch
                      id={inputId}
                      checked={selected.includes(permission.code)}
                      disabled={!canEdit || mutation.isPending}
                      onCheckedChange={(next) => toggle(permission.code, next)}
                      className="mt-0.5"
                    />
                    <FieldLabel htmlFor={inputId} className="flex-col items-start">
                      {/* La descripción es la etiqueta: el código nunca se muestra. */}
                      <FieldDescription className="text-foreground">
                        {permission.description ?? permission.action}
                      </FieldDescription>
                    </FieldLabel>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>

      {canEdit && (
        <div className="flex items-center gap-3">
          <Button
            type="button"
            disabled={!isDirty || mutation.isPending}
            onClick={() =>
              mutation.mutate(
                { id: roleId, permissionCodes: selected },
                // Devuelve el control al servidor en vez de resincronizar
                // el estado local desde un efecto.
                { onSuccess: () => setGranted(null) },
              )
            }
          >
            {mutation.isPending ? "Guardando…" : "Guardar cambios"}
          </Button>
          {isDirty && (
            <Button
              type="button"
              variant="ghost"
              disabled={mutation.isPending}
              onClick={() => setGranted(serverGranted)}
            >
              Descartar
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
