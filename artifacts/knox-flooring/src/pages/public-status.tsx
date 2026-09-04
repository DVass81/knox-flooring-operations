import { useState } from "react";
import { useParams } from "wouter";
import {
  useGetPublicJob,
  getGetPublicJobQueryKey,
  useAcceptPublicQuote,
  useDeclinePublicQuote,
} from "@workspace/api-client-react";
import type {
  PublicJob,
  PublicPortalQuote,
  PublicInvoice,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { StagePipeline } from "@/components/jobs/StagePipeline";
import { StageTimeline } from "@/components/jobs/StageTimeline";
import { photoSrc } from "@/components/jobs/StagePhotos";
import {
  Loader2,
  MapPin,
  Phone,
  Mail,
  Globe,
  FileText,
  Receipt,
  Image as ImageIcon,
  Download,
  Wallet,
  CheckCircle2,
  XCircle,
  ListChecks,
  Clock,
  ShieldCheck,
  PenLine,
  ArrowRight,
} from "lucide-react";
import { stageProgressPct } from "@/lib/stages";
import { money, formatDate, nextStepMessage, publicInvoiceVariant } from "@/lib/portal";
import type { JobPhoto } from "@/lib/types";

function printUrl(token: string, path: string): string {
  return `${import.meta.env.BASE_URL}p/${token}/print/${path}`;
}

export default function PublicStatus() {
  const { token } = useParams();
  const { data: job, isLoading, isError } = useGetPublicJob(token ?? "", {
    query: {
      queryKey: getGetPublicJobQueryKey(token ?? ""),
      enabled: Boolean(token),
      retry: false,
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !job) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 px-6 text-center">
        <h1 className="text-2xl font-semibold text-foreground">Project not found</h1>
        <p className="text-muted-foreground mt-2 max-w-md">
          This link is invalid or has expired. Please contact your flooring team for
          an updated link.
        </p>
      </div>
    );
  }

  const quote = job.quote ?? null;
  const invoices = job.invoices ?? [];
  const outstanding = job.balance?.outstanding ?? 0;
  const quotePending = quote
    ? quote.status === "Sent" || quote.status === "Viewed"
    : false;

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-primary text-primary-foreground">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <p className="text-xs uppercase tracking-[0.2em] opacity-80">
            {job.company.companyName}
          </p>
          <h1 className="text-2xl md:text-3xl font-semibold mt-1">
            Your Flooring Project
          </h1>
          <p className="opacity-90 mt-1">
            {job.jobNumber} · {job.customerName}
          </p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <Tabs defaultValue="progress" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 h-auto">
            <TabsTrigger value="progress" className="py-2">Progress</TabsTrigger>
            <TabsTrigger value="quote" className="py-2 gap-1.5">
              Quote
              {quotePending && (
                <span className="inline-block w-2 h-2 rounded-full bg-primary" />
              )}
            </TabsTrigger>
            <TabsTrigger value="invoices" className="py-2">Invoices</TabsTrigger>
            <TabsTrigger value="documents" className="py-2">Documents</TabsTrigger>
          </TabsList>

          <TabsContent value="progress" className="space-y-6 mt-0">
            <ProgressTab job={job} />
          </TabsContent>

          <TabsContent value="quote" className="space-y-6 mt-0">
            <QuoteTab job={job} quote={quote} token={token ?? ""} />
          </TabsContent>

          <TabsContent value="invoices" className="space-y-6 mt-0">
            <InvoicesTab job={job} invoices={invoices} outstanding={outstanding} token={token ?? ""} />
          </TabsContent>

          <TabsContent value="documents" className="space-y-6 mt-0">
            <DocumentsTab job={job} quote={quote} invoices={invoices} token={token ?? ""} />
          </TabsContent>
        </Tabs>

        <ContactFooter job={job} />
      </main>
    </div>
  );
}

/* ---------------- Progress ---------------- */

