import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { InvestorLevel, LEVEL_ORDER, LEVEL_THRESHOLDS, PlayerStats } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  if (Math.abs(amount) >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(2)}M`;
  }
  if (Math.abs(amount) >= 1_000) {
    return `$${(amount / 1_000).toFixed(0)}K`;
  }
  return `$${amount.toFixed(0)}`;
}

export function formatCurrencyFull(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(n));
}

export function getNextLevel(current: InvestorLevel): InvestorLevel | null {
  const idx = LEVEL_ORDER.indexOf(current);
  if (idx >= LEVEL_ORDER.length - 1) return null;
  return LEVEL_ORDER[idx + 1];
}

export function getXpForNextLevel(current: InvestorLevel): number {
  const next = getNextLevel(current);
  if (!next) return LEVEL_THRESHOLDS[current];
  return LEVEL_THRESHOLDS[next];
}

export function getLevelFromXp(xp: number): InvestorLevel {
  let level: InvestorLevel = 'Rookie Investor';
  for (const lvl of LEVEL_ORDER) {
    if (xp >= LEVEL_THRESHOLDS[lvl]) level = lvl;
  }
  return level;
}

export function calcXpProgress(xp: number, level: InvestorLevel): number {
  const currentThreshold = LEVEL_THRESHOLDS[level];
  const next = getNextLevel(level);
  if (!next) return 100;
  const nextThreshold = LEVEL_THRESHOLDS[next];
  return Math.min(100, ((xp - currentThreshold) / (nextThreshold - currentThreshold)) * 100);
}

export function calcNetWorth(stats: PlayerStats): number {
  const portfolioValue = stats.portfolio.reduce((sum, p) => {
    return sum + (p.currentValue ?? p.purchasePrice ?? 0);
  }, 0);
  const totalDebt = stats.portfolio.reduce((sum, p) => {
    return sum + (p.loanAmount ?? 0);
  }, 0);
  return stats.cash + portfolioValue - totalDebt;
}

export function calcMonthlyCashFlow(stats: PlayerStats): number {
  return stats.portfolio
    .filter(p => p.status === 'rented')
    .reduce((sum, p) => sum + (p.monthlyCashFlow ?? 0), 0);
}

export function gradeProperty(arv: number, askingPrice: number, repairs: number): string {
  const mao = arv * 0.7 - repairs;
  const ratio = askingPrice / mao;
  if (ratio <= 0.85) return 'A';
  if (ratio <= 0.95) return 'B';
  if (ratio <= 1.05) return 'C';
  if (ratio <= 1.15) return 'D';
  return 'F';
}

export function conditionLabel(score: number): string {
  if (score >= 8) return 'Excellent';
  if (score >= 6) return 'Good';
  if (score >= 4) return 'Fair';
  if (score >= 2) return 'Poor';
  return 'Distressed';
}

export function uniqueId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
