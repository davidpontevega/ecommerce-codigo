import axios, { AxiosError } from "axios";

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// `api` solo se usa en el navegador (hooks "use client", nunca desde un
// Server Component o Route Handler): relativo, para que resuelva contra el
// origen real de la pestaña. Vercel expone varias URLs válidas para el mismo
// deploy (alias + URL única por build); un baseURL absoluto construido con
// NEXT_PUBLIC_APP_URL solo calza con una de ellas y las demás disparan CORS
// cross-origin contra Route Handlers que nunca respondieron con esos headers.
export const api = axios.create({ baseURL: "/api" });

// La UI necesita distinguir 409 de 500 sin importar axios en un componente.
api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (error instanceof AxiosError) {
      const payload = error.response?.data as { error?: string } | undefined;
      return Promise.reject(
        new ApiError(payload?.error ?? error.message, error.response?.status ?? 0),
      );
    }
    return Promise.reject(error);
  },
);
