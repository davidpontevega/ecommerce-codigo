import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { can } from "@/lib/permissions";
import { RolePermissionMatrix } from "@/modules/roles/components/role-permission-matrix";

export const metadata: Metadata = {
  title: "Detalle del rol",
  description: "Permisos que concede este rol.",
};

export default async function RoleDetailPage({
  params,
}: PageProps<"/admin/roles/[id]">) {
  const { id } = await params;

  if (!(await can("roles.read"))) {
    notFound();
  }

  const canEdit = await can("roles.update_permissions");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Link
          href="/admin/roles"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Roles y permisos
        </Link>
        <h1 className="text-2xl font-semibold">Permisos del rol</h1>
        <p className="text-sm text-muted-foreground">
          {canEdit
            ? "Activa o desactiva lo que este rol permite hacer y guarda los cambios."
            : "Consulta lo que este rol permite hacer. No tienes permiso para modificarlo."}
        </p>
      </header>

      <RolePermissionMatrix roleId={id} canEdit={canEdit} />
    </div>
  );
}
