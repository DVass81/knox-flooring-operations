/**
 * Returns a shallow copy of the row with all `null`-valued keys removed.
 *
 * DB columns that are optional in the API contract are stored as NULL when
 * absent, but the generated Zod schemas treat those fields as optional
 * (`undefined`), not nullable. Dropping the null keys lets the row validate
 * cleanly while keeping the optional-string shape the frontend expects.
 */
export function stripNulls<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value !== null) out[key] = value;
  }
  return out as T;
}
