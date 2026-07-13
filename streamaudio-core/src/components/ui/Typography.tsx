import React from 'react';

interface TypographyProps {
  children: React.ReactNode;
  variant?: 'h1' | 'h2' | 'h3' | 'subtitle' | 'body' | 'caption';
  className?: string;
  color?: 'primary' | 'secondary' | 'muted' | 'accent';
  align?: 'left' | 'center' | 'right';
}

export function Typography({
  children,
  variant = 'body',
  className = '',
  color = 'primary',
  align = 'right'
}: TypographyProps) {
  
  const baseClasses = 'font-cairo tracking-wide';
  
  const variantClasses = {
    h1: 'text-3xl font-black',
    h2: 'text-2xl font-bold',
    h3: 'text-xl font-bold',
    subtitle: 'text-lg font-semibold',
    body: 'text-[15px] font-medium leading-relaxed',
    caption: 'text-sm font-medium',
  };

  const colorClasses = {
    primary: 'text-white',
    secondary: 'text-zinc-300',
    muted: 'text-zinc-500',
    accent: 'text-ocean-400',
  };

  const alignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  const Component = ['h1', 'h2', 'h3'].includes(variant) ? variant as any : 'p';

  return (
    <Component 
      className={`${baseClasses} ${variantClasses[variant]} ${colorClasses[color]} ${alignClasses[align]} ${className}`}
      dir="rtl"
    >
      {children}
    </Component>
  );
}
