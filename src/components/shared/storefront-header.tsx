import { Laptop } from "lucide-react";
import Link from "next/link";

import { ThemeToggle } from "@/components/shared/theme-toggle";
import { UserMenu } from "@/components/shared/user-menu";
import { CartButton } from "@/modules/cart/components/cart-button";
import { SearchBox } from "@/modules/storefront/components/search-box";

/**
 * Server Component: el estado de sesión lo resuelve `<UserMenu>` (isla cliente)
 * para no volver dinámica la landing (ISR).
 */
export function StorefrontHeader() {
  return (
    <header className="flex flex-wrap items-center gap-3 px-1.5 pb-4 sm:px-3 sm:pb-5">
      <Link
        href="/"
        className="flex items-center gap-2.5 text-base font-bold tracking-tight sm:text-lg"
      >
        <span className="bg-foreground text-background grid size-8 place-items-center rounded-[10px]">
          <Laptop className="size-4" />
        </span>
        <span>
          Tech<span className="text-brand">.</span>
        </span>
      </Link>

      <Link
        href="/products"
        className="text-muted-foreground hover:text-foreground hidden text-sm font-medium sm:block"
      >
        Catálogo
      </Link>

      {/* Única isla de cliente del header: conserva dentro el `<form>` nativo,
          que busca aunque el JS no cargue. */}
      <SearchBox />

      <ThemeToggle />

      {/* El carrito vive en el header compartido: funciona igual en `/` y en
          `/products` sin duplicar nada. */}
      <CartButton />

      <UserMenu />
    </header>
  );
}
