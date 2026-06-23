'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { Button } from '@/components/ui/button';
import { formatCurrencyFull, formatCurrency } from '@/lib/utils';
import { FinancingType } from '@/lib/types';
import { PropertyImage } from '@/components/shared/PropertyImage';

interface FinancingOption {
  type: FinancingType;
  label: string;
  icon: string;
  description: string;
  downPercent: number;
  rate: number;
  closingPercent: number;
  minCreditScore: number;
  pros: string[];
  cons: string[];
}

const FINANCING_OPTIONS: FinancingOption[] = [
  {
    type: 'cash',
    label: 'All Cash',
    icon: '💵',
    description: 'Purchase with 100% cash. Fastest close, maximum negotiating power.',
    downPercent: 1.0,
    rate: 0,
    closingPercent: 0,
    minCreditScore: 0,
    pros: ['Fastest close (7-14 days)', 'No interest costs', 'Maximum negotiating power'],
    cons: ['Ties up all capital', 'No leverage benefit'],
  },
  {
    type: 'hard_money',
    label: 'Hard Money',
    icon: '⚡',
    description: '90% LTV, 12% interest. Short-term loan for fix & flip investors.',
    downPercent: 0.1,
    rate: 12,
    closingPercent: 2,
    minCreditScore: 600,
    pros: ['Only 10% down', 'Fast close (7-21 days)', 'Credit-friendly'],
    cons: ['12% interest rate', '2% closing fee', 'Short loan term'],
  },
  {
    type: 'conventional',
    label: 'Conventional',
    icon: '🏦',
    description: '80% LTV, 7% interest. 30-year mortgage for buy & hold.',
    downPercent: 0.2,
    rate: 7,
    closingPercent: 3,
    minCreditScore: 680,
    pros: ['Low interest rate', 'Long amortization', 'Builds equity fast'],
    cons: ['20% down required', 'Credit score 680+', 'Slower close (30-45 days)'],
  },
  {
    type: 'private_money',
    label: 'Private Money',
    icon: '🤝',
    description: '85% LTV, 10% interest. Flexible terms from private lenders.',
    downPercent: 0.15,
    rate: 10,
    closingPercent: 1,
    minCreditScore: 620,
    pros: ['Flexible terms', 'Only 1% closing', 'Creative structures'],
    cons: ['10% interest', 'Relationship dependent'],
  },
];

