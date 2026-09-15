import { ClerkProvider } from "@clerk/nextjs";
import { esES } from "@clerk/localizations";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Los componentes de Clerk heredan los tokens de globals.css en vez de traer su
// propia paleta.
const clerkAppearance = {
  variables: {
    colorPrimary: "var(--primary)",
    colorBackground: "var(--card)",
    colorForeground: "var(--card-foreground)",
    colorDanger: "var(--destructive)",
    colorMutedForeground: "var(--muted-foreground)",
    colorBorder: "var(--border)",
    borderRadius: "var(--radius)",
    fontFamily: "var(--font-geist-sans)",
  },
};

export const metadata: Metadata = {
  title: "E-commerce Tech",
  description: "Tienda de tecnología: catálogo, carrito y pedidos en línea.",
};

// `suppressHydrationWarning`: `next-themes` escribe la clase del tema en el
// `<html>` antes del primer paint, así que el marcado del servidor y el del
// cliente difieren por diseño. El `<Toaster>` también queda dentro del provider
// porque lee `useTheme()`.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ClerkProvider localization={esES} appearance={clerkAppearance}>
          <ThemeProvider>
            <QueryProvider>{children}</QueryProvider>
            <Toaster />
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
