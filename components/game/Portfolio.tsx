'use client';

import { motion } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { Property } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/shared/StatCard';
import { formatCurrencyFull, formatCurrency } from '@/lib/utils';
import { PropertyImage } from '@/components/shared/PropertyImage';

const STATUS_CONFIG = {
  owned: { label: 'Owned', color: 'blue' as const, icon: '🏠' },
  renovating: { label: 'Renovating', color: 'amber' as const, icon: '🔨' },
  rented: { label: 'Rented', color: 'emerald' as const, icon: '✅' },
  sold: { label: 'Sold', color: 'gray' as const, icon: '💰' },
  listed: { label: 'Listed', color: 'gray' as const, icon: '📋' },
};

function PortfolioCard({ property }: { property: Property }) {
  const { setScreen, pendingExitStrategy } = useGameStore();
  const config = STATUS_CONFIG[property.status] ?? STATUS_CONFIG.owned;
  const equity = (property.currentValue ?? property.arv) - (property.loanAmount ?? 0);

  const handleAction = () => {
    if (property.status === 'owned' || property.status === 'renovating') {
      useGameStore.setState({ pendingExitStrategy: property, screen: 'exit_strategy' });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-[#111] border border-[#222] overflow-hidden"
    >
      <div className="relative">
        <PropertyImage propertyType={property.propertyType} imageIndex={property.imageIndex} className="w-full h-28" size="sm" />
        <div className="absolute top-2 left-2 flex gap-1">
          <Badge variant={config.color}>{config.icon} {config.label}</Badge>
          <Badge variant="gray">{property.propertyType}</Badge>
        </div>
        {property.status === 'sold' && property.profit !== undefined && (
          <div className="absolute top-2 right-2">
            <Badge variant={property.profit > 0 ? 'emerald' : 'red'}>
              {property.profit > 0 ? '+' : ''}{formatCurrency(property.profit)}
            </Badge>
          </div>
        )}
      </div>

      <div className="p-3">
        <div className="flex justify-between items-start mb-2">
          <div>
            <p className="font-bold text-white text-sm">{property.address}</p>
            <p className="text-xs text-gray-500">{property.city}, {property.state}</p>
          </div>
          {property.status !== 'sold' && (
            <p className="text-sm font-black text-yellow-300">{formatCurrency(property.currentValue ?? property.arv)}</p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {property.status === 'rented' ? (
            <>
              <div className="text-center p-1.5 rounded-lg bg-[#0d0d0d]">
                <p className="text-[10px] text-gray-500">Rent</p>
                <p className="text-xs font-bold text-emerald-400">{formatCurrency(property.monthlyRent ?? 0)}</p>
              </div>
              <div className="text-center p-1.5 rounded-lg bg-[#0d0d0d]">
                <p className="text-[10px] text-gray-500">Cash Flow</p>
                <p className={`text-xs font-bold ${(property.monthlyCashFlow ?? 0) > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  +{formatCurrency(property.monthlyCashFlow ?? 0)}
                </p>
              </div>
              <div className="text-center p-1.5 rounded-lg bg-[#0d0d0d]">
                <p className="text-[10px] text-gray-500">Equity</p>
                <p className="text-xs font-bold text-yellow-300">{formatCurrency(equity)}</p>
              </div>
            </>
          ) : property.status === 'sold' ? (
            <>
              <div className="text-center p-1.5 rounded-lg bg-[#0d0d0d]">
                <p className="text-[10px] text-gray-500">Sold For</p>
                <p className="text-xs font-bold text-white">{formatCurrency(property.sellPrice ?? 0)}</p>
              </div>
              <div className="text-center p-1.5 rounded-lg bg-[#0d0d0d]">
                <p className="text-[10px] text-gray-500">Invested</p>
                <p className="text-xs font-bold text-gray-400">{formatCurrency(property.totalInvested ?? 0)}</p>
              </div>
              <div className="text-center p-1.5 rounded-lg bg-[#0d0d0d]">
                <p className="text-[10px] text-gray-500">Profit</p>
                <p className={`text-xs font-bold ${(property.profit ?? 0) > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatCurrency(property.profit ?? 0)}
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="text-center p-1.5 rounded-lg bg-[#0d0d0d]">
                <p className="text-[10px] text-gray-500">Purchase</p>
                <p className="text-xs font-bold text-white">{formatCurrency(property.purchasePrice ?? 0)}</p>
              </div>
              <div className="text-center p-1.5 rounded-lg bg-[#0d0d0d]">
                <p className="text-[10px] text-gray-500">Value</p>
                <p className="text-xs font-bold text-yellow-300">{formatCurrency(property.currentValue ?? property.arv)}</p>
              </div>
              <div className="text-center p-1.5 rounded-lg bg-[#0d0d0d]">
                <p className="text-[10px] text-gray-500">Equity</p>
                <p className="text-xs font-bold text-emerald-400">{formatCurrency(equity)}</p>
              </div>
            </>
          )}
        </div>

        {(property.status === 'owned' || property.status === 'renovating') && (
          <Button variant="surface" size="sm" className="w-full mt-2" onClick={handleAction}>
            {property.status === 'renovating' ? '🔨 Continue Renovation' : '🎯 Choose Exit Strategy'}
          </Button>
        )}
      </div>
    </motion.div>
  );
}

export function Portfolio() {
  const { stats, setScreen, refreshDeals, collectRent } = useGameStore();

  const activeProperties = stats.portfolio.filter(p => p.status !== 'sold');
  const soldProperties = stats.portfolio.filter(p => p.status === 'sold');
  const totalValue = activeProperties.reduce((s, p) => s + (p.currentValue ?? p.arv), 0);
  const totalEquity = activeProperties.reduce((s, p) => s + (p.currentValue ?? p.arv) - (p.loanAmount ?? 0), 0);
  const totalDebt = activeProperties.reduce((s, p) => s + (p.loanAmount ?? 0), 0);

  const handleFindDeals = () => {
    refreshDeals();
    setScreen('deal_feed');
  };

  return (
    <div className="min-h-screen bg-[#080808] pb-24">
      <div className="px-4 pt-8 pb-4">
        <p className="text-xs text-gray-500 uppercase tracking-widest">Your Empire</p>
        <h1 className="text-2xl font-bold text-white">Portfolio</h1>
      </div>

      <div className="px-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Portfolio Value" value={formatCurrency(totalValue)} icon="🏘️" highlight />
          <StatCard label="Total Equity" value={formatCurrency(totalEquity)} icon="💎" trend="up" />
          <StatCard label="Monthly Cash Flow" value={`+${formatCurrency(stats.monthlyCashFlow)}`} icon="💸" trend="up" />
          <StatCard label="Total Debt" value={formatCurrency(totalDebt)} icon="🏦" trend="down" />
        </div>

        {stats.portfolio.filter(p => p.status === 'rented').length > 0 && (
          <button
            onClick={collectRent}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-950 to-emerald-900 border border-emerald-700/40 text-emerald-300 font-bold flex items-center justify-center gap-2 hover:from-emerald-900 hover:to-emerald-800 transition-all"
          >
            💰 Collect Rent — +{formatCurrencyFull(stats.monthlyCashFlow)}/mo
          </button>
        )}

        {activeProperties.length > 0 ? (
          <div>
            <h2 className="text-sm font-semibold text-gray-400 mb-2 uppercase tracking-wide">Active ({activeProperties.length})</h2>
            <div className="space-y-3">
              {activeProperties.map(p => <PortfolioCard key={p.id} property={p} />)}
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">🏗️</p>
            <p className="text-white font-bold">Portfolio is Empty</p>
            <p className="text-gray-500 text-sm mt-1">Start by acquiring your first property</p>
            <Button variant="gold" className="mt-4" onClick={handleFindDeals}>
              Find Deals
            </Button>
          </div>
        )}

        {soldProperties.length > 0 && (
          <div className="pb-4">
            <h2 className="text-sm font-semibold text-gray-400 mb-2 uppercase tracking-wide">Sold ({soldProperties.length})</h2>
            <div className="space-y-3">
              {soldProperties.map(p => <PortfolioCard key={p.id} property={p} />)}
            </div>
          </div>
        )}

        {(stats.dealsCompleted > 0 || stats.flipProfits > 0) && (
          <div className="p-4 rounded-2xl bg-[#111] border border-[#222]">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">All-Time Stats</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-500">Deals Completed</p>
                <p className="text-lg font-bold text-white">{stats.dealsCompleted}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Flip Profits</p>
                <p className="text-lg font-bold text-yellow-300">{formatCurrencyFull(stats.flipProfits)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Rental Income</p>
                <p className="text-lg font-bold text-emerald-400">{formatCurrencyFull(stats.totalRentalIncome)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Net Worth</p>
                <p className="text-lg font-bold text-white">{formatCurrencyFull(stats.netWorth)}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
