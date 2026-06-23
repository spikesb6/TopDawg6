'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { Button } from '@/components/ui/button';
import { formatCurrencyFull, formatCurrency } from '@/lib/utils';
import { RehabCategory, RehabTier } from '@/lib/types';
import { PropertyImage } from '@/components/shared/PropertyImage';

const DEFAULT_REHAB_CATEGORIES: Omit<RehabCategory, 'selected'>[] = [
  { name: 'Roof', budgetCost: 4000, standardCost: 8000, luxuryCost: 15000, budgetTimeDays: 7, standardTimeDays: 14, luxuryTimeDays: 21 },
  { name: 'Foundation', budgetCost: 3000, standardCost: 8000, luxuryCost: 20000, budgetTimeDays: 10, standardTimeDays: 21, luxuryTimeDays: 45 },
  { name: 'Electrical', budgetCost: 2500, standardCost: 5000, luxuryCost: 12000, budgetTimeDays: 5, standardTimeDays: 10, luxuryTimeDays: 14 },
  { name: 'Plumbing', budgetCost: 2000, standardCost: 4500, luxuryCost: 10000, budgetTimeDays: 5, standardTimeDays: 10, luxuryTimeDays: 14 },
  { name: 'Kitchen', budgetCost: 5000, standardCost: 15000, luxuryCost: 45000, budgetTimeDays: 14, standardTimeDays: 28, luxuryTimeDays: 45 },
  { name: 'Bathrooms', budgetCost: 3000, standardCost: 8000, luxuryCost: 25000, budgetTimeDays: 7, standardTimeDays: 14, luxuryTimeDays: 28 },
  { name: 'Flooring', budgetCost: 2500, standardCost: 6000, luxuryCost: 18000, budgetTimeDays: 5, standardTimeDays: 10, luxuryTimeDays: 21 },
  { name: 'Paint', budgetCost: 1500, standardCost: 3500, luxuryCost: 8000, budgetTimeDays: 3, standardTimeDays: 7, luxuryTimeDays: 14 },
];

const TIER_LABELS: Record<RehabTier, { label: string; color: string; multiplier: number }> = {
  budget: { label: 'Budget', color: 'text-gray-300', multiplier: 1.5 },
  standard: { label: 'Standard', color: 'text-blue-300', multiplier: 2.0 },
  luxury: { label: 'Luxury', color: 'text-yellow-300', multiplier: 2.8 },
};

const CATEGORY_ICONS: Record<string, string> = {
  'Roof': '🏠', 'Foundation': '⛏️', 'Electrical': '⚡', 'Plumbing': '🔧',
  'Kitchen': '🍳', 'Bathrooms': '🛁', 'Flooring': '🪵', 'Paint': '🎨',
};

