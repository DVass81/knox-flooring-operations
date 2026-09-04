import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { sceneTransitions } from '@/lib/video/animations';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 1000), // "SPREADSHEETS" highlights
      setTimeout(() => setPhase(2), 2500), // Transition out text
      setTimeout(() => setPhase(3), 3200), // New text in
      setTimeout(() => setPhase(4), 5000), // Prepare for next scene
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center bg-[var(--color-bg-light)]"
      {...sceneTransitions.clipPolygon}
    >
      <motion.div 
        className="absolute inset-0 opacity-80"
        initial={{ scale: 1.15, y: '5%' }}
        animate={{ scale: 1, y: '0%' }}
        transition={{ duration: 7, ease: "easeOut" }}
      >
        <img 
          src={`${import.meta.env.BASE_URL}images/messy-desk-bright.png`} 
          alt="Messy desk" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-white/80 via-white/20 to-transparent" />
      </motion.div>
      
      <div className="relative z-10 text-center flex flex-col items-center justify-center w-full h-full px-12">
        <div className="overflow-hidden">
          <motion.h1 
            className="text-[6vw] font-bold text-[var(--color-bg-dark)] uppercase leading-none tracking-tight drop-shadow-md"
            style={{ fontFamily: 'var(--font-display)' }}
            initial={{ opacity: 0, y: 100 }}
            animate={phase < 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: -100 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            Drowning in
          </motion.h1>
        </div>
        
        <div className="overflow-hidden mt-4">
          <motion.div 
            initial={{ opacity: 0, y: 100 }}
            animate={phase < 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: -100 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          >
            <h2 
              className="text-[6.5vw] font-black uppercase leading-none"
              style={{ 
                fontFamily: 'var(--font-display)',
                color: 'var(--color-primary)',
                WebkitTextStroke: '1px rgba(0,0,0,0.35)',
                textShadow: '0 3px 14px rgba(0,0,0,0.35)',
                filter: phase >= 1 ? 'brightness(1.08)' : 'brightness(0.96)',
                transition: 'filter 0.4s ease'
              }}
            >
              Spreadsheets?
            </h2>
          </motion.div>
        </div>

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <motion.h2
            className="text-[5vw] font-medium text-[var(--color-bg-dark)] uppercase tracking-[0.2em] drop-shadow-md bg-white/60 px-8 py-4 rounded-xl backdrop-blur-sm"
            style={{ fontFamily: 'var(--font-display)' }}
            initial={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
            animate={phase >= 3 && phase < 4 ? { opacity: 1, scale: 1, filter: 'blur(0px)' } : { opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          >
            The chaos stops here.
          </motion.h2>
        </div>
      </div>
    </motion.div>
  );
}