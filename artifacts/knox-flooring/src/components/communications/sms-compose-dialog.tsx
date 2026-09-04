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
import { MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Communication } from "@/lib/types";

interface SmsComposeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prefilled recipient phone number from the lead/customer. */
  toNumber: string;
  customerName?: string;
  defaultBody?: string;
  onSend: (input: {
    to: string;
    body: string;
    customerName?: string;
  }) => Promise<Communication>;
}

const MAX_SMS = 1600;

export function SmsComposeDialog({
  open,
  onOpenChange,
  toNumber,
  customerName,
  defaultBody = "",
  onSend,
}: SmsComposeDialogProps) {
  const { toast } = useToast();
  const [to, setTo] = useState(toNumber);
  const [body, setBody] = useState(defaultBody);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) {
      setTo(toNumber);
      setBody(defaultBody);
    }
    // Reset the form to the prefilled values each time the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSend = async () => {
    if (!to.trim()) {
      toast({ title: "Recipient number is required", variant: "destructive" });
      return;
    }
    if (!body.trim()) {
      toast({ title: "Message is required", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      await onSend({ to: to.trim(), body, customerName });
      toast({ title: "Text message sent" });
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Text could not be sent",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" /> Send Text Message
          </DialogTitle>
          <DialogDescription>
            {customerName
              ? `Send an SMS to ${customerName}.`
              : "Send a text message."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>To</Label>
            <Input
              type="tel"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="+1 865 555 0123"
            />
          </div>
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, MAX_SMS))}
              rows={5}
              placeholder="Write your text…"
            />
            <p className="text-xs text-muted-foreground text-right">
              {body.length}/{MAX_SMS}
            </p>
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
            {sending ? "Sending…" : "Send Text"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
