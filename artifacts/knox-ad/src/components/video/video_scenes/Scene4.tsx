import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { sceneTransitions } from '@/lib/video/animations';

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 1200),
      setTimeout(() => setPhase(2), 2500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 bg-[var(--color-bg-light)] flex items-center justify-center overflow-hidden"
      {...sceneTransitions.clipCircle}
    >
      <motion.div 
        className="absolute inset-0 opacity-[0.9]"
        initial={{ scale: 1.15, filter: 'blur(5px)' }}
        animate={{ scale: 1, filter: 'blur(0px)' }}
        transition={{ duration: 6, ease: "easeOut" }}
      >
        <img 
          src={`${import.meta.env.BASE_URL}images/bright-craftsman.png`} 
          alt="Craftsman" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-white/90 via-white/20 to-white/40" />
      </motion.div>

      <div className="relative z-10 text-center px-12 flex flex-col items-center bg-white/60 p-16 rounded-3xl backdrop-blur-md shadow-2xl border border-white/50">
        <div className="overflow-hidden mb-2">
          <motion.h1 
            className="text-[5vw] font-bold text-[var(--color-secondary)] uppercase tracking-[0.2em] leading-none"
            style={{ fontFamily: 'var(--font-display)' }}
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          >
            BUILT FOR
          </motion.h1>
        </div>
        
        <div className="overflow-hidden py-4">
          <motion.div
            initial={{ opacity: 0, y: 100, rotateX: -45 }}
            animate={phase >= 1 ? { opacity: 1, y: 0, rotateX: 0 } : { opacity: 0, y: 100, rotateX: -45 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          >
            <h1 
              className="text-[11vw] font-black text-[var(--color-bg-dark)] uppercase tracking-tighter leading-none"
              style={{ fontFamily: 'var(--font-display)', textShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
            >
              CRAFTSMEN
            </h1>
          </motion.div>
        </div>

        <motion.div
          className="mt-8 h-[2px] bg-[var(--color-primary)]"
          initial={{ width: 0 }}
          animate={phase >= 2 ? { width: '20vw' } : { width: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </motion.div>
  );
}