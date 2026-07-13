import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

interface ButtonProps extends HTMLMotionProps<"button"> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export function Button({ 
  children, 
  variant = 'secondary', 
  size = 'md', 
  fullWidth = false,
  className = '', 
  ...props 
}: ButtonProps) {
  
  const baseClasses = 'relative flex items-center justify-center font-bold tracking-wide rounded-xl overflow-hidden transition-all duration-200 outline-none select-none';
  
  const variantClasses = {
    primary: 'bg-brand-700 text-brand-900 border border-brand-500/50 hover:bg-brand-500 hover:text-brand-900 shadow-md',
    secondary: 'bg-white/5 text-zinc-300 border border-white/10 hover:bg-white/10 hover:text-white',
    danger: 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 hover:border-red-400/50 hover:shadow-[0_0_15px_rgba(248,113,113,0.2)]',
    ghost: 'bg-transparent text-zinc-400 border border-transparent hover:bg-white/5 hover:text-zinc-200',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-5 py-2.5 text-[15px]',
    lg: 'px-8 py-3.5 text-base',
  };

  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <motion.button 
      whileTap={{ scale: 0.96 }}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${widthClass} ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  );
}
