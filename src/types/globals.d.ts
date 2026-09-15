export {};

declare global {
  /**
   * Claims a medida del session token de Clerk. `publicMetadata` solo llega si
   * el claim está configurado en el dashboard
   * (`{"publicMetadata": "{{user.public_metadata}}"}`); si falta, el gate de
   * `/admin` falla cerrado.
   *
   * Es un cache derivado con hasta ~60 s de desfase: sirve para el gate grueso
   * del middleware, nunca para el permiso fino (ese relee Postgres).
   */
  interface CustomJwtSessionClaims {
    publicMetadata?: {
      roles?: string[];
      mustChangePassword?: boolean;
    };
  }
}
