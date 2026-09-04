import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { aiRequestAuditsTable, db } from "@workspace/db";
import { requireRole } from "../middlewares/auth";

const router: IRouter = Router();
const PROMPT_VERSION = "knox-estimator-2026.1";

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
  const model = process.env.OPENAI_ESTIMATOR_MODEL ?? "gpt-5.6-terra";
  let result: Record<string, any> = fallback(req.body);
  let status = "fallback";
  let inputTokens = 0, outputTokens = 0;
  if (process.env.OPENAI_API_KEY) {
    try {
      const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", signal: AbortSignal.timeout(25_000), headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, store: false, max_output_tokens: 1800, input: [{ role: "system", content: "You are Knoxville Flooring Center's estimating copilot. Use only supplied facts and catalog entries. Never invent products, measurements, prices, availability, or tax. Separate facts from assumptions. Return concise, practical flooring guidance; Knox Ops performs all arithmetic and final pricing." }, { role: "user", content: JSON.stringify(req.body) }], text: { format: { type: "json_schema", name: "flooring_quote_recommendation", strict: true, schema: { type: "object", additionalProperties: false, required: ["scopeOfWork","recommendedProducts","wasteFactor","wasteExplanation","labor","preparation","risks","missingInformation","marginWarnings","proposalSummary","internalNotes","confidence","suppliedFacts","assumptions"], properties: { scopeOfWork:{type:"string"}, recommendedProducts:{type:"array",items:{type:"string"}}, wasteFactor:{type:"number"}, wasteExplanation:{type:"string"}, labor:{type:"object",additionalProperties:false,required:["hours","crewSize","durationDays"],properties:{hours:{type:"number"},crewSize:{type:"integer"},durationDays:{type:"integer"}}}, preparation:{type:"array",items:{type:"string"}}, risks:{type:"array",items:{type:"string"}}, missingInformation:{type:"array",items:{type:"string"}}, marginWarnings:{type:"array",items:{type:"string"}}, proposalSummary:{type:"string"}, internalNotes:{type:"string"}, confidence:{type:"string",enum:["low","medium","high"]}, suppliedFacts:{type:"object",additionalProperties:true}, assumptions:{type:"array",items:{type:"string"}} } } } } }) });
      if (!response.ok) throw new Error(`OpenAI returned ${response.status}`);
      const payload: any = await response.json();
      const text = payload.output_text ?? payload.output?.flatMap((o:any)=>o.content ?? []).find((c:any)=>c.type === "output_text")?.text;
      result = { ...JSON.parse(text), mode: "live" }; status = "success";
      inputTokens = payload.usage?.input_tokens ?? 0; outputTokens = payload.usage?.output_tokens ?? 0;
    } catch (error) { result = { ...result, fallbackReason: error instanceof Error ? error.message : "AI unavailable" }; }
  }
  await db.insert(aiRequestAuditsTable).values({ id: randomUUID(), userId: req.auth!.userId, model, promptVersion: PROMPT_VERSION, status, latencyMs: Date.now() - started, inputTokens, outputTokens, estimatedCostMicros: 0, createdAt: new Date().toISOString() });
  res.json({ ...result, promptVersion: PROMPT_VERSION, model: status === "success" ? model : null });
});

export default router;
