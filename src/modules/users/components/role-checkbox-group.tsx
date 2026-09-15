"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldDescription, FieldLabel } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { useRoles } from "@/modules/roles/hooks/use-roles";

type RoleCheckboxGroupProps = {
  /** Ids de los roles marcados. */
  value: string[];
  onChange: (roleIds: string[]) => void;
  disabled?: boolean;
  /** Prefijo de los `id` del DOM: los dos diálogos pueden convivir montados. */
  idPrefix: string;
};

export function RoleCheckboxGroup({
  value,
  onChange,
  disabled,
  idPrefix,
}: RoleCheckboxGroupProps) {
  const query = useRoles();

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-sm text-muted-foreground">
          No se pudieron cargar los roles.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void query.refetch()}
        >
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {query.data.map((role) => {
        const inputId = `${idPrefix}-role-${role.id}`;
        const checked = value.includes(role.id);

        return (
          <div key={role.id} className="flex items-start gap-3">
            <Checkbox
              id={inputId}
              checked={checked}
              disabled={disabled}
              onCheckedChange={(next) =>
                onChange(
                  next
                    ? [...value, role.id]
                    : value.filter((id) => id !== role.id),
                )
              }
              className="mt-0.5"
            />
            <div className="flex flex-col gap-0.5">
              <FieldLabel htmlFor={inputId}>{role.name}</FieldLabel>
              {role.description && (
                <FieldDescription>{role.description}</FieldDescription>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
