import * as React from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'gold' | 'emerald' | 'red' | 'amber' | 'blue' | 'gray';
}

export function Badge({ className, variant = 'gray', children, ...props }: BadgeProps) {
  const variants = {
    gold: 'bg-yellow-900/40 text-yellow-300 border-yellow-700/40',
    emerald: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/40',
    red: 'bg-red-900/40 text-red-300 border-red-700/40',
    amber: 'bg-amber-900/40 text-amber-300 border-amber-700/40',
    blue: 'bg-blue-900/40 text-blue-300 border-blue-700/40',
    gray: 'bg-gray-800/60 text-gray-400 border-gray-700/40',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
