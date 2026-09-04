import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 2000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-end pr-20 text-right"
      initial={{ opacity: 0, x: -50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, filter: "blur(10px)", scale: 1.05 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      <div className="w-[50vw] relative z-10">
        <motion.div
          className="px-4 py-1 border border-green-500/50 rounded-full text-green-400 text-sm tracking-widest uppercase font-semibold mb-6 inline-block"
          initial={{ opacity: 0, x: 20 }}
          animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }}
          transition={{ duration: 0.5 }}
        >
          Financial Suite & Portal
        </motion.div>

        <motion.h2 
          className="text-[4vw] font-bold leading-tight mb-8"
          initial={{ opacity: 0, y: 30 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          Track <span className="text-[#D4AF37]">Every Cent</span> <br/>
          <span className="text-white/60">Delight Every Client</span>
        </motion.h2>

        <div className="flex flex-col items-end gap-6">
          {["Live Job Costing", "Sales Commissions", "Private Customer Portal"].map((item, i) => (
            <motion.div 
              key={i}
              className="flex items-center justify-end gap-4"
              initial={{ opacity: 0, x: 30 }}
              animate={phase >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: 30 }}
              transition={{ duration: 0.6, delay: i * 0.2 }}
            >
              <p className="text-[1.8vw] text-white/80">{item}</p>
              <div className="w-2 h-2 rounded-full bg-green-500" />
            </motion.div>
          ))}
        </div>
      </div>

      {/* Background Graphic */}
      <motion.div 
        className="absolute left-[10vw] top-[20vh] w-[30vw] h-[30vw] rounded-full border-[1px] border-green-500/20 z-0"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={phase >= 3 ? { scale: [1, 1.1, 1], opacity: 0.3 } : { scale: 0.8, opacity: 0 }}
        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
      >
        <motion.div 
          className="absolute inset-4 rounded-full border-[1px] border-blue-500/20"
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        />
        <motion.div 
          className="absolute inset-12 rounded-full border-[1px] border-[#D4AF37]/20"
          animate={{ rotate: -360 }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        />
      </motion.div>

    </motion.div>
  );
}