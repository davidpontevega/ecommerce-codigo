import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { can } from "@/lib/permissions";
import { RoleList } from "@/modules/roles/components/role-list";

export const metadata: Metadata = {
  title: "Roles y permisos",
  description: "Qué puede hacer cada rol dentro del panel.",
};

export default async function RolesPage() {
  if (!(await can("roles.read"))) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Roles y permisos</h1>
        <p className="text-sm text-muted-foreground">
          Cada rol agrupa lo que una persona puede ver y hacer. Entra en uno
          para revisar el detalle.
        </p>
      </header>

      <RoleList />
    </div>
  );
}
