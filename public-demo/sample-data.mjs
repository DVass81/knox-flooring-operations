// New fictional fixtures. Never import the private application's seed or database.
export const sampleSettings = Object.freeze({
  ownerName: "", ownerRole: "", companyName: "Catalyst Innovations · Flooring sample",
  address: "", phone: "", email: "", website: "",
  defaultWasteFactor: 10, defaultLaborRateLVP: 2.5, defaultLaborRateHardwood: 4,
  defaultLaborRateCarpet: 1.5, defaultLaborRateTile: 5,
  commissionBasis: "Gross Profit", defaultCommissionRate: 5,
});

const products = [
  ["sample-lvp", "Sample vinyl plank", "Vinyl Plank", "sqft", 3.5],
  ["sample-hardwood", "Sample hardwood", "Hardwood", "sqft", 5],
  ["sample-carpet", "Sample carpet", "Carpet", "sqft", 2.5],
  ["sample-tile", "Sample tile", "Tile", "sqft", 4],
  ["sample-laminate", "Sample laminate", "Laminate", "sqft", 3],
  ["sample-lvt", "Sample vinyl tile", "Vinyl Tile", "sqft", 3.5],
  ["sample-commercial", "Sample commercial carpet", "Commercial", "sqft", 4],
  ["sample-trim", "Sample transition trim", "Trim/Supplies", "each", 25],
  ["sample-barrier", "Sample moisture barrier", "Trim/Supplies", "sqft", 0.5],
];
export const sampleProducts = Object.freeze(products.map(([id, name, category, unit, price]) => Object.freeze({
  id, name, category, unit, price, cost: price, sku: String(id).toUpperCase(),
  supplier: "Fictional sample catalog", color: "Sample", quantityOnHand: 0,
  inventoryType: "Special Order", active: true, notes: "Illustrative product and price.",
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
})));
