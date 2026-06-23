'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { Navigation } from '@/components/shared/Navigation';
import { Notification } from '@/components/shared/Notification';
import { SplashScreen } from '@/components/game/SplashScreen';
import { Dashboard } from '@/components/game/Dashboard';
import { DealFeed } from '@/components/game/DealFeed';
import { PropertyDetail } from '@/components/game/PropertyDetail';
import { NegotiationEngine } from '@/components/game/NegotiationEngine';
import { AcquisitionScreen } from '@/components/game/AcquisitionScreen';
import { RehabSystem } from '@/components/game/RehabSystem';
import { ExitStrategy } from '@/components/game/ExitStrategy';
import { Portfolio } from '@/components/game/Portfolio';

const NAV_SCREENS = ['dashboard', 'deal_feed', 'portfolio'];

export default function Home() {
  const { screen, checkForEvents, refreshDeals, stats } = useGameStore();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    if (stats.activity.length > 0 || stats.portfolio.length > 0) {
      setShowSplash(false);
    }
  }, []);

  useEffect(() => {
    if (!showSplash) {
      if (stats.listedProperties.length === 0) refreshDeals();
      checkForEvents();
    }
  }, [showSplash]);

  if (showSplash) {
    return (
      <div className="max-w-md mx-auto">
        <SplashScreen onStart={() => setShowSplash(false)} />
      </div>
    );
  }

  const showNav = NAV_SCREENS.includes(screen);

  return (
    <main className="relative min-h-screen bg-[#080808] overflow-x-hidden max-w-md mx-auto">
      <Notification />

      <AnimatePresence mode="wait">
        <motion.div
          key={screen}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="min-h-screen"
        >
          {screen === 'dashboard' && <Dashboard />}
          {screen === 'deal_feed' && <DealFeed />}
          {screen === 'property_detail' && <PropertyDetail />}
          {screen === 'negotiation' && <NegotiationEngine />}
          {screen === 'acquisition' && <AcquisitionScreen />}
          {screen === 'rehab' && <RehabSystem />}
          {screen === 'exit_strategy' && <ExitStrategy />}
          {screen === 'portfolio' && <Portfolio />}
        </motion.div>
      </AnimatePresence>

      {showNav && <Navigation />}
    </main>
  );
}
