import { AdminHeader } from "@/components/shared/admin-header";
import { AdminNav } from "@/components/shared/admin-nav";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex min-h-full flex-1">
      <aside className="hidden w-56 shrink-0 border-r bg-muted/30 p-4 md:block">
        <p className="px-3 pb-4 text-sm font-semibold">Administración</p>
        <AdminNav />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminHeader />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
