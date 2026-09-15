import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { can } from "@/lib/permissions";
import { UserTable } from "@/modules/users/components/user-table";

export const metadata: Metadata = {
  title: "Usuarios",
  description: "Alta, roles y estado del personal.",
};

export default async function UsersPage() {
  // El middleware solo distingue staff de cliente: sin esto, cualquier miembro
  // del personal podría teclear la URL.
  if (!(await can("users.read"))) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Usuarios</h1>
        <p className="text-sm text-muted-foreground">
          Da de alta al personal, cambia sus roles y activa o desactiva su
          acceso.
        </p>
      </header>

      <UserTable />
    </div>
  );
}
