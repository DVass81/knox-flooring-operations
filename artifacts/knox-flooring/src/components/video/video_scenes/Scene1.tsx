import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 2000),
      setTimeout(() => setPhase(3), 4000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(20px)', scale: 1.1 }}
      transition={{ duration: 1 }}
    >
      <div className="absolute inset-0 z-0">
        <video 
          className="w-full h-full object-cover opacity-60"
          src={`${import.meta.env.BASE_URL}videos/hero-flooring.mp4`}
          autoPlay 
          muted 
          playsInline
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
      </div>

      <div className="relative z-10 text-center flex flex-col items-center">
        <motion.div 
          className="overflow-hidden mb-6"
        >
          <motion.h1 
            className="text-[6vw] font-bold tracking-tight text-white leading-none uppercase"
            initial={{ y: "100%" }}
            animate={phase >= 1 ? { y: 0 } : { y: "100%" }}
            transition={{ type: "spring", stiffness: 100, damping: 20 }}
          >
            Total Visibility
          </motion.h1>
        </motion.div>

        <motion.div 
          className="h-[2px] bg-[#D4AF37] w-0"
          animate={phase >= 2 ? { width: "20vw" } : { width: 0 }}
          transition={{ duration: 0.8, ease: "circOut" }}
        />
      </div>
    </motion.div>
  );
}