"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

// `next-themes` renderiza su script anti-flash como <script> dentro del árbol
// de React; React 19 advierte por eso en consola ("Encountered a script tag").
// El script sí funciona en SSR — es ruido cosmético conocido y sin fix
// upstream (pacocoursey/next-themes#385/#387), no un bug de la app.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
