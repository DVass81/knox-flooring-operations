import type { Lead } from "./types";
import { WON_STAGE, LOST_STAGE } from "./types";

export const DEFAULT_LEAD_STAGES = [
  "New",
  "Contacted",
  "Estimate Scheduled",
  "Quoted",
];

/** Terminal stages that always exist and carry special conversion / loss logic. */
export const TERMINAL_STAGES = [WON_STAGE, LOST_STAGE];

/**
 * Resolve the full ordered list of pipeline stages: the user-configured open
 * stages followed by the reserved terminal stages (Won, Lost).
 */
export function resolveStages(configured?: string[] | null): string[] {
  const open =
    configured && configured.length > 0 ? configured : DEFAULT_LEAD_STAGES;
  const openClean = open.filter(
    (s) => s !== WON_STAGE && s !== LOST_STAGE,
  );
  return [...openClean, ...TERMINAL_STAGES];
}

/** Just the configurable (non-terminal) stages, used by Settings editing. */
export function openStages(configured?: string[] | null): string[] {
  const open =
    configured && configured.length > 0 ? configured : DEFAULT_LEAD_STAGES;
  return open.filter((s) => s !== WON_STAGE && s !== LOST_STAGE);
}

/** Build a single-line, human-readable address string from a lead. */
export function formatLeadAddress(lead: Lead): string {
  const line1 = lead.street?.trim() || lead.address?.trim() || "";
  const cityState = [lead.city?.trim(), lead.state?.trim()]
    .filter(Boolean)
    .join(", ");
  const tail = [cityState, lead.zip?.trim()].filter(Boolean).join(" ");
  return [line1, tail].filter(Boolean).join(", ");
}

/** True when the lead has enough address info to build property links. */
export function hasAddress(lead: Lead): boolean {
  return Boolean(formatLeadAddress(lead).trim());
}

/** Google Maps deep link for the lead's address. */
export function buildMapsUrl(lead: Lead): string {
  const q = encodeURIComponent(formatLeadAddress(lead));
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

/**
 * Zillow deep link. Zillow's address search route uses the address with spaces
 * and commas converted to hyphens, e.g.
 * https://www.zillow.com/homes/1131-Armstrong-Ave-Knoxville-TN-37917_rb/
 */
export function buildZillowUrl(lead: Lead): string {
  const slug = formatLeadAddress(lead)
    .replace(/,/g, "")
    .trim()
    .replace(/\s+/g, "-");
  return `https://www.zillow.com/homes/${encodeURIComponent(slug)}_rb/`;
}

/** mailto: link with optional subject. */
export function buildMailto(email: string, subject?: string): string {
  const base = `mailto:${email.trim()}`;
  return subject ? `${base}?subject=${encodeURIComponent(subject)}` : base;
}

/** tel: link, stripping formatting characters. */
export function buildTel(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}
