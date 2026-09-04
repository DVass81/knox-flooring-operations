import { useEffect } from "react";
import { useParams } from "wouter";
import { useGetPublicJob, getGetPublicJobQueryKey } from "@workspace/api-client-react";
import type { PublicJob, PublicPortalQuote, PublicInvoice } from "@workspace/api-client-react";
import { Loader2, Printer } from "lucide-react";
import { money, formatDate } from "@/lib/portal";

export default function PublicPrint() {
  const params = useParams();
  const token = params.token;
  const invoiceId = params.invoiceId;
  const kind = invoiceId ? "invoice" : params.kind;
  const { data: job, isLoading, isError } = useGetPublicJob(token ?? "", {
    query: {
      queryKey: getGetPublicJobQueryKey(token ?? ""),
      enabled: Boolean(token),
      retry: false,
    },
  });

  useEffect(() => {
    if (job) document.title = `${job.company.companyName} — Document`;
  }, [job]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !job) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white px-6 text-center">
        <h1 className="text-2xl font-semibold text-foreground">Document not found</h1>
        <p className="text-muted-foreground mt-2 max-w-md">
          This link is invalid or has expired. Please contact your flooring team.
        </p>
      </div>
    );
  }

  const invoice =
    kind === "invoice"
      ? (job.invoices ?? []).find((inv) => inv.id === invoiceId) ?? null
      : null;

  if (kind === "invoice" && !invoice) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white px-6 text-center">
        <h1 className="text-2xl font-semibold text-foreground">Invoice not found</h1>
      </div>
    );
  }

  if (kind === "quote" && !job.quote) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white px-6 text-center">
        <h1 className="text-2xl font-semibold text-foreground">No quote available</h1>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100 py-8 print:bg-white print:py-0">
      <div className="max-w-3xl mx-auto px-4 print:px-0">
        <div className="flex justify-end mb-4 print:hidden">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Printer className="w-4 h-4" /> Print / Save as PDF
          </button>
        </div>
        <div className="bg-white rounded-lg shadow-sm border print:border-0 print:shadow-none print:rounded-none">
          {kind === "invoice" && invoice ? (
            <InvoiceDoc job={job} invoice={invoice} />
          ) : (
            <QuoteDoc job={job} quote={job.quote!} />
          )}
        </div>
      </div>
    </div>
  );
}

function DocHeader({ job, title }: { job: PublicJob; title: string }) {
  return (
    <div className="flex items-start justify-between gap-6 border-b p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {job.company.companyName}
        </h1>
        <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
          {job.company.phone && <div>{job.company.phone}</div>}
          {job.company.email && <div>{job.company.email}</div>}
          {job.company.website && <div>{job.company.website}</div>}
        </div>
      </div>
      <div className="text-right">
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {title}
        </div>
        <div className="text-sm text-muted-foreground mt-2">
          {job.jobNumber}
        </div>
        <div className="text-sm text-muted-foreground">{job.customerName}</div>
      </div>
    </div>
  );
}

