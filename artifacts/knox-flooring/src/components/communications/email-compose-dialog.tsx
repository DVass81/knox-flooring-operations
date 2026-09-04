import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Communication } from "@/lib/types";

interface EmailComposeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prefilled recipient email address from the lead/customer. */
  toAddress: string;
  customerName?: string;
  defaultSubject?: string;
  defaultBody?: string;
  onSend: (input: {
    to: string;
    subject: string;
    body: string;
    customerName?: string;
  }) => Promise<Communication>;
}

export function EmailComposeDialog({
  open,
  onOpenChange,
  toAddress,
  customerName,
  defaultSubject = "",
  defaultBody = "",
  onSend,
}: EmailComposeDialogProps) {
  const { toast } = useToast();
  const [to, setTo] = useState(toAddress);
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) {
      setTo(toAddress);
      setSubject(defaultSubject);
      setBody(defaultBody);
    }
    // Reset the form to the prefilled values each time the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSend = async () => {
    if (!to.trim()) {
      toast({ title: "Recipient email is required", variant: "destructive" });
      return;
    }
    if (!subject.trim() || !body.trim()) {
      toast({
        title: "Subject and message are required",
        variant: "destructive",
      });
      return;
    }
    setSending(true);
    try {
      await onSend({ to: to.trim(), subject: subject.trim(), body, customerName });
      toast({ title: "Email sent" });
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Email could not be sent",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" /> Compose Email
          </DialogTitle>
          <DialogDescription>
            {customerName ? `Send an email to ${customerName}.` : "Send an email."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>To</Label>
            <Input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="customer@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label>Subject</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Your flooring estimate"
            />
          </div>
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              placeholder="Write your message…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? "Sending…" : "Send Email"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
