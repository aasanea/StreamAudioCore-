import { motion } from "framer-motion";

export const AnimatedWaveBg = () => {
  const midAccent = "var(--color-brand-500)";
  const primaryAccent = "var(--color-brand-700)";

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center opacity-[0.06]">
      <motion.svg 
        viewBox="0 0 48 48" 
        style={{ width: "120%", height: "120%", minWidth: "800px", minHeight: "800px", willChange: "transform" }} 
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="waveBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={primaryAccent} />
            <stop offset="100%" stopColor={midAccent} />
          </linearGradient>
        </defs>

        <motion.circle 
          cx="24" cy="24" r="13" 
          fill="none" 
          stroke="url(#waveBgGrad)" 
          strokeWidth="2.5" 
          strokeLinecap="round" 
          strokeDasharray="12 24" 
          animate={{ rotate: 360 }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "24px 24px", willChange: "transform" }}
        />
        
        <motion.circle 
          cx="24" cy="24" r="22" 
          fill="none" 
          stroke="url(#waveBgGrad)" 
          strokeWidth="3.5" 
          strokeLinecap="round" 
          strokeDasharray="24 38" 
          strokeDashoffset="18" 
          animate={{ rotate: -360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "24px 24px", willChange: "transform" }}
        />
      </motion.svg>
    </div>
  );
};

