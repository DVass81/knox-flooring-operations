import { createHash } from "node:crypto";
import { aiRequestAuditsTable, db } from "@workspace/db";

type StructuredResponseOptions = {
  schemaName: string;
  schema: Record<string, unknown>;
  instructions: string;
  input: unknown;
  promptCacheKey: string;
  safetyIdentifier: string;
  maxOutputTokens?: number;
};

type OpenAIUsage = {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
};

export const hasOpenAI = () => Boolean(process.env.OPENAI_API_KEY);
export const getOpenAIModel = () => process.env.OPENAI_ESTIMATOR_MODEL ?? "gpt-5.5";

export async function getOpenAIUsageToday() {
  const today = new Date().toISOString().slice(0, 10);
  const rows = (await db.select().from(aiRequestAuditsTable)).filter((row) => row.createdAt.startsWith(today));
  const successfulRequests = rows.filter((row) => row.status === "success").length;
  const limit = Math.max(1, Number(process.env.OPENAI_DAILY_REQUEST_LIMIT ?? 100) || 100);
  return {
    successfulRequests,
    attempts: rows.length,
    inputTokens: rows.reduce((sum, row) => sum + row.inputTokens, 0),
    outputTokens: rows.reduce((sum, row) => sum + row.outputTokens, 0),
    limit,
    remaining: Math.max(0, limit - successfulRequests),
  };
}

function outputText(payload: any) {
  if (typeof payload?.output_text === "string" && payload.output_text) return payload.output_text;
  for (const item of payload?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (content?.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  throw new Error("OpenAI returned no structured output");
}

export async function createStructuredResponse<T>(options: StructuredResponseOptions): Promise<{ value: T; model: string; usage: OpenAIUsage }> {
  if (!process.env.OPENAI_API_KEY) throw new Error("OpenAI is not configured");
  const model = getOpenAIModel();
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    signal: AbortSignal.timeout(30_000),
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      store: false,
      max_output_tokens: options.maxOutputTokens ?? 1800,
      reasoning: { effort: "low" },
      prompt_cache_key: options.promptCacheKey,
      safety_identifier: createHash("sha256").update(options.safetyIdentifier).digest("hex").slice(0, 32),
      instructions: options.instructions,
      input: JSON.stringify(options.input),
      text: {
        verbosity: "low",
        format: {
          type: "json_schema",
          name: options.schemaName,
          strict: true,
          schema: options.schema,
        },
      },
    }),
  });
  const payload: any = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload?.error?.message ? `: ${payload.error.message}` : "";
    throw new Error(`OpenAI returned ${response.status}${detail}`);
  }
  return {
    value: JSON.parse(outputText(payload)) as T,
    model: String(payload.model ?? model),
    usage: {
      inputTokens: Number(payload.usage?.input_tokens ?? 0),
      outputTokens: Number(payload.usage?.output_tokens ?? 0),
      cachedInputTokens: Number(payload.usage?.input_tokens_details?.cached_tokens ?? 0),
    },
  };
}
