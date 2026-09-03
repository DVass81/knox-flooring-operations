---
name: Knox ad narration/audio pipeline
description: How narration and music for the knox-ad video artifact are generated and mixed, and constraints on VO timing.
---

- Playback/export uses ONE pre-mixed file: `artifacts/knox-ad/public/audio/composite_audio.mp3` (referenced in VideoTemplate.tsx). Per-scene VO stems (`vo_*.mp3`) and `bg_music.mp3` are kept as sources for remixing.
- Scene timing: SCENE_DURATIONS = problem 6s, solution 7s, features 10s, craftsman 6s, outro 7s (36s total). VO scene-start offsets in the ffmpeg mix: 0 / 6000 / 13000 / 23000 / 29000 ms, plus a small per-line delay (~150-400ms).
- **Why:** each ElevenLabs clip must fit its scene with ~400ms tail buffer or it bleeds into the next scene — always ffprobe each clip after generation and shorten the script line if it overruns (this recurred on nearly every regeneration).
- **How to apply:** regenerate lines → ffprobe → remix with `amix ... normalize=0`, `adelay=N|N`, clamp `-t 36`. Music duck level: user found 0.26 "overbearing"; 0.15 is the accepted level with the epic trailer bed.
- Voice history: user rejected Wesley (VkL7...) and Blaze (S9UF...); accepted direction is "energetic hype announcer like the Aethon video" (an app from another project — not inspectable) → currently Adam `pNInz6obpgDQGcFmaJgB`, style ~0.55, stability ~0.35.
- Batch TTS calls can 500; retry sequentially with backoff.
- Audio-only changes need no workflow restart; but production requires republish after audio swaps (user has published).
