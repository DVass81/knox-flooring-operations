import { useState } from "react";
import { Link } from "wouter";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Mail, MessageSquare, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CommunicationsHistory,
  EmailComposeDialog,
  SmsComposeDialog,
} from "@/components/communications";
import { useStore, useCommunications } from "@/hooks/use-store";
import { customerKey } from "@/lib/customers";
import { CollectionTab } from "./collection-tab";
import { DocumentsTab } from "./documents-tab";
import { MeasurementsPanel } from "@/components/measurements/measurements-panel";
import type {
  Lead,
  LeadNote,
  LeadInteraction,
  LeadSample,
  LeadTask,
  LeadContact,
  LeadAddress,
  LeadMeasurement,
  LeadDocument,
} from "@/lib/types";

interface LeadTabsProps {
  lead: Lead;
}

const TAB_TRIGGERS = [
  "Notes",
  "Interactions",
  "Samples",
  "Tasks",
  "Emails",
  "SMS",
  "Documents",
  "Contacts",
  "Addresses",
  "Measurements",
  "Quotes",
];

export function LeadTabs({ lead }: LeadTabsProps) {
  const { updateLead, proposals, jobs } = useStore();
  const { communications, isLoading, sendEmail, sendSms } = useCommunications({
    leadId: lead.id,
  });
  const [emailOpen, setEmailOpen] = useState(false);
  const [smsOpen, setSmsOpen] = useState(false);

  const save = (updates: Partial<Lead>) => updateLead(lead.id, updates);

  const ckey = customerKey(lead.customerName);
  const leadProposals = proposals.filter(
    (p) => customerKey(p.customerName) === ckey,
  );

  return (
    <Tabs defaultValue="Notes" className="w-full">
      <TabsList className="flex flex-wrap h-auto justify-start">
        {TAB_TRIGGERS.map((t) => (
          <TabsTrigger key={t} value={t}>
            {t}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="Notes" className="mt-4">
        <CollectionTab
          addLabel="Add Note"
          emptyLabel="No notes yet."
          items={lead.noteEntries ?? []}
          titleKey="body"
          fields={[
            {
              key: "body",
              label: "Note",
              type: "textarea",
              required: true,
              fullWidth: true,
            },
            { key: "author", label: "Author", placeholder: "Your name" },
          ]}
          onSave={(noteEntries) => save({ noteEntries })}
        />
      </TabsContent>

      <TabsContent value="Interactions" className="mt-4">
        <CollectionTab
          addLabel="Log Interaction"
          emptyLabel="No interactions logged yet."
          items={lead.interactions ?? []}
          titleKey="summary"
          fields={[
            {
              key: "type",
              label: "Type",
              type: "select",
              required: true,
              options: ["Call", "Email", "Text", "Meeting", "Visit", "Other"],
            },
            { key: "date", label: "Date", type: "date", required: true },
            {
              key: "summary",
              label: "Summary",
              type: "textarea",
              required: true,
              fullWidth: true,
            },
          ]}
          onSave={(interactions) => save({ interactions })}
        />
      </TabsContent>

      <TabsContent value="Samples" className="mt-4">
        <CollectionTab
          addLabel="Add Sample"
          emptyLabel="No samples checked out."
          items={lead.samples ?? []}
          titleKey="productName"
          fields={[
            {
              key: "productName",
              label: "Product Name",
              required: true,
            },
            { key: "color", label: "Color" },
            { key: "sku", label: "SKU" },
            {
              key: "status",
              label: "Status",
              type: "select",
              options: ["Checked Out", "Returned", "Lost"],
            },
            { key: "checkedOutDate", label: "Checked Out", type: "date" },
            { key: "returnDate", label: "Return By", type: "date" },
            {
              key: "notes",
              label: "Notes",
              type: "textarea",
              fullWidth: true,
            },
          ]}
          onSave={(samples) => save({ samples })}
        />
      </TabsContent>

      <TabsContent value="Tasks" className="mt-4">
        <CollectionTab
          addLabel="Add Task"
          emptyLabel="No tasks yet."
          items={lead.tasks ?? []}
          titleKey="title"
          fields={[
            { key: "title", label: "Task", required: true, fullWidth: true },
            { key: "dueDate", label: "Due Date", type: "date" },
            { key: "assignedTo", label: "Assigned To" },
          ]}
          onSave={(tasks) => save({ tasks })}
          renderItem={(task, helpers) => (
            <div className="rounded-md border p-3 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <Checkbox
                  checked={task.completed}
                  onCheckedChange={(checked) =>
                    helpers.patch(task.id, {
                      completed: Boolean(checked),
                      completedAt: checked
                        ? new Date().toISOString()
                        : undefined,
                    })
                  }
                  className="mt-0.5"
                />
                <div className="min-w-0">
                  <div
                    className={cn(
                      "font-medium text-sm",
                      task.completed &&
                        "line-through text-muted-foreground",
                    )}
                  >
                    {task.title}
                  </div>
                  <div className="flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                    {task.dueDate && <span>Due: {task.dueDate}</span>}
                    {task.assignedTo && <span>For: {task.assignedTo}</span>}
                    {task.completed && task.completedAt && (
                      <span>
                        Done: {new Date(task.completedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => helpers.remove(task.id)}
                aria-label="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        />
      </TabsContent>

      <TabsContent value="Emails" className="mt-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Emails sent to {lead.customerName}.
          </p>
          <Button
            size="sm"
            onClick={() => setEmailOpen(true)}
            disabled={!lead.email}
          >
            <Mail className="mr-2 h-4 w-4" /> Compose Email
          </Button>
        </div>
        <CommunicationsHistory
          communications={communications}
          isLoading={isLoading}
          channel="email"
        />
        <EmailComposeDialog
          open={emailOpen}
          onOpenChange={setEmailOpen}
          toAddress={lead.email}
          customerName={lead.customerName}
          onSend={sendEmail}
        />
      </TabsContent>

      <TabsContent value="SMS" className="mt-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Text messages with {lead.customerName}.
          </p>
          <Button
            size="sm"
            onClick={() => setSmsOpen(true)}
            disabled={!lead.phone}
          >
            <MessageSquare className="mr-2 h-4 w-4" /> Send SMS
          </Button>
        </div>
        <CommunicationsHistory
          communications={communications}
          isLoading={isLoading}
          channel="sms"
        />
        <SmsComposeDialog
          open={smsOpen}
          onOpenChange={setSmsOpen}
          toNumber={lead.phone}
          customerName={lead.customerName}
          onSend={sendSms}
        />
      </TabsContent>

      <TabsContent value="Documents" className="mt-4">
        <DocumentsTab
          documents={lead.documents ?? []}
          onSave={(documents) => save({ documents })}
        />
      </TabsContent>

      <TabsContent value="Contacts" className="mt-4">
        <CollectionTab
          addLabel="Add Contact"
          emptyLabel="No additional contacts."
          items={lead.contacts ?? []}
          titleKey="name"
          fields={[
            { key: "name", label: "Name", required: true },
            {
              key: "role",
              label: "Role",
              placeholder: "Spouse, builder, PM...",
            },
            { key: "phone", label: "Phone" },
            { key: "email", label: "Email" },
            {
              key: "notes",
              label: "Notes",
              type: "textarea",
              fullWidth: true,
            },
          ]}
          onSave={(contacts) => save({ contacts })}
        />
      </TabsContent>

      <TabsContent value="Addresses" className="mt-4">
        <CollectionTab
          addLabel="Add Address"
          emptyLabel="No additional addresses."
          items={lead.addresses ?? []}
          titleKey="title"
          fields={[
            {
              key: "title",
              label: "Title",
              required: true,
              placeholder: "Primary Residence, Rental...",
            },
            { key: "street", label: "Street" },
            { key: "city", label: "City" },
            { key: "state", label: "State" },
            { key: "zip", label: "ZIP" },
            { key: "county", label: "County" },
            { key: "subdivision", label: "Subdivision" },
          ]}
          onSave={(addresses) => save({ addresses })}
        />
      </TabsContent>

      <TabsContent value="Measurements" className="mt-4">
        <MeasurementsPanel scope={{ leadId: lead.id }} />
      </TabsContent>

      <TabsContent value="Quotes" className="mt-4">
        {leadProposals.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No quotes or proposals for {lead.customerName} yet.
          </p>
        ) : (
          <div className="space-y-2">
            {leadProposals.map((p) => {
              const job = p.convertedJobId
                ? jobs.find((j) => j.id === p.convertedJobId)
                : undefined;
              return (
                <Link
                  key={p.id}
                  href="/proposals"
                  className="block rounded-md border p-3 hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">
                          {p.flooringType} · {p.projectLocation || "—"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(p.createdAt).toLocaleDateString()}
                          {job ? ` · Job ${job.jobNumber}` : ""}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-semibold">
                        ${p.estimatedPrice.toLocaleString()}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {p.status}
                      </Badge>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