export function AcquisitionScreen() {
  const { pendingAcquisition, acquireProperty, setScreen, stats } = useGameStore();
  const [selectedFinancing, setSelectedFinancing] = useState<FinancingType>('hard_money');

  if (!pendingAcquisition) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#080808]">
        <Button variant="gold" onClick={() => setScreen('deal_feed')}>Back to Deals</Button>
      </div>
    );
  }

  const { property, agreedPrice } = pendingAcquisition;
  const option = FINANCING_OPTIONS.find(f => f.type === selectedFinancing)!;

  const downPayment = Math.round(agreedPrice * option.downPercent);
  const closingCosts = Math.round(agreedPrice * option.closingPercent);
  const loanAmount = Math.round(agreedPrice * (1 - option.downPercent));
  const totalCashNeeded = downPayment + closingCosts;
  const monthlyPayment = option.rate > 0
    ? Math.round(loanAmount * (option.rate / 100 / 12) * Math.pow(1 + option.rate / 100 / 12, 360) / (Math.pow(1 + option.rate / 100 / 12, 360) - 1))
    : 0;
  const canAfford = stats.cash >= totalCashNeeded;
  const meetsCredit = stats.creditScore >= option.minCreditScore;
  const canUse = canAfford && meetsCredit;

  return (
    <div className="min-h-screen bg-[#080808] pb-24">
      <div className="px-4 pt-8 pb-4">
        <button onClick={() => setScreen('negotiation')} className="text-gray-400 hover:text-white text-sm mb-2">
          ← Back
        </button>
        <h1 className="text-2xl font-black text-white">Acquire Property</h1>
        <p className="text-gray-500 text-sm">Choose your financing strategy</p>
      </div>

      <div className="px-4 space-y-4">
        <div className="rounded-2xl overflow-hidden bg-[#111] border border-yellow-800/30">
          <PropertyImage propertyType={property.propertyType} imageIndex={property.imageIndex} className="w-full h-32" size="md" />
          <div className="p-3 flex justify-between items-center">
            <div>
              <p className="font-bold text-white">{property.address}</p>
              <p className="text-xs text-gray-500">{property.city}, {property.state}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Agreed Price</p>
              <p className="text-lg font-black text-yellow-300">{formatCurrencyFull(agreedPrice)}</p>
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Financing Options</p>
          <div className="grid grid-cols-2 gap-2">
            {FINANCING_OPTIONS.map((opt) => {
              const eligible = stats.creditScore >= opt.minCreditScore;
              return (
                <motion.button
                  key={opt.type}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => eligible && setSelectedFinancing(opt.type)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    !eligible ? 'opacity-40 cursor-not-allowed' :
                    selectedFinancing === opt.type
                      ? 'bg-yellow-950/40 border-yellow-600/50'
                      : 'bg-[#111] border-[#222] hover:border-[#333]'
                  }`}
                >
                  <span className="text-xl">{opt.icon}</span>
                  <p className="text-sm font-bold text-white mt-1">{opt.label}</p>
                  <p className="text-[10px] text-gray-500">{opt.rate > 0 ? `${opt.rate}% / ${Math.round(opt.downPercent * 100)}% down` : '100% cash'}</p>
                  {!eligible && <p className="text-[10px] text-red-400 mt-0.5">Credit {opt.minCreditScore}+</p>}
                </motion.button>
              );
            })}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#111] border border-[#222]">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">{option.label} — Breakdown</p>
          <div className="space-y-2">
            {option.rate > 0 && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Down Payment ({Math.round(option.downPercent * 100)}%)</span>
                <span className="text-sm font-bold text-white">{formatCurrencyFull(downPayment)}</span>
              </div>
            )}
            {option.closingPercent > 0 && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Closing Costs ({option.closingPercent}%)</span>
                <span className="text-sm font-bold text-amber-400">{formatCurrencyFull(closingCosts)}</span>
              </div>
            )}
            {option.rate > 0 && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Loan Amount</span>
                <span className="text-sm font-bold text-white">{formatCurrencyFull(loanAmount)}</span>
              </div>
            )}
            {option.rate > 0 && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Monthly Payment</span>
                <span className="text-sm font-bold text-red-400">{formatCurrencyFull(monthlyPayment)}/mo</span>
              </div>
            )}
            <div className="border-t border-[#222] pt-2 flex justify-between">
              <span className="text-sm font-bold text-white">Total Cash Needed</span>
              <span className={`text-sm font-black ${canAfford ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatCurrencyFull(totalCashNeeded)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-400">Your Cash</span>
              <span className="text-sm font-bold text-white">{formatCurrencyFull(stats.cash)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-400">Cash After Close</span>
              <span className={`text-sm font-bold ${stats.cash - totalCashNeeded > 5000 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatCurrencyFull(Math.max(0, stats.cash - totalCashNeeded))}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-3">
            <div>
              {option.pros.map(pro => (
                <p key={pro} className="text-[10px] text-emerald-400 flex items-start gap-1 mb-0.5">
                  <span>✓</span>{pro}
                </p>
              ))}
            </div>
            <div>
              {option.cons.map(con => (
                <p key={con} className="text-[10px] text-red-400 flex items-start gap-1 mb-0.5">
                  <span>✗</span>{con}
                </p>
              ))}
            </div>
          </div>
        </div>

        {!canAfford && (
          <div className="p-3 rounded-xl bg-red-950/30 border border-red-900/40">
            <p className="text-sm text-red-400 font-medium">Insufficient funds for this financing option.</p>
            <p className="text-xs text-gray-500">Need {formatCurrencyFull(totalCashNeeded - stats.cash)} more</p>
          </div>
        )}

        <Button
          variant="gold"
          size="lg"
          className="w-full text-base"
          disabled={!canUse}
          onClick={() => acquireProperty(property, agreedPrice, selectedFinancing)}
        >
          🏠 Close the Deal — {formatCurrencyFull(totalCashNeeded)} Cash
        </Button>

        <Button variant="ghost" size="md" className="w-full" onClick={() => setScreen('negotiation')}>
          ← Renegotiate
        </Button>
      </div>
    </div>
  );
}
