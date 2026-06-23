'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { Button } from '@/components/ui/button';
import { formatCurrencyFull, formatCurrency } from '@/lib/utils';
import { PropertyImage } from '@/components/shared/PropertyImage';

export function ExitStrategy() {
  const { pendingExitStrategy, flipProperty, rentProperty, setScreen } = useGameStore();
  const [selected, setSelected] = useState<'flip' | 'rental' | null>(null);

  if (!pendingExitStrategy) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#080808]">
        <Button variant="gold" onClick={() => setScreen('portfolio')}>Back to Portfolio</Button>
      </div>
    );
  }

  const p = pendingExitStrategy;
  const sellPrice = p.currentValue ?? p.arv;
  const totalInvested = p.totalInvested ?? p.purchasePrice ?? 0;
  const loanPayoff = p.loanAmount ?? 0;
  const flipProfit = sellPrice - totalInvested - loanPayoff;
  const flipROI = totalInvested > 0 ? (flipProfit / totalInvested) * 100 : 0;

  const monthlyRent = p.estimatedRent;
  const monthlyExpenses = monthlyRent * 0.35 + (p.monthlyPayment ?? 0);
  const cashFlow = monthlyRent - monthlyExpenses;
  const annualCashFlow = cashFlow * 12;
  const capRate = ((monthlyRent * 12 - monthlyExpenses * 12) / sellPrice) * 100;
  const cashOnCash = totalInvested > 0 ? (annualCashFlow / totalInvested) * 100 : 0;
  const equity = sellPrice - loanPayoff;

  const confirm = () => {
    if (selected === 'flip') flipProperty(p);
    if (selected === 'rental') rentProperty(p);
  };

  return (
    <div className="min-h-screen bg-[#080808] pb-24">
      <div className="px-4 pt-8 pb-4">
        <h1 className="text-2xl font-black text-white">Exit Strategy</h1>
        <p className="text-gray-500 text-sm">{p.address}</p>
      </div>

      <div className="px-4 space-y-4">
        <div className="rounded-2xl overflow-hidden bg-[#111] border border-[#222]">
          <PropertyImage propertyType={p.propertyType} imageIndex={p.imageIndex} className="w-full h-32" size="md" />
          <div className="p-3 flex justify-between">
            <div>
              <p className="font-bold text-white">{p.address}</p>
              <p className="text-xs text-gray-500">{p.city}, {p.state} · {p.propertyType}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Current Value</p>
              <p className="text-lg font-black text-yellow-300">{formatCurrencyFull(sellPrice)}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="p-3 rounded-xl bg-[#111] border border-[#222] text-center">
            <p className="text-xs text-gray-500">Total Invested</p>
            <p className="text-base font-bold text-white">{formatCurrencyFull(totalInvested)}</p>
          </div>
          <div className="p-3 rounded-xl bg-[#111] border border-[#222] text-center">
            <p className="text-xs text-gray-500">Equity</p>
            <p className="text-base font-bold text-emerald-400">{formatCurrencyFull(equity)}</p>
          </div>
        </div>

        <div className="space-y-3">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => setSelected(selected === 'flip' ? null : 'flip')}
            className={`w-full text-left p-4 rounded-2xl border transition-all ${
              selected === 'flip'
                ? 'bg-yellow-950/40 border-yellow-600/60'
                : 'bg-[#111] border-[#222] hover:border-[#333]'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🏷️</span>
                <div>
                  <p className="font-black text-white text-lg">FLIP IT</p>
                  <p className="text-xs text-gray-500">Sell for immediate profit</p>
                </div>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selected === 'flip' ? 'border-yellow-500 bg-yellow-500' : 'border-gray-600'}`}>
                {selected === 'flip' && <span className="text-black text-xs font-bold">✓</span>}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Sale Price</span>
                <span className="text-sm font-bold text-white">{formatCurrencyFull(sellPrice)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Total Invested</span>
                <span className="text-sm font-bold text-red-400">-{formatCurrencyFull(totalInvested)}</span>
              </div>
              {loanPayoff > 0 && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Loan Payoff</span>
                  <span className="text-sm font-bold text-red-400">-{formatCurrencyFull(loanPayoff)}</span>
                </div>
              )}
              <div className="border-t border-yellow-800/30 pt-2 flex justify-between">
                <span className="text-sm font-bold text-yellow-300">Net Profit</span>
                <span className={`text-lg font-black ${flipProfit > 0 ? 'text-yellow-300' : 'text-red-400'}`}>
                  {flipProfit > 0 ? '+' : ''}{formatCurrencyFull(flipProfit)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">ROI</span>
                <span className={`text-sm font-bold ${flipROI > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {flipROI.toFixed(1)}%
                </span>
              </div>
            </div>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => setSelected(selected === 'rental' ? null : 'rental')}
            className={`w-full text-left p-4 rounded-2xl border transition-all ${
              selected === 'rental'
                ? 'bg-emerald-950/40 border-emerald-600/60'
                : 'bg-[#111] border-[#222] hover:border-[#333]'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🏘️</span>
                <div>
                  <p className="font-black text-white text-lg">BUY &amp; HOLD</p>
                  <p className="text-xs text-gray-500">Rent for recurring income</p>
                </div>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selected === 'rental' ? 'border-emerald-500 bg-emerald-500' : 'border-gray-600'}`}>
                {selected === 'rental' && <span className="text-black text-xs font-bold">✓</span>}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Monthly Rent</span>
                <span className="text-sm font-bold text-white">{formatCurrencyFull(monthlyRent)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Expenses (35% + mortgage)</span>
                <span className="text-sm font-bold text-red-400">-{formatCurrencyFull(monthlyExpenses)}</span>
              </div>
              <div className="border-t border-emerald-900/30 pt-2 flex justify-between">
                <span className="text-sm font-bold text-emerald-300">Monthly Cash Flow</span>
                <span className={`text-lg font-black ${cashFlow > 0 ? 'text-emerald-300' : 'text-red-400'}`}>
                  {cashFlow > 0 ? '+' : ''}{formatCurrencyFull(cashFlow)}/mo
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <div className="text-center p-2 rounded-lg bg-[#0d0d0d]">
                  <p className="text-[10px] text-gray-500">Annual CF</p>
                  <p className="text-xs font-bold text-emerald-400">{formatCurrency(annualCashFlow)}</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-[#0d0d0d]">
                  <p className="text-[10px] text-gray-500">Cap Rate</p>
                  <p className="text-xs font-bold text-blue-400">{capRate.toFixed(1)}%</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-[#0d0d0d]">
                  <p className="text-[10px] text-gray-500">CoC Return</p>
                  <p className="text-xs font-bold text-yellow-400">{cashOnCash.toFixed(1)}%</p>
                </div>
              </div>
            </div>
          </motion.button>
        </div>

        <Button
          variant={selected === 'flip' ? 'gold' : 'emerald'}
          size="lg"
          className="w-full text-base"
          disabled={!selected}
          onClick={confirm}
        >
          {selected === 'flip' ? `🏷️ Sell for ${formatCurrencyFull(flipProfit)} Profit` :
           selected === 'rental' ? `🏘️ Rent for +${formatCurrencyFull(cashFlow)}/mo` :
           'Select a strategy above'}
        </Button>

        <Button variant="ghost" size="md" className="w-full" onClick={() => setScreen('portfolio')}>
          ← Back to Portfolio
        </Button>
      </div>
    </div>
  );
}
