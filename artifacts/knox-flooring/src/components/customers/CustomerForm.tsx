import { useState } from "react";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  operation,
  useRefreshOperations,
  type Customer,
} from "@/lib/operations";
import { useUnsavedForm } from "@/hooks/use-unsaved-changes";

export function CustomerForm({
  customer,
  onClose,
}: {
  customer?: Customer;
  onClose: () => void;
}) {
  const [, navigate] = useLocation();
  const refresh = useRefreshOperations();
  const [name, setName] = useState(customer?.name || "");
  const [email, setEmail] = useState(customer?.email || "");
  const [phone, setPhone] = useState(customer?.phone || "");
  const [notes, setNotes] = useState(customer?.notes || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const guard = useUnsavedForm(true, { name, email, phone, notes });
  const close = () => {
    if (!busy && guard.confirmDiscard()) onClose();
  };
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {customer ? "Edit customer" : "Add customer"}
          </DialogTitle>
          <DialogDescription>
            Keep contact details together across projects and locations.
            Existing documents retain their original recipient details.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError("");
            try {
              const saved = await operation<Customer>(
                customer
                  ? `/customers/${encodeURIComponent(customer.id)}`
                  : "/customers",
                customer ? "PATCH" : "POST",
                {
                  name: name.trim(),
                  email: email.trim(),
                  phone: phone.trim(),
                  notes,
                  ...(customer ? { revision: customer.revision } : {}),
                },
              );
              await refresh();
              onClose();
              if (!customer)
                navigate(`/customers/${encodeURIComponent(saved.id)}`);
            } catch (cause) {
              setError(
                cause instanceof Error
                  ? cause.message
                  : "Customer could not be saved. Your entries are still here.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="block space-y-1 text-sm">
            <span>Name</span>
            <Input
              autoFocus
              required
              maxLength={200}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">
              <span>Email</span>
              <Input
                type="email"
                maxLength={320}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span>Phone</span>
              <Input
                type="tel"
                maxLength={80}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </label>
          </div>
          <label className="block space-y-1 text-sm">
            <span>Customer notes</span>
            <Textarea
              maxLength={10000}
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={close}
            >
              Cancel
            </Button>
            <Button disabled={busy || !name.trim()}>
              {busy ? "Saving…" : "Save customer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
