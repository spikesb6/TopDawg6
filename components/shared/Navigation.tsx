'use client';

import { useGameStore } from '@/store/gameStore';
import { Screen } from '@/lib/types';
import { cn } from '@/lib/utils';

const NAV_ITEMS: { screen: Screen; label: string; icon: string }[] = [
  { screen: 'dashboard', label: 'Home', icon: '🏠' },
  { screen: 'deal_feed', label: 'Deals', icon: '🔍' },
  { screen: 'portfolio', label: 'Portfolio', icon: '📊' },
];

export function Navigation() {
  const { screen, setScreen, refreshDeals, stats } = useGameStore();

  const handleNav = (s: Screen) => {
    if (s === 'deal_feed' && stats.listedProperties.length === 0) {
      refreshDeals();
    }
    setScreen(s);
  };

  const unreadEvents = stats.events.filter(e => !e.read).length;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#0a0a0a] border-t border-[#1a1a1a] max-w-md mx-auto">
      <div className="flex items-center">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.screen}
            onClick={() => handleNav(item.screen)}
            className={cn(
              'flex-1 flex flex-col items-center gap-0.5 py-3 transition-all',
              screen === item.screen ? 'text-yellow-400' : 'text-gray-600 hover:text-gray-400'
            )}
          >
            <span className="text-xl relative">
              {item.icon}
              {item.screen === 'dashboard' && unreadEvents > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full text-[8px] font-bold flex items-center justify-center text-white">
                  {unreadEvents}
                </span>
              )}
            </span>
            <span className="text-[10px] font-medium">{item.label}</span>
            {screen === item.screen && (
              <span className="w-4 h-0.5 rounded-full bg-yellow-400 mt-0.5" />
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}
