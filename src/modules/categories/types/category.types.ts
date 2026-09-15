import type { Category, NewCategory } from "@/server/db/schema";

export type { Category, NewCategory };

/**
 * Lo que realmente recibe el cliente: `NextResponse.json` serializa las
 * columnas `timestamptz` a string ISO, no a `Date`.
 */
export type CategoryDto = Omit<Category, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

export type CategoryListResponse = {
  data: CategoryDto[];
  total: number;
  page: number;
  pageSize: number;
};
