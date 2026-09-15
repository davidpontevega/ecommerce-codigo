import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  "/products(.*)",
  // Checkout de invitado (spec 010, D1 revisado): ni el carrito ni el flujo de
  // pago exigen sesión. `/checkout/success` recibe al visitante de vuelta de
  // Stripe, que puede no tener sesión.
  "/cart",
  "/checkout(.*)",
  // Lectura del storefront: el permiso fino de las mutaciones lo aplica cada
  // Route Handler con `requirePermission` (docs/specs/003 §11).
  "/api/products(.*)",
  "/api/categories(.*)",
  // `POST /api/checkout/session` no exige sesión (checkout de invitado). Si hay
  // sesión de Clerk, el handler ata el pedido al usuario; si no, sigue como
  // invitado.
  "/api/checkout(.*)",
]);

const isAdminRoute = createRouteMatcher(["/admin(.*)", "/api/admin(.*)"]);

const CHANGE_PASSWORD_PATH = "/onboarding/cambiar-clave";
// La página y el endpoint que la cierra. Sin el endpoint, la redirección se
// tragaría el `POST` que baja el flag y el flujo no podría completarse nunca.
const isChangePasswordRoute = createRouteMatcher([
  CHANGE_PASSWORD_PATH,
  "/api/onboarding/password-changed",
]);

/** Rol por defecto de todo usuario; no da acceso a ninguna vista del panel. */
const CUSTOMER_SLUG = "customer";

export default clerkMiddleware(async (auth, request) => {
  const { userId, sessionClaims, redirectToSignIn } = await auth();

  if (
    userId &&
    sessionClaims?.publicMetadata?.mustChangePassword &&
    !isChangePasswordRoute(request)
  ) {
    return NextResponse.redirect(new URL(CHANGE_PASSWORD_PATH, request.url));
  }

  // Gate **grueso** del borde: staff sí / cliente no, leído del cache derivado
  // del token. La autorización real es por código de permiso en cada handler,
  // que relee Postgres (docs/specs/003 §8).
  if (isAdminRoute(request)) {
    if (!userId) {
      return redirectToSignIn();
    }

    const roles = sessionClaims?.publicMetadata?.roles ?? [];

    if (!roles.some((slug) => slug !== CUSTOMER_SLUG)) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return;
  }

  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
