'use client';

import { motion } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { StatCard } from '@/components/shared/StatCard';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { formatCurrency, formatCurrencyFull, calcXpProgress, getXpForNextLevel, getNextLevel } from '@/lib/utils';
import { LEVEL_THRESHOLDS } from '@/lib/types';

export function Dashboard() {
  const { stats, setScreen, refreshDeals, collectRent, dismissEvent, checkForEvents } = useGameStore();

  const xpProgress = calcXpProgress(stats.xp, stats.level);
  const nextLevel = getNextLevel(stats.level);
  const xpNeeded = getXpForNextLevel(stats.level);
  const unreadEvents = stats.events.filter(e => !e.read);
  const rentableProperties = stats.portfolio.filter(p => p.status === 'rented');

  const handleFindDeals = () => {
    refreshDeals();
    checkForEvents();
    setScreen('deal_feed');
  };

  return (
    <div className="min-h-screen bg-[#080808] pb-24">
      <div className="px-4 pt-8 pb-4 bg-gradient-to-b from-[#0d0d0d] to-[#080808]">
        <div className="flex items-start justify-between mb-1">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest font-medium">Property Empire</p>
            <h1 className="text-2xl font-bold text-white mt-0.5">{stats.level}</h1>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Credit Score</p>
            <p className="text-lg font-bold text-emerald-400">{stats.creditScore}</p>
          </div>
        </div>

        <div className="mt-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-gray-500">{stats.xp.toLocaleString()} XP</span>
            {nextLevel ? (
              <span className="text-xs text-gray-500">{xpNeeded.toLocaleString()} XP → {nextLevel}</span>
            ) : (
              <span className="text-xs text-yellow-400">MAX LEVEL</span>
            )}
          </div>
          <Progress value={xpProgress} barClassName="gold-bg" className="h-2" />
        </div>
      </div>

      <div className="px-4 space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-gradient-to-br from-yellow-950/80 to-[#111] border border-yellow-800/30 p-5 relative overflow-hidden shimmer"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-600/5 rounded-full -translate-y-8 translate-x-8" />
          <p className="text-xs text-yellow-600 uppercase tracking-widest font-medium">Available Cash</p>
          <p className="text-4xl font-black text-yellow-300 mt-1">{formatCurrencyFull(stats.cash)}</p>
          <p className="text-xs text-gray-500 mt-1">Liquid capital ready to deploy</p>
        </motion.div>

        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Net Worth"
            value={formatCurrency(stats.netWorth)}
            icon="💎"
            trend="up"
            subValue="Total equity"
          />
          <StatCard
            label="Monthly Cash Flow"
            value={`${stats.monthlyCashFlow >= 0 ? '+' : ''}${formatCurrency(stats.monthlyCashFlow)}`}
            icon="💸"
            trend={stats.monthlyCashFlow > 0 ? 'up' : stats.monthlyCashFlow < 0 ? 'down' : 'neutral'}
            subValue="From rentals"
          />
          <StatCard
            label="Portfolio"
            value={`${stats.portfolio.length} properties`}
            icon="🏘️"
            subValue={`${rentableProperties.length} rented`}
          />
          <StatCard
            label="Deals Done"
            value={stats.dealsCompleted.toString()}
            icon="🤝"
            subValue={`$${formatCurrency(stats.flipProfits)} flipped`}
          />
        </div>

        {rentableProperties.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <button
              onClick={collectRent}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-950 to-emerald-900 border border-emerald-700/40 text-emerald-300 font-bold text-lg flex items-center justify-center gap-3 hover:from-emerald-900 hover:to-emerald-800 transition-all active:scale-98"
            >
              <span className="text-2xl">💰</span>
              Collect Monthly Rent
              <span className="text-sm font-normal text-emerald-400">
                +{formatCurrencyFull(stats.monthlyCashFlow)}
              </span>
            </button>
          </motion.div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Button variant="gold" size="lg" className="w-full" onClick={handleFindDeals}>
            🔍 Find Deals
          </Button>
          <Button variant="surface" size="lg" className="w-full" onClick={() => setScreen('portfolio')}>
            📊 Portfolio
          </Button>
        </div>

        {stats.portfolio.filter(p => ['owned', 'renovating'].includes(p.status)).length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-400 mb-2 uppercase tracking-wide">Active Projects</h2>
            <div className="space-y-2">
              {stats.portfolio.filter(p => ['owned', 'renovating'].includes(p.status)).map(property => (
                <div key={property.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-[#111] border border-[#222] cursor-pointer hover:border-yellow-800/40 transition-colors"
                  onClick={() => { useGameStore.getState().pendingExitStrategy = property; setScreen('exit_strategy'); }}
                >
                  <div>
                    <p className="text-sm font-medium text-white">{property.address}</p>
                    <p className="text-xs text-gray-500">{property.status === 'renovating' ? '🔨 Renovating' : '🏠 Owned — Choose exit'}</p>
                  </div>
                  <span className="text-yellow-400 text-xs font-bold">→</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {unreadEvents.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-400 mb-2 uppercase tracking-wide">Market Events</h2>
            <div className="space-y-2">
              {unreadEvents.slice(0, 3).map(event => (
                <div key={event.id} className="p-3 rounded-xl bg-[#111] border border-amber-800/30">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-bold text-amber-300">{event.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{event.description}</p>
                      <p className="text-xs text-amber-400 mt-1 font-medium">{event.effect}</p>
                    </div>
                    <button onClick={() => dismissEvent(event.id)} className="text-gray-600 hover:text-gray-400 ml-2 text-xs">✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {stats.activity.length > 0 && (
          <div className="pb-4">
            <h2 className="text-sm font-semibold text-gray-400 mb-2 uppercase tracking-wide">Recent Activity</h2>
            <div className="space-y-2">
              {stats.activity.slice(0, 5).map(entry => (
                <div key={entry.id} className="flex items-center justify-between p-3 rounded-xl bg-[#111] border border-[#1e1e1e]">
                  <div>
                    <p className="text-sm font-medium text-white">{entry.title}</p>
                    <p className="text-xs text-gray-500">{entry.description}</p>
                  </div>
                  {entry.amount !== undefined && (
                    <span className={`text-sm font-bold ${entry.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {entry.amount >= 0 ? '+' : ''}{formatCurrency(entry.amount)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {stats.portfolio.length === 0 && stats.activity.length === 0 && (
          <div className="text-center py-8">
            <p className="text-4xl mb-3">🏗️</p>
            <p className="text-white font-bold">Start Building Your Empire</p>
            <p className="text-gray-500 text-sm mt-1">Find your first deal in the market</p>
            <Button variant="gold" size="lg" className="mt-4" onClick={handleFindDeals}>
              Browse Deals
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
