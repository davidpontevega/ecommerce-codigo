import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL no está definida. Configúrala en .env.local antes de arrancar.",
  );
}

// El HMR de dev recarga este módulo y dejaría pools huérfanos consumiendo
// el límite de conexiones de Neon.
const globalForDb = globalThis as typeof globalThis & { __dbPool?: Pool };

const pool = globalForDb.__dbPool ?? new Pool({ connectionString });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__dbPool = pool;
}

export const db = drizzle(pool);

export type Database = typeof db;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
