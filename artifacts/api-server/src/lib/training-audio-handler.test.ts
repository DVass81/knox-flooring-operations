import { createHash } from "node:crypto";
import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createTrainingAudioHandler, type CachedTrainingAudio } from "./training-audio-handler";
import type { TutorialNarrationResult, TutorialNarrationStatus } from "./tutorial-narration";

const preferredAudio: TutorialNarrationResult = {
  provider: "ElevenLabs", model: "eleven_multilingual_v2", voice: "Knox Guide",
  voiceId: "original-voice-id", outputFormat: "mp3_44100_128",
  audio: Buffer.from("elevenlabs-audio"), contentType: "audio/mpeg",
};
const preferredStatus: TutorialNarrationStatus = { provider: "ElevenLabs", model: preferredAudio.model, voice: preferredAudio.voice };
const script = "Welcome to this lesson.";

function fixture() {
  const cache = new Map<string, CachedTrainingAudio>();
  let status = preferredStatus;
  const env: NodeJS.ProcessEnv = { ELEVENLABS_VOICE_ID: "original-voice-id" };
  const generate = vi.fn<() => Promise<TutorialNarrationResult>>().mockImplementation(async () => ({ ...preferredAudio, voiceId: env.ELEVENLABS_VOICE_ID, outputFormat: env.ELEVENLABS_OUTPUT_FORMAT || "mp3_44100_128" }));
  const readCache = vi.fn(async (hash: string) => cache.get(hash));
  const writeCache = vi.fn(async (audio: CachedTrainingAudio) => { cache.set(audio.scriptHash, audio); });
  const auditGenerated = vi.fn(async () => {});
  const warn = vi.fn();
  function app(authenticated = true) {
    const result = express();
    result.use((req, _res, next) => {
      if (authenticated) req.auth = { userId: "owner", email: "owner@example.test", name: "Test Owner", role: "owner", actualRole: "owner", previewRole: null, csrfToken: "csrf" };
      req.log = { warn } as unknown as typeof req.log;
      next();
    });
    result.get("/audio/:stepId", createTrainingAudioHandler({
      manifestVersion: "training-v1", findScript: (id) => id === "welcome" ? script : undefined,
      env: () => env, getStatus: () => status, generate, readCache, writeCache, auditGenerated,
    }));
    return result;
  }
  return { app, env, cache, generate, readCache, writeCache, auditGenerated, warn, setStatus: (next: TutorialNarrationStatus) => { status = next; } };
}

