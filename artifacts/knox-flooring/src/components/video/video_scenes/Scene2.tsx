import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 2500),
      setTimeout(() => setPhase(4), 4500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const words = ["Every Lead.", "Every Quote.", "Every Job.", "Every Dollar."];

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center pl-20"
      initial={{ x: "10vw", opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: "-10vw", opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="absolute right-0 top-0 bottom-0 w-[50vw] z-0 overflow-hidden">
        <motion.img 
          src={`${import.meta.env.BASE_URL}images/abstract-dashboard.png`}
          className="w-full h-full object-cover opacity-40 mix-blend-screen"
          initial={{ scale: 1.2, x: 50 }}
          animate={{ scale: 1, x: 0 }}
          transition={{ duration: 6, ease: "easeOut" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0A] to-transparent" />
      </div>

      <div className="relative z-10 w-full max-w-5xl flex flex-col gap-4">
        {words.map((word, i) => (
          <motion.div key={i} className="overflow-hidden">
            <motion.h2 
              className="text-[5vw] font-bold text-[#D4AF37] leading-[1.1] tracking-tight"
              initial={{ y: "100%", opacity: 0, rotateX: -30 }}
              animate={phase >= 1 ? { y: 0, opacity: 1, rotateX: 0 } : { y: "100%", opacity: 0, rotateX: -30 }}
              transition={{ 
                type: "spring", stiffness: 150, damping: 20, 
                delay: i * 0.3 + 0.2
              }}
            >
              {word}
            </motion.h2>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}