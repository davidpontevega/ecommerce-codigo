import { api } from "@/lib/axios";

import type {
  CategoryCreateInput,
  CategoryQueryInput,
  CategoryUpdateInput,
} from "../schemas/category.schema";
import type { CategoryDto, CategoryListResponse } from "../types/category.types";

const RESOURCE = "/categories";

export async function listCategories(
  params: CategoryQueryInput,
): Promise<CategoryListResponse> {
  const { data } = await api.get<CategoryListResponse>(RESOURCE, { params });
  return data;
}

export async function getCategory(id: string): Promise<CategoryDto> {
  const { data } = await api.get<CategoryDto>(`${RESOURCE}/${id}`);
  return data;
}

export async function createCategory(
  input: CategoryCreateInput,
): Promise<CategoryDto> {
  const { data } = await api.post<CategoryDto>(RESOURCE, input);
  return data;
}

export async function updateCategory(
  id: string,
  input: CategoryUpdateInput,
): Promise<CategoryDto> {
  const { data } = await api.patch<CategoryDto>(`${RESOURCE}/${id}`, input);
  return data;
}

export async function setCategoryActive(
  id: string,
  isActive: boolean,
): Promise<CategoryDto> {
  const { data } = await api.patch<CategoryDto>(`${RESOURCE}/${id}`, {
    isActive,
  });
  return data;
}
