'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  PlayerStats, Property, Screen, NegotiationState,
  FinancingType, RehabCategory, ExitStrategy, ActivityEntry, InvestorLevel,
} from '@/lib/types';
import { generateDealFeed } from '@/lib/propertyGenerator';
import { processNegotiationAction, initNegotiationState } from '@/lib/negotiationEngine';
import { generateRandomEvent, shouldGenerateEvent } from '@/lib/randomEvents';
import { calcNetWorth, calcMonthlyCashFlow, getLevelFromXp, uniqueId } from '@/lib/utils';
import { NegotiationAction } from '@/lib/types';

const INITIAL_STATS: PlayerStats = {
  cash: 50000,
  netWorth: 50000,
  monthlyCashFlow: 0,
  xp: 0,
  level: 'Rookie Investor',
  creditScore: 650,
  dealsCompleted: 0,
  flipProfits: 0,
  totalRentalIncome: 0,
  portfolio: [],
  listedProperties: [],
  activity: [],
  events: [],
  gameMonth: 1,
  gameYear: 2024,
};

interface GameStore {
  stats: PlayerStats;
  screen: Screen;
  selectedProperty: Property | null;
  negotiationState: NegotiationState | null;
  pendingAcquisition: { property: Property; agreedPrice: number } | null;
  pendingRehab: Property | null;
  pendingExitStrategy: Property | null;
  notification: { message: string; type: 'success' | 'error' | 'info' | 'gold' } | null;

  setScreen: (screen: Screen) => void;
  selectProperty: (property: Property) => void;
  refreshDeals: () => void;
  startNegotiation: (property: Property) => void;
  performNegotiationAction: (action: NegotiationAction, offerAmount?: number) => void;
  acceptDeal: () => void;
  acquireProperty: (property: Property, price: number, financing: FinancingType) => void;
  startRehab: (property: Property, plan: RehabCategory[]) => void;
  completeRehab: (propertyId: string) => void;
  flipProperty: (property: Property) => void;
  rentProperty: (property: Property) => void;
  collectRent: () => void;
  checkForEvents: () => void;
  dismissEvent: (eventId: string) => void;
  showNotification: (message: string, type?: 'success' | 'error' | 'info' | 'gold') => void;
  clearNotification: () => void;
  addActivity: (entry: Omit<ActivityEntry, 'id' | 'date'>) => void;
  resetGame: () => void;
}

