import React from "react";
import { motion } from "framer-motion";

export type LogoVariant = "horizontal" | "icon" | "stacked";

interface LogoProps {
  variant?: LogoVariant;
  className?: string;
  size?: number;
}

export const Logo = React.memo(({ variant = "horizontal", className = "", size = 200 }: LogoProps) => {
  // CSS variables for the exact approved hex codes
  const colors = {
    baseDark: "var(--color-brand-900)",
    primaryAccent: "var(--color-brand-700)",
    midAccent: "var(--color-brand-500)",
    secondaryText: "var(--color-brand-300)",
    highContrast: "var(--color-brand-100)"
  };

  const IconMark = () => (
    <motion.svg viewBox="0 0 48 48" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ willChange: "transform" }}>
      <defs>
        <linearGradient id="waveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={colors.primaryAccent} />
          <stop offset="100%" stopColor={colors.midAccent} />
        </linearGradient>
        
        {/* Glow effect for the laser dot */}
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Center Laser Dot */}
      <motion.circle 
        cx="24" cy="24" r="5.5" 
        fill={colors.highContrast} 
        filter="url(#glow)" 
        animate={{ scale: [1, 1.4, 1], opacity: [0.8, 1, 0.8] }}
        transition={{ duration: 2, repeat: Infinity, repeatType: "loop", ease: "easeInOut" }}
        style={{ transformOrigin: "24px 24px" }}
      />
      
      {/* Expanding Wave Sphere - Ring 1 */}
      <motion.circle 
        className="wave-ring-1"
        cx="24" cy="24" r="13" 
        fill="none" 
        stroke="url(#waveGrad)" 
        strokeWidth="3.5" 
        strokeLinecap="round" 
        strokeDasharray="12 24" 
        animate={{ rotate: 360 }}
        transition={{ duration: 10, repeat: Infinity, repeatType: "loop", ease: "linear" }}
        style={{ transformOrigin: "24px 24px" }}
      />
      
      {/* Expanding Wave Sphere - Ring 2 */}
      <motion.circle 
        className="wave-ring-2"
        cx="24" cy="24" r="22" 
        fill="none" 
        stroke="url(#waveGrad)" 
        strokeWidth="4.5" 
        strokeLinecap="round" 
        strokeDasharray="24 38" 
        strokeDashoffset="18" 
        animate={{ rotate: -360 }}
        transition={{ duration: 12, repeat: Infinity, repeatType: "loop", ease: "linear" }}
        style={{ transformOrigin: "24px 24px" }}
      />
    </motion.svg>
  );

  const AnimatedCoreText = ({ baseColor, spacing, fontSize, alignClass }: { baseColor: string; spacing: string; fontSize: number; alignClass: string }) => {
    const letters = ["C", "O", "R", "E"];
    return (
      <div className={`flex select-none leading-none ${alignClass}`} style={{ fontSize, fontFamily: 'TheYearofHandicrafts, system-ui, sans-serif' }}>
        {letters.map((char, i) => (
          <motion.span
            key={i}
            className="inline-block font-black italic"
            animate={{ 
              scale: [1, 1.35, 1], 
              color: [baseColor, "#FFFFFF", baseColor],
              textShadow: [
                "0 0 0px rgba(91,163,198,0)",
                "0 0 16px rgba(91,163,198,0.85)",
                "0 0 0px rgba(91,163,198,0)"
              ]
            }}
            transition={{ 
              duration: 3.6, 
              repeat: Infinity, 
              repeatType: "loop" as const,
              delay: i * 0.45,
              ease: "easeInOut"
            }}
            style={{ 
              transformOrigin: "center",
              marginRight: i < 3 ? spacing : "0",
              display: "inline-block",
              willChange: "transform",
              backfaceVisibility: "hidden",
              WebkitFontSmoothing: "antialiased"
            }}
          >
            {char}
          </motion.span>
        ))}
      </div>
    );
  };

  if (variant === "icon") {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ width: size, height: size, willChange: "transform" }}>
        <IconMark />
      </div>
    );
  }

  if (variant === "stacked") {
    return (
      <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
        <div style={{ width: size * 0.4, height: size * 0.4, willChange: "transform" }}>
          <IconMark />
        </div>
        <div className="flex flex-col items-center">
          <div className="flex items-baseline" style={{ color: colors.highContrast, fontSize: size * 0.18, fontFamily: 'TheYearofHandicrafts, system-ui, sans-serif' }}>
            <span className="font-black">Stream</span>
            <span className="font-light opacity-90">Audio</span>
          </div>
          <AnimatedCoreText 
            baseColor={colors.secondaryText} 
            spacing="0.35em" 
            fontSize={size * 0.09} 
            alignClass="justify-center mt-1 ml-1" 
          />
        </div>
      </div>
    );
  }

  // Horizontal (Variant A)
  return (
    <div className={`flex items-center gap-4 ${className}`} dir="ltr">
      <div style={{ width: size * 0.25, height: size * 0.25, willChange: "transform" }}>
        <IconMark />
      </div>
      <div className="flex flex-col text-left justify-center">
        <div className="flex items-baseline leading-none" style={{ color: colors.highContrast, fontSize: size * 0.16, fontFamily: 'TheYearofHandicrafts, system-ui, sans-serif' }}>
          <span className="font-black tracking-tight">Stream</span>
          <span className="font-light tracking-wide opacity-90">Audio</span>
        </div>
        <AnimatedCoreText 
          baseColor={colors.midAccent} 
          spacing="0.4em" 
          fontSize={size * 0.08} 
          alignClass="justify-start mt-1.5 ml-0.5" 
        />
      </div>
    </div>
  );
});

Logo.displayName = "Logo";
