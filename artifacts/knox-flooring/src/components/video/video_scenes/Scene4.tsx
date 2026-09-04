import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene4() {
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
      className="absolute inset-0 flex flex-col items-center justify-center text-center"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, y: 50 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      <motion.div
        className="px-4 py-1 border border-blue-500/50 rounded-full text-blue-400 text-sm tracking-widest uppercase font-semibold mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: -20 }}
      >
        Operations Engine
      </motion.div>

      <motion.h2 
        className="text-[4.5vw] font-bold leading-tight mb-12"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={phase >= 1 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        From Lead <br/>
        <span className="text-white/50">To Completion</span>
      </motion.h2>

      <div className="flex gap-12 mt-4 relative z-10">
        {[
          { title: "CRM Pipeline", sub: "Track Prospects" },
          { title: "Scheduling", sub: "Google Cal Sync" },
          { title: "Crew App", sub: "Job Assignments" }
        ].map((item, i) => (
          <motion.div 
            key={i}
            className="flex flex-col items-center bg-white/5 border border-white/10 p-8 rounded-2xl backdrop-blur-sm w-[20vw]"
            initial={{ opacity: 0, y: 40 }}
            animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
            transition={{ type: "spring", stiffness: 100, damping: 15, delay: i * 0.15 }}
          >
            <h3 className="text-[1.8vw] font-bold mb-2 text-white/90">{item.title}</h3>
            <p className="text-[1vw] text-white/50">{item.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Abstract lines connecting them */}
      {phase >= 3 && (
        <svg className="absolute w-[60vw] h-[20vh] top-[50%] left-1/2 -translate-x-1/2 z-0" viewBox="0 0 100 100" preserveAspectRatio="none">
           <motion.path 
             d="M 15 50 Q 50 100 85 50" 
             fill="none" 
             stroke="rgba(59, 130, 246, 0.3)" 
             strokeWidth="0.5"
             initial={{ pathLength: 0 }}
             animate={{ pathLength: 1 }}
             transition={{ duration: 1.5, ease: "easeInOut" }}
           />
        </svg>
      )}
    </motion.div>
  );
}