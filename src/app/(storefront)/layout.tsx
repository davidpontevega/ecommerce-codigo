import { StorefrontFooter } from "@/components/shared/storefront-footer";
import { StorefrontHeader } from "@/components/shared/storefront-header";

export default function StorefrontLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="storefront-page flex flex-1 flex-col p-3 sm:p-6 lg:p-10">
      <div className="border-storefront-border bg-storefront-shell mx-auto flex w-full max-w-[1440px] flex-1 flex-col rounded-[26px] border p-3 shadow-[0_40px_90px_-40px_rgba(30,40,80,0.35)] backdrop-blur-2xl sm:rounded-[34px] sm:p-[18px]">
        <StorefrontHeader />
        <main className="flex-1">{children}</main>
        <StorefrontFooter />
      </div>
    </div>
  );
}
