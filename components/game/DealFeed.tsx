'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { Property } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, gradeProperty } from '@/lib/utils';
import { PropertyImage } from '@/components/shared/PropertyImage';

const GRADE_COLORS: Record<string, string> = {
  A: 'emerald',
  B: 'blue',
  C: 'amber',
  D: 'amber',
  F: 'red',
};

function DealCard({ property, onSelect }: { property: Property; onSelect: (p: Property) => void }) {
  const mao = Math.round(property.arv * 0.7 - property.repairEstimate);
  const grade = gradeProperty(property.arv, property.askingPrice, property.repairEstimate);
  const potential = mao - property.askingPrice;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.98 }}
      className="rounded-2xl bg-[#111] border border-[#222] overflow-hidden cursor-pointer hover:border-yellow-800/40 transition-all"
      onClick={() => onSelect(property)}
    >
      <div className="relative">
        <PropertyImage
          propertyType={property.propertyType}
          imageIndex={property.imageIndex}
          className="w-full h-40"
          size="lg"
        />
        <div className="absolute top-3 left-3 flex gap-1.5 flex-wrap">
          <Badge variant={GRADE_COLORS[grade] as any}>{grade} Deal</Badge>
          <Badge variant="gray">{property.propertyType}</Badge>
        </div>
        <div className="absolute top-3 right-3">
          <Badge variant={property.seller.personality === 'Distressed' || property.seller.personality === 'Heir' ? 'emerald' : 'gray'}>
            {property.seller.personality}
          </Badge>
        </div>
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-[#111] to-transparent h-12" />
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="font-bold text-white">{property.address}</p>
            <p className="text-xs text-gray-500">{property.city}, {property.state}</p>
          </div>
          <div className="text-right">
            <p className="font-black text-lg text-white">{formatCurrency(property.askingPrice)}</p>
            <p className="text-xs text-gray-500">Asking</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="text-center p-2 rounded-lg bg-[#0d0d0d]">
            <p className="text-xs text-gray-500">ARV</p>
            <p className="text-sm font-bold text-white">{formatCurrency(property.arv)}</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-[#0d0d0d]">
            <p className="text-xs text-gray-500">Repairs</p>
            <p className="text-sm font-bold text-amber-400">{formatCurrency(property.repairEstimate)}</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-[#0d0d0d]">
            <p className="text-xs text-gray-500">Flip $</p>
            <p className={`text-sm font-bold ${potential > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {potential > 0 ? '+' : ''}{formatCurrency(potential)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3">
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <span key={i} className={`text-xs ${i < Math.round(property.neighborhoodRating / 2) ? 'text-yellow-400' : 'text-gray-700'}`}>★</span>
            ))}
          </div>
          <span className="text-xs text-gray-500">{property.city} area</span>
          <span className="ml-auto text-xs text-gray-500">
            Condition: <span className="text-white">{property.conditionScore}/10</span>
          </span>
        </div>
      </div>
    </motion.div>
  );
}

export function DealFeed() {
  const { stats, setScreen, selectProperty, startNegotiation, refreshDeals } = useGameStore();

  const handleSelect = (property: Property) => {
    selectProperty(property);
    setScreen('property_detail');
  };

  return (
    <div className="min-h-screen bg-[#080808] pb-24">
      <div className="px-4 pt-8 pb-4 bg-gradient-to-b from-[#0d0d0d] to-[#080808]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest">Market</p>
            <h1 className="text-2xl font-bold text-white">Deal Feed</h1>
          </div>
          <Button variant="surface" size="sm" onClick={refreshDeals}>
            🔄 Refresh
          </Button>
        </div>
        <p className="text-sm text-gray-500 mt-1">{stats.listedProperties.length} properties available</p>
      </div>

      <div className="px-4 space-y-4">
        <AnimatePresence>
          {stats.listedProperties.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">🏖️</p>
              <p className="text-white font-bold">No Deals Listed</p>
              <p className="text-gray-500 text-sm mt-1">Check back soon or refresh the market</p>
              <Button variant="gold" className="mt-4" onClick={refreshDeals}>Find Deals</Button>
            </div>
          ) : (
            stats.listedProperties.map((property) => (
              <DealCard key={property.id} property={property} onSelect={handleSelect} />
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
