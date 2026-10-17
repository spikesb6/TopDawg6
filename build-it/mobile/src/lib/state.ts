// The saved build. Same shape as the web app's, so a backup code moves between them.

export type Utilities = 'public' | 'private';
export type Waiver = 'none' | 'conditional' | 'unconditional';
export type LotValue = 'unknown' | 'ok' | 'concern' | 'nogo';
export type PermitStatus = 'todo' | 'applied' | 'approved' | 'na';

export type Profile = {
  name: string;
  location: string;
  sqft: number;
  stories: string;
  foundation: 'slab' | 'crawl' | 'basement';
  route: 'gc' | 'owner';
  utilities: Utilities;
  hoa: boolean;
  flood: boolean;
  acre: boolean;
  trees: boolean;
  demo: boolean;
  gas: boolean;
};

export type Budget = {
  land: number;
  sqft: number;
  cpsf: number;
  site: number;
  softPct: number;
  contPct: number;
  downPct: number;
  rate: number;
  months: number;
  extras: number;
};

export type Payment = {
  id: string;
  date: string;
  payee: string;
  phase: string;
  amount: number;
  waiver: Waiver;
  inspected: boolean;
  example?: boolean;
};

export type BuildState = {
  profile: Profile;
  done: Record<string, boolean>;
  notes: Record<string, string>;
  lot: Record<string, LotValue>;
  permits: Record<string, PermitStatus>;
  vet: Record<string, boolean>;
  budget: Budget;
  payments: Payment[];
  retainPct: number;
};

export const EXAMPLE_PAYMENTS: Payment[] = [
  { id: 'x1', date: '2026-03-04', payee: 'Ridgeline Excavating', phase: 'site', amount: 18400, waiver: 'unconditional', inspected: true, example: true },
  { id: 'x2', date: '2026-03-28', payee: 'Ridgeline Excavating', phase: 'foundation', amount: 9600, waiver: 'conditional', inspected: true, example: true },
  { id: 'x3', date: '2026-04-15', payee: 'Stonebridge Concrete', phase: 'foundation', amount: 31250, waiver: 'none', inspected: false, example: true },
];

export function freshState(): BuildState {
  return {
    profile: {
      name: '', location: '', sqft: 2200, stories: '1', foundation: 'slab', route: 'gc',
      utilities: 'public', hoa: false, flood: false, acre: false, trees: false, demo: false, gas: true,
    },
    done: {}, notes: {}, lot: {}, permits: {}, vet: {},
    budget: { land: 85000, sqft: 2200, cpsf: 210, site: 30000, softPct: 10, contPct: 12, downPct: 20, rate: 7.5, months: 10, extras: 25000 },
    payments: EXAMPLE_PAYMENTS.slice(),
    retainPct: 10,
  };
}

/** Fills in anything an older or partial save is missing. */
export function mergeState(saved: Partial<BuildState>): BuildState {
  const f = freshState();
  return {
    ...f,
    ...saved,
    profile: { ...f.profile, ...saved.profile },
    budget: { ...f.budget, ...saved.budget },
  };
}
