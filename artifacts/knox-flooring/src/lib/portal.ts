import type { JobStatus } from "@/lib/types";
import type { InvoiceStatus } from "@/lib/types";

export function money(n: number | undefined | null): string {
  return `$${Math.round(n ?? 0).toLocaleString()}`;
}

export function formatDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** Customer-friendly "what happens next" message tied to the current stage. */
export function nextStepMessage(status: JobStatus): { title: string; body: string } {
  switch (status) {
    case "New Lead":
    case "Estimate Scheduled":
      return {
        title: "We're getting ready to visit",
        body: "Our team will measure your space and put together a detailed quote for you.",
      };
    case "Estimate Completed":
      return {
        title: "Preparing your quote",
        body: "We're finalizing your pricing. Your quote will appear in the Quote tab shortly.",
      };
    case "Proposal Sent":
      return {
        title: "Your quote is ready to review",
        body: "Head to the Quote tab to review the details and accept it online when you're ready.",
      };
    case "Approved":
      return {
        title: "Thanks for approving!",
        body: "We're scheduling your materials and crew. We'll keep this page updated as things move.",
      };
    case "Material Ordered":
      return {
        title: "Materials are on the way",
        body: "Your flooring has been ordered. We'll let you know the moment it arrives.",
      };
    case "Material Received":
      return {
        title: "Materials are in",
        body: "Everything has arrived and we're lining up your installation date.",
      };
    case "Scheduled":
      return {
        title: "Installation is scheduled",
        body: "Your crew is booked. Check the project details below for your dates.",
      };
    case "In Progress":
      return {
        title: "Installation underway",
        body: "Our crew is hard at work. Watch the Progress tab for live photos.",
      };
    case "Final Walkthrough":
      return {
        title: "Almost done",
        body: "We're doing a final walkthrough to make sure everything is perfect.",
      };
    case "Completed":
      return {
        title: "Your project is complete",
        body: "Thank you for your business! Any final invoice will appear in the Invoices tab.",
      };
    case "Invoiced":
      return {
        title: "Final invoice sent",
        body: "Your project is wrapped up. See the Invoices tab for your balance and payment details.",
      };
    default:
      return {
        title: "We're on it",
        body: "We'll keep this page updated as your project moves forward.",
      };
  }
}

export function publicInvoiceVariant(
  status: InvoiceStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "Paid":
      return "secondary";
    case "Sent":
      return "default";
    case "Overdue":
      return "destructive";
    default:
      return "outline";
  }
}
