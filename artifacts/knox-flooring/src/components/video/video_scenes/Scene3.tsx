import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 2000),
      setTimeout(() => setPhase(4), 2800),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center"
      initial={{ scale: 1.1, opacity: 0, filter: "blur(20px)" }}
      animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, y: -50 }}
      transition={{ duration: 1, ease: "easeOut" }}
    >
      <div className="w-[45vw] pl-20 relative z-10">
        <motion.div
          className="px-4 py-1 border border-[#D4AF37]/50 rounded-full text-[#D4AF37] text-sm tracking-widest uppercase font-semibold mb-6 inline-block"
          initial={{ opacity: 0, x: -20 }}
          animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
          transition={{ duration: 0.5 }}
        >
          AI Estimator
        </motion.div>

        <motion.h2 
          className="text-[4vw] font-bold leading-tight mb-8"
          initial={{ opacity: 0, y: 30 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          Precision <br/>
          <span className="text-white/60">Calculated</span>
        </motion.h2>

        <div className="flex flex-col gap-6">
          {["Material Quantities", "Waste Factors", "Labor Rates"].map((item, i) => (
            <motion.div 
              key={i}
              className="flex items-center gap-4"
              initial={{ opacity: 0, x: -30 }}
              animate={phase >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 }}
              transition={{ duration: 0.6, delay: i * 0.2 }}
            >
              <div className="w-2 h-2 rounded-full bg-[#D4AF37]" />
              <p className="text-[1.8vw] text-white/80">{item}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Abstract UI UI Elements right side */}
      <div className="absolute right-[5vw] top-[20vh] w-[45vw] h-[60vh] z-0">
        {phase >= 2 && (
          <motion.div 
            className="absolute inset-0 bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-md overflow-hidden"
            initial={{ opacity: 0, rotateY: 20, z: -100 }}
            animate={{ opacity: 1, rotateY: 0, z: 0 }}
            transition={{ type: "spring", stiffness: 100, damping: 20 }}
            style={{ perspective: 1000 }}
          >
            <motion.div 
              className="w-full h-12 bg-white/10 rounded-lg mb-6"
              initial={{ width: 0 }}
              animate={phase >= 3 ? { width: "100%" } : { width: 0 }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <motion.div 
                  key={i}
                  className="w-full h-8 bg-white/5 rounded"
                  initial={{ opacity: 0, x: 20 }}
                  animate={phase >= 4 ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }}
                  transition={{ delay: i * 0.1 }}
                />
              ))}
            </div>
            
            <motion.div 
              className="absolute bottom-8 right-8 w-32 h-32 rounded-full border-4 border-[#D4AF37]/30 border-t-[#D4AF37]"
              animate={{ rotate: 360 }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            />
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}