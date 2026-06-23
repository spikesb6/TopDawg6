'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { Button } from '@/components/ui/button';
import { formatCurrencyFull, formatCurrency } from '@/lib/utils';
import { NegotiationAction } from '@/lib/types';

export function NegotiationEngine() {
  const { negotiationState, selectedProperty, performNegotiationAction, setScreen, stats } = useGameStore();
  const [offerInput, setOfferInput] = useState('');
  const [showOfferInput, setShowOfferInput] = useState(false);
  const [pendingAction, setPendingAction] = useState<NegotiationAction | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [negotiationState?.log]);

  if (!negotiationState || !selectedProperty) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#080808]">
        <Button variant="gold" onClick={() => setScreen('deal_feed')}>Back to Deals</Button>
      </div>
    );
  }

  const p = selectedProperty;
  const ns = negotiationState;
  const mao = Math.round(p.arv * 0.7 - p.repairEstimate);

  const handleAction = (action: NegotiationAction) => {
    if (action === 'make_offer' || action === 'counter_offer') {
      setPendingAction(action);
      setShowOfferInput(true);
      setOfferInput(String(ns.sellerCounterOffer));
      return;
    }
    performNegotiationAction(action);
  };

  const submitOffer = () => {
    const amount = parseInt(offerInput.replace(/[^0-9]/g, ''));
    if (!amount || amount < 1000) return;
    if (amount > stats.cash * 2) return;
    performNegotiationAction(pendingAction!, amount);
    setShowOfferInput(false);
    setPendingAction(null);
    setOfferInput('');
  };

  const trustPercent = ns.trustBuilt;
  const motivationPercent = ns.motivationRevealed;

  const actions: { action: NegotiationAction; label: string; icon: string; desc: string }[] = [
    { action: 'build_rapport', label: 'Build Rapport', icon: '🤝', desc: 'Establish trust & connection' },
    { action: 'ask_questions', label: 'Ask Questions', icon: '❓', desc: 'Learn their situation' },
    { action: 'explore_motivation', label: 'Explore Motivation', icon: '🔍', desc: 'Find their real reason to sell' },
    { action: 'make_offer', label: 'Make Offer', icon: '💵', desc: 'Submit a purchase price' },
    { action: 'counter_offer', label: 'Counter', icon: '⚖️', desc: 'Respond to their counter' },
    { action: 'walk_away', label: 'Walk Away', icon: '🚶', desc: 'Leave and see if they chase' },
  ];

  return (
    <div className="min-h-screen bg-[#080808] pb-24 flex flex-col">
      <div className="px-4 pt-8 pb-4 bg-gradient-to-b from-[#0d0d0d] to-[#080808] flex-shrink-0">
        <div className="flex items-center justify-between mb-1">
          <button onClick={() => setScreen('property_detail')} className="text-gray-400 hover:text-white">
            ← Back
          </button>
          <span className="text-xs text-gray-500">Round {ns.rounds}</span>
        </div>
        <h1 className="text-xl font-black text-white">{p.address}</h1>
        <p className="text-xs text-gray-500">Negotiating with {p.seller.name} · {p.seller.personality}</p>
      </div>

      <div className="px-4 mb-3 flex-shrink-0">
        <div className="grid grid-cols-3 gap-2">
          <div className="p-3 rounded-xl bg-[#111] border border-[#222] text-center">
            <p className="text-xs text-gray-500">Asking</p>
            <p className="text-sm font-bold text-white">{formatCurrency(p.seller.askingPrice)}</p>
          </div>
          <div className="p-3 rounded-xl bg-[#111] border border-[#222] text-center">
            <p className="text-xs text-gray-500">Their Counter</p>
            <p className="text-sm font-bold text-amber-300">{formatCurrency(ns.sellerCounterOffer)}</p>
          </div>
          <div className="p-3 rounded-xl bg-[#111] border border-[#222] text-center">
            <p className="text-xs text-gray-500">Your MAO</p>
            <p className="text-sm font-bold text-yellow-400">{formatCurrency(mao)}</p>
          </div>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="p-2 rounded-xl bg-[#111] border border-[#222]">
            <div className="flex justify-between mb-1">
              <span className="text-xs text-gray-500">Trust Built</span>
              <span className="text-xs text-blue-400 font-bold">{trustPercent.toFixed(0)}%</span>
            </div>
            <div className="h-1.5 bg-[#222] rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-blue-500 rounded-full"
                animate={{ width: `${trustPercent}%` }}
                transition={{ type: 'spring', damping: 20 }}
              />
            </div>
          </div>
          <div className="p-2 rounded-xl bg-[#111] border border-[#222]">
            <div className="flex justify-between mb-1">
              <span className="text-xs text-gray-500">Motivation</span>
              <span className="text-xs text-orange-400 font-bold">{motivationPercent.toFixed(0)}%</span>
            </div>
            <div className="h-1.5 bg-[#222] rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-orange-500 rounded-full"
                animate={{ width: `${motivationPercent}%` }}
                transition={{ type: 'spring', damping: 20 }}
              />
            </div>
          </div>
        </div>
      </div>

      <div
        ref={logRef}
        className="flex-1 px-4 overflow-y-auto space-y-2 mb-3 max-h-48 scrollbar-hide"
      >
        {ns.log.length === 0 && (
          <div className="text-center py-4">
            <p className="text-gray-500 text-sm">Introduce yourself and start building a relationship.</p>
          </div>
        )}
        <AnimatePresence>
          {ns.log.map((entry) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: entry.actor === 'player' ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`flex ${entry.actor === 'player' ? 'justify-start' : 'justify-end'}`}
            >
              <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                entry.actor === 'player'
                  ? 'bg-[#1a2a1a] border border-emerald-900/40 text-emerald-200'
                  : 'bg-[#1a1a2a] border border-blue-900/40 text-blue-200'
              }`}>
                {entry.actor === 'player' ? (
                  <span className="text-xs text-emerald-500 font-medium block mb-0.5">You → {entry.action}</span>
                ) : (
                  <span className="text-xs text-blue-500 font-medium block mb-0.5">{p.seller.name}</span>
                )}
                <p>{entry.message}</p>
                {entry.trustChange && entry.trustChange !== 0 && (
                  <span className={`text-xs mt-1 block ${entry.trustChange > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    Trust {entry.trustChange > 0 ? '+' : ''}{entry.trustChange}
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {ns.dealAccepted && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950 to-[#111] border border-emerald-600/40 text-center"
          >
            <p className="text-2xl mb-1">🎉</p>
            <p className="text-emerald-300 font-black text-lg">Deal Accepted!</p>
            <p className="text-white font-bold">{formatCurrencyFull(ns.agreedPrice!)}</p>
            <p className="text-gray-400 text-xs">Proceeding to acquisition...</p>
          </motion.div>
        )}
        {ns.dealRejected && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-4 rounded-2xl bg-[#1a0a0a] border border-red-900/40 text-center"
          >
            <p className="text-xl mb-1">💔</p>
            <p className="text-red-400 font-bold">Deal Lost</p>
            <p className="text-gray-400 text-xs">The seller wasn't ready to deal today.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setScreen('deal_feed')}>
              Find Another Deal
            </Button>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {showOfferInput && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="px-4 mb-3 flex-shrink-0"
          >
            <div className="p-4 rounded-2xl bg-[#111] border border-yellow-800/40">
              <p className="text-sm font-bold text-white mb-2">Your Offer Amount</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={offerInput}
                  onChange={e => setOfferInput(e.target.value)}
                  className="flex-1 bg-[#080808] border border-[#333] rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-yellow-600"
                  placeholder={`MAO: ${formatCurrencyFull(mao)}`}
                  min={1000}
                />
                <Button variant="gold" size="sm" onClick={submitOffer}>
                  Send
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setShowOfferInput(false); setPendingAction(null); }}>
                  ✕
                </Button>
              </div>
              <div className="flex gap-2 mt-2 flex-wrap">
                {[mao, Math.round(mao * 0.9), Math.round(p.seller.askingPrice * 0.85)].map(amt => (
                  <button
                    key={amt}
                    onClick={() => setOfferInput(String(amt))}
                    className="text-xs px-2 py-1 rounded-lg bg-[#1a1a1a] border border-[#333] text-yellow-400 hover:border-yellow-700"
                  >
                    {formatCurrency(amt)}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!ns.dealAccepted && !ns.dealRejected && !showOfferInput && (
        <div className="px-4 flex-shrink-0 grid grid-cols-2 gap-2">
          {actions.map(({ action, label, icon, desc }) => (
            <motion.button
              key={action}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleAction(action)}
              className={`p-3 rounded-xl border text-left transition-all ${
                action === 'walk_away'
                  ? 'bg-red-950/30 border-red-900/40 hover:border-red-700/40'
                  : action === 'make_offer' || action === 'counter_offer'
                  ? 'bg-yellow-950/30 border-yellow-800/40 hover:border-yellow-600/40'
                  : 'bg-[#111] border-[#222] hover:border-[#333]'
              }`}
            >
              <span className="text-lg">{icon}</span>
              <p className="text-xs font-bold text-white mt-1">{label}</p>
              <p className="text-[10px] text-gray-500">{desc}</p>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}
