type FetchLike = typeof fetch;

type ElevenLabsVoice = {
  voice_id?: string;
  name?: string;
};

export type TutorialNarrationResult = {
  audio: Buffer;
  contentType: string;
  provider: "ElevenLabs" | "OpenAI";
  model: string;
  voice: string;
  voiceId?: string;
  outputFormat?: string;
  fallbackReason?: string;
  fallbackCode?: string;
  fallbackStatus?: number;
};

export type TutorialNarrationStatus = {
  provider: "ElevenLabs" | "OpenAI fallback" | "Unavailable";
  voice: string;
  model: string;
};

const DEFAULT_ELEVENLABS_MODEL = "eleven_multilingual_v2";
const DEFAULT_ELEVENLABS_VOICE = "Liam - Energetic, Social Media Creator";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini-tts";
const DEFAULT_OPENAI_VOICE = "marin";

class NarrationProviderError extends Error {
  constructor(readonly status: number, readonly code: string, readonly retryAfterMs = 0) {
    super(`ElevenLabs narration failed (${status}, ${code})`);
  }
}

// Keep current-step generation and prefetch within the account's concurrency allowance.
let elevenLabsQueue: Promise<unknown> = Promise.resolve();
function withElevenLabsSlot<T>(work: () => Promise<T>): Promise<T> {
  const pending = elevenLabsQueue.then(work);
  elevenLabsQueue = pending.catch(() => undefined);
  return pending;
}

async function providerError(response: Response) {
  const payload = await response.json().catch(() => null) as { detail?: { status?: unknown }; error?: { code?: unknown } } | null;
  const rawCode = payload?.detail?.status ?? payload?.error?.code;
  // Never put provider response bodies, submitted text, or credentials into logs/headers.
  const code = typeof rawCode === "string" && /^[a-zA-Z0-9_]{1,64}$/.test(rawCode) ? rawCode : `http_${response.status}`;
  const retryAfter = response.headers.get("retry-after");
  const seconds = retryAfter === null ? 0 : Number(retryAfter);
  const retryAfterMs = Number.isFinite(seconds) ? Math.max(0, seconds * 1000) : Math.max(0, Date.parse(retryAfter!) - Date.now()) || 0;
  return new NarrationProviderError(response.status, code, retryAfterMs);
}

function fallbackDetails(error: unknown) {
  const status = error instanceof NarrationProviderError ? error.status : undefined;
  const code = error instanceof NarrationProviderError ? error.code : error instanceof Error && /timeout|abort/i.test(error.name) ? "timeout" : "connection_error";
  let reason = "ElevenLabs could not be reached. Playing the backup voice; Replay tries ElevenLabs again.";
  if (status === 401 || status === 403) reason = "ElevenLabs access needs attention. Playing the backup voice until access is restored.";
  else if (status === 402 || /quota|credit|payment/.test(code)) reason = "ElevenLabs plan or credits need attention. Playing the backup voice until the account is ready.";
  else if (status === 429) reason = "ElevenLabs is busy. Playing the backup voice; Replay tries ElevenLabs again.";
  else if (status && status >= 500) reason = "ElevenLabs is temporarily unavailable. Playing the backup voice; Replay tries ElevenLabs again.";
  else if (status && status >= 400) reason = "ElevenLabs could not use the configured voice. Playing the backup voice; the voice settings need attention.";
  return { fallbackReason: reason, fallbackCode: code, fallbackStatus: status };
}

function value(env: NodeJS.ProcessEnv, key: string) {
  return env[key]?.trim() ?? "";
}

