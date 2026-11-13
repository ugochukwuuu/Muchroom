export const maxProductPhotos = 3;
export const categories = ['Laptops', 'Projectors', 'Audio', 'Power Stations', 'Power Banks', 'Phones & Tablets', 'Monitors', 'Accessories'] as const;
export type Category = typeof categories[number];

export type Variant = {
  id: string;
  product_id: string;
  product: string;
  name: string;
  brand: string;
  category: Category;
  sku: string;
  description: string;
  image: string;
  images: string[];
  published: boolean;
  price: number;
  quantity: number;
  available: number;
  specs: Record<string, string>;
  uses: string[];
};

export type Order = {
  id: string;
  channel: 'online' | 'in_store';
  status: 'pending' | 'paid' | 'review' | 'cancelled';
  fulfilment: 'unfulfilled' | 'fulfilled';
  payment_method: string;
  customer: string;
  email: string;
  phone: string;
  method: string;
  address: string;
  location: string;
  source: string;
  total: number;
  delivery_fee: number;
  created_at: Date;
  expires_at: Date | null;
  paid_at: Date | null;
};

export const money = (value: number) => '₦' + value.toLocaleString('en-NG');
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
