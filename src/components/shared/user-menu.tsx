"use client";

import { Show, UserButton } from "@clerk/nextjs";
import { User } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Isla de cliente: `<UserButton>` solo acepta `<UserButton.MenuItems>` como hijo
 * cuando se renderiza dentro de un Client Component (Clerk lo exige y si no,
 * ignora el ítem). El fallback sin sesión sigue siendo un enlace a `/sign-in`.
 */
export function UserMenu() {
  return (
    <Show
      when="signed-in"
      fallback={
        <Button
          variant="outline"
          nativeButton={false}
          className="border-storefront-border bg-storefront-card h-11 gap-2 rounded-full px-4"
          render={<Link href="/sign-in" />}
        >
          <User className="size-4" />
          Entrar
        </Button>
      }
    >
      <UserButton>
        <UserButton.MenuItems>
          <UserButton.Link
            href="/perfil"
            label="Mi perfil"
            labelIcon={<User className="size-4" />}
          />
        </UserButton.MenuItems>
      </UserButton>
    </Show>
  );
}
