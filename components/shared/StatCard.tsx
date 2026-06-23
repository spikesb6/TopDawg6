import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
  highlight?: boolean;
}

export function StatCard({ label, value, subValue, icon, trend, className, highlight }: StatCardProps) {
  return (
    <div className={cn(
      'rounded-xl p-3 border',
      highlight
        ? 'bg-gradient-to-br from-yellow-950/60 to-yellow-900/20 border-yellow-700/30'
        : 'bg-[#111] border-[#222]',
      className
    )}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide truncate">{label}</p>
          <p className={cn(
            'text-lg font-bold mt-0.5 truncate',
            highlight ? 'text-yellow-300' : 'text-white'
          )}>{value}</p>
          {subValue && (
            <p className={cn(
              'text-xs mt-0.5',
              trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-gray-500'
            )}>
              {trend === 'up' ? '↑' : trend === 'down' ? '↓' : ''} {subValue}
            </p>
          )}
        </div>
        {icon && <span className="text-xl ml-2 flex-shrink-0">{icon}</span>}
      </div>
    </div>
  );
}
