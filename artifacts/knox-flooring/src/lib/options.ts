// Shared option lists for dropdown fields across the app.
// Fields backed by these lists use a "Select or Other…" control so the common
// case is a quick pick, while genuinely custom values are still allowed.

export const ROOM_NAMES = [
  "Living Room",
  "Family Room",
  "Great Room",
  "Kitchen",
  "Dining Room",
  "Breakfast Nook",
  "Master Bedroom",
  "Bedroom",
  "Bedroom 2",
  "Bedroom 3",
  "Bathroom",
  "Master Bathroom",
  "Half Bath",
  "Hallway",
  "Entryway / Foyer",
  "Stairs",
  "Closet",
  "Office",
  "Laundry Room",
  "Mudroom",
  "Bonus Room",
  "Basement",
  "Garage",
  "Sunroom",
  "Pantry",
] as const;

export const PAYMENT_TERMS = [
  "50% deposit, balance due on completion",
  "50% deposit, 50% on material delivery",
  "1/3 deposit, 1/3 at start, 1/3 on completion",
  "Due on receipt",
  "Net 15",
  "Net 30",
  "Net 60",
  "Paid in full upfront",
] as const;

export const SUPPLIERS = [
  "Shaw",
  "Mohawk",
  "COREtec",
  "Daltile",
  "Bruce",
  "Mannington",
  "Armstrong",
  "Karastan",
  "Pergo",
  "Mullican",
  "Anderson Tuftex",
  "Tarkett",
  "Engineered Floors",
  "MSI",
  "Marazzi",
  "Stanton",
] as const;

export const STATES = [
  "TN",
  "KY",
  "VA",
  "NC",
  "GA",
  "AL",
  "SC",
  "MS",
] as const;

export const COUNTIES = [
  "Knox",
  "Blount",
  "Loudon",
  "Anderson",
  "Sevier",
  "Roane",
  "Jefferson",
  "Union",
  "Grainger",
  "Cocke",
  "Hamblen",
  "Campbell",
  "Claiborne",
  "Monroe",
  "Morgan",
  "Cumberland",
] as const;

export const OWNER_ROLES = [
  "Owner",
  "Co-Owner",
  "President",
  "General Manager",
  "Project Manager",
  "Sales Manager",
  "Operations Manager",
  "Estimator",
  "Administrator",
] as const;