function addXp(stats: PlayerStats, amount: number): PlayerStats {
  const newXp = stats.xp + amount;
  const newLevel = getLevelFromXp(newXp);
  return { ...stats, xp: newXp, level: newLevel };
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      stats: INITIAL_STATS,
      screen: 'dashboard',
      selectedProperty: null,
      negotiationState: null,
      pendingAcquisition: null,
      pendingRehab: null,
      pendingExitStrategy: null,
      notification: null,

      setScreen: (screen) => set({ screen }),

      selectProperty: (property) => set({ selectedProperty: property }),

      refreshDeals: () => {
        const { stats } = get();
        const newDeals = generateDealFeed(stats.level, 6);
        set((s) => ({
          stats: { ...s.stats, listedProperties: newDeals },
        }));
      },

      startNegotiation: (property) => {
        const negotiationState = initNegotiationState(property);
        set({ negotiationState, selectedProperty: property, screen: 'negotiation' });
      },

      performNegotiationAction: (action, offerAmount) => {
        const { negotiationState, selectedProperty } = get();
        if (!negotiationState || !selectedProperty) return;

        const newState = processNegotiationAction(negotiationState, selectedProperty, action, offerAmount);
        set({ negotiationState: newState });

        if (newState.dealAccepted && newState.agreedPrice) {
          setTimeout(() => {
            set({
              pendingAcquisition: { property: selectedProperty, agreedPrice: newState.agreedPrice! },
              screen: 'acquisition',
            });
          }, 1500);
        }
      },

      acceptDeal: () => {
        const { negotiationState, selectedProperty } = get();
        if (!negotiationState || !selectedProperty || !negotiationState.agreedPrice) return;
        set({
          pendingAcquisition: { property: selectedProperty, agreedPrice: negotiationState.agreedPrice },
          screen: 'acquisition',
        });
      },

      acquireProperty: (property, price, financing) => {
        const { stats } = get();

        let loanAmount = 0;
        let interestRate = 0;
        let monthlyPayment = 0;
        let cashNeeded = price;

        if (financing === 'hard_money') {
          loanAmount = price * 0.9;
          interestRate = 0.12;
          monthlyPayment = loanAmount * (interestRate / 12);
          cashNeeded = price * 0.1 + price * 0.02;
        } else if (financing === 'conventional') {
          loanAmount = price * 0.8;
          interestRate = 0.07;
          const r = interestRate / 12;
          const n = 360;
          monthlyPayment = loanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
          cashNeeded = price * 0.2 + price * 0.03;
        } else if (financing === 'private_money') {
          loanAmount = price * 0.85;
          interestRate = 0.10;
          monthlyPayment = loanAmount * (interestRate / 12);
          cashNeeded = price * 0.15 + price * 0.01;
        }

        if (stats.cash < cashNeeded) {
          get().showNotification('Not enough cash for this acquisition!', 'error');
          return;
        }

        const acquiredProperty: Property = {
          ...property,
          status: 'owned',
          purchasePrice: price,
          purchaseDate: new Date().toISOString(),
          financingType: financing,
          loanAmount: loanAmount > 0 ? loanAmount : undefined,
          interestRate: interestRate > 0 ? interestRate : undefined,
          monthlyPayment: monthlyPayment > 0 ? monthlyPayment : undefined,
          currentValue: property.arv * 0.85,
          totalInvested: cashNeeded,
        };

        const newStats = {
          ...stats,
          cash: stats.cash - cashNeeded,
          portfolio: [...stats.portfolio, acquiredProperty],
          listedProperties: stats.listedProperties.filter(p => p.id !== property.id),
        };

        const withXp = addXp(newStats, 100);
        const netWorth = calcNetWorth(withXp);

        get().addActivity({
          type: 'purchase',
          title: `Acquired ${property.address}`,
          description: `${financing === 'cash' ? 'Cash purchase' : financing.replace('_', ' ')} at $${price.toLocaleString()}`,
          amount: -cashNeeded,
        });

        set({
          stats: { ...withXp, netWorth },
          screen: 'rehab',
          pendingRehab: acquiredProperty,
          pendingAcquisition: null,
        });

        get().showNotification(`Property acquired! Now let's plan the renovation.`, 'gold');
      },

      startRehab: (property, plan) => {
        const { stats } = get();
        const totalCost = plan.reduce((sum, cat) => {
          if (!cat.selected) return sum;
          const costs = { budget: cat.budgetCost, standard: cat.standardCost, luxury: cat.luxuryCost };
          return sum + costs[cat.selected];
        }, 0);

        const totalDays = plan.reduce((max, cat) => {
          if (!cat.selected) return max;
          const days = { budget: cat.budgetTimeDays, standard: cat.standardTimeDays, luxury: cat.luxuryTimeDays };
          return Math.max(max, days[cat.selected]);
        }, 0);

        if (stats.cash < totalCost) {
          get().showNotification('Not enough cash for this renovation plan!', 'error');
          return;
        }

        const valueBoost = plan.reduce((boost, cat) => {
          if (!cat.selected) return boost;
          const multipliers = { budget: 1.5, standard: 2.0, luxury: 2.8 };
          const costs = { budget: cat.budgetCost, standard: cat.standardCost, luxury: cat.luxuryCost };
          return boost + (costs[cat.selected] * multipliers[cat.selected]);
        }, 0);

        const updatedProperty: Property = {
          ...property,
          status: 'renovating',
          rehabPlan: plan,
          rehabCost: totalCost,
          rehabDaysRemaining: totalDays,
          rehabStartDate: new Date().toISOString(),
          rehabComplete: false,
          currentValue: (property.currentValue ?? property.arv * 0.85) + valueBoost,
          totalInvested: (property.totalInvested ?? 0) + totalCost,
        };

        const newPortfolio = stats.portfolio.map(p =>
          p.id === property.id ? updatedProperty : p
        );

        set((s) => ({
          stats: {
            ...s.stats,
            cash: s.stats.cash - totalCost,
            portfolio: newPortfolio,
          },
          pendingRehab: null,
          pendingExitStrategy: updatedProperty,
          screen: 'exit_strategy',
        }));

        get().showNotification(`Renovation started! $${totalCost.toLocaleString()} invested.`, 'success');
      },

      completeRehab: (propertyId) => {
        const { stats } = get();
        const newPortfolio = stats.portfolio.map(p => {
          if (p.id !== propertyId) return p;
          return { ...p, status: 'owned' as const, rehabComplete: true, rehabDaysRemaining: 0 };
        });
        set((s) => ({ stats: { ...s.stats, portfolio: newPortfolio } }));
      },

      flipProperty: (property) => {
        const { stats } = get();
        const sellPrice = property.currentValue ?? property.arv;
        const totalInvested = property.totalInvested ?? property.purchasePrice ?? 0;
        const loanPayoff = property.loanAmount ?? 0;
        const profit = sellPrice - totalInvested - loanPayoff;

        const newPortfolio = stats.portfolio.filter(p => p.id !== property.id);
        const soldProperty: Property = {
          ...property,
          status: 'sold',
          sellPrice,
          sellDate: new Date().toISOString(),
          profit,
        };

        const newStats = {
          ...stats,
          cash: stats.cash + sellPrice - loanPayoff,
          portfolio: newPortfolio,
          dealsCompleted: stats.dealsCompleted + 1,
          flipProfits: stats.flipProfits + profit,
        };

        const withXp = addXp(newStats, 200 + Math.floor(profit / 1000));
        const netWorth = calcNetWorth(withXp);

        get().addActivity({
          type: 'sale',
          title: `Sold ${property.address}`,
          description: `Flip profit: $${profit.toLocaleString()}`,
          amount: profit,
        });

        const leveled = withXp.level !== stats.level;

        set({
          stats: { ...withXp, netWorth },
          pendingExitStrategy: null,
          screen: 'portfolio',
        });

        if (leveled) {
          get().showNotification(`🎉 Level Up! You're now a ${withXp.level}!`, 'gold');
        } else {
          get().showNotification(`Property sold! Profit: $${profit.toLocaleString()}`, 'success');
        }
      },

      rentProperty: (property) => {
        const { stats } = get();
        const monthlyRent = property.estimatedRent;
        const expenses = (property.monthlyPayment ?? 0) + monthlyRent * 0.35;
        const cashFlow = monthlyRent - expenses;

        const rentedProperty: Property = {
          ...property,
          status: 'rented',
          monthlyRent,
          monthlyExpenses: expenses,
          monthlyCashFlow: cashFlow,
        };

        const newPortfolio = stats.portfolio.map(p =>
          p.id === property.id ? rentedProperty : p
        );

        const newStats = { ...stats, portfolio: newPortfolio };
        const withXp = addXp(newStats, 150);
        const netWorth = calcNetWorth(withXp);
        const monthlyCashFlow = calcMonthlyCashFlow(withXp);

        get().addActivity({
          type: 'rental',
          title: `${property.address} Now Rented`,
          description: `Monthly cash flow: $${cashFlow.toFixed(0)}`,
          amount: cashFlow,
        });

        set({
          stats: { ...withXp, netWorth, monthlyCashFlow },
          pendingExitStrategy: null,
          screen: 'portfolio',
        });

        get().showNotification(`Property rented! +$${cashFlow.toFixed(0)}/month cash flow`, 'success');
      },

      collectRent: () => {
        const { stats } = get();
        const totalRent = stats.portfolio
          .filter(p => p.status === 'rented')
          .reduce((sum, p) => sum + (p.monthlyCashFlow ?? 0), 0);

        if (totalRent <= 0) {
          get().showNotification('No rental income to collect.', 'info');
          return;
        }

        const newStats = addXp(
          { ...stats, cash: stats.cash + totalRent, totalRentalIncome: stats.totalRentalIncome + totalRent },
          50
        );

        const appreciated = newStats.portfolio.map(p => {
          if (p.status === 'rented' || p.status === 'owned') {
            const newVal = (p.currentValue ?? p.arv) * 1.003;
            return { ...p, currentValue: newVal, equity: newVal - (p.loanAmount ?? 0) };
          }
          return p;
        });

        const withPortfolio = { ...newStats, portfolio: appreciated };
        const netWorth = calcNetWorth(withPortfolio);

        get().addActivity({
          type: 'rental',
          title: 'Monthly Rent Collected',
          description: `$${totalRent.toFixed(0)} from ${stats.portfolio.filter(p => p.status === 'rented').length} properties`,
          amount: totalRent,
        });

        set({ stats: { ...withPortfolio, netWorth } });
        get().showNotification(`Collected $${totalRent.toFixed(0)} in rent!`, 'gold');
      },

      checkForEvents: () => {
        const { stats } = get();
        if (!shouldGenerateEvent(stats.lastEventDate)) return;

        const event = generateRandomEvent();
        let newStats = { ...stats };

        if (event.cashEffect) {
          newStats = { ...newStats, cash: newStats.cash + event.cashEffect };
        }

        if (event.valueEffect) {
          newStats = {
            ...newStats,
            portfolio: newStats.portfolio.map(p => ({
              ...p,
              currentValue: (p.currentValue ?? p.arv) * (1 + event.valueEffect!),
            })),
          };
        }

        if (event.rentEffect) {
          newStats = {
            ...newStats,
            portfolio: newStats.portfolio.map(p => {
              if (p.status !== 'rented') return p;
              const newRent = (p.monthlyRent ?? 0) * (1 + event.rentEffect!);
              const newCashFlow = newRent - (p.monthlyExpenses ?? 0);
              return { ...p, monthlyRent: newRent, monthlyCashFlow: newCashFlow };
            }),
          };
        }

        const netWorth = calcNetWorth(newStats);
        const monthlyCashFlow = calcMonthlyCashFlow(newStats);

        set((s) => ({
          stats: {
            ...newStats,
            netWorth,
            monthlyCashFlow,
            events: [event, ...s.stats.events].slice(0, 20),
            lastEventDate: new Date().toISOString(),
          },
        }));
      },

      dismissEvent: (eventId) => {
        set((s) => ({
          stats: {
            ...s.stats,
            events: s.stats.events.map(e => e.id === eventId ? { ...e, read: true } : e),
          },
        }));
      },

      showNotification: (message, type = 'success') => {
        set({ notification: { message, type } });
        setTimeout(() => get().clearNotification(), 3000);
      },

      clearNotification: () => set({ notification: null }),

      addActivity: (entry) => {
        const activity: ActivityEntry = {
          ...entry,
          id: uniqueId(),
          date: new Date().toISOString(),
        };
        set((s) => ({
          stats: {
            ...s.stats,
            activity: [activity, ...s.stats.activity].slice(0, 50),
          },
        }));
      },

      resetGame: () => {
        set({
          stats: INITIAL_STATS,
          screen: 'dashboard',
          selectedProperty: null,
          negotiationState: null,
          pendingAcquisition: null,
          pendingRehab: null,
          pendingExitStrategy: null,
          notification: null,
        });
      },
    }),
    {
      name: 'property-empire-save',
      version: 1,
    }
  )
);
