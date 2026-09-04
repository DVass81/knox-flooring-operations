import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { sceneTransitions } from '@/lib/video/animations';

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 1200),
      setTimeout(() => setPhase(2), 2400),
      setTimeout(() => setPhase(3), 3600),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 bg-[var(--color-bg-light)] flex flex-col items-center justify-center gap-12 overflow-hidden"
      {...sceneTransitions.scaleFade}
    >
      <motion.div 
        className="absolute inset-0 opacity-[0.8]"
      >
        <img 
          src={`${import.meta.env.BASE_URL}images/bright-showroom.png`} 
          alt="Showroom" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/95 via-white/80 to-white/95" />
      </motion.div>

      <motion.div 
        className="w-[18vw] h-[18vw] border-[0.8vw] border-[var(--color-primary)] flex items-center justify-center relative z-10 bg-white/50 backdrop-blur-md shadow-2xl"
        initial={{ rotate: -90, scale: 0, opacity: 0, borderRadius: '50%' }}
        animate={{ rotate: 0, scale: 1, opacity: 1, borderRadius: '0%' }}
        transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <motion.div 
          className="absolute inset-0 bg-[var(--color-primary)]"
          initial={{ scaleY: 0, originY: 1 }}
          animate={phase >= 3 ? { scaleY: 1 } : { scaleY: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        />
        <h1 
          className="text-[10vw] font-black leading-none z-10" 
          style={{ 
            fontFamily: 'var(--font-display)',
            color: phase >= 3 ? 'var(--color-bg-dark)' : 'var(--color-bg-dark)',
            transition: 'color 0.4s ease'
          }}
        >
          K
        </h1>
      </motion.div>

      <div className="text-center relative z-10 bg-white/70 p-12 rounded-3xl backdrop-blur-md shadow-xl border border-white/60">
        <div className="overflow-hidden">
          <motion.h2 
            className="text-[4.5vw] font-bold text-[var(--color-bg-dark)] uppercase tracking-widest leading-none pb-2 drop-shadow-sm"
            style={{ fontFamily: 'var(--font-display)' }}
            initial={{ opacity: 0, y: 60 }}
            animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 60 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          >
            Knox Flooring
          </motion.h2>
        </div>
        
        <div className="overflow-hidden">
          <motion.h2 
            className="text-[3vw] font-medium text-[var(--color-text-secondary)] uppercase tracking-[0.4em] leading-none mt-2"
            style={{ fontFamily: 'var(--font-display)' }}
            initial={{ opacity: 0, y: -40 }}
            animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: -40 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          >
            Operations
          </motion.h2>
        </div>

        <motion.div 
          className="mt-12"
          initial={{ opacity: 0, filter: 'blur(10px)' }}
          animate={phase >= 3 ? { opacity: 1, filter: 'blur(0px)' } : { opacity: 0, filter: 'blur(10px)' }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <p 
            className="text-[1.8vw] text-[var(--color-primary)] font-semibold tracking-widest uppercase"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            knoxflooring.com
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}