import { FolderTree, Package, Receipt, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";

import { getCurrentUser } from "@/lib/auth";
import type { PermissionCode } from "@/lib/permissions";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission: PermissionCode;
};

const NAV_ITEMS: ReadonlyArray<NavItem> = [
  {
    label: "Categorías",
    href: "/admin/categories",
    icon: FolderTree,
    permission: "categories.read",
  },
  {
    label: "Productos",
    href: "/admin/products",
    icon: Package,
    permission: "products.read",
  },
  {
    label: "Pedidos",
    href: "/admin/orders",
    icon: Receipt,
    permission: "orders.read",
  },
  {
    label: "Usuarios",
    href: "/admin/users",
    icon: Users,
    permission: "users.read",
  },
  {
    label: "Roles y permisos",
    href: "/admin/roles",
    icon: ShieldCheck,
    permission: "roles.read",
  },
];

/**
 * Ocultar un enlace no es una defensa: cada página vuelve a comprobar su
 * permiso en el servidor. Esto solo evita mostrar puertas cerradas.
 */
export async function AdminNav() {
  const user = await getCurrentUser();
  const permissions = user?.permissions ?? [];
  const items = NAV_ITEMS.filter((item) =>
    permissions.includes(item.permission),
  );

  return (
    <nav className="flex flex-col gap-1">
      {items.map(({ label, href, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted"
        >
          <Icon className="size-4" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