function numberSetting(env: NodeJS.ProcessEnv, key: string, fallback: number, min: number, max: number) {
  const raw = value(env, key);
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function hasElevenLabs(env: NodeJS.ProcessEnv) {
  return Boolean(value(env, "ELEVENLABS_API_KEY"));
}

function hasOpenAI(env: NodeJS.ProcessEnv) {
  return Boolean(value(env, "OPENAI_API_KEY"));
}

export function getTutorialNarrationStatus(env: NodeJS.ProcessEnv = process.env): TutorialNarrationStatus {
  const preferred = value(env, "TUTORIAL_TTS_PROVIDER").toLowerCase() || "elevenlabs";
  if ((preferred === "elevenlabs" && hasElevenLabs(env)) || (!hasOpenAI(env) && hasElevenLabs(env))) {
    return {
      provider: "ElevenLabs",
      voice: value(env, "ELEVENLABS_VOICE_NAME") || (value(env, "ELEVENLABS_VOICE_ID") ? "Configured teaching voice" : DEFAULT_ELEVENLABS_VOICE),
      model: value(env, "ELEVENLABS_TTS_MODEL") || DEFAULT_ELEVENLABS_MODEL,
    };
  }
  if (hasOpenAI(env)) {
    return {
      provider: "OpenAI fallback",
      voice: value(env, "OPENAI_TTS_VOICE") || DEFAULT_OPENAI_VOICE,
      model: value(env, "OPENAI_TTS_MODEL") || DEFAULT_OPENAI_MODEL,
    };
  }
  return { provider: "Unavailable", voice: "Captions only", model: "none" };
}

async function resolveElevenLabsVoice(fetchImpl: FetchLike, env: NodeJS.ProcessEnv) {
  const configuredId = value(env, "ELEVENLABS_VOICE_ID");
  const configuredName = value(env, "ELEVENLABS_VOICE_NAME") || DEFAULT_ELEVENLABS_VOICE;
  if (configuredId) return { id: configuredId, name: configuredName || "Configured teaching voice" };

  const search = new URL("https://api.elevenlabs.io/v2/voices");
  search.searchParams.set("search", configuredName);
  search.searchParams.set("page_size", "20");
  const response = await fetchImpl(search, {
    headers: { "xi-api-key": value(env, "ELEVENLABS_API_KEY"), Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw await providerError(response);
  const payload = await response.json() as { voices?: ElevenLabsVoice[] };
  const voices = payload.voices ?? [];
  const voice = voices.find((item) => item.name?.toLowerCase() === configuredName.toLowerCase());
  if (!voice?.voice_id) throw new NarrationProviderError(404, "voice_not_found");
  return { id: voice.voice_id, name: voice.name || configuredName };
}

async function generateWithElevenLabs(text: string, fetchImpl: FetchLike, env: NodeJS.ProcessEnv): Promise<TutorialNarrationResult> {
  const apiKey = value(env, "ELEVENLABS_API_KEY");
  if (!apiKey) throw new Error("ElevenLabs is not configured");
  const voice = await resolveElevenLabsVoice(fetchImpl, env);
  const model = value(env, "ELEVENLABS_TTS_MODEL") || DEFAULT_ELEVENLABS_MODEL;
  const outputFormat = value(env, "ELEVENLABS_OUTPUT_FORMAT") || "mp3_44100_128";
  const endpoint = new URL(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice.id)}`);
  endpoint.searchParams.set("output_format", outputFormat);
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({
      text,
      model_id: model,
      voice_settings: {
        stability: numberSetting(env, "ELEVENLABS_VOICE_STABILITY", 0.48, 0, 1),
        similarity_boost: numberSetting(env, "ELEVENLABS_VOICE_SIMILARITY", 0.78, 0, 1),
        style: numberSetting(env, "ELEVENLABS_VOICE_STYLE", 0.32, 0, 1),
        use_speaker_boost: true,
        speed: numberSetting(env, "ELEVENLABS_VOICE_SPEED", 0.96, 0.7, 1.2),
      },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw await providerError(response);
  return {
    audio: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") || "audio/mpeg",
    provider: "ElevenLabs",
    model,
    voice: voice.name,
    voiceId: voice.id,
    outputFormat,
  };
}

async function generateWithOpenAI(text: string, fetchImpl: FetchLike, env: NodeJS.ProcessEnv): Promise<TutorialNarrationResult> {
  const apiKey = value(env, "OPENAI_API_KEY");
  if (!apiKey) throw new Error("OpenAI narration fallback is not configured");
  const model = value(env, "OPENAI_TTS_MODEL") || DEFAULT_OPENAI_MODEL;
  const voice = value(env, "OPENAI_TTS_VOICE") || DEFAULT_OPENAI_VOICE;
  const response = await fetchImpl("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      voice,
      input: text,
      instructions: "Speak like a warm, upbeat young male teacher. Sound patient, natural, inviting, confident, and conversational. Use a relaxed pace and clear phrasing for a professional flooring-team training session.",
      response_format: "mp3",
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`OpenAI speech request failed with status ${response.status}`);
  return { audio: Buffer.from(await response.arrayBuffer()), contentType: "audio/mpeg", provider: "OpenAI", model, voice, voiceId: voice, outputFormat: "mp3" };
}

export async function generateTutorialNarration(
  text: string,
  options: { fetchImpl?: FetchLike; env?: NodeJS.ProcessEnv; waitImpl?: (ms: number) => Promise<void> } = {},
): Promise<TutorialNarrationResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const env = options.env ?? process.env;
  const preferred = value(env, "TUTORIAL_TTS_PROVIDER").toLowerCase() || "elevenlabs";
  const wait = options.waitImpl ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  const generateElevenLabs = () => withElevenLabsSlot(async () => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await generateWithElevenLabs(text, fetchImpl, env);
      } catch (error) {
        const retryable = error instanceof NarrationProviderError
          ? (error.status === 429 || error.status >= 500) && !/quota|credit|payment/.test(error.code) && error.retryAfterMs <= 5000
          : error instanceof Error && (error instanceof TypeError || /timeout|abort/i.test(error.name));
        if (!retryable || attempt >= 2) throw error;
        const backoff = 500 * 2 ** attempt + Math.floor(Math.random() * 200);
        await wait(Math.max(backoff, error instanceof NarrationProviderError ? error.retryAfterMs : 0));
      }
    }
  });

  if ((preferred === "elevenlabs" && hasElevenLabs(env)) || (!hasOpenAI(env) && hasElevenLabs(env))) {
    try {
      return await generateElevenLabs();
    } catch (error) {
      if (!hasOpenAI(env)) throw error;
      return { ...await generateWithOpenAI(text, fetchImpl, env), ...fallbackDetails(error) };
    }
  }
  if (hasOpenAI(env)) return generateWithOpenAI(text, fetchImpl, env);
  if (hasElevenLabs(env)) return generateElevenLabs();
  throw new Error("No tutorial narration provider is configured");
}
