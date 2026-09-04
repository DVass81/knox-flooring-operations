import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene6() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center text-center bg-[#0A0A0A]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1 }}
      transition={{ duration: 1.2, ease: "easeInOut" }}
    >
      <motion.div 
        className="w-[10vw] h-[10vw] mb-8 relative"
        initial={{ scale: 0.8, opacity: 0, rotateY: 90 }}
        animate={phase >= 1 ? { scale: 1, opacity: 1, rotateY: 0 } : { scale: 0.8, opacity: 0, rotateY: 90 }}
        transition={{ type: "spring", stiffness: 80, damping: 15 }}
      >
        {/* Abstract Logo */}
        <div className="absolute inset-0 border-4 border-[#D4AF37] transform rotate-45" />
        <div className="absolute inset-2 border-4 border-white/80" />
      </motion.div>

      <motion.h1 
        className="text-[4vw] font-black tracking-tight"
        initial={{ opacity: 0, y: 20 }}
        animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.8, delay: 0.3 }}
      >
        Knox Flooring
      </motion.h1>

      <motion.p 
        className="text-[1.5vw] text-[#D4AF37] tracking-[0.2em] uppercase mt-4 font-semibold"
        initial={{ opacity: 0 }}
        animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 1 }}
      >
        Operations + AI Estimator
      </motion.p>
      
      <motion.div 
        className="absolute bottom-[10vh] w-[1px] h-[10vh] bg-gradient-to-b from-[#D4AF37] to-transparent"
        style={{ transformOrigin: "top" }}
        initial={{ scaleY: 0 }}
        animate={phase >= 2 ? { scaleY: 1 } : { scaleY: 0 }}
        transition={{ duration: 1, ease: "circOut" }}
      />
    </motion.div>
  );
}
