import { RandomEvent, RandomEventType } from './types';
import { uniqueId } from './utils';

const EVENTS: Array<{
  type: RandomEventType;
  title: string;
  description: string;
  effect: string;
  cashEffect?: number;
  valueEffect?: number;
  rentEffect?: number;
  weight: number;
}> = [
  {
    type: 'market_boom',
    title: '🚀 Market Boom!',
    description: 'A major tech company announced it\'s relocating its headquarters to the area, creating 5,000 jobs.',
    effect: 'All property values +8%',
    valueEffect: 0.08,
    rentEffect: 0.05,
    weight: 10,
  },
  {
    type: 'market_crash',
    title: '📉 Market Correction',
    description: 'Rising interest rates have cooled buyer demand. Properties are sitting longer and values are dipping.',
    effect: 'All property values -5%',
    valueEffect: -0.05,
    rentEffect: -0.02,
    weight: 8,
  },
  {
    type: 'interest_rate_spike',
    title: '📈 Interest Rate Hike',
    description: 'The Federal Reserve raised rates by 0.75%. Financing costs have increased.',
    effect: 'Financing becomes more expensive',
    cashEffect: -2000,
    weight: 12,
  },
  {
    type: 'tenant_damage',
    title: '🔨 Tenant Damage',
    description: 'One of your tenants caused significant damage before moving out. Repairs needed.',
    effect: 'Emergency repair cost: -$3,500',
    cashEffect: -3500,
    weight: 9,
  },
  {
    type: 'new_employer',
    title: '🏢 New Employer Arrives',
    description: 'A major distribution center is opening nearby, bringing 800 new jobs and housing demand.',
    effect: 'Rental income +6% in affected areas',
    rentEffect: 0.06,
    weight: 10,
  },
  {
    type: 'housing_shortage',
    title: '🏘️ Housing Shortage',
    description: 'Low inventory has driven rental rates up across your market.',
    effect: 'Rent rates +4% market-wide',
    rentEffect: 0.04,
    weight: 11,
  },
  {
    type: 'property_tax_increase',
    title: '💸 Property Tax Increase',
    description: 'The city council passed a budget that increases property taxes by 15%.',
    effect: 'Annual expenses increase',
    cashEffect: -1500,
    weight: 10,
  },
];

export function shouldGenerateEvent(lastEventDate?: string): boolean {
  if (!lastEventDate) return Math.random() < 0.3;
  const last = new Date(lastEventDate);
  const now = new Date();
  const daysDiff = (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24);
  if (daysDiff < 2) return false;
  return Math.random() < 0.2;
}

export function generateRandomEvent(): RandomEvent {
  const totalWeight = EVENTS.reduce((sum, e) => sum + e.weight, 0);
  let random = Math.random() * totalWeight;

  for (const event of EVENTS) {
    random -= event.weight;
    if (random <= 0) {
      return {
        id: uniqueId(),
        type: event.type,
        title: event.title,
        description: event.description,
        effect: event.effect,
        cashEffect: event.cashEffect,
        valueEffect: event.valueEffect,
        rentEffect: event.rentEffect,
        date: new Date().toISOString(),
        read: false,
      };
    }
  }

  return {
    id: uniqueId(),
    type: 'housing_shortage',
    title: '🏘️ Housing Shortage',
    description: 'Low inventory has driven rental rates up.',
    effect: 'Rent +4%',
    rentEffect: 0.04,
    date: new Date().toISOString(),
    read: false,
  };
}
