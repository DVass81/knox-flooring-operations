import { ReplitConnectors } from "@replit/connectors-sdk";
import { logger } from "./logger";

// Email is sent via the Resend integration and SMS via the Twilio integration,
// both reached through the Replit connectors proxy. The proxy injects auth, so
// no API keys are handled here. See the `integrations` setup for connecting them.
const connectors = new ReplitConnectors();

/**
 * Error type that carries an HTTP status so routes can surface a clear,
 * actionable message when a provider isn't connected/configured.
 */
export class CommsError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "CommsError";
    this.status = status;
  }
}

function isConnectivityError(err: unknown): boolean {
  // Thrown by fetch when the proxy/identity can't be reached at all.
  return err instanceof TypeError;
}

export interface SendEmailArgs {
  to: string;
  subject: string;
  body: string;
  from?: string;
}

export interface SendEmailResult {
  providerMessageId: string;
  fromAddress: string;
}

export async function sendEmail({
  to,
  subject,
  body,
  from,
}: SendEmailArgs): Promise<SendEmailResult> {
  if (!to.trim()) {
    throw new CommsError("A recipient email address is required.", 400);
  }

  // Resend requires a verified domain for custom senders; their shared
  // onboarding sender works out of the box for testing/demo.
  const fromAddress =
    from?.trim() ||
    process.env.RESEND_FROM_EMAIL ||
    "Knox Flooring <onboarding@resend.dev>";

  const html = `<div style="font-family:system-ui,Arial,sans-serif;white-space:pre-wrap;line-height:1.5">${escapeHtml(
    body,
  )}</div>`;

  let response: Response;
  try {
    response = await connectors.proxy("resend", "/emails", {
      method: "POST",
      body: { from: fromAddress, to: [to], subject, html, text: body },
    });
  } catch (err) {
    if (isConnectivityError(err)) {
      throw new CommsError(
        "Email service (Resend) is not connected. Connect it in the integrations panel to send email.",
        503,
      );
    }
    throw err;
  }

  if (!response.ok) {
    const detail = await safeText(response);
    logger.warn({ status: response.status, detail }, "Resend send failed");
    if (response.status === 401 || response.status === 403) {
      throw new CommsError(
        "Email service (Resend) is not authorized. Reconnect it in the integrations panel.",
        503,
      );
    }
    throw new CommsError(`Email could not be sent: ${detail}`, 502);
  }

  const data = (await response.json()) as { id?: string };
  return { providerMessageId: data.id ?? "", fromAddress };
}

export interface SendSmsArgs {
  to: string;
  body: string;
  from?: string;
}

export interface SendSmsResult {
  providerMessageId: string;
  fromAddress: string;
}

let cachedTwilioAccountSid: string | null = null;

async function getTwilioAccountSid(): Promise<string> {
  if (cachedTwilioAccountSid) return cachedTwilioAccountSid;
  let response: Response;
  try {
    response = await connectors.proxy("twilio", "/2010-04-01/Accounts.json", {
      method: "GET",
    });
  } catch (err) {
    if (isConnectivityError(err)) {
      throw new CommsError(
        "SMS service (Twilio) is not connected. Connect it in the integrations panel to send texts.",
        503,
      );
    }
    throw err;
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new CommsError(
        "SMS service (Twilio) is not authorized. Reconnect it in the integrations panel.",
        503,
      );
    }
    throw new CommsError(
      `SMS service could not be reached: ${await safeText(response)}`,
      502,
    );
  }
  const data = (await response.json()) as {
    accounts?: Array<{ sid?: string }>;
  };
  const sid = data.accounts?.[0]?.sid;
  if (!sid) {
    throw new CommsError(
      "No Twilio account was found for the connected integration.",
      502,
    );
  }
  cachedTwilioAccountSid = sid;
  return sid;
}

export async function sendSms({
  to,
  body,
  from,
}: SendSmsArgs): Promise<SendSmsResult> {
  if (!to.trim()) {
    throw new CommsError("A recipient phone number is required.", 400);
  }

  const fromNumber = from?.trim() || process.env.TWILIO_FROM_NUMBER;
  if (!fromNumber) {
    throw new CommsError(
      "No SMS sender number is configured. Set TWILIO_FROM_NUMBER to your Twilio phone number.",
      503,
    );
  }

  const accountSid = await getTwilioAccountSid();
  const params = new URLSearchParams({ To: to, From: fromNumber, Body: body });

  let response: Response;
  try {
    response = await connectors.proxy(
      "twilio",
      `/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params,
      },
    );
  } catch (err) {
    if (isConnectivityError(err)) {
      throw new CommsError(
        "SMS service (Twilio) is not connected. Connect it in the integrations panel to send texts.",
        503,
      );
    }
    throw err;
  }

  if (!response.ok) {
    const detail = await safeText(response);
    logger.warn({ status: response.status, detail }, "Twilio send failed");
    if (response.status === 401 || response.status === 403) {
      throw new CommsError(
        "SMS service (Twilio) is not authorized. Reconnect it in the integrations panel.",
        503,
      );
    }
    throw new CommsError(`Text message could not be sent: ${detail}`, 502);
  }

  const data = (await response.json()) as { sid?: string };
  return { providerMessageId: data.sid ?? "", fromAddress: fromNumber };
}

async function safeText(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.slice(0, 500);
  } catch {
    return `HTTP ${response.status}`;
  }
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
