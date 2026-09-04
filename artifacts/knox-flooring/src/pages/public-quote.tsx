import { useState } from "react";
import { useParams } from "wouter";
import {
  useGetPublicQuote,
  getGetPublicQuoteQueryKey,
  useAcceptPublicQuote,
  useDeclinePublicQuote,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Loader2,
  MapPin,
  Phone,
  Mail,
  Globe,
  FileText,
  ListChecks,
  Clock,
  ShieldCheck,
  XCircle,
  Wallet,
  CheckCircle2,
  PenLine,
} from "lucide-react";

function money(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatDate(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function PublicQuote() {
  const { token } = useParams();
  const queryClient = useQueryClient();
  const queryKey = getGetPublicQuoteQueryKey(token ?? "");

  const { data: quote, isLoading, isError } = useGetPublicQuote(token ?? "", {
    query: { queryKey, enabled: Boolean(token), retry: false },
  });

  const acceptMutation = useAcceptPublicQuote();
  const declineMutation = useDeclinePublicQuote();

  const [fullName, setFullName] = useState("");
  const [agreed, setAgreed] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submitting = acceptMutation.isPending || declineMutation.isPending;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !quote) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 px-6 text-center">
        <h1 className="text-2xl font-semibold text-foreground">Quote not found</h1>
        <p className="text-muted-foreground mt-2 max-w-md">
          This quote link is invalid or has expired. Please contact your flooring
          team for an updated link.
        </p>
      </div>
    );
  }

  const balance = quote.estimatedPrice - quote.depositAmount;
  const isAccepted = quote.status === "Accepted";
  const isDeclined = quote.status === "Declined";
  const canRespond = quote.status === "Sent" || quote.status === "Viewed";

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
        token: token ?? "",
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
      await declineMutation.mutateAsync({ token: token ?? "" });
      await queryClient.invalidateQueries({ queryKey });
    } catch {
      setError("Something went wrong. Please refresh and try again.");
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-primary text-primary-foreground">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <p className="text-xs uppercase tracking-[0.2em] opacity-80">
            {quote.company.companyName}
          </p>
          <h1 className="text-2xl md:text-3xl font-semibold mt-1">Your Flooring Quote</h1>
          <p className="opacity-90 mt-1">{quote.customerName}</p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Status banners */}
        {isAccepted && (
          <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg p-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Quote accepted</p>
              <p className="text-sm">
                Signed by {quote.signature} on {formatDate(quote.acceptedAt)}. Thank you!
                We'll be in touch shortly.
              </p>
            </div>
          </div>
        )}
        {isDeclined && (
          <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-lg p-4 flex items-start gap-3">
            <XCircle className="w-5 h-5 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Quote declined</p>
              <p className="text-sm">
                You declined this quote on {formatDate(quote.declinedAt)}. Contact us if
                you'd like to revisit it.
              </p>
            </div>
          </div>
        )}

        {/* Summary */}
        <section className="bg-card rounded-lg border shadow-sm p-6">
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
              <div className="text-3xl font-bold text-primary">{money(quote.estimatedPrice)}</div>
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
        </section>

        {/* Scope */}
        <section className="bg-card rounded-lg border shadow-sm p-6 space-y-2">
          <h2 className="font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" /> Scope of Work
          </h2>
          <p className="text-sm text-muted-foreground">{quote.scopeOfWork}</p>
        </section>

        {/* Rooms */}
        <section className="bg-card rounded-lg border shadow-sm p-6 space-y-2">
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
        </section>

        {/* Timeline + assumptions */}
        <section className="bg-card rounded-lg border shadow-sm p-6 grid sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <h2 className="font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" /> Expected Timeline
            </h2>
            <p className="text-sm text-muted-foreground">{quote.expectedTimeline}</p>
          </div>
          <div className="space-y-1">
            <h2 className="font-semibold">Material Assumptions</h2>
            <p className="text-sm text-muted-foreground">{quote.materialAssumptions}</p>
          </div>
        </section>

        {/* Exclusions + warranty */}
        <section className="bg-card rounded-lg border shadow-sm p-6 space-y-4">
          <div className="space-y-1">
            <h2 className="font-semibold flex items-center gap-2">
              <XCircle className="w-4 h-4 text-destructive" /> Exclusions
            </h2>
            <p className="text-sm text-muted-foreground">{quote.exclusions}</p>
          </div>
          <div className="space-y-1">
            <h2 className="font-semibold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-green-600" /> Warranty
            </h2>
            <p className="text-sm text-muted-foreground">{quote.warrantyNote}</p>
          </div>
        </section>

        {/* Acceptance / e-sign */}
        {canRespond && (
          <section className="bg-card rounded-lg border shadow-sm p-6 space-y-4">
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
                checked={Boolean(agreed)}
                onCheckedChange={(c) => setAgreed(c ? "yes" : "")}
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
          </section>
        )}

        {/* Contact */}
        <footer className="bg-card rounded-lg border shadow-sm p-6">
          <h2 className="font-semibold text-foreground mb-3">Questions?</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Reach out to {quote.company.companyName} anytime.
          </p>
          <div className="space-y-2 text-sm">
            {quote.company.phone && (
              <ContactRow icon={<Phone className="w-4 h-4" />} value={quote.company.phone} />
            )}
            {quote.company.email && (
              <ContactRow icon={<Mail className="w-4 h-4" />} value={quote.company.email} />
            )}
            {quote.company.website && (
              <ContactRow icon={<Globe className="w-4 h-4" />} value={quote.company.website} />
            )}
          </div>
        </footer>

        <p className="text-center text-xs text-muted-foreground pt-2 pb-8">
          <MapPin className="w-3 h-3 inline mr-1" />
          {quote.company.companyName}
        </p>
      </main>
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
