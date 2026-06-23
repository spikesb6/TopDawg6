'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { cn } from '@/lib/utils';

export function Notification() {
  const { notification, clearNotification } = useGameStore();

  const colors = {
    success: 'bg-emerald-900/90 border-emerald-600/50 text-emerald-100',
    error: 'bg-red-900/90 border-red-600/50 text-red-100',
    info: 'bg-blue-900/90 border-blue-600/50 text-blue-100',
    gold: 'bg-yellow-900/90 border-yellow-600/50 text-yellow-100',
  };

  return (
    <AnimatePresence>
      {notification && (
        <motion.div
          initial={{ opacity: 0, y: -60, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -40, scale: 0.9 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] max-w-sm w-[90%]"
          onClick={clearNotification}
        >
          <div className={cn('px-4 py-3 rounded-xl border backdrop-blur-lg text-sm font-medium text-center shadow-2xl', colors[notification.type])}>
            {notification.message}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
