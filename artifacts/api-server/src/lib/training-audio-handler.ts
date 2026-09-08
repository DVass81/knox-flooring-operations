import { createHash } from "node:crypto";
import type { Request, RequestHandler } from "express";
import type { TutorialNarrationResult, TutorialNarrationStatus } from "./tutorial-narration";

export type CachedTrainingAudio = {
  scriptHash: string;
  stepId: string;
  manifestVersion: string;
  model: string;
  voice: string;
  contentType: string;
  audioBase64: string;
};

type AudioDependencies = {
  manifestVersion: string;
  findScript: (stepId: string) => string | undefined;
  getStatus: (env: NodeJS.ProcessEnv) => TutorialNarrationStatus;
  generate: (script: string, options: { env: NodeJS.ProcessEnv }) => Promise<TutorialNarrationResult>;
  readCache: (hash: string) => Promise<CachedTrainingAudio | undefined>;
  writeCache: (audio: CachedTrainingAudio) => Promise<void>;
  auditGenerated: (req: Request, stepId: string, details: Record<string, unknown>) => Promise<void>;
  env?: () => NodeJS.ProcessEnv;
};

const settingsFingerprint = (env: NodeJS.ProcessEnv) => [env.ELEVENLABS_VOICE_STABILITY, env.ELEVENLABS_VOICE_SIMILARITY, env.ELEVENLABS_VOICE_STYLE, env.ELEVENLABS_VOICE_SPEED].join(":");
const hash = (text: string) => createHash("sha256").update(text).digest("hex");

function audioHash(manifestVersion: string, script: string, status: { provider: string; model: string; voice: string; voiceId?: string; outputFormat?: string }, env: NodeJS.ProcessEnv) {
  const elevenLabs = status.provider === "ElevenLabs";
  return hash(JSON.stringify([
    manifestVersion, status.provider, status.model, status.voice,
    status.voiceId || (elevenLabs ? env.ELEVENLABS_VOICE_ID?.trim() || status.voice : status.voice),
    status.outputFormat || (elevenLabs ? env.ELEVENLABS_OUTPUT_FORMAT?.trim() || "mp3_44100_128" : "mp3"),
    elevenLabs ? settingsFingerprint(env) : "",
    script,
  ]));
}

// Reasons come from the provider's fixed public messages, never its raw error body.
function fallbackDetails(result: TutorialNarrationResult): Pick<TutorialNarrationResult, "fallbackReason" | "fallbackCode" | "fallbackStatus"> {
  if (!result.fallbackReason) return {};
  return {
    fallbackReason: result.fallbackReason.replace(/[^\x20-\x7E]/g, " ").slice(0, 300),
    ...(result.fallbackCode && /^[a-zA-Z0-9_]{1,64}$/.test(result.fallbackCode) ? { fallbackCode: result.fallbackCode } : {}),
    ...(Number.isInteger(result.fallbackStatus) && result.fallbackStatus! >= 100 && result.fallbackStatus! <= 599 ? { fallbackStatus: result.fallbackStatus } : {}),
  };
}

export function createTrainingAudioHandler(dependencies: AudioDependencies): RequestHandler {
  // Prefetch, Replay and concurrent tabs share generation, persistence and its audit.
  // Entries exist only while work is in progress; a backup never blocks recovery.
  const inFlight = new Map<string, Promise<TutorialNarrationResult>>();

  return async (req, res) => {
    // Persistent caching belongs in PostgreSQL. Browser caching on this stable URL
    // would pin the backup voice after a temporary provider error or voice change.
    res.setHeader("Cache-Control", "private, no-store");
    if (!req.auth?.userId) { res.status(401).json({ error: "Authentication required" }); return; }
    const stepId = String(req.params.stepId);
    const script = dependencies.findScript(stepId);
    if (script === undefined) { res.status(404).json({ error: "Narration script not found" }); return; }
    const env = { ...(dependencies.env?.() ?? process.env) };
    const status = dependencies.getStatus(env);
    if (status.provider === "Unavailable") { res.status(503).json({ error: "Voice narration is unavailable. Captions remain available." }); return; }
    const provider = status.provider === "OpenAI fallback" ? "OpenAI" : status.provider;
    const desired = { ...status, provider };
    const desiredHash = audioHash(dependencies.manifestVersion, script, desired, env);

    try {
      let pending = inFlight.get(desiredHash);
      if (!pending) {
        pending = (async () => {
          let cached = await dependencies.readCache(desiredHash);
          if (!cached && provider === "OpenAI") {
            // Old OpenAI entries already identify the actual voice and fixed MP3
            // output. ElevenLabs legacy entries lack voice IDs, so cannot be reused.
            const legacyHash = hash(`${dependencies.manifestVersion}\n${provider}\n${status.model}\n${status.voice}\n${settingsFingerprint(env)}\n${script}`);
            cached = await dependencies.readCache(legacyHash);
          }
          if (cached) return {
            audio: Buffer.from(cached.audioBase64, "base64"),
            contentType: cached.contentType,
            provider: cached.model.startsWith("ElevenLabs:") ? "ElevenLabs" as const : "OpenAI" as const,
            model: cached.model.replace(/^(ElevenLabs|OpenAI):/, ""),
            voice: cached.voice,
          };

          const started = Date.now();
          const generated = await dependencies.generate(script, { env });
          const fallback = fallbackDetails(generated);
          // A fallback has its own provider identity. It must never be found as a
          // successful result for the desired ElevenLabs voice on the next Replay.
          const expectedVoiceId = env.ELEVENLABS_VOICE_ID?.trim();
          const expectedOutput = provider === "ElevenLabs" ? env.ELEVENLABS_OUTPUT_FORMAT?.trim() || "mp3_44100_128" : "mp3";
          const matchesRequested = generated.provider === provider && generated.model === status.model && generated.voice === status.voice
            && (provider !== "ElevenLabs" || !expectedVoiceId || generated.voiceId === expectedVoiceId)
            && generated.outputFormat === expectedOutput;
          const actualHash = matchesRequested
            ? desiredHash
            : audioHash(dependencies.manifestVersion, script, generated, env);
          await dependencies.writeCache({
            scriptHash: actualHash, stepId, manifestVersion: dependencies.manifestVersion,
            model: `${generated.provider}:${generated.model}`, voice: generated.voice,
            contentType: generated.contentType, audioBase64: generated.audio.toString("base64"),
          });
          if (fallback.fallbackReason) req.log?.warn({ stepId, ...fallback }, "Training narration used backup provider");
          await dependencies.auditGenerated(req, stepId, {
            provider: generated.provider, model: generated.model, voice: generated.voice,
            latencyMs: Date.now() - started, ...fallback,
          });
          return { ...generated, ...fallback };
        })();
        inFlight.set(desiredHash, pending);
        // Register both settlements without creating an unhandled rejected promise.
        void pending.then(() => inFlight.delete(desiredHash), () => inFlight.delete(desiredHash));
      }
      const audio = await pending;
      res.setHeader("X-AI-Generated-Voice", "true");
      res.setHeader("X-Narration-Provider", audio.provider);
      res.setHeader("X-Narration-Voice", audio.voice);
      if (audio.fallbackReason) res.setHeader("X-Narration-Fallback-Reason", audio.fallbackReason);
      res.type(audio.contentType).send(audio.audio);
    } catch {
      // Provider failures can contain sensitive request details. Only fixed public
      // metadata is logged here; the generator supplies safe fallback diagnostics.
      req.log?.warn({ stepId }, "Training narration generation failed");
      res.status(503).json({ error: "Voice narration is temporarily unavailable. Continue with the visible captions and try Replay shortly." });
    }
  };
}
