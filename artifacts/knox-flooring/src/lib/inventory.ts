import type {
  Product,
  ProductCategory,
  ProductUnit,
  ProductInventoryType,
} from "@/lib/types";

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  "Vinyl Plank",
  "Vinyl Tile",
  "Carpet",
  "Hardwood",
  "Tile",
  "Laminate",
  "Waterproof",
  "Commercial",
  "Trim/Supplies",
  "Padding",
  "Underlayment",
  "Trim",
  "Installation",
];

export const PRODUCT_UNITS: ProductUnit[] = ["sqft", "box", "lineal ft", "each", "piece"];

export const PRODUCT_INVENTORY_TYPES: ProductInventoryType[] = [
  "Inventory",
  "Special Order",
  "Service",
];

/** On-hand quantity at or below this is flagged "Low Stock". */
export const LOW_STOCK_THRESHOLD = 100;

export type StockStatus = "In Stock" | "Low Stock" | "Out of Stock" | "Special Order" | "Service";

export function stockStatus(product: Product): StockStatus {
  if (product.inventoryType === "Special Order") return "Special Order";
  if (product.inventoryType === "Service") return "Service";
  if (product.quantityOnHand <= 0) return "Out of Stock";
  if (product.quantityOnHand <= LOW_STOCK_THRESHOLD) return "Low Stock";
  return "In Stock";
}

export function stockStatusClass(status: StockStatus): string {
  switch (status) {
    case "In Stock":
      return "bg-emerald-100 text-emerald-800 hover:bg-emerald-100";
    case "Low Stock":
      return "bg-amber-100 text-amber-800 hover:bg-amber-100";
    case "Out of Stock":
      return "bg-red-100 text-red-800 hover:bg-red-100";
    case "Special Order":
      return "bg-violet-100 text-violet-800 hover:bg-violet-100";
    case "Service":
      return "bg-blue-100 text-blue-800 hover:bg-blue-100";
    default:
      return "";
  }
}

/** Gross margin percentage from cost & sell price. Null when price is 0. */
export function marginPct(cost: number, price: number): number | null {
  if (!price || price <= 0) return null;
  return ((price - cost) / price) * 100;
}

/** Build a servable URL for a stored product image object path. */
export function productImageSrc(objectPath: string): string {
  return `/api/storage${objectPath}`;
}
