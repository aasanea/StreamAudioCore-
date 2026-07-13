import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

interface GlassPanelProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
  intensity?: 'low' | 'medium' | 'high';
}

export function GlassPanel({ children, className = '', intensity = 'medium', ...props }: GlassPanelProps) {
  const intensityClasses = {
    low: 'bg-gradient-to-br from-[#1a1a2e]/60 to-[#121223]/70 backdrop-blur-xl border border-white/5 shadow-[0_8px_32px_rgba(0,0,0,0.4)]',
    medium: 'bg-[#18182b]/80 backdrop-blur-xl border border-[#312E81]/30 shadow-[0_12px_40px_rgba(0,0,0,0.5)]',
    high: 'bg-gradient-to-br from-[#27273f]/70 to-[#1B1B30]/90 backdrop-blur-2xl border border-[#22C55E]/20 shadow-[0_16px_48px_rgba(0,0,0,0.6)]',
  };

  return (
    <motion.div 
      className={`rounded-2xl ${intensityClasses[intensity]} ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
}
