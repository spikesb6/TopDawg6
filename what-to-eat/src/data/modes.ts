import type { IconName } from '@/components/icons';
import type { ModeKey } from '@/theme/theme';

export type Mode = {
  key: ModeKey;
  title: string;
  blurb: string;
  icon: IconName;
};

// Order and copy match the Home screen tiles in the prototype.
export const modes: Mode[] = [
  { key: 'cook', title: 'Cook it', blurb: 'Easy, 30 min or less', icon: 'chefHat' },
  { key: 'fast', title: 'Fast food', blurb: 'Quick and craveable', icon: 'burger' },
  { key: 'dine', title: 'Dine out', blurb: 'Sit down somewhere good', icon: 'forkKnife' },
  { key: 'deliv', title: 'Delivery', blurb: 'Couch mode', icon: 'bag' },
];

export const modesByKey = Object.fromEntries(modes.map((m) => [m.key, m])) as Record<ModeKey, Mode>;
