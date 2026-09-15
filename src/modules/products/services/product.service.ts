import { api } from "@/lib/axios";

import type {
  ProductCreateInput,
  ProductQueryInput,
  ProductUpdateInput,
} from "../schemas/product.schema";
import type { ProductDto, ProductListResponse } from "../types/product.types";

const RESOURCE = "/products";

export async function listProducts(
  params: ProductQueryInput,
): Promise<ProductListResponse> {
  const { data } = await api.get<ProductListResponse>(RESOURCE, { params });
  return data;
}

export async function getProduct(id: string): Promise<ProductDto> {
  const { data } = await api.get<ProductDto>(`${RESOURCE}/${id}`);
  return data;
}

export async function createProduct(
  input: ProductCreateInput,
): Promise<ProductDto> {
  const { data } = await api.post<ProductDto>(RESOURCE, input);
  return data;
}

export async function updateProduct(
  id: string,
  input: ProductUpdateInput,
): Promise<ProductDto> {
  const { data } = await api.patch<ProductDto>(`${RESOURCE}/${id}`, input);
  return data;
}

export async function deleteProduct(id: string): Promise<ProductDto> {
  const { data } = await api.delete<ProductDto>(`${RESOURCE}/${id}`);
  return data;
}

export async function restoreProduct(id: string): Promise<ProductDto> {
  const { data } = await api.post<ProductDto>(`${RESOURCE}/${id}/restore`);
  return data;
}
