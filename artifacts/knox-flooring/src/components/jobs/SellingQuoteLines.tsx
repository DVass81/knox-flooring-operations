import type { ProposalLineItem } from "@workspace/api-client-react";
import { currency, quantity } from "@/lib/operations";

/** Only complete selling-price breakdowns show line prices; legacy partial catalogs retain their original quantities. */
export function SellingQuoteLines({
  lines = [],
  total,
  className = "",
}: {
  lines?: ProposalLineItem[];
  total: number;
  className?: string;
}) {
  if (!lines.length) return null;
  const subtotal = lines.reduce(
    (sum, line) =>
      sum +
      Math.round((line.lineTotal ?? line.quantity * line.unitPrice) * 100),
    0,
  );
  const reconciles = subtotal === Math.round(total * 100);
  return (
    <section className={`space-y-3 ${className}`} aria-label="Quoted items">
      <h2 className="font-semibold">
        {reconciles ? "Quoted items" : "Selected products and services"}
      </h2>
      <div className="divide-y rounded-lg border">
        {lines.map((line) => (
          <div
            key={line.id}
            className="flex items-start justify-between gap-4 px-4 py-3 text-sm print:break-inside-avoid"
          >
            <div className="min-w-0">
              <p className="font-medium break-words">{line.name}</p>
              <p className="mt-0.5 text-muted-foreground">
                {quantity(line.quantity)} {line.unit}
                {line.sku ? ` · ${line.sku}` : ""}
              </p>
            </div>
            {reconciles && (
              <p className="shrink-0 text-right tabular-nums font-medium">
                {currency(line.lineTotal ?? line.quantity * line.unitPrice)}
              </p>
            )}
          </div>
        ))}
        {reconciles && (
          <div className="flex justify-between gap-4 bg-muted/30 px-4 py-3 text-sm font-semibold">
            <span>Quoted total</span>
            <span className="tabular-nums">{currency(total)}</span>
          </div>
        )}
      </div>
      {!reconciles && (
        <p className="text-xs text-muted-foreground">
          This quote records selected items separately from its full project
          price. The quote total includes the agreed scope of work.
        </p>
      )}
    </section>
  );
}
