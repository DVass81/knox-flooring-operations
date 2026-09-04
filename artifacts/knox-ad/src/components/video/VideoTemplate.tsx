import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';

export const SCENE_DURATIONS = {
  problem: 6000,
  solution: 7000,
  features: 10000,
  craftsman: 6000,
  outro: 7000,
};

const SCENE_COMPONENTS: Record<string, React.ComponentType> = {
  problem: Scene1,
  solution: Scene2,
  features: Scene3,
  craftsman: Scene4,
  outro: Scene5,
};

const SCENE_START_SEC: Record<string, number> = (() => {
  const out: Record<string, number> = {};
  let cumulativeMs = 0;
  for (const [key, ms] of Object.entries(SCENE_DURATIONS)) {
    out[key] = cumulativeMs / 1000;
    cumulativeMs += ms;
  }
  return out;
})();

const AUDIO_SEEK_EPSILON_SEC = 0.18;

export default function VideoTemplate({
  durations = SCENE_DURATIONS,
  loop = true,
  muted = false,
  onSceneChange,
}: {
  durations?: Record<string, number>;
  loop?: boolean;
  muted?: boolean;
  onSceneChange?: (sceneKey: string) => void;
} = {}) {
  const { currentSceneKey } = useVideoPlayer({ durations, loop });

  useEffect(() => {
    onSceneChange?.(currentSceneKey);
  }, [currentSceneKey, onSceneChange]);

  const baseSceneKey = currentSceneKey.replace(/_r[12]$/, '') as keyof typeof SCENE_DURATIONS;
  const sceneIndex = Object.keys(SCENE_DURATIONS).indexOf(baseSceneKey);
  const SceneComponent = SCENE_COMPONENTS[baseSceneKey];

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.45;
    const targetTime = SCENE_START_SEC[baseSceneKey] ?? 0;
    if (Math.abs(audio.currentTime - targetTime) > AUDIO_SEEK_EPSILON_SEC) {
      audio.currentTime = targetTime;
    }
    audio.play().catch(() => {});
  }, [currentSceneKey, baseSceneKey, muted]);

  return (
    <div className="w-full h-screen overflow-hidden relative bg-[var(--color-bg-light)]">
      {/* Persistent background layers */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute w-[80vw] h-[80vw] rounded-full blur-[100px] opacity-20"
          style={{ background: 'radial-gradient(circle, var(--color-primary), transparent)' }}
          animate={{
            x: sceneIndex % 2 === 0 ? '-20%' : '50%',
            y: sceneIndex % 2 === 0 ? '10%' : '-30%',
            scale: [1, 1.2, 0.9],
          }}
          transition={{ duration: 10, ease: 'easeInOut' }}
        />
      </div>

      <AnimatePresence mode="popLayout">
        {SceneComponent && <SceneComponent key={currentSceneKey} />}
      </AnimatePresence>

      <audio
        ref={audioRef}
        src={`${import.meta.env.BASE_URL}audio/composite_audio.mp3`}
        preload="auto"
        autoPlay
        muted={muted}
      />
    </div>
  );
}
