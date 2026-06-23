'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'gold' | 'emerald' | 'ghost' | 'outline' | 'danger' | 'surface';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export function Button({
  className,
  variant = 'gold',
  size = 'md',
  loading,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const base = 'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:pointer-events-none select-none';

  const variants = {
    gold: 'bg-gradient-to-r from-[#a08020] to-[#d4af37] text-black hover:from-[#b09030] hover:to-[#e0bf47] shadow-lg shadow-yellow-900/30',
    emerald: 'bg-gradient-to-r from-[#059669] to-[#10b981] text-white hover:from-[#069975] hover:to-[#20c991] shadow-lg shadow-emerald-900/30',
    ghost: 'text-gray-400 hover:text-white hover:bg-white/5',
    outline: 'border border-[#2a2a2a] text-gray-300 hover:border-[#d4af37]/40 hover:text-white bg-transparent',
    danger: 'bg-gradient-to-r from-[#b91c1c] to-[#ef4444] text-white hover:from-[#c91c1c] hover:to-[#ff5454] shadow-lg shadow-red-900/30',
    surface: 'bg-[#1a1a1a] border border-[#2a2a2a] text-gray-200 hover:bg-[#222] hover:border-[#3a3a3a]',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2.5 text-sm gap-2',
    lg: 'px-6 py-3.5 text-base gap-2',
  };

  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}