function ProgressTab({ job }: { job: PublicJob }) {
  const photos = (job.photos ?? []) as JobPhoto[];
  const pct = stageProgressPct(job.status);
  const next = nextStepMessage(job.status);
  const outstanding = job.balance?.outstanding ?? 0;

  return (
    <>
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Current Status</h2>
          <span className="text-sm font-medium text-primary">{job.status}</span>
        </div>
        <StagePipeline current={job.status} />
        <p className="text-sm text-muted-foreground mt-4">
          {pct}% of the way through your project.
        </p>
      </Card>

      <div className="bg-primary/5 border border-primary/20 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <ArrowRight className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div>
            <h3 className="font-semibold text-foreground">{next.title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{next.body}</p>
          </div>
        </div>
      </div>

      {outstanding > 0 && (
        <div className="bg-card rounded-lg border shadow-sm p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Wallet className="w-4 h-4" /> Outstanding balance
          </div>
          <div className="text-lg font-semibold text-foreground">{money(outstanding)}</div>
        </div>
      )}

      <Card>
        <h2 className="text-lg font-semibold text-foreground mb-3">Project Details</h2>
        <div className="grid sm:grid-cols-2 gap-y-3 gap-x-6 text-sm">
          <Detail label="Flooring Type" value={job.flooringType} />
          {job.squareFootage ? (
            <Detail label="Area" value={`${job.squareFootage} sq ft`} />
          ) : null}
          {job.crewAssigned ? <Detail label="Crew" value={job.crewAssigned} /> : null}
          {job.estStartDate ? (
            <Detail
              label="Estimated Schedule"
              value={`${job.estStartDate}${
                job.estCompletionDate ? ` – ${job.estCompletionDate}` : ""
              }`}
            />
          ) : null}
          {job.address ? (
            <Detail label="Location" value={`${job.address}, ${job.city}, TN`} />
          ) : (
            <Detail label="Location" value={`${job.city}, TN`} />
          )}
        </div>
      </Card>

      {photos.length > 0 && (
        <Card>
          <h2 className="text-lg font-semibold text-foreground mb-4">Progress Photos</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {photos.map((photo) => (
              <figure
                key={photo.id}
                className="rounded-md border overflow-hidden bg-muted/30"
              >
                <img
                  src={photoSrc(photo.objectPath)}
                  alt={photo.caption || photo.stage}
                  className="w-full h-36 object-cover"
                  loading="lazy"
                />
                <figcaption className="p-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{photo.stage}</span>
                  {photo.caption ? ` · ${photo.caption}` : ""}
                </figcaption>
              </figure>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <h2 className="text-lg font-semibold text-foreground mb-4">Timeline</h2>
        <StageTimeline history={job.stageHistory} />
      </Card>
    </>
  );
}

/* ---------------- Quote ---------------- */

function QuoteTab({
  job,
  quote,
  token,
}: {
  job: PublicJob;
  quote: PublicPortalQuote | null;
  token: string;
}) {
  const queryClient = useQueryClient();
  const queryKey = getGetPublicJobQueryKey(token);
  const acceptMutation = useAcceptPublicQuote();
  const declineMutation = useDeclinePublicQuote();
  const [fullName, setFullName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!quote) {
    return (
      <Card>
        <EmptyState
          icon={<FileText className="w-6 h-6" />}
          title="No quote yet"
          body="Once your flooring team prepares your quote, it will appear here for you to review and accept."
        />
      </Card>
    );
  }

  const balance = quote.estimatedPrice - quote.depositAmount;
  const isAccepted = quote.status === "Accepted";
  const isDeclined = quote.status === "Declined";
  const canRespond = quote.status === "Sent" || quote.status === "Viewed";
  const submitting = acceptMutation.isPending || declineMutation.isPending;

  const handleAccept = async () => {
    setError(null);
    if (!fullName.trim()) {
      setError("Please type your full name to sign.");
      return;
    }
    if (!agreed) {
      setError("Please check the box to confirm your acceptance.");
      return;
    }
    try {
      await acceptMutation.mutateAsync({
        token: quote.shareToken,
        data: { signature: fullName.trim() },
      });
      await queryClient.invalidateQueries({ queryKey });
    } catch {
      setError("Something went wrong. Please refresh and try again.");
    }
  };

  const handleDecline = async () => {
    setError(null);
    try {
      await declineMutation.mutateAsync({ token: quote.shareToken });
      await queryClient.invalidateQueries({ queryKey });
    } catch {
      setError("Something went wrong. Please refresh and try again.");
    }
  };

  return (
    <>
      {isAccepted && (
        <Banner
          tone="success"
          icon={<CheckCircle2 className="w-5 h-5" />}
          title="Quote accepted"
          body={`Signed by ${quote.signature} on ${formatDate(quote.acceptedAt)}. Thank you! We'll be in touch shortly.`}
        />
      )}
      {isDeclined && (
        <Banner
          tone="error"
          icon={<XCircle className="w-5 h-5" />}
          title="Quote declined"
          body={`You declined this quote on ${formatDate(quote.declinedAt)}. Contact us if you'd like to revisit it.`}
        />
      )}

      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" /> {quote.projectLocation}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {quote.flooringType} · {quote.totalSqFt} sq ft
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Total Investment
            </div>
            <div className="text-3xl font-bold text-primary">
              {money(quote.estimatedPrice)}
            </div>
          </div>
        </div>

        {quote.depositAmount > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-4 border-t pt-4 text-sm">
            <div>
              <div className="text-muted-foreground flex items-center gap-1">
                <Wallet className="w-3.5 h-3.5" /> Deposit Due
              </div>
              <div className="font-semibold text-base">{money(quote.depositAmount)}</div>
            </div>
            <div className="text-right">
              <div className="text-muted-foreground">Balance</div>
              <div className="font-semibold text-base">{money(balance)}</div>
            </div>
          </div>
        )}
        {quote.paymentTerms && (
          <p className="text-sm text-muted-foreground mt-3">
            <span className="font-medium text-foreground">Payment terms: </span>
            {quote.paymentTerms}
          </p>
        )}
        <div className="mt-4">
          <DownloadLink href={printUrl(token, "quote")} label="View / download quote (PDF)" />
        </div>
      </Card>

      <Card className="space-y-2">
        <h2 className="font-semibold flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" /> Scope of Work
        </h2>
        <p className="text-sm text-muted-foreground whitespace-pre-line">{quote.scopeOfWork}</p>
      </Card>

      {quote.roomList.length > 0 && (
        <Card className="space-y-2">
          <h2 className="font-semibold flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-primary" /> Rooms & Areas
          </h2>
          <div className="rounded-md border divide-y">
            {quote.roomList.map((room) => (
              <div key={room.id} className="flex justify-between px-3 py-2 text-sm">
                <span className="text-foreground">{room.name}</span>
                <span className="text-muted-foreground">
                  {room.length} × {room.width} ft · {Math.round(room.length * room.width)} sq ft
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="grid sm:grid-cols-2 gap-4">
        {quote.expectedTimeline && (
          <div className="space-y-1">
            <h2 className="font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" /> Expected Timeline
            </h2>
            <p className="text-sm text-muted-foreground">{quote.expectedTimeline}</p>
          </div>
        )}
        {quote.materialAssumptions && (
          <div className="space-y-1">
            <h2 className="font-semibold">Material Assumptions</h2>
            <p className="text-sm text-muted-foreground">{quote.materialAssumptions}</p>
          </div>
        )}
        {quote.exclusions && (
          <div className="space-y-1">
            <h2 className="font-semibold flex items-center gap-2">
              <XCircle className="w-4 h-4 text-destructive" /> Exclusions
            </h2>
            <p className="text-sm text-muted-foreground">{quote.exclusions}</p>
          </div>
        )}
        {quote.warrantyNote && (
          <div className="space-y-1">
            <h2 className="font-semibold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-green-600" /> Warranty
            </h2>
            <p className="text-sm text-muted-foreground">{quote.warrantyNote}</p>
          </div>
        )}
      </Card>

      {canRespond && (
        <Card className="space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <PenLine className="w-4 h-4 text-primary" /> Review & Sign
          </h2>
          <p className="text-sm text-muted-foreground">
            By typing your full name and accepting below, you agree to the scope, pricing,
            and terms in this quote.
          </p>
          <div className="space-y-2">
            <Label htmlFor="fullName">Type your full name to sign</Label>
            <Input
              id="fullName"
              value={fullName}
              placeholder="e.g. Jordan Smith"
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="flex items-start gap-2">
            <Checkbox
              id="agree"
              checked={agreed}
              onCheckedChange={(c) => setAgreed(Boolean(c))}
            />
            <Label htmlFor="agree" className="text-sm font-normal leading-snug">
              I have reviewed and accept this quote and its terms.
            </Label>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button className="flex-1 min-w-[160px]" onClick={handleAccept} disabled={submitting}>
              {acceptMutation.isPending ? "Submitting…" : "Accept & Sign Quote"}
            </Button>
            <Button
              variant="outline"
              className="flex-1 min-w-[160px]"
              onClick={handleDecline}
              disabled={submitting}
            >
              {declineMutation.isPending ? "Submitting…" : "Decline"}
            </Button>
          </div>
        </Card>
      )}
    </>
  );
}

/* ---------------- Invoices ---------------- */

function InvoicesTab({
  invoices,
  outstanding,
  token,
}: {
  job: PublicJob;
  invoices: PublicInvoice[];
  outstanding: number;
  token: string;
}) {
  if (invoices.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Receipt className="w-6 h-6" />}
          title="No invoices yet"
          body="Your invoices will appear here as your project progresses."
        />
      </Card>
    );
  }

  return (
    <>
      <div className="bg-card rounded-lg border shadow-sm p-5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Wallet className="w-4 h-4" /> Outstanding balance
        </div>
        <div className={`text-2xl font-bold ${outstanding > 0 ? "text-foreground" : "text-green-600"}`}>
          {outstanding > 0 ? money(outstanding) : "Paid in full"}
        </div>
      </div>

      {invoices.map((inv) => {
        const balanceDue = Math.max(0, inv.total - inv.depositAmount);
        return (
          <Card key={inv.id} className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-semibold text-foreground">{inv.invoiceNumber}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Issued {formatDate(inv.issueDate)} · Due {formatDate(inv.dueDate)}
                </div>
              </div>
              <Badge variant={publicInvoiceVariant(inv.status)}>{inv.status}</Badge>
            </div>
            <div className="rounded-md border divide-y text-sm">
              <Row label="Total" value={money(inv.total)} bold />
              {inv.depositAmount > 0 && (
                <>
                  <Row label="Deposit" value={`- ${money(inv.depositAmount)}`} />
                  <Row label="Balance Due" value={money(balanceDue)} bold />
                </>
              )}
            </div>
            <DownloadLink
              href={printUrl(token, `invoice/${inv.id}`)}
              label="View / download invoice (PDF)"
            />
          </Card>
        );
      })}
    </>
  );
}

/* ---------------- Documents ---------------- */

function DocumentsTab({
  job,
  quote,
  invoices,
  token,
}: {
  job: PublicJob;
  quote: PublicPortalQuote | null;
  invoices: PublicInvoice[];
  token: string;
}) {
  const photos = (job.photos ?? []) as JobPhoto[];
  const hasDocs = quote || invoices.length > 0 || photos.length > 0;

  if (!hasDocs) {
    return (
      <Card>
        <EmptyState
          icon={<FileText className="w-6 h-6" />}
          title="No documents yet"
          body="Your quote, invoices, and project photos will be collected here."
        />
      </Card>
    );
  }

  return (
    <>
      <Card className="space-y-3">
        <h2 className="font-semibold text-foreground">Your Documents</h2>
        <div className="rounded-md border divide-y">
          {quote && (
            <DocRow
              icon={<FileText className="w-4 h-4 text-primary" />}
              title="Quote"
              subtitle={`${quote.flooringType} · ${money(quote.estimatedPrice)}`}
              href={printUrl(token, "quote")}
            />
          )}
          {invoices.map((inv) => (
            <DocRow
              key={inv.id}
              icon={<Receipt className="w-4 h-4 text-primary" />}
              title={`Invoice ${inv.invoiceNumber}`}
              subtitle={`${inv.status} · ${money(inv.total)}`}
              href={printUrl(token, `invoice/${inv.id}`)}
            />
          ))}
        </div>
      </Card>

      {photos.length > 0 && (
        <Card className="space-y-3">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-primary" /> Project Photos
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {photos.map((photo) => (
              <a
                key={photo.id}
                href={photoSrc(photo.objectPath)}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border overflow-hidden bg-muted/30 block group"
              >
                <img
                  src={photoSrc(photo.objectPath)}
                  alt={photo.caption || photo.stage}
                  className="w-full h-28 object-cover group-hover:opacity-90"
                  loading="lazy"
                />
              </a>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}

/* ---------------- Shared bits ---------------- */

function ContactFooter({ job }: { job: PublicJob }) {
  return (
    <>
      <footer className="bg-card rounded-lg border shadow-sm p-6 mt-6">
        <h2 className="text-lg font-semibold text-foreground mb-3">Questions?</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Reach out to {job.company.companyName} anytime.
        </p>
        <div className="space-y-2 text-sm">
          {job.company.phone && (
            <ContactRow icon={<Phone className="w-4 h-4" />} value={job.company.phone} />
          )}
          {job.company.email && (
            <ContactRow icon={<Mail className="w-4 h-4" />} value={job.company.email} />
          )}
          {job.company.website && (
            <ContactRow icon={<Globe className="w-4 h-4" />} value={job.company.website} />
          )}
        </div>
      </footer>
      <p className="text-center text-xs text-muted-foreground pt-4 pb-8">
        <MapPin className="w-3 h-3 inline mr-1" />
        {job.company.companyName}
      </p>
    </>
  );
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`bg-card rounded-lg border shadow-sm p-6 ${className}`}>
      {children}
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div className="font-medium text-foreground mt-0.5">{value}</div>
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

function ContactRow({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <div className="flex items-center gap-2 text-foreground">
      <span className="text-muted-foreground">{icon}</span>
      {value}
    </div>
  );
}

function DownloadLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
    >
      <Download className="w-4 h-4" /> {label}
    </a>
  );
}

function DocRow({
  icon,
  title,
  subtitle,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  href: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
    >
      <span className="shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-foreground truncate">{title}</div>
        <div className="text-xs text-muted-foreground">{subtitle}</div>
      </div>
      <Download className="w-4 h-4 text-muted-foreground shrink-0" />
    </a>
  );
}

function EmptyState({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="text-center py-8">
      <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
        {icon}
      </div>
      <h3 className="font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">{body}</p>
    </div>
  );
}

function Banner({
  tone,
  icon,
  title,
  body,
}: {
  tone: "success" | "error";
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  const styles =
    tone === "success"
      ? "bg-green-50 border-green-200 text-green-800"
      : "bg-destructive/10 border-destructive/30 text-destructive";
  return (
    <div className={`border rounded-lg p-4 flex items-start gap-3 ${styles}`}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-sm">{body}</p>
      </div>
    </div>
  );
}
