import API from "./api";
import type { Product } from "../types";

export const fetchProducts = async (): Promise<Product[]> => {
  const response = await API.get<Product[]>("/products");
  return response.data;
};

export const fetchProductById = async (id: string): Promise<Product> => {
  const response = await API.get<{ product: Product }>(`/products/${id}`);
  return response.data.product;
};
