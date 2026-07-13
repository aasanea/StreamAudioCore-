import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

interface IconButtonProps extends HTMLMotionProps<"button"> {
  icon: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isActive?: boolean;
}

export function IconButton({ 
  icon, 
  variant = 'secondary', 
  size = 'md', 
  isActive = false,
  className = '', 
  ...props 
}: IconButtonProps) {
  
  const baseClasses = 'relative flex items-center justify-center rounded-xl overflow-hidden transition-all duration-200 outline-none select-none';
  
  const variantClasses = {
    primary: isActive 
      ? 'bg-ocean-500/20 text-ocean-300 border-ocean-400/50 shadow-[0_0_15px_rgba(34,211,238,0.2)]'
      : 'bg-ocean-500/5 text-ocean-500 border border-ocean-500/20 hover:bg-ocean-500/10 hover:border-ocean-500/40',
    secondary: isActive
      ? 'bg-white/10 text-white border-white/20'
      : 'bg-white/5 text-zinc-400 border border-white/5 hover:bg-white/10 hover:text-zinc-200 hover:border-white/10',
    danger: isActive
      ? 'bg-red-500/20 text-red-300 border-red-400/50 shadow-[0_0_15px_rgba(248,113,113,0.2)]'
      : 'bg-red-500/5 text-red-500 border border-red-500/20 hover:bg-red-500/10 hover:border-red-500/40',
    ghost: isActive
      ? 'bg-white/10 text-white'
      : 'bg-transparent text-zinc-500 hover:text-zinc-300 hover:bg-white/5',
  };

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };

  return (
    <motion.button 
      whileTap={{ scale: 0.92 }}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {icon}
    </motion.button>
  );
}
