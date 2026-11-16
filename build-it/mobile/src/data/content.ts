// Typed access to the guidance in content.json (generated from ../content.js, shared with the web app).
import raw from './content.json';

export type Step = {
  id: string;
  t: string;
  d: string;
  pro: string;
  /** Inspection hold point: nothing gets covered, poured or paid until it passes. */
  gate?: boolean;
  /** Never skip. */
  crit?: boolean;
};

export type Phase = {
  id: string;
  name: string;
  days: string;
  blurb: string;
  who: string[];
  steps: Step[];
};

export type LotItem = { id: string; t: string; how: string };
export type LotGroup = { name: string; items: LotItem[] };

export type Permit = {
  id: string;
  t: string;
  by: string;
  stage: string;
  when?: Partial<Record<string, string | boolean>>;
};

export type Principle = { t: string; phase: string; d: string };

type Content = {
  PHASES: Phase[];
  LOT_GROUPS: LotGroup[];
  PERMITS: Permit[];
  VETTING: string[];
  CONTRACT: [string, string][];
  RED_FLAGS: string[];
  PAY_RULES: [string, string][];
  PRINCIPLES: Principle[];
  COST_SPLIT: [string, number][];
  DRAWS: [string, number, string][];
};

const content = raw as unknown as Content;

export const {
  PHASES,
  LOT_GROUPS,
  PERMITS,
  VETTING,
  CONTRACT,
  RED_FLAGS,
  PAY_RULES,
  PRINCIPLES,
  COST_SPLIT,
  DRAWS,
} = content;

export type StepRef = Step & { phase: string; pi: number };

/** Every step in build order, with its phase. */
export const ALL_STEPS: StepRef[] = PHASES.flatMap((p, pi) =>
  p.steps.map((s) => ({ ...s, phase: p.id, pi })),
);
