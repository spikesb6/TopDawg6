/**
 * In-memory mock database.
 *
 * Used automatically when Supabase env vars are not configured so the MVP
 * runs out of the box. Data lives on `globalThis` to survive Next.js
 * hot-reloads in dev; it resets when the server restarts.
 */

import { Agent, LeadStatusRecord, Match, Seller } from "./types";
import { SEED_AGENTS, SEED_SELLERS } from "./seed-data";
import { rankAgentsForSeller } from "./matching";

interface MockStore {
  sellers: Seller[];
  agents: Agent[];
  matches: Match[];
  leadStatuses: LeadStatusRecord[];
}

declare global {
  // eslint-disable-next-line no-var
  var __agentmatchStore: MockStore | undefined;
}

let counter = 0;
export const newId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

/** Build matches + lead status rows for a seller against a set of agents. */
function buildMatchesForSeller(
  seller: Seller,
  agents: Agent[],
  keep = 5
): { matches: Match[]; leadStatuses: LeadStatusRecord[] } {
  const ranked = rankAgentsForSeller(seller, agents).slice(0, keep);
  const now = new Date().toISOString();
  const matches: Match[] = ranked.map((r) => ({
    id: newId("match"),
    seller_id: seller.id,
    agent_id: r.agent.id,
    score: r.score,
    reasons: r.reasons,
    created_at: now,
  }));
  const leadStatuses: LeadStatusRecord[] = matches.map((m) => ({
    id: newId("lead"),
    match_id: m.id,
    agent_id: m.agent_id,
    seller_id: m.seller_id,
    status: "new",
    updated_at: now,
  }));
  return { matches, leadStatuses };
}

function seedStore(): MockStore {
  const store: MockStore = {
    sellers: [...SEED_SELLERS],
    agents: [...SEED_AGENTS],
    matches: [],
    leadStatuses: [],
  };
  // Generate sample matches for every seed seller.
  for (const seller of store.sellers) {
    const { matches, leadStatuses } = buildMatchesForSeller(
      seller,
      store.agents
    );
    store.matches.push(...matches);
    store.leadStatuses.push(...leadStatuses);
  }
  return store;
}

export function getStore(): MockStore {
  if (!globalThis.__agentmatchStore) {
    globalThis.__agentmatchStore = seedStore();
  }
  return globalThis.__agentmatchStore;
}

export { buildMatchesForSeller };
