import { describe, expect, it, vi } from "vitest";
import { generateTutorialNarration, getTutorialNarrationStatus } from "./tutorial-narration";

describe("tutorial narration", () => {
  it("uses ElevenLabs with the configured warm teaching profile", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.includes("/v2/voices")) {
        return new Response(JSON.stringify({ voices: [{ voice_id: "teacher-voice", name: "Liam - Energetic, Social Media Creator" }] }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "audio/mpeg" } });
    }) as typeof fetch;
    const env = { ELEVENLABS_API_KEY: "test-key", TUTORIAL_TTS_PROVIDER: "elevenlabs" } as NodeJS.ProcessEnv;

    const result = await generateTutorialNarration("Welcome to training.", { fetchImpl, env });

    expect(result.provider).toBe("ElevenLabs");
    expect(result.voice).toBe("Liam - Energetic, Social Media Creator");
    expect(calls[1].url).toContain("/v1/text-to-speech/teacher-voice");
    const body = JSON.parse(String(calls[1].init?.body));
    expect(body.model_id).toBe("eleven_multilingual_v2");
    expect(body.voice_settings).toMatchObject({ stability: 0.48, style: 0.32, speed: 0.96, use_speaker_boost: true });
  });

  it("uses a configured ElevenLabs voice ID without searching", async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => new Response(new Uint8Array([4, 5, 6]), { status: 200, headers: { "content-type": "audio/mpeg" } }));
    const fetchImpl = fetchMock as unknown as typeof fetch;
    const env = { ELEVENLABS_API_KEY: "test-key", ELEVENLABS_VOICE_ID: "custom-teacher", ELEVENLABS_VOICE_NAME: "Knox Guide" } as NodeJS.ProcessEnv;

    const result = await generateTutorialNarration("Let us begin.", { fetchImpl, env });

    expect(result.voice).toBe("Knox Guide");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/custom-teacher");
  });

  it("falls back to OpenAI when ElevenLabs is temporarily unavailable", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      if (String(input).includes("elevenlabs.io")) return new Response("unavailable", { status: 503 });
      return new Response(new Uint8Array([7, 8, 9]), { status: 200, headers: { "content-type": "audio/mpeg" } });
    }) as typeof fetch;
    const env = { ELEVENLABS_API_KEY: "test-key", OPENAI_API_KEY: "fallback-key" } as NodeJS.ProcessEnv;

    const result = await generateTutorialNarration("Continue with the lesson.", { fetchImpl, env, waitImpl: async () => undefined });

    expect(result.provider).toBe("OpenAI");
    expect(result.fallbackStatus).toBe(503);
    expect(result.fallbackReason).toContain("temporarily unavailable");
    expect(getTutorialNarrationStatus(env).provider).toBe("ElevenLabs");
  });

  it("recovers a temporary concurrency error without changing the narrator", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: { status: "too_many_concurrent_requests" } }), { status: 429, headers: { "retry-after": "2" } }))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
    const waitImpl = vi.fn(async () => undefined);
    const result = await generateTutorialNarration("One teaching step", {
      fetchImpl: fetchMock as typeof fetch, waitImpl,
      env: { ELEVENLABS_API_KEY: "test", ELEVENLABS_VOICE_ID: "selected-voice", OPENAI_API_KEY: "backup" },
    });
    expect(result.provider).toBe("ElevenLabs");
    expect(result.voiceId).toBe("selected-voice");
    expect(result.fallbackReason).toBeUndefined();
    expect(waitImpl).toHaveBeenCalledWith(2000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.every(([url]) => String(url).includes("/selected-voice"))).toBe(true);
  });

  it("does not repeatedly call a plan-blocked voice or expose provider response text", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => String(input).includes("elevenlabs.io")
      ? new Response(JSON.stringify({ detail: { status: "payment_required", message: "private-provider-details" } }), { status: 402 })
      : new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
    const waitImpl = vi.fn(async () => undefined);
    const result = await generateTutorialNarration("One teaching step", {
      fetchImpl: fetchMock as typeof fetch, waitImpl,
      env: { ELEVENLABS_API_KEY: "test", ELEVENLABS_VOICE_ID: "selected-voice", OPENAI_API_KEY: "backup" },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(waitImpl).not.toHaveBeenCalled();
    expect(result).toMatchObject({ provider: "OpenAI", fallbackStatus: 402, fallbackCode: "payment_required" });
    expect(result.fallbackReason).toContain("plan or credits");
    expect(JSON.stringify(result)).not.toContain("private-provider-details");
  });

  it("serializes distinct requests and releases the slot after failure", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let calls = 0;
    const fetchMock = vi.fn(async () => {
      calls++;
      if (calls === 1) { await gate; return new Response("denied", { status: 401 }); }
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    });
    const options = { fetchImpl: fetchMock as typeof fetch, env: { ELEVENLABS_API_KEY: "test", ELEVENLABS_VOICE_ID: "selected-voice" } };
    const first = generateTutorialNarration("First step", options);
    const firstFailure = expect(first).rejects.toThrow("401");
    await vi.waitFor(() => expect(calls).toBe(1));
    const second = generateTutorialNarration("Next step", options);
    await Promise.resolve();
    expect(calls).toBe(1);
    release();
    await firstFailure;
    expect((await second).provider).toBe("ElevenLabs");
    expect(calls).toBe(2);
  });
});