export function RehabSystem() {
  const { pendingRehab, startRehab, setScreen, stats } = useGameStore();
  const [categories, setCategories] = useState<RehabCategory[]>(
    DEFAULT_REHAB_CATEGORIES.map(c => ({ ...c, selected: null }))
  );

  if (!pendingRehab) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#080808]">
        <Button variant="gold" onClick={() => setScreen('portfolio')}>Back to Portfolio</Button>
      </div>
    );
  }

  const property = pendingRehab;

  const toggleTier = (catIndex: number, tier: RehabTier) => {
    setCategories(prev => prev.map((cat, i) => {
      if (i !== catIndex) return cat;
      return { ...cat, selected: cat.selected === tier ? null : tier };
    }));
  };

  const totalCost = categories.reduce((sum, cat) => {
    if (!cat.selected) return sum;
    const costs = { budget: cat.budgetCost, standard: cat.standardCost, luxury: cat.luxuryCost };
    return sum + costs[cat.selected];
  }, 0);

  const totalDays = categories.reduce((max, cat) => {
    if (!cat.selected) return max;
    const days = { budget: cat.budgetTimeDays, standard: cat.standardTimeDays, luxury: cat.luxuryTimeDays };
    return Math.max(max, days[cat.selected]);
  }, 0);

  const valueAdded = categories.reduce((sum, cat) => {
    if (!cat.selected) return sum;
    const costs = { budget: cat.budgetCost, standard: cat.standardCost, luxury: cat.luxuryCost };
    const mults = { budget: 1.5, standard: 2.0, luxury: 2.8 };
    return sum + costs[cat.selected] * mults[cat.selected];
  }, 0);

  const projectedValue = (property.currentValue ?? property.arv * 0.85) + valueAdded;
  const canAfford = stats.cash >= totalCost;
  const selected = categories.filter(c => c.selected !== null).length;

  const skipRehab = () => {
    useGameStore.setState({ pendingRehab: null, pendingExitStrategy: property, screen: 'exit_strategy' });
  };

  return (
    <div className="min-h-screen bg-[#080808] pb-24">
      <div className="px-4 pt-8 pb-4">
        <h1 className="text-2xl font-black text-white">Renovation Plan</h1>
        <p className="text-gray-500 text-sm">{property.address}</p>
      </div>

      <div className="px-4 space-y-4">
        <div className="rounded-2xl overflow-hidden bg-[#111] border border-[#222]">
          <PropertyImage propertyType={property.propertyType} imageIndex={property.imageIndex} className="w-full h-28" size="md" />
          <div className="p-3 grid grid-cols-3 gap-2">
            <div className="text-center">
              <p className="text-xs text-gray-500">Current Value</p>
              <p className="text-sm font-bold text-white">{formatCurrency(property.currentValue ?? property.arv * 0.85)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">ARV</p>
              <p className="text-sm font-bold text-yellow-300">{formatCurrency(property.arv)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">Your Cash</p>
              <p className={`text-sm font-bold ${stats.cash >= 10000 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(stats.cash)}</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          {(['budget', 'standard', 'luxury'] as RehabTier[]).map(tier => (
            <div key={tier} className="flex-1 text-center p-2 rounded-xl bg-[#111] border border-[#222]">
              <p className={`text-xs font-bold ${TIER_LABELS[tier].color}`}>{TIER_LABELS[tier].label}</p>
              <p className="text-[10px] text-gray-500">{TIER_LABELS[tier].multiplier}x ROI</p>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          {categories.map((cat, i) => {
            const tierCosts = {
              budget: cat.budgetCost,
              standard: cat.standardCost,
              luxury: cat.luxuryCost,
            };
            return (
              <div key={cat.name} className="p-3 rounded-xl bg-[#111] border border-[#222]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{CATEGORY_ICONS[cat.name]}</span>
                  <span className="font-medium text-white">{cat.name}</span>
                  {cat.selected && (
                    <span className={`ml-auto text-xs font-bold ${TIER_LABELS[cat.selected].color}`}>
                      {TIER_LABELS[cat.selected].label} — {formatCurrency(tierCosts[cat.selected])}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['budget', 'standard', 'luxury'] as RehabTier[]).map(tier => (
                    <button
                      key={tier}
                      onClick={() => toggleTier(i, tier)}
                      className={`py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        cat.selected === tier
                          ? tier === 'budget' ? 'bg-gray-700 border-gray-500 text-white' :
                            tier === 'standard' ? 'bg-blue-900/60 border-blue-600/50 text-blue-200' :
                            'bg-yellow-900/60 border-yellow-600/50 text-yellow-200'
                          : 'bg-[#0d0d0d] border-[#1a1a1a] text-gray-600 hover:text-gray-400'
                      }`}
                    >
                      {formatCurrency(tierCosts[tier])}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {selected > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-2xl bg-gradient-to-br from-yellow-950/50 to-[#111] border border-yellow-800/30"
          >
            <p className="text-xs text-yellow-600 uppercase tracking-wide mb-3">Renovation Summary</p>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Total Rehab Cost</span>
                <span className={`text-sm font-bold ${canAfford ? 'text-white' : 'text-red-400'}`}>{formatCurrencyFull(totalCost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Value Added</span>
                <span className="text-sm font-bold text-emerald-400">+{formatCurrencyFull(valueAdded)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Projected Value</span>
                <span className="text-sm font-bold text-yellow-300">{formatCurrencyFull(projectedValue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Timeline</span>
                <span className="text-sm font-bold text-white">{totalDays} days</span>
              </div>
            </div>
          </motion.div>
        )}

        {!canAfford && totalCost > 0 && (
          <div className="p-3 rounded-xl bg-red-950/30 border border-red-900/40">
            <p className="text-sm text-red-400">Not enough cash. Need {formatCurrencyFull(totalCost - stats.cash)} more.</p>
          </div>
        )}

        <div className="space-y-2">
          <Button
            variant="gold"
            size="lg"
            className="w-full"
            disabled={selected === 0 || !canAfford}
            onClick={() => startRehab(property, categories)}
          >
            🔨 Start Renovation — {formatCurrencyFull(totalCost)}
          </Button>
          <Button variant="surface" size="md" className="w-full" onClick={skipRehab}>
            Skip Renovation → Choose Exit Strategy
          </Button>
        </div>
      </div>
    </div>
  );
}
