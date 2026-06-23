export type InvestorLevel =
  | 'Rookie Investor'
  | 'Wholesaler'
  | 'Rehabber'
  | 'Landlord'
  | 'Commercial Investor'
  | 'Developer'
  | 'Tycoon'
  | 'Empire Builder';

export type PropertyType =
  | 'Single Family'
  | 'Condo'
  | 'Duplex'
  | 'Triplex'
  | 'Fourplex'
  | 'Retail'
  | 'Office'
  | 'Industrial'
  | 'Waterfront'
  | 'Mansion'
  | 'Penthouse';

export type PropertyCondition = 'Distressed' | 'Poor' | 'Fair' | 'Good' | 'Excellent';
export type PropertyStatus = 'listed' | 'owned' | 'renovating' | 'rented' | 'sold';
export type ExitStrategy = 'flip' | 'rental' | null;
export type FinancingType = 'cash' | 'hard_money' | 'conventional' | 'private_money';
export type RehabTier = 'budget' | 'standard' | 'luxury';
export type SellerPersonality =
  | 'Distressed'
  | 'Emotional'
  | 'Investor'
  | 'Landlord'
  | 'Heir'
  | 'Stubborn'
  | 'Luxury Seller';

export type NegotiationAction =
  | 'build_rapport'
  | 'ask_questions'
  | 'explore_motivation'
  | 'make_offer'
  | 'counter_offer'
  | 'walk_away';

export type RandomEventType =
  | 'market_boom'
  | 'market_crash'
  | 'interest_rate_spike'
  | 'tenant_damage'
  | 'new_employer'
  | 'housing_shortage'
  | 'property_tax_increase';

export interface SellerProfile {
  personality: SellerPersonality;
  name: string;
  backstory: string;
  trust: number;
  resistance: number;
  motivation: number;
  minimumAcceptablePrice: number;
  askingPrice: number;
}

export interface RehabCategory {
  name: string;
  budgetCost: number;
  standardCost: number;
  luxuryCost: number;
  selected: RehabTier | null;
  budgetTimeDays: number;
  standardTimeDays: number;
  luxuryTimeDays: number;
}

export interface Property {
  id: string;
  address: string;
  city: string;
  state: string;
  propertyType: PropertyType;
  askingPrice: number;
  arv: number;
  repairEstimate: number;
  conditionScore: number;
  condition: PropertyCondition;
  neighborhoodRating: number;
  estimatedRent: number;
  dealDifficulty: number;
  seller: SellerProfile;
  status: PropertyStatus;
  purchasePrice?: number;
  purchaseDate?: string;
  financingType?: FinancingType;
  loanAmount?: number;
  interestRate?: number;
  monthlyPayment?: number;
  exitStrategy?: ExitStrategy;
  rehabPlan?: RehabCategory[];
  rehabCost?: number;
  rehabDaysRemaining?: number;
  rehabStartDate?: string;
  rehabComplete?: boolean;
  currentValue?: number;
  equity?: number;
  monthlyRent?: number;
  monthlyExpenses?: number;
  monthlyCashFlow?: number;
  totalInvested?: number;
  sellPrice?: number;
  sellDate?: string;
  profit?: number;
  imageIndex: number;
}

export interface NegotiationState {
  propertyId: string;
  currentOffer: number;
  sellerCounterOffer: number;
  trustBuilt: number;
  motivationRevealed: number;
  rounds: number;
  log: NegotiationLogEntry[];
  dealAccepted: boolean;
  dealRejected: boolean;
  agreedPrice?: number;
}

export interface NegotiationLogEntry {
  id: string;
  actor: 'player' | 'seller';
  action: string;
  message: string;
  trustChange?: number;
  resistanceChange?: number;
}

export interface RandomEvent {
  id: string;
  type: RandomEventType;
  title: string;
  description: string;
  effect: string;
  cashEffect?: number;
  valueEffect?: number;
  rentEffect?: number;
  date: string;
  read: boolean;
}

export interface ActivityEntry {
  id: string;
  type: 'purchase' | 'sale' | 'rental' | 'rehab' | 'event' | 'level_up';
  title: string;
  description: string;
  amount?: number;
  date: string;
}

export interface PlayerStats {
  cash: number;
  netWorth: number;
  monthlyCashFlow: number;
  xp: number;
  level: InvestorLevel;
  creditScore: number;
  dealsCompleted: number;
  flipProfits: number;
  totalRentalIncome: number;
  portfolio: Property[];
  listedProperties: Property[];
  activity: ActivityEntry[];
  events: RandomEvent[];
  lastEventDate?: string;
  gameMonth: number;
  gameYear: number;
}

export type Screen =
  | 'dashboard'
  | 'deal_feed'
  | 'property_detail'
  | 'negotiation'
  | 'acquisition'
  | 'rehab'
  | 'exit_strategy'
  | 'portfolio';

export const LEVEL_THRESHOLDS: Record<InvestorLevel, number> = {
  'Rookie Investor': 0,
  'Wholesaler': 500,
  'Rehabber': 1500,
  'Landlord': 3500,
  'Commercial Investor': 7000,
  'Developer': 13000,
  'Tycoon': 22000,
  'Empire Builder': 35000,
};

export const LEVEL_ORDER: InvestorLevel[] = [
  'Rookie Investor',
  'Wholesaler',
  'Rehabber',
  'Landlord',
  'Commercial Investor',
  'Developer',
  'Tycoon',
  'Empire Builder',
];