function QuoteDoc({ job, quote }: { job: PublicJob; quote: PublicPortalQuote }) {
  const balance = quote.estimatedPrice - quote.depositAmount;
  return (
    <div>
      <DocHeader job={job} title="Quote" />
      <div className="p-8 space-y-6 text-sm">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Customer" value={quote.customerName} />
          <Field label="Project Location" value={quote.projectLocation} />
          <Field label="Flooring Type" value={quote.flooringType} />
          <Field label="Total Area" value={`${quote.totalSqFt} sq ft`} />
        </div>

        <Section title="Scope of Work">
          <p className="text-muted-foreground whitespace-pre-line">{quote.scopeOfWork}</p>
        </Section>

        {quote.roomList.length > 0 && (
          <Section title="Rooms & Areas">
            <table className="w-full border-collapse">
              <tbody>
                {quote.roomList.map((room) => (
                  <tr key={room.id} className="border-b last:border-0">
                    <td className="py-2 text-foreground">{room.name}</td>
                    <td className="py-2 text-right text-muted-foreground">
                      {room.length} × {room.width} ft ·{" "}
                      {Math.round(room.length * room.width)} sq ft
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        <div className="rounded-md border divide-y">
          <Row label="Total Investment" value={money(quote.estimatedPrice)} bold />
          {quote.depositAmount > 0 && (
            <>
              <Row label="Deposit Due" value={money(quote.depositAmount)} />
              <Row label="Balance After Deposit" value={money(balance)} />
            </>
          )}
        </div>

        {quote.paymentTerms && (
          <Section title="Payment Terms">
            <p className="text-muted-foreground">{quote.paymentTerms}</p>
          </Section>
        )}
        <div className="grid sm:grid-cols-2 gap-4">
          {quote.expectedTimeline && (
            <Section title="Expected Timeline">
              <p className="text-muted-foreground">{quote.expectedTimeline}</p>
            </Section>
          )}
          {quote.materialAssumptions && (
            <Section title="Material Assumptions">
              <p className="text-muted-foreground">{quote.materialAssumptions}</p>
            </Section>
          )}
          {quote.exclusions && (
            <Section title="Exclusions">
              <p className="text-muted-foreground">{quote.exclusions}</p>
            </Section>
          )}
          {quote.warrantyNote && (
            <Section title="Warranty">
              <p className="text-muted-foreground">{quote.warrantyNote}</p>
            </Section>
          )}
        </div>

        {quote.status === "Accepted" && (
          <div className="border-t pt-4">
            <div className="text-muted-foreground">Accepted &amp; signed by</div>
            <div className="text-lg font-semibold text-foreground mt-1">
              {quote.signature}
            </div>
            <div className="text-muted-foreground">{formatDate(quote.acceptedAt)}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function InvoiceDoc({ job, invoice }: { job: PublicJob; invoice: PublicInvoice }) {
  const balanceDue = Math.max(0, invoice.total - invoice.depositAmount);
  return (
    <div>
      <DocHeader job={job} title="Invoice" />
      <div className="p-8 space-y-6 text-sm">
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Invoice #" value={invoice.invoiceNumber} />
          <Field label="Issued" value={formatDate(invoice.issueDate)} />
          <Field label="Due" value={formatDate(invoice.dueDate)} />
        </div>

        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b text-muted-foreground text-left">
              <th className="py-2 font-medium">Description</th>
              <th className="py-2 font-medium text-right">Qty</th>
              <th className="py-2 font-medium text-right">Unit</th>
              <th className="py-2 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lineItems.map((li) => (
              <tr key={li.id} className="border-b last:border-0">
                <td className="py-2 text-foreground">
                  {li.description}
                  <span className="text-muted-foreground"> · {li.category}</span>
                </td>
                <td className="py-2 text-right text-muted-foreground">{li.quantity}</td>
                <td className="py-2 text-right text-muted-foreground">
                  {money(li.unitPrice)}
                </td>
                <td className="py-2 text-right text-foreground">
                  {money(li.quantity * li.unitPrice)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="ml-auto sm:w-72 rounded-md border divide-y">
          <Row label="Subtotal" value={money(invoice.subtotal)} />
          <Row label="Total" value={money(invoice.total)} bold />
          {invoice.depositAmount > 0 && (
            <>
              <Row label="Deposit" value={`- ${money(invoice.depositAmount)}`} />
              <Row label="Balance Due" value={money(balanceDue)} bold />
            </>
          )}
        </div>

        <div className="text-sm">
          <span className="text-muted-foreground">Status: </span>
          <span className="font-medium text-foreground">{invoice.status}</span>
        </div>

        {invoice.notes && (
          <Section title="Notes">
            <p className="text-muted-foreground whitespace-pre-line">{invoice.notes}</p>
          </Section>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-medium text-foreground mt-0.5">{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <h2 className="font-semibold text-foreground">{title}</h2>
      {children}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between px-4 py-2">
      <span className={bold ? "font-semibold text-foreground" : "text-muted-foreground"}>
        {label}
      </span>
      <span className={bold ? "font-semibold text-foreground" : "text-foreground"}>
        {value}
      </span>
    </div>
  );
}
