import API from "./api";
import type { Product } from "../types";

export const fetchProducts = async (): Promise<Product[]> => {
  const response = await API.get<Product[]>("/products?platform=orchardgrowers");
  return response.data.filter(
    (product) =>
      product.inventoryType !== "raw_material" &&
      product.createdSource !== "grower" &&
      product.createdSource !== "efruitmandi" &&
      !product.gradeLots?.length &&
      product.status !== "IN_AUCTION"
  );
};

export const fetchProductById = async (id: string): Promise<Product> => {
  const response = await API.get<{ product: Product }>(`/products/${id}?platform=orchardgrowers`);
  return response.data.product;
};
