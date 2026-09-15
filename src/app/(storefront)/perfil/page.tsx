import { currentUser } from "@clerk/nextjs/server";
import { Heart } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PurchasesTab } from "@/modules/orders/components/purchases-tab";
import { CardsTab } from "@/modules/payment-methods/components/cards-tab";

export const metadata: Metadata = {
  title: "Mi perfil — E-commerce Tech",
  description: "Tus datos, tus favoritos y tus compras.",
};

const dateFormatter = new Intl.DateTimeFormat("es-PE", { dateStyle: "long" });

/** Clerk entrega epoch en ms; el campo se oculta si nunca ocurrió. */
function formatDate(epochMs: number | null): string | null {
  return epochMs === null ? null : dateFormatter.format(epochMs);
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {label}
      </dt>
      <dd className="text-sm font-medium break-words">{value}</dd>
    </div>
  );
}

function EmptySection({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="border-storefront-border bg-storefront-card rounded-card flex flex-col items-center gap-2 border px-6 py-16 text-center sm:px-10 sm:py-20">
      <span className="bg-storefront-sunk text-muted-foreground rounded-pill grid size-14 place-items-center">
        {icon}
      </span>
      <p className="mt-2 text-base font-medium">{title}</p>
      <p className="text-muted-foreground max-w-sm text-sm">{description}</p>
      <Button
        nativeButton={false}
        className="bg-brand text-brand-foreground rounded-pill mt-2.5 h-11 px-5 hover:opacity-90"
        render={<Link href="/products" />}
      >
        Explorar catálogo
      </Button>
    </div>
  );
}

/** Pestañas válidas en `?tab=`: cualquier otro valor cae en la de siempre. */
const TABS = ["perfil", "favoritos", "compras", "tarjetas"] as const;

export default async function ProfilePage({
  searchParams,
}: PageProps<"/perfil">) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  // Al volver del alta de tarjeta, Stripe manda a `?tab=tarjetas&setup=success`.
  const { tab, setup } = await searchParams;
  const activeTab = TABS.find((name) => name === tab) ?? "perfil";

  const email = user.primaryEmailAddress?.emailAddress ?? null;
  const createdAt = formatDate(user.createdAt);
  const lastSignInAt = formatDate(user.lastSignInAt);
  const displayName = user.fullName ?? user.username ?? "Cliente";

  return (
    <div className="flex flex-col gap-4 px-1 sm:px-3">
      <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">
        Mi cuenta
      </h1>

      <Tabs defaultValue={activeTab} className="gap-4">
        <TabsList className="w-full">
          <TabsTrigger value="perfil" className="text-xs sm:text-sm">
            Mi perfil
          </TabsTrigger>
          <TabsTrigger value="favoritos" className="text-xs sm:text-sm">
            Mis favoritos
          </TabsTrigger>
          <TabsTrigger value="compras" className="text-xs sm:text-sm">
            Mis compras
          </TabsTrigger>
          <TabsTrigger value="tarjetas" className="text-xs sm:text-sm">
            Mis tarjetas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="perfil">
          <div className="border-storefront-border bg-storefront-card rounded-card border p-6 sm:p-8">
            <div className="flex items-center gap-4">
              <Avatar className="size-16">
                <AvatarImage src={user.imageUrl} alt="" />
                <AvatarFallback>{displayName.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold">{displayName}</p>
                {email ? (
                  <p className="text-muted-foreground truncate text-sm">
                    {email}
                  </p>
                ) : null}
              </div>
            </div>

            <Separator className="my-6" />

            <dl className="grid gap-5 sm:grid-cols-2">
              <Field label="Nombre" value={displayName} />
              {email ? <Field label="Correo" value={email} /> : null}
              {createdAt ? (
                <Field label="Cliente desde" value={createdAt} />
              ) : null}
              {lastSignInAt ? (
                <Field label="Último acceso" value={lastSignInAt} />
              ) : null}
            </dl>

            <p className="text-muted-foreground mt-6 text-xs">
              Para editar tus datos usa «Gestionar cuenta» en el menú de tu
              avatar.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="favoritos">
          <EmptySection
            icon={<Heart aria-hidden className="size-6" />}
            title="Aún no tienes favoritos"
            description="Guarda los productos que te gusten para encontrarlos aquí."
          />
        </TabsContent>

        <TabsContent value="compras">
          <PurchasesTab />
        </TabsContent>

        <TabsContent value="tarjetas">
          <CardsTab justAdded={setup === "success"} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
