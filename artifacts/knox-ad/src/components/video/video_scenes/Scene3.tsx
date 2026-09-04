import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { sceneTransitions } from '@/lib/video/animations';

export function Scene3() {
  const [phase, setPhase] = useState(0);

  const features = [
    { title: "AI Estimator", desc: "Instant, accurate quotes." },
    { title: "Lead CRM", desc: "Never drop a prospect." },
    { title: "Smart Scheduling", desc: "Crews aligned, always." },
    { title: "Financial Suite", desc: "Every dollar tracked." }
  ];

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 800),
      setTimeout(() => setPhase(2), 2200),
      setTimeout(() => setPhase(3), 3600),
      setTimeout(() => setPhase(4), 5000),
      setTimeout(() => setPhase(5), 7500), // Summary fade in
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 bg-[var(--color-bg-light)] overflow-hidden"
      {...sceneTransitions.morphExpand}
    >
      <motion.div 
        className="absolute inset-0 opacity-[0.9]"
        initial={{ scale: 1.1, x: '5%' }}
        animate={{ scale: 1, x: '0%' }}
        transition={{ duration: 12, ease: "easeOut" }}
      >
        <img 
          src={`${import.meta.env.BASE_URL}images/bright-hardwood.png`} 
          alt="Luxury floor" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-white/90 via-white/60 to-transparent" />
      </motion.div>

      <div className="absolute left-[8vw] top-[15vh] bottom-[15vh] flex flex-col justify-center gap-10 z-10 w-[45vw] bg-white/40 p-12 rounded-3xl backdrop-blur-md shadow-2xl border border-white/50">
        {features.map((feature, idx) => (
          <motion.div 
            key={idx}
            className="flex flex-col gap-1"
            initial={{ opacity: 0, x: -60, filter: 'blur(10px)' }}
            animate={phase >= idx + 1 ? { opacity: 1, x: 0, filter: 'blur(0px)' } : { opacity: 0, x: -60, filter: 'blur(10px)' }}
            transition={{ type: "spring", stiffness: 200, damping: 25 }}
          >
            <div className="flex items-center gap-4">
              <motion.div 
                className="w-[3vw] h-[4px] bg-[var(--color-primary)]"
                initial={{ scaleX: 0, originX: 0 }}
                animate={phase >= idx + 1 ? { scaleX: 1 } : { scaleX: 0 }}
                transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              />
              <h2 
                className="text-[3.5vw] font-bold text-[var(--color-bg-dark)] uppercase tracking-wide leading-none"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {feature.title}
              </h2>
            </div>
            <motion.p
              className="text-[1.5vw] text-[var(--color-secondary)] pl-[calc(3vw+1rem)] font-medium"
              initial={{ opacity: 0 }}
              animate={phase >= idx + 1 ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              {feature.desc}
            </motion.p>
          </motion.div>
        ))}
      </div>

      <motion.div 
        className="absolute right-[8vw] bottom-[15vh] w-[35vw] bg-white/70 p-8 rounded-2xl backdrop-blur-sm shadow-xl"
        initial={{ opacity: 0, y: 40 }}
        animate={phase >= 5 ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      >
        <h3 className="text-[4vw] font-black text-[var(--color-primary)] uppercase leading-[1.1] tracking-tight drop-shadow-md" style={{ fontFamily: 'var(--font-display)' }}>
          Total<br/>Visibility.
        </h3>
        <p className="text-[1.6vw] text-[var(--color-bg-dark)] mt-4 leading-relaxed font-semibold" style={{ fontFamily: 'var(--font-body)' }}>
          Every lead, quote, job, crew, and dollar in one place.
        </p>
      </motion.div>
    </motion.div>
  );
}