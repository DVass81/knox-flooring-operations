import { Router, type IRouter } from "express";
import { db, quickbooksConnectionsTable } from "@workspace/db";
import { getOpenAIModel, getOpenAIUsageToday, hasOpenAI } from "../lib/openai";
import { getTutorialNarrationStatus } from "../lib/tutorial-narration";

const router: IRouter = Router();
router.get("/integrations/health", async (_req, res) => {
  const [quickbooks] = await db.select().from(quickbooksConnectionsTable).limit(1);
  const quickbooksDemo = process.env.DEMO_MODE === "true";
  const aiUsage = await getOpenAIUsageToday();
  const narration = getTutorialNarrationStatus();
  res.json({
    generatedAt: new Date().toISOString(),
    integrations: [
      { key: "openai", name: "OpenAI Copilots", status: hasOpenAI() ? "Live" : "Simulated", detail: hasOpenAI() ? `Responses API configured with ${getOpenAIModel()}` : "Deterministic fallback is active", metrics: [{ label: "Requests today", value: `${aiUsage.successfulRequests} / ${aiUsage.limit}` }, { label: "Tokens today", value: (aiUsage.inputTokens + aiUsage.outputTokens).toLocaleString() }, { label: "Remaining", value: String(aiUsage.remaining) }] },
      { key: "tutorial_voice", name: "Tutorial Narration", status: narration.provider === "Unavailable" ? "Disconnected" : "Live", detail: narration.provider === "ElevenLabs" ? `ElevenLabs ${narration.voice} · ${narration.model}` : narration.provider === "OpenAI fallback" ? `OpenAI backup narrator · ${narration.voice}` : "Add an ElevenLabs API key and voice ID to enable narration" },
      { key: "quickbooks", name: "QuickBooks Online", status: quickbooks?.status === "connected" ? (process.env.QUICKBOOKS_ENVIRONMENT === "production" ? "Live" : "Sandbox") : quickbooksDemo ? "Simulated" : "Disconnected", detail: quickbooks?.companyName ?? (quickbooksDemo ? "Interactive demo company available in Settings" : "Connect an Intuit sandbox company") },
      { key: "calendar", name: "Google Calendar", status: process.env.GOOGLE_CLIENT_ID ? "Live" : "Simulated", detail: process.env.GOOGLE_CLIENT_ID ? "Dedicated calendar configured" : "Demo calendar mode" },
      { key: "measure_square", name: "Measure Square", status: process.env.MEASURE_SQUARE_API_KEY ? "Live" : "Simulated", detail: process.env.MEASURE_SQUARE_API_KEY ? "Measurement sync configured" : "Fixture imports available" },
      { key: "communications", name: "Email & SMS", status: "Simulated", detail: "Captured in the safe Demo Outbox" },
    ],
  });
});
export default router;
