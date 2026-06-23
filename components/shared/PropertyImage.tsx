import { PropertyType } from '@/lib/types';
import { cn } from '@/lib/utils';

const PROPERTY_EMOJIS: Record<string, string> = {
  'Single Family': '🏡',
  'Condo': '🏢',
  'Duplex': '🏘️',
  'Triplex': '🏘️',
  'Fourplex': '🏢',
  'Retail': '🏪',
  'Office': '🏦',
  'Industrial': '🏭',
  'Waterfront': '🌊',
  'Mansion': '🏰',
  'Penthouse': '🏙️',
};

const PROPERTY_GRADIENTS = [
  'from-slate-900 to-slate-800',
  'from-stone-900 to-stone-800',
  'from-zinc-900 to-zinc-800',
  'from-neutral-900 to-neutral-800',
  'from-gray-900 to-gray-800',
  'from-red-950 to-stone-900',
  'from-amber-950 to-stone-900',
  'from-green-950 to-slate-900',
  'from-teal-950 to-slate-900',
  'from-blue-950 to-slate-900',
  'from-indigo-950 to-slate-900',
  'from-purple-950 to-slate-900',
];

interface PropertyImageProps {
  propertyType: PropertyType;
  imageIndex: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function PropertyImage({ propertyType, imageIndex, className, size = 'md' }: PropertyImageProps) {
  const gradient = PROPERTY_GRADIENTS[imageIndex % PROPERTY_GRADIENTS.length];
  const emoji = PROPERTY_EMOJIS[propertyType] ?? '🏠';

  const sizes = { sm: 'text-4xl', md: 'text-6xl', lg: 'text-8xl' };

  return (
    <div className={cn(
      `bg-gradient-to-br ${gradient} flex items-center justify-center relative overflow-hidden`,
      className
    )}>
      <div className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.02) 10px, rgba(255,255,255,0.02) 20px)`
        }}
      />
      <span className={cn(sizes[size], 'relative z-10')}>{emoji}</span>
    </div>
  );
}
