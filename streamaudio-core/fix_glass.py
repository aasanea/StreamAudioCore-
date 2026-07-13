code = '''import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

interface GlassPanelProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
  intensity?: 'low' | 'medium' | 'high';
}

export function GlassPanel({ children, className = '', intensity = 'medium', ...props }: GlassPanelProps) {
  const intensityClasses = {
    low: 'bg-[#12181b]/60 backdrop-blur-md border-white/5',
    medium: 'bg-[#0f1417]/70 backdrop-blur-lg border-white/10',
    high: 'bg-[#0a0d0f]/80 backdrop-blur-xl border-white/15',
  };

  return (
    <motion.div 
      className={ounded-2xl border shadow-xl  }
      {...props}
    >
      {children}
    </motion.div>
  );
}
'''
with open('src/components/ui/GlassPanel.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
