'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useGameStore } from '@/store/gameStore';

export function SplashScreen({ onStart }: { onStart: () => void }) {
  const { resetGame } = useGameStore();
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div className="min-h-screen bg-[#080808] flex flex-col items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-yellow-600/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 left-1/3 w-64 h-64 bg-emerald-600/5 rounded-full blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="text-center relative z-10"
      >
        <motion.div
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
          className="text-7xl mb-6"
        >
          🏰
        </motion.div>

        <h1 className="text-4xl font-black text-white leading-none mb-1">
          PROPERTY
        </h1>
        <h2 className="text-5xl font-black gold-gradient leading-none mb-6">
          EMPIRE
        </h2>
        <p className="text-gray-400 text-base max-w-xs mx-auto leading-relaxed">
          Start with $50,000. Build a real estate empire through smart deals, tough negotiations, and strategic investing.
        </p>

        <div className="mt-8 space-y-3">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#111] border border-[#222] text-left">
            <span className="text-2xl">🔍</span>
            <div>
              <p className="text-sm font-bold text-white">Find Deals</p>
              <p className="text-xs text-gray-500">Discover motivated sellers in the market</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#111] border border-[#222] text-left">
            <span className="text-2xl">🤝</span>
            <div>
              <p className="text-sm font-bold text-white">Negotiate</p>
              <p className="text-xs text-gray-500">Master the art of the deal</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#111] border border-[#222] text-left">
            <span className="text-2xl">🔨</span>
            <div>
              <p className="text-sm font-bold text-white">Renovate &amp; Scale</p>
              <p className="text-xs text-gray-500">Flip for profit or hold for cash flow</p>
            </div>
          </div>
        </div>

        <div className="mt-8 space-y-3">
          <Button variant="gold" size="lg" className="w-full text-lg font-black" onClick={onStart}>
            🚀 Start Building Your Empire
          </Button>

          {!confirmReset ? (
            <button onClick={() => setConfirmReset(true)} className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
              Reset saved game
            </button>
          ) : (
            <div className="flex gap-2">
              <Button variant="danger" size="sm" className="flex-1" onClick={() => { resetGame(); setConfirmReset(false); }}>
                Confirm Reset
              </Button>
              <Button variant="ghost" size="sm" className="flex-1" onClick={() => setConfirmReset(false)}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
