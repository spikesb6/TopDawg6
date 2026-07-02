/**
 * AgentMatch scoring algorithm.
 *
 * Produces a 0–100 match score between a seller and an agent, plus
 * human-readable reasons that explain the match to the homeowner.
 *
 * Weight budget (sums to 100):
 *   Service area (ZIP)          25
 *   Property type experience    12
 *   Seller goal match           12
 *   Condition / specialty fit   10
 *   Timeline urgency fit         8
 *   Recent sales activity       10
 *   Years of experience          8
 *   Days on market               8
 *   List-to-sale price ratio     7
 */

import {
  Agent,
  Seller,
  Specialty,
  PropertyType,
  SPECIALTY_LABELS,
  Condition,
  SellingGoal,
  Timeline,
  SellingReason,
} from "./types";

export interface MatchResult {
  agent: Agent;
  score: number;
  reasons: string[];
}

const WEIGHTS = {
  zip: 25,
  propertyType: 12,
  goal: 12,
  condition: 10,
  timeline: 8,
  recentActivity: 10,
  experience: 8,
  daysOnMarket: 8,
  listToSale: 7,
} as const;

/** Specialties that indicate experience with a given property type. */
const PROPERTY_TYPE_SPECIALTIES: Record<PropertyType, Specialty[]> = {
  single_family: ["first_time_sellers", "luxury", "relocation"],
  condo: ["condos"],
  townhouse: ["condos", "first_time_sellers"],
  multifamily: ["multifamily", "investor_deals"],
  land: ["investor_deals"],
};

/** Specialties that align with what the seller wants out of the sale. */
const GOAL_SPECIALTIES: Record<SellingGoal, Specialty[]> = {
  highest_price: ["luxury"],
  fastest_sale: ["investor_deals", "relocation"],
  as_is_sale: ["fixer", "investor_deals"],
  privacy: ["divorce", "probate"],
  investor_offer: ["investor_deals"],
  unsure: ["first_time_sellers"],
};

/** Specialties that align with property condition. */
const CONDITION_SPECIALTIES: Record<Condition, Specialty[]> = {
  turnkey: ["luxury", "first_time_sellers"],
  light_updates: ["first_time_sellers", "relocation"],
  dated: ["fixer", "investor_deals"],
  fixer: ["fixer", "investor_deals"],
  major_repairs: ["fixer", "investor_deals"],
};

/** Specialties that align with the seller's situation/reason. */
const REASON_SPECIALTIES: Record<SellingReason, Specialty[]> = {
  relocating: ["relocation"],
  inherited_property: ["probate"],
  downsizing: ["senior_downsizing"],
  divorce: ["divorce"],
  financial_pressure: ["investor_deals", "fixer"],
  rental_property: ["investor_deals", "multifamily"],
  other: [],
};

const TIMELINE_URGENCY: Record<Timeline, number> = {
  now: 1.0,
  "30_days": 0.85,
  "60_days": 0.65,
  "90_plus_days": 0.45,
  just_exploring: 0.2,
};

/** Clamp helper. */
const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));

/**
 * Seller intent score (0–100): how serious/qualified this lead is.
 * Used to rank leads on the agent dashboard.
 */
export function calculateIntentScore(seller: {
  timeline: Timeline;
  selling_reason: SellingReason;
  selling_goal: SellingGoal;
}): number {
  let score = TIMELINE_URGENCY[seller.timeline] * 60;

  // Life events with a deadline signal higher intent than open-ended exploring.
  const highIntentReasons: SellingReason[] = [
    "relocating",
    "divorce",
    "financial_pressure",
    "inherited_property",
  ];
  score += highIntentReasons.includes(seller.selling_reason) ? 25 : 12;

  // A concrete goal means they've thought about the outcome.
  score += seller.selling_goal === "unsure" ? 5 : 15;

  return Math.round(clamp(score, 0, 100));
}

/**
 * Score one agent against one seller. Returns 0–100 plus reasons.
 */
