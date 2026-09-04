import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';
import { Scene6 } from './video_scenes/Scene6';

const SCENE_DURATIONS = {
  open: 5500,
  tagline: 6000,
  estimator: 8000,
  operations: 8000,
  financials: 8000,
  outro: 6000
};

export default function VideoTemplate() {
  const { currentScene } = useVideoPlayer({ durations: SCENE_DURATIONS });

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#0A0A0A] font-sans text-white">
      {/* Persistent Background layer */}
      <div className="absolute inset-0 z-0">
        <motion.div 
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/wood-texture.jpg)` }}
          animate={{ scale: [1, 1.1, 1], rotate: [0, 1, 0] }}
          transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
        />
        
        {/* Dynamic gradient overlay that changes with scenes */}
        <motion.div 
          className="absolute inset-0"
          animate={{
            background: [
              'radial-gradient(circle at 50% 50%, rgba(200, 160, 100, 0.1) 0%, rgba(10, 10, 10, 0.9) 100%)',
              'radial-gradient(circle at 70% 30%, rgba(50, 100, 200, 0.15) 0%, rgba(10, 10, 10, 0.9) 100%)',
              'radial-gradient(circle at 30% 70%, rgba(200, 80, 50, 0.15) 0%, rgba(10, 10, 10, 0.95) 100%)',
              'radial-gradient(circle at 50% 50%, rgba(100, 200, 150, 0.1) 0%, rgba(10, 10, 10, 0.95) 100%)',
              'radial-gradient(circle at 80% 80%, rgba(200, 160, 100, 0.15) 0%, rgba(10, 10, 10, 0.95) 100%)',
              'radial-gradient(circle at 50% 50%, rgba(150, 120, 80, 0.2) 0%, rgba(10, 10, 10, 1) 100%)'
            ][currentScene]
          }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
        />
      </div>

      <AnimatePresence mode="sync">
        {currentScene === 0 && <Scene1 key="open" />}
        {currentScene === 1 && <Scene2 key="tagline" />}
        {currentScene === 2 && <Scene3 key="estimator" />}
        {currentScene === 3 && <Scene4 key="operations" />}
        {currentScene === 4 && <Scene5 key="financials" />}
        {currentScene === 5 && <Scene6 key="outro" />}
      </AnimatePresence>
    </div>
  );
}