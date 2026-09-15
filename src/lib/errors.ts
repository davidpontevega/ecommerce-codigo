import type { PermissionCode } from "@/lib/permissions";

/** No hay sesión de Clerk o el usuario no está activo → HTTP 401. */
export class UnauthorizedError extends Error {
  constructor() {
    super("No autenticado");
    this.name = "UnauthorizedError";
  }
}

/**
 * Una línea del carrito ya no se puede comprar (producto retirado o sin stock
 * suficiente) → HTTP 409. El mensaje se le muestra al cliente tal cual, así que
 * se redacta legible y sin detalles internos.
 */
export class CheckoutUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckoutUnavailableError";
  }
}

/** El usuario está autenticado pero le falta el permiso exigido → HTTP 403. */
export class ForbiddenError extends Error {
  constructor(public readonly code: PermissionCode) {
    super(`Falta el permiso ${code}`);
    this.name = "ForbiddenError";
  }
}
