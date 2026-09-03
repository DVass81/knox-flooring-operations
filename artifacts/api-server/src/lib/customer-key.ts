// Mirrors the frontend `customerKey()` in
// artifacts/knox-flooring/src/lib/customers.ts so communications logged
// server-side line up with the derived customer identity used in the UI.
export function customerKey(name: string): string {
  return encodeURIComponent(name.trim().toLowerCase().replace(/\s+/g, " "));
}