describe("training audio HTTP cache and provider recovery", () => {
  it("reuses persisted successful audio after handler recreation, without browser caching", async () => {
    const f = fixture();
    const generated = await request(f.app()).get("/audio/welcome").expect(200);
    const persisted = await request(f.app()).get("/audio/welcome").expect(200);

    expect(generated.headers["cache-control"]).toBe("private, no-store");
    expect(persisted.headers["cache-control"]).toBe("private, no-store");
    expect(persisted.headers["x-narration-provider"]).toBe("ElevenLabs");
    expect(persisted.body).toEqual(preferredAudio.audio);
    expect(f.generate).toHaveBeenCalledTimes(1);
    expect(f.writeCache).toHaveBeenCalledTimes(1);
    expect(f.auditGenerated).toHaveBeenCalledTimes(1);
  });

  it("coalesces concurrent prefetch and Replay including the database write and audit", async () => {
    const f = fixture();
    f.generate.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      return preferredAudio;
    });
    const app = f.app();
    const responses = await Promise.all(Array.from({ length: 4 }, () => request(app).get("/audio/welcome").expect(200)));

    expect(responses.every((response) => response.headers["x-narration-provider"] === "ElevenLabs")).toBe(true);
    expect(f.readCache).toHaveBeenCalledTimes(1);
    expect(f.generate).toHaveBeenCalledTimes(1);
    expect(f.writeCache).toHaveBeenCalledTimes(1);
    expect(f.auditGenerated).toHaveBeenCalledTimes(1);
  });

  it("reports a backup without poisoning the preferred cache and recovers on Replay", async () => {
    const f = fixture();
    f.generate.mockResolvedValueOnce({
      provider: "OpenAI", model: "gpt-4o-mini-tts", voice: "marin",
      voiceId: "marin", outputFormat: "mp3",
      audio: Buffer.from("backup-audio"), contentType: "audio/mpeg",
      fallbackReason: "ElevenLabs is temporarily unavailable.", fallbackCode: "service_unavailable", fallbackStatus: 503,
    });
    const app = f.app();
    const backup = await request(app).get("/audio/welcome").expect(200);
    const recovered = await request(app).get("/audio/welcome").expect(200);
    const reused = await request(app).get("/audio/welcome").expect(200);

    expect(backup.headers["x-narration-provider"]).toBe("OpenAI");
    expect(backup.headers["x-narration-fallback-reason"]).toBe("ElevenLabs is temporarily unavailable.");
    expect(backup.headers["cache-control"]).toBe("private, no-store");
    expect(recovered.headers["x-narration-provider"]).toBe("ElevenLabs");
    expect(recovered.headers["x-narration-fallback-reason"]).toBeUndefined();
    expect(reused.body).toEqual(preferredAudio.audio);
    expect(f.generate).toHaveBeenCalledTimes(2);
    expect(f.cache.size).toBe(2);
    expect(f.auditGenerated.mock.calls[0]).toEqual(expect.arrayContaining([expect.objectContaining({ fallbackReason: "ElevenLabs is temporarily unavailable.", fallbackCode: "service_unavailable", fallbackStatus: 503 })]));
    expect(f.warn).toHaveBeenCalledWith(expect.objectContaining({ fallbackCode: "service_unavailable" }), expect.any(String));
  });

  it("invalidates the desired cache when the exact voice ID or output format changes", async () => {
    const f = fixture();
    const app = f.app();
    await request(app).get("/audio/welcome").expect(200);
    f.env.ELEVENLABS_VOICE_ID = "changed-id-same-display-name";
    await request(app).get("/audio/welcome").expect(200);
    f.env.ELEVENLABS_OUTPUT_FORMAT = "mp3_22050_32";
    await request(app).get("/audio/welcome").expect(200);

    expect(f.generate).toHaveBeenCalledTimes(3);
    expect(f.cache.size).toBe(3);
  });

  it("reuses an unambiguous legacy OpenAI cache entry", async () => {
    const f = fixture();
    f.setStatus({ provider: "OpenAI fallback", model: "gpt-4o-mini-tts", voice: "marin" });
    const legacyHash = createHash("sha256").update(`training-v1\nOpenAI\ngpt-4o-mini-tts\nmarin\n:::\n${script}`).digest("hex");
    f.cache.set(legacyHash, { scriptHash: legacyHash, stepId: "welcome", manifestVersion: "training-v1", model: "OpenAI:gpt-4o-mini-tts", voice: "marin", contentType: "audio/mpeg", audioBase64: Buffer.from("legacy-audio").toString("base64") });

    const response = await request(f.app()).get("/audio/welcome").expect(200);
    expect(response.headers["x-narration-provider"]).toBe("OpenAI");
    expect(response.body).toEqual(Buffer.from("legacy-audio"));
    expect(f.generate).not.toHaveBeenCalled();
  });

  it("does not cache an unexpected actual voice as the requested voice", async () => {
    const f = fixture();
    f.generate.mockResolvedValueOnce({ ...preferredAudio, voiceId: "unexpected-provider-voice" });
    const app = f.app();
    await request(app).get("/audio/welcome").expect(200);
    await request(app).get("/audio/welcome").expect(200);
    await request(app).get("/audio/welcome").expect(200);

    expect(f.generate).toHaveBeenCalledTimes(2);
    expect(f.cache.size).toBe(2);
  });

  it("releases failed in-flight work so Replay can generate successfully", async () => {
    const f = fixture();
    f.generate.mockRejectedValueOnce(new Error("Do not log provider request details"));
    const app = f.app();
    await request(app).get("/audio/welcome").expect(503);
    await request(app).get("/audio/welcome").expect(200);

    expect(f.generate).toHaveBeenCalledTimes(2);
    expect(f.cache.size).toBe(1);
    expect(JSON.stringify(f.warn.mock.calls)).not.toContain("Do not log provider request details");
  });

  it("requires authentication and only narrates registered scripts", async () => {
    const f = fixture();
    await request(f.app(false)).get("/audio/welcome").expect(401);
    await request(f.app()).get("/audio/arbitrary-text").expect(404);
    expect(f.generate).not.toHaveBeenCalled();
    expect(f.readCache).not.toHaveBeenCalled();
  });
});
