"use client";

import type { PaginationState, SortingState } from "@tanstack/react-table";
import { useMemo, useState } from "react";

import { DataTable } from "@/components/shared/data-table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDebounce } from "@/hooks/use-debounce";

import { useSetUserActive } from "../hooks/use-user-mutations";
import { useUsers } from "../hooks/use-users";
import { userSortFields, type UserQueryInput } from "../schemas/user.schema";
import type { UserDto } from "../types/user.types";
import { buildUserColumns, fullName } from "./user-columns";
import { UserFormDialog } from "./user-form-dialog";
import { UserRolesDialog } from "./user-roles-dialog";

type UserStatus = UserQueryInput["status"];
type UserSortField = UserQueryInput["sortBy"];

const statusOptions: ReadonlyArray<{ value: UserStatus; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "active", label: "Activos" },
  { value: "inactive", label: "Inactivos" },
];

const EMPTY_ROWS: UserDto[] = [];

function isSortField(value: string): value is UserSortField {
  return (userSortFields as ReadonlyArray<string>).includes(value);
}

export function UserTable() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<UserStatus>("all");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [isFormOpen, setIsFormOpen] = useState(false);
  // Cambia en cada apertura para remontar el diálogo con estado limpio.
  const [formKey, setFormKey] = useState(0);
  const [editingRoles, setEditingRoles] = useState<UserDto | null>(null);
  const [pendingToggle, setPendingToggle] = useState<UserDto | null>(null);

  const debouncedSearch = useDebounce(search);
  const setActiveMutation = useSetUserActive();

  const activeSort = sorting[0];
  const sortBy: UserSortField =
    activeSort && isSortField(activeSort.id) ? activeSort.id : "createdAt";

  const params: UserQueryInput = {
    search: debouncedSearch.trim() || undefined,
    status,
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    sortBy,
    sortDir: activeSort?.desc === false ? "asc" : "desc",
  };

  const query = useUsers(params);

  const columns = useMemo(
    () =>
      buildUserColumns({
        onChangeRoles: (user) => setEditingRoles(user),
        onToggleActive: (user) => {
          if (user.isActive) {
            setPendingToggle(user);
            return;
          }
          setActiveMutation.mutate({ id: user.id, isActive: true });
        },
      }),
    [setActiveMutation],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPagination((current) => ({ ...current, pageIndex: 0 }));
            }}
            placeholder="Buscar por nombre o correo"
            aria-label="Buscar usuarios"
            className="w-64"
          />
          <Select
            value={status}
            onValueChange={(value: UserStatus | null) => {
              setStatus(value ?? "all");
              setPagination((current) => ({ ...current, pageIndex: 0 }));
            }}
          >
            <SelectTrigger className="w-40" aria-label="Filtrar por estado">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={() => {
            setFormKey((current) => current + 1);
            setIsFormOpen(true);
          }}
        >
          Nuevo usuario
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={query.data?.data ?? EMPTY_ROWS}
        rowCount={query.data?.total ?? 0}
        sorting={sorting}
        onSortingChange={setSorting}
        pagination={pagination}
        onPaginationChange={setPagination}
        isPending={query.isPending}
        isError={query.isError}
        onRetry={() => void query.refetch()}
        emptyMessage="No hay usuarios que coincidan con el filtro."
      />

      <UserFormDialog
        key={formKey}
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
      />

      <UserRolesDialog
        key={editingRoles?.id ?? "none"}
        open={editingRoles !== null}
        onOpenChange={(open) => {
          if (!open) setEditingRoles(null);
        }}
        user={editingRoles}
      />

      <AlertDialog
        open={pendingToggle !== null}
        onOpenChange={(open) => {
          if (!open) setPendingToggle(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar al usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingToggle ? fullName(pendingToggle) : "Esta persona"} perderá
              el acceso de inmediato. Podrás reactivarlo más tarde.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!pendingToggle) return;
                setActiveMutation.mutate({
                  id: pendingToggle.id,
                  isActive: false,
                });
                setPendingToggle(null);
              }}
            >
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
