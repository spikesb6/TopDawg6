'use client';

import { motion } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrencyFull, formatCurrency, gradeProperty } from '@/lib/utils';
import { PropertyImage } from '@/components/shared/PropertyImage';

const PERSONALITY_TIPS: Record<string, string> = {
  'Distressed': 'High motivation — they need to sell FAST. Move quickly, offer certainty.',
  'Emotional': 'Build personal connection first. Show you\'ll care for the property.',
  'Investor': 'Skip the small talk. Come with clean terms and a fast close.',
  'Landlord': 'Empathize with the tenant headaches. Offer hassle-free process.',
  'Heir': 'Make it easy on them. Simple docs, quick close. Don\'t lowball.',
  'Stubborn': 'Don\'t rush. Build trust slowly. Multiple sessions may be needed.',
  'Luxury Seller': 'Be professional. Come prepared with comps and a strong offer.',
};

export function PropertyDetail() {
  const { selectedProperty, startNegotiation, setScreen } = useGameStore();

  if (!selectedProperty) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#080808]">
        <Button variant="gold" onClick={() => setScreen('deal_feed')}>Back to Deals</Button>
      </div>
    );
  }

  const p = selectedProperty;
  const mao = Math.round(p.arv * 0.7 - p.repairEstimate);
  const flipPotential = mao - p.askingPrice;
  const monthlyExpenses = (p.estimatedRent * 0.35);
  const cashFlow = p.estimatedRent - monthlyExpenses;
  const capRate = ((p.estimatedRent * 12 - monthlyExpenses * 12) / p.arv * 100);
  const grade = gradeProperty(p.arv, p.askingPrice, p.repairEstimate);

  return (
    <div className="min-h-screen bg-[#080808] pb-24">
      <div className="relative">
        <PropertyImage
          propertyType={p.propertyType}
          imageIndex={p.imageIndex}
          className="w-full h-56"
          size="lg"
        />
        <button
          onClick={() => setScreen('deal_feed')}
          className="absolute top-4 left-4 w-9 h-9 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/80 transition-colors"
        >
          ←
        </button>
        <div className="absolute bottom-4 left-4 right-4">
          <h1 className="text-xl font-black text-white drop-shadow-lg">{p.address}</h1>
          <p className="text-sm text-gray-300">{p.city}, {p.state}</p>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">Asking Price</p>
            <p className="text-3xl font-black text-white">{formatCurrencyFull(p.askingPrice)}</p>
          </div>
          <div className="flex gap-2">
            <Badge variant={grade === 'A' ? 'emerald' : grade === 'B' ? 'blue' : grade === 'C' ? 'amber' : 'red'} className="text-sm px-3 py-1">
              {grade} Grade
            </Badge>
            <Badge variant="gray">{p.propertyType}</Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-[#111] border border-[#222]">
            <p className="text-xs text-gray-500">After Repair Value</p>
            <p className="text-lg font-bold text-white">{formatCurrencyFull(p.arv)}</p>
          </div>
          <div className="p-3 rounded-xl bg-[#111] border border-[#222]">
            <p className="text-xs text-gray-500">Repair Estimate</p>
            <p className="text-lg font-bold text-amber-400">{formatCurrencyFull(p.repairEstimate)}</p>
          </div>
          <div className="p-3 rounded-xl bg-[#111] border border-emerald-900/40">
            <p className="text-xs text-gray-500">Est. Monthly Rent</p>
            <p className="text-lg font-bold text-emerald-400">{formatCurrencyFull(p.estimatedRent)}</p>
          </div>
          <div className="p-3 rounded-xl bg-[#111] border border-[#222]">
            <p className="text-xs text-gray-500">Neighborhood</p>
            <div className="flex items-center gap-1 mt-0.5">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className={`flex-1 h-1.5 rounded-full ${i < p.neighborhoodRating ? 'bg-yellow-400' : 'bg-[#222]'}`} />
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1">{p.neighborhoodRating}/10</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-gradient-to-br from-yellow-950/60 to-[#111] border border-yellow-800/30">
          <p className="text-xs text-yellow-600 uppercase tracking-wide font-medium mb-3">Investor Analysis</p>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-400">ARV × 70%</span>
              <span className="text-sm font-bold text-white">{formatCurrencyFull(p.arv * 0.7)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-400">- Repairs</span>
              <span className="text-sm font-bold text-red-400">-{formatCurrencyFull(p.repairEstimate)}</span>
            </div>
            <div className="border-t border-yellow-800/30 pt-2 flex justify-between">
              <span className="text-sm font-bold text-yellow-300">Max Allowable Offer</span>
              <span className="text-sm font-black text-yellow-300">{formatCurrencyFull(mao)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-400">Asking vs MAO</span>
              <span className={`text-sm font-bold ${flipPotential > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {flipPotential > 0 ? '+' : ''}{formatCurrencyFull(flipPotential)}
              </span>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#111] border border-emerald-900/30">
          <p className="text-xs text-emerald-600 uppercase tracking-wide font-medium mb-3">Rental Analysis</p>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-400">Gross Monthly Rent</span>
              <span className="text-sm font-bold text-white">{formatCurrencyFull(p.estimatedRent)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-400">Expenses (35%)</span>
              <span className="text-sm font-bold text-red-400">-{formatCurrencyFull(monthlyExpenses)}</span>
            </div>
            <div className="border-t border-emerald-900/30 pt-2 flex justify-between">
              <span className="text-sm font-bold text-emerald-300">Net Cash Flow</span>
              <span className={`text-sm font-black ${cashFlow > 0 ? 'text-emerald-300' : 'text-red-400'}`}>
                {formatCurrencyFull(cashFlow)}/mo
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-400">Cap Rate</span>
              <span className="text-sm font-bold text-blue-400">{capRate.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#111] border border-[#222]">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-3">Seller Profile</p>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center text-lg">
              👤
            </div>
            <div>
              <p className="font-bold text-white">{p.seller.name}</p>
              <Badge variant={p.seller.personality === 'Distressed' ? 'red' : p.seller.personality === 'Stubborn' ? 'amber' : 'gray'}>
                {p.seller.personality}
              </Badge>
            </div>
          </div>
          <p className="text-sm text-gray-400 italic">"{p.seller.backstory}"</p>

          <div className="mt-3 p-3 rounded-xl bg-blue-950/30 border border-blue-900/30">
            <p className="text-xs text-blue-300 font-medium mb-1">💡 Negotiation Tip</p>
            <p className="text-xs text-gray-400">{PERSONALITY_TIPS[p.seller.personality]}</p>
          </div>
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl bg-[#111] border border-[#222]">
          <div>
            <p className="text-xs text-gray-500">Property Condition</p>
            <p className="text-base font-bold text-white">{p.condition}</p>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className={`w-2 h-6 rounded-sm ${i < p.conditionScore ? 'bg-yellow-400' : 'bg-[#222]'}`} />
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Button variant="gold" size="lg" className="w-full text-base" onClick={() => startNegotiation(p)}>
            🤝 Start Negotiation
          </Button>
          <Button variant="ghost" size="md" className="w-full" onClick={() => setScreen('deal_feed')}>
            ← Back to Deals
          </Button>
        </div>
      </div>
    </div>
  );
}
