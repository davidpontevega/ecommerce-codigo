import axios, { AxiosError } from "axios";

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const baseURL = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api`
  : "/api";

export const api = axios.create({ baseURL });

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
