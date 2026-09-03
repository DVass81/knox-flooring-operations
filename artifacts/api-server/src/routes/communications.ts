import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  communicationsTable,
  type CommunicationInsert,
} from "@workspace/db";
import {
  ListCommunicationsQueryParams,
  ListCommunicationsResponse,
  ListCommunicationsResponseItem,
  SendEmailBody,
  SendSmsBody,
} from "@workspace/api-zod";
import { stripNulls } from "../lib/strip-nulls";
import { CommsError, sendEmail, sendSms } from "../lib/comms";
import { customerKey } from "../lib/customer-key";

const router: IRouter = Router();

router.get("/communications", async (req, res): Promise<void> => {
  const query = ListCommunicationsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const filters = [];
  if (query.data.leadId) {
    filters.push(eq(communicationsTable.leadId, query.data.leadId));
  }
  if (query.data.customerKey) {
    filters.push(eq(communicationsTable.customerKey, query.data.customerKey));
  }

  const rows = await db
    .select()
    .from(communicationsTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(communicationsTable.createdAt));

  res.json(ListCommunicationsResponse.parse(rows.map(stripNulls)));
});

router.post("/communications/email", async (req, res): Promise<void> => {
  const parsed = SendEmailBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid send-email body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { to, subject, body, leadId, customerKey: ckey, customerName } =
    parsed.data;
  const resolvedKey =
    ckey ?? (customerName ? customerKey(customerName) : undefined);

  try {
    const result = await sendEmail({ to, subject, body });
    const row = await persist({
      leadId,
      customerKey: resolvedKey,
      customerName: customerName ?? "",
      channel: "email",
      direction: "outbound",
      toAddress: to,
      fromAddress: result.fromAddress,
      subject,
      body,
      status: "sent",
      providerMessageId: result.providerMessageId || null,
    });
    res.status(201).json(ListCommunicationsResponseItem.parse(stripNulls(row)));
  } catch (err) {
    await logFailedSend(err, {
      leadId,
      customerKey: resolvedKey,
      customerName: customerName ?? "",
      channel: "email",
      toAddress: to,
      fromAddress: "",
      subject,
      body,
    });
    handleSendError(err, res, req.log.error.bind(req.log));
  }
});

router.post("/communications/sms", async (req, res): Promise<void> => {
  const parsed = SendSmsBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid send-sms body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { to, body, leadId, customerKey: ckey, customerName } = parsed.data;
  const resolvedKey =
    ckey ?? (customerName ? customerKey(customerName) : undefined);

  try {
    const result = await sendSms({ to, body });
    const row = await persist({
      leadId,
      customerKey: resolvedKey,
      customerName: customerName ?? "",
      channel: "sms",
      direction: "outbound",
      toAddress: to,
      fromAddress: result.fromAddress,
      subject: "",
      body,
      status: "sent",
      providerMessageId: result.providerMessageId || null,
    });
    res.status(201).json(ListCommunicationsResponseItem.parse(stripNulls(row)));
  } catch (err) {
    await logFailedSend(err, {
      leadId,
      customerKey: resolvedKey,
      customerName: customerName ?? "",
      channel: "sms",
      toAddress: to,
      fromAddress: "",
      subject: "",
      body,
    });
    handleSendError(err, res, req.log.error.bind(req.log));
  }
});

async function persist(
  values: Omit<CommunicationInsert, "id" | "createdAt">,
) {
  const [row] = await db
    .insert(communicationsTable)
    .values({
      ...values,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    })
    .returning();
  return row;
}

// Records a failed outbound attempt so it shows up in the history. Only
// genuine send attempts (provider/connectivity errors) are logged; plain
// bad-input (400) errors are not persisted. Persistence failures here are
// swallowed so the original send error is still returned to the caller.
async function logFailedSend(
  err: unknown,
  values: Omit<
    CommunicationInsert,
    "id" | "createdAt" | "direction" | "status" | "errorMessage"
  >,
): Promise<void> {
  if (err instanceof CommsError && err.status === 400) return;
  const errorMessage =
    err instanceof Error ? err.message : "Unknown send error";
  try {
    await persist({
      ...values,
      direction: "outbound",
      status: "failed",
      errorMessage,
    });
  } catch {
    // Best effort — never mask the original send error.
  }
}

function handleSendError(
  err: unknown,
  res: import("express").Response,
  log: (obj: unknown, msg?: string) => void,
): void {
  if (err instanceof CommsError) {
    log({ err: err.message, status: err.status }, "Communication send failed");
    res.status(err.status).json({ error: err.message });
    return;
  }
  log({ err }, "Unexpected communication send error");
  res
    .status(500)
    .json({ error: "Something went wrong while sending the message." });
}

export default router;
