/** Mismo hueco para las cuatro cards cuando no hay nada que graficar. */
export function EmptyMetric({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-muted-foreground flex h-[220px] items-center justify-center text-center text-sm">
      {children}
    </div>
  );
}
