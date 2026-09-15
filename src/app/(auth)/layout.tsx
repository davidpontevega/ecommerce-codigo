import Link from "next/link";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-6 bg-muted/30 p-6">
      <Link href="/" className="text-lg font-semibold tracking-tight">
        E-commerce Tech
      </Link>
      {children}
    </div>
  );
}