export function scoreAgentForSeller(seller: Seller, agent: Agent): MatchResult {
  let score = 0;
  const reasons: string[] = [];

  /* ---- 1. Service area (ZIP) ---- */
  const exactZip = agent.service_zip_codes.includes(seller.zip_code);
  const nearbyZip =
    !exactZip &&
    agent.service_zip_codes.some(
      (z) => z.slice(0, 3) === seller.zip_code.slice(0, 3)
    );
  if (exactZip) {
    score += WEIGHTS.zip;
    reasons.push(`Actively serves your ZIP code (${seller.zip_code})`);
  } else if (nearbyZip) {
    score += WEIGHTS.zip * 0.5;
    reasons.push(`Works in neighborhoods near ${seller.zip_code}`);
  }

  /* ---- 2. Property type experience ---- */
  const typeSpecs = PROPERTY_TYPE_SPECIALTIES[seller.property_type];
  const typeHits = typeSpecs.filter((s) => agent.specialties.includes(s));
  if (typeHits.length > 0) {
    score += WEIGHTS.propertyType;
    reasons.push(
      `Experienced with ${seller.property_type.replace(/_/g, " ")} properties`
    );
  } else if (seller.property_type === "single_family") {
    // Every full-time agent handles single family homes; partial credit.
    score += WEIGHTS.propertyType * 0.6;
  }

  /* ---- 3. Seller goal match ---- */
  const goalSpecs = GOAL_SPECIALTIES[seller.selling_goal];
  const goalHits = goalSpecs.filter((s) => agent.specialties.includes(s));
  if (goalHits.length > 0) {
    score += WEIGHTS.goal;
    reasons.push(
      `Specializes in ${goalHits.map((s) => SPECIALTY_LABELS[s].toLowerCase()).join(", ")} — a fit for your goal`
    );
  } else if (seller.selling_goal === "highest_price" && agent.avg_list_to_sale_ratio >= 1.0) {
    score += WEIGHTS.goal * 0.8;
    reasons.push("Consistently sells at or above list price");
  }

  /* ---- 4. Condition / specialty fit (also folds in selling reason) ---- */
  const condSpecs = new Set([
    ...CONDITION_SPECIALTIES[seller.condition],
    ...REASON_SPECIALTIES[seller.selling_reason],
  ]);
  const condHits = agent.specialties.filter((s) => condSpecs.has(s));
  if (condHits.length > 0) {
    score += WEIGHTS.condition;
    reasons.push(
      `Background in ${condHits
        .slice(0, 2)
        .map((s) => SPECIALTY_LABELS[s].toLowerCase())
        .join(" and ")} situations like yours`
    );
  }

  /* ---- 5. Timeline urgency fit ---- */
  // Urgent sellers need agents who move inventory fast; patient sellers
  // benefit from anyone, so everyone gets at least partial credit.
  const urgency = TIMELINE_URGENCY[seller.timeline];
  const speedScore = clamp((45 - agent.avg_days_on_market) / 30); // 15 DOM = 1.0, 45+ = 0
  const timelineFit = urgency * speedScore + (1 - urgency) * 0.75;
  score += WEIGHTS.timeline * timelineFit;
  if (urgency >= 0.85 && speedScore >= 0.6) {
    reasons.push(
      `Averages just ${agent.avg_days_on_market} days on market — matches your urgent timeline`
    );
  }

  /* ---- 6. Recent sales activity ---- */
  const activityScore = clamp(agent.homes_sold_last_12mo / 30); // 30+/yr = max
  score += WEIGHTS.recentActivity * activityScore;
  if (agent.homes_sold_last_12mo >= 20) {
    reasons.push(`Closed ${agent.homes_sold_last_12mo} homes in the last 12 months`);
  }

  /* ---- 7. Years of experience ---- */
  const expScore = clamp(agent.years_experience / 15); // 15+ yrs = max
  score += WEIGHTS.experience * expScore;
  if (agent.years_experience >= 10) {
    reasons.push(`${agent.years_experience} years of local market experience`);
  }

  /* ---- 8. Days on market (absolute performance) ---- */
  score += WEIGHTS.daysOnMarket * clamp((60 - agent.avg_days_on_market) / 45);

  /* ---- 9. List-to-sale price ratio ---- */
  // 0.90 → 0 points, 1.05+ → full points.
  const ratioScore = clamp((agent.avg_list_to_sale_ratio - 0.9) / 0.15);
  score += WEIGHTS.listToSale * ratioScore;
  if (agent.avg_list_to_sale_ratio >= 1.0) {
    reasons.push(
      `Sells at ${Math.round(agent.avg_list_to_sale_ratio * 100)}% of list price on average`
    );
  }

  return {
    agent,
    score: Math.round(clamp(score, 0, 100)),
    reasons: reasons.slice(0, 4),
  };
}

/**
 * Rank all agents for a seller, best first.
 * Agents with no service-area overlap at all are filtered out unless
 * that would leave fewer than `minResults` agents.
 */
export function rankAgentsForSeller(
  seller: Seller,
  agents: Agent[],
  minResults = 3
): MatchResult[] {
  const scored = agents
    .map((agent) => scoreAgentForSeller(seller, agent))
    .sort((a, b) => b.score - a.score);

  const inArea = scored.filter((r) =>
    r.agent.service_zip_codes.some(
      (z) => z === seller.zip_code || z.slice(0, 3) === seller.zip_code.slice(0, 3)
    )
  );

  return inArea.length >= minResults ? inArea : scored;
}
