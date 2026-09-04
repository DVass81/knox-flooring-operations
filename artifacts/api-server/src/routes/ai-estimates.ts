import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { aiRequestAuditsTable, db } from "@workspace/db";
import { requireRole } from "../middlewares/auth";
import { createStructuredResponse, getOpenAIModel, getOpenAIUsageToday, hasOpenAI } from "../lib/openai";

const router: IRouter = Router();
const PROMPT_VERSION = "knox-estimator-2026.1";

const recommendationSchema = {
  type: "object",
  additionalProperties: false,
  required: ["scopeOfWork", "recommendedProducts", "wasteFactor", "wasteExplanation", "labor", "preparation", "risks", "missingInformation", "marginWarnings", "proposalSummary", "internalNotes", "confidence", "suppliedFacts", "assumptions"],
  properties: {
    scopeOfWork: { type: "string" },
    recommendedProducts: { type: "array", items: { type: "string" } },
    wasteFactor: { type: "number", minimum: 0, maximum: 30 },
    wasteExplanation: { type: "string" },
    labor: { type: "object", additionalProperties: false, required: ["hours", "crewSize", "durationDays"], properties: { hours: { type: "number", minimum: 1 }, crewSize: { type: "integer", minimum: 1 }, durationDays: { type: "integer", minimum: 1 } } },
    preparation: { type: "array", items: { type: "string" } },
    risks: { type: "array", items: { type: "string" } },
    missingInformation: { type: "array", items: { type: "string" } },
    marginWarnings: { type: "array", items: { type: "string" } },
    proposalSummary: { type: "string" },
    internalNotes: { type: "string" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    suppliedFacts: { type: "object", additionalProperties: false, required: ["flooringType", "squareFeet", "roomsCount", "city"], properties: { flooringType: { type: "string" }, squareFeet: { type: "number" }, roomsCount: { type: "integer" }, city: { type: "string" } } },
    assumptions: { type: "array", items: { type: "string" } },
  },
};

function fallback(input: any) {
  const rooms = Array.isArray(input.rooms) ? input.rooms : [];
  const sqft = rooms.reduce((sum: number, room: any) => sum + Math.max(0, Number(room.length) * Number(room.width)), 0);
  const type = String(input.flooringType || "flooring");
  const waste = type.includes("Tile") ? 15 : type.includes("Carpet") ? 7 : 10;
  const risks = type.includes("Hardwood") ? ["Verify moisture readings and allow at least 72 hours for acclimation."] : type.includes("Tile") ? ["Confirm subfloor flatness and include cure time in the schedule."] : ["Confirm subfloor condition before finalizing the scope."];
  return { mode: "fallback", scopeOfWork: `Prepare and professionally install ${type} in ${rooms.length || 1} area(s).`, recommendedProducts: [], wasteFactor: waste, wasteExplanation: `A ${waste}% planning allowance is typical for this material and should be confirmed against the final layout.`, labor: { hours: Math.ceil(sqft / 50), crewSize: sqft > 1200 ? 3 : 2, durationDays: Math.max(1, Math.ceil(sqft / 800)) }, preparation: ["Verify field measurements", "Inspect and photograph the subfloor"], risks, missingInformation: ["Confirm product SKU and current supplier availability", "Confirm tax jurisdiction"], marginWarnings: [], proposalSummary: `${type} installation for approximately ${Math.round(sqft)} square feet, subject to final field verification and product selection.`, internalNotes: "Deterministic fallback recommendation. Prices and totals remain controlled by Knox Ops.", confidence: "medium", suppliedFacts: { flooringType: type, squareFeet: sqft }, assumptions: ["Rooms are rectangular unless noted otherwise"] };
}

router.post("/ai/estimate", requireRole("owner", "sales"), async (req, res) => {
  const started = Date.now();
  const model = getOpenAIModel();
  let result: Record<string, any> = fallback(req.body);
  let status = "fallback";
  let inputTokens = 0, outputTokens = 0;
  const budget = hasOpenAI() ? await getOpenAIUsageToday() : null;
  if (hasOpenAI() && budget && budget.remaining > 0) {
    try {
      const ai = await createStructuredResponse<Record<string, any>>({
        schemaName: "flooring_quote_recommendation",
        schema: recommendationSchema,
        instructions: "You are Knoxville Flooring Center's estimating copilot. Use only supplied facts and catalog entries. Never invent products, measurements, prices, availability, or tax. Separate facts from assumptions. Knox Ops performs all arithmetic and final pricing. suppliedFacts must summarize flooringType, raw square feet, room count, and city exactly from the input.",
        input: req.body,
        promptCacheKey: PROMPT_VERSION,
        safetyIdentifier: req.auth!.userId,
      });
      result = { ...ai.value, mode: "live" }; status = "success";
      inputTokens = ai.usage.inputTokens; outputTokens = ai.usage.outputTokens;
    } catch (error) { result = { ...result, fallbackReason: error instanceof Error ? error.message : "AI unavailable" }; }
  } else if (hasOpenAI()) {
    result = { ...result, fallbackReason: `Daily OpenAI request limit reached (${budget?.limit ?? 100})` };
  }
  await db.insert(aiRequestAuditsTable).values({ id: randomUUID(), userId: req.auth!.userId, model, promptVersion: PROMPT_VERSION, status, latencyMs: Date.now() - started, inputTokens, outputTokens, estimatedCostMicros: 0, createdAt: new Date().toISOString() });
  res.json({ ...result, promptVersion: PROMPT_VERSION, model: status === "success" ? model : null });
});

export default router;
