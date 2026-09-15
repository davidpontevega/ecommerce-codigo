import { UserButton } from "@clerk/nextjs";

import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/auth";

export async function AdminHeader() {
  const user = await getCurrentUser();

  const name =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.email ||
    "Sesión no disponible";

  return (
    <header className="flex h-14 items-center justify-between gap-4 border-b px-6">
      <div className="flex min-w-0 items-center gap-3">
        <span className="truncate text-sm font-medium">{name}</span>
        {user?.roles.map((role) => (
          <Badge key={role.slug} variant="secondary">
            {role.name}
          </Badge>
        ))}
      </div>
      <UserButton />
    </header>
  );
}
