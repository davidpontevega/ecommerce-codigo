"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";

import {
  dataTableFeatures,
  type DataTableColumnDef,
} from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { UserDto } from "../types/user.types";

const helper = createColumnHelper<typeof dataTableFeatures, UserDto>();

const dateFormatter = new Intl.DateTimeFormat("es", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function fullName(user: UserDto): string {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
}

export type UserRowActions = {
  onChangeRoles: (user: UserDto) => void;
  onToggleActive: (user: UserDto) => void;
};

export function buildUserColumns({
  onChangeRoles,
  onToggleActive,
}: UserRowActions): ReadonlyArray<DataTableColumnDef<UserDto>> {
  return helper.columns([
    helper.accessor("firstName", {
      header: "Nombre",
      cell: (info) => fullName(info.row.original),
    }),
    helper.accessor("email", { header: "Correo" }),
    helper.accessor("isActive", {
      header: "Estado",
      enableSorting: false,
      cell: (info) => (
        <Badge variant={info.getValue() ? "default" : "secondary"}>
          {info.getValue() ? "Activo" : "Inactivo"}
        </Badge>
      ),
    }),
    helper.display({
      id: "roles",
      header: "Roles",
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.roles.length === 0 ? (
            <span className="text-sm text-muted-foreground">Sin roles</span>
          ) : (
            row.original.roles.map((role) => (
              <Badge key={role.id} variant="outline">
                {role.name}
              </Badge>
            ))
          )}
        </div>
      ),
    }),
    helper.accessor("createdAt", {
      header: "Alta",
      cell: (info) => dateFormatter.format(new Date(info.getValue())),
    }),
    helper.display({
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon" aria-label="Abrir acciones">
                  <MoreHorizontal className="size-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onChangeRoles(row.original)}>
                Cambiar roles
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onToggleActive(row.original)}>
                {row.original.isActive ? "Desactivar" : "Reactivar"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    }),
  ]);
}
