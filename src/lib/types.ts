/**
 * Core domain types for AgentMatch.
 * These mirror the Supabase tables defined in supabase/schema.sql.
 */

export const PROPERTY_TYPES = [
  "single_family",
  "condo",
  "townhouse",
  "multifamily",
  "land",
] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const CONDITIONS = [
  "turnkey",
  "light_updates",
  "dated",
  "fixer",
  "major_repairs",
] as const;
export type Condition = (typeof CONDITIONS)[number];

export const TIMELINES = [
  "now",
  "30_days",
  "60_days",
  "90_plus_days",
  "just_exploring",
] as const;
export type Timeline = (typeof TIMELINES)[number];

export const SELLING_REASONS = [
  "relocating",
  "inherited_property",
  "downsizing",
  "divorce",
  "financial_pressure",
  "rental_property",
  "other",
] as const;
export type SellingReason = (typeof SELLING_REASONS)[number];

export const SELLING_GOALS = [
  "highest_price",
  "fastest_sale",
  "as_is_sale",
  "privacy",
  "investor_offer",
  "unsure",
] as const;
export type SellingGoal = (typeof SELLING_GOALS)[number];

export const SPECIALTIES = [
  "luxury",
  "probate",
  "fixer",
  "investor_deals",
  "first_time_sellers",
  "condos",
  "multifamily",
  "relocation",
  "divorce",
  "senior_downsizing",
] as const;
export type Specialty = (typeof SPECIALTIES)[number];

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "appointment_set",
  "won",
  "lost",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export interface Seller {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  property_address: string;
  city: string;
  state: string;
  zip_code: string;
  property_type: PropertyType;
  condition: Condition;
  bedrooms: number;
  bathrooms: number;
  square_footage: number;
  estimated_value: number;
  timeline: Timeline;
  selling_reason: SellingReason;
  selling_goal: SellingGoal;
  notes: string;
  intent_score: number; // 0-100, computed at intake
  created_at: string;
}

export interface Agent {
  id: string;
  full_name: string;
  brokerage: string;
  email: string;
  phone: string;
  license_number: string;
  service_zip_codes: string[];
  years_experience: number;
  total_homes_sold: number;
  homes_sold_last_12mo: number;
  avg_days_on_market: number;
  avg_list_to_sale_ratio: number; // e.g. 0.98 = sells at 98% of list
  specialties: Specialty[];
  bio: string;
  photo_url: string;
  created_at: string;
}

export interface Match {
  id: string;
  seller_id: string;
  agent_id: string;
  score: number; // 0-100
  reasons: string[];
  created_at: string;
}

export interface LeadStatusRecord {
  id: string;
  match_id: string;
  agent_id: string;
  seller_id: string;
  status: LeadStatus;
  updated_at: string;
}

/* ---------- Display labels ---------- */

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  single_family: "Single Family",
  condo: "Condo",
  townhouse: "Townhouse",
  multifamily: "Multifamily",
  land: "Land",
};

export const CONDITION_LABELS: Record<Condition, string> = {
  turnkey: "Turnkey",
  light_updates: "Light Updates",
  dated: "Dated",
  fixer: "Fixer",
  major_repairs: "Major Repairs",
};

export const TIMELINE_LABELS: Record<Timeline, string> = {
  now: "Ready Now",
  "30_days": "Within 30 Days",
  "60_days": "Within 60 Days",
  "90_plus_days": "90+ Days",
  just_exploring: "Just Exploring",
};

export const SELLING_REASON_LABELS: Record<SellingReason, string> = {
  relocating: "Relocating",
  inherited_property: "Inherited Property",
  downsizing: "Downsizing",
  divorce: "Divorce",
  financial_pressure: "Financial Pressure",
  rental_property: "Rental Property",
  other: "Other",
};

export const SELLING_GOAL_LABELS: Record<SellingGoal, string> = {
  highest_price: "Highest Price",
  fastest_sale: "Fastest Sale",
  as_is_sale: "As-Is Sale",
  privacy: "Privacy",
  investor_offer: "Investor Offer",
  unsure: "Not Sure Yet",
};

export const SPECIALTY_LABELS: Record<Specialty, string> = {
  luxury: "Luxury",
  probate: "Probate",
  fixer: "Fixer-Uppers",
  investor_deals: "Investor Deals",
  first_time_sellers: "First-Time Sellers",
  condos: "Condos",
  multifamily: "Multifamily",
  relocation: "Relocation",
  divorce: "Divorce",
  senior_downsizing: "Senior Downsizing",
};

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  appointment_set: "Appointment Set",
  won: "Won",
  lost: "Lost",
};
