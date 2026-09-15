import Link from "next/link";

// Solo destinos que existen: un enlace a ninguna parte es una trampa de
// accesibilidad. Soporte, envíos y privacidad entran cuando existan sus páginas.
const LINKS = [
  { label: "Inicio", href: "/" },
  { label: "Tienda", href: "/products" },
] as const;

export function StorefrontFooter() {
  return (
    <footer className="text-muted-foreground flex flex-wrap items-center justify-between gap-3 px-3 pt-6 pb-2 text-xs">
      <span>© {new Date().getFullYear()} E-commerce Tech</span>
      <nav className="flex gap-5">
        {LINKS.map((link) => (
          <Link key={link.label} href={link.href} className="hover:underline">
            {link.label}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
