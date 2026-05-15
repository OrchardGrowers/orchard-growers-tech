export interface Product {
  _id: string;
  title: string;
  fruitName: string;
  variety: string;
  description: string;
  location: string;
  quantity: number;
  lotNo?: string;
  packingType?: string;
  packingWeightKg?: number;
  totalWeightKg?: number;
  basePrice: number;
  images?: string[];
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: {
    name?: string;
    orchardName?: string;
    businessName?: string;
  };
}
