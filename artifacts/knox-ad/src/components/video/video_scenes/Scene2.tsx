import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { sceneTransitions } from '@/lib/video/animations';

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 1000), // KNOX
      setTimeout(() => setPhase(2), 1400), // FLOORING
      setTimeout(() => setPhase(3), 1800), // OPERATIONS
      setTimeout(() => setPhase(4), 3000), // Tagline
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center bg-[var(--color-bg-light)] overflow-hidden"
      {...sceneTransitions.wipe}
    >
      <motion.div 
        className="absolute inset-0 opacity-[0.4]"
        initial={{ scale: 1.1 }}
        animate={{ scale: 1 }}
        transition={{ duration: 10, ease: "easeOut" }}
      >
        <img 
          src={`${import.meta.env.BASE_URL}images/bright-showroom.png`} 
          alt="Showroom" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/80 to-transparent" />
      </motion.div>

      <div className="absolute right-0 top-0 h-full w-1/2 overflow-hidden pointer-events-none opacity-20 mix-blend-multiply">
        <motion.div 
           className="w-[150%] h-[150%] border-[2px] border-[var(--color-primary)] rounded-full absolute -top-1/4 -right-1/4"
           animate={{ rotate: 360, scale: [1, 1.05, 1] }}
           transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        />
        <motion.div 
           className="w-[120%] h-[120%] border-[1px] border-[var(--color-primary)] rounded-full absolute top-0 -right-1/4"
           animate={{ rotate: -360, scale: [1, 1.1, 1] }}
           transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        />
      </div>

      <div className="w-full flex flex-col items-start justify-center px-[10vw] z-10">
        <motion.p 
          className="text-[1.8vw] font-bold text-[var(--color-secondary)] tracking-[0.3em] uppercase mb-6 drop-shadow-sm"
          style={{ fontFamily: 'var(--font-body)' }}
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 0.8, x: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          Meet the new standard
        </motion.p>
        
        <div className="flex flex-col gap-2">
          <motion.h1 
            className="text-[9vw] font-black text-[var(--color-bg-dark)] uppercase leading-[0.85] tracking-tighter drop-shadow-md"
            style={{ fontFamily: 'var(--font-display)' }}
            initial={{ opacity: 0, y: 100, rotateX: 45 }}
            animate={phase >= 1 ? { opacity: 1, y: 0, rotateX: 0 } : { opacity: 0, y: 100, rotateX: 45 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            KNOX
          </motion.h1>
          <motion.h1 
            className="text-[9vw] font-black text-[var(--color-bg-dark)] uppercase leading-[0.85] tracking-tighter drop-shadow-md"
            style={{ fontFamily: 'var(--font-display)' }}
            initial={{ opacity: 0, y: 100, rotateX: 45 }}
            animate={phase >= 2 ? { opacity: 1, y: 0, rotateX: 0 } : { opacity: 0, y: 100, rotateX: 45 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            FLOORING
          </motion.h1>
          <motion.h1 
            className="text-[9vw] font-black text-transparent uppercase leading-[0.85] tracking-tighter"
            style={{ 
              fontFamily: 'var(--font-display)',
              WebkitTextStroke: '3px var(--color-primary)',
            }}
            initial={{ opacity: 0, y: 100, rotateX: 45 }}
            animate={phase >= 3 ? { opacity: 1, y: 0, rotateX: 0 } : { opacity: 0, y: 100, rotateX: 45 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            OPERATIONS
          </motion.h1>
        </div>

        <motion.div 
          className="mt-12 flex gap-6 items-center bg-white/70 p-6 rounded-2xl backdrop-blur-sm shadow-lg border border-white/50"
          initial={{ opacity: 0, filter: 'blur(10px)' }}
          animate={phase >= 4 ? { opacity: 1, filter: 'blur(0px)' } : { opacity: 0, filter: 'blur(10px)' }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="h-[3px] w-[6vw] bg-[var(--color-primary)]"></div>
          <p className="text-[2vw] font-bold text-[var(--color-secondary)] leading-tight max-w-2xl" style={{ fontFamily: 'var(--font-body)' }}>
            The all-in-one command center for flooring companies.
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}