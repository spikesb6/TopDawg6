/**
 * Unified data-access layer.
 *
 * Every read/write in the app goes through these functions. When Supabase
 * credentials are present (see src/lib/supabase.ts) they hit the real
 * database; otherwise they use the seeded in-memory mock store so the MVP
 * works with zero configuration.
 */

import { Agent, LeadStatus, Match, Seller } from "./types";
import { calculateIntentScore, rankAgentsForSeller } from "./matching";
import { getSupabase } from "./supabase";
import { buildMatchesForSeller, getStore, newId } from "./mock-db";

/* ────────────────────────────── Sellers ────────────────────────────── */

export type NewSeller = Omit<Seller, "id" | "created_at" | "intent_score">;

export async function createSeller(input: NewSeller): Promise<Seller> {
  const seller: Seller = {
    ...input,
    id: newId("seller"),
    intent_score: calculateIntentScore(input),
    created_at: new Date().toISOString(),
  };

  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from("sellers")
      .insert({ ...seller, id: undefined }) // let Postgres generate the UUID
      .select()
      .single();
    if (error) throw new Error(`Failed to create seller: ${error.message}`);
    const created = data as Seller;
    await generateMatchesForSeller(created);
    return created;
  }

  const store = getStore();
  store.sellers.push(seller);
  const { matches, leadStatuses } = buildMatchesForSeller(
    seller,
    store.agents
  );
  store.matches.push(...matches);
  store.leadStatuses.push(...leadStatuses);
  return seller;
}

export async function getSeller(id: string): Promise<Seller | null> {
  const supabase = getSupabase();
  if (supabase) {
    const { data } = await supabase
      .from("sellers")
      .select()
      .eq("id", id)
      .maybeSingle();
    return (data as Seller) ?? null;
  }
  return getStore().sellers.find((s) => s.id === id) ?? null;
}

export async function getSellerByEmail(email: string): Promise<Seller | null> {
  const normalized = email.trim().toLowerCase();
  const supabase = getSupabase();
  if (supabase) {
    const { data } = await supabase
      .from("sellers")
      .select()
      .ilike("email", normalized)
      .maybeSingle();
    return (data as Seller) ?? null;
  }
  return (
    getStore().sellers.find((s) => s.email.toLowerCase() === normalized) ?? null
  );
}

export async function listSellers(): Promise<Seller[]> {
  const supabase = getSupabase();
  if (supabase) {
    const { data } = await supabase
      .from("sellers")
      .select()
      .order("created_at", { ascending: false });
    return (data as Seller[]) ?? [];
  }
  return [...getStore().sellers].sort((a, b) =>
    b.created_at.localeCompare(a.created_at)
  );
}

/* ────────────────────────────── Agents ─────────────────────────────── */

export type NewAgent = Omit<Agent, "id" | "created_at">;

export async function createAgent(input: NewAgent): Promise<Agent> {
  const agent: Agent = {
    ...input,
    id: newId("agent"),
    created_at: new Date().toISOString(),
  };

  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from("agents")
      .insert({ ...agent, id: undefined })
      .select()
      .single();
    if (error) throw new Error(`Failed to create agent: ${error.message}`);
    return data as Agent;
  }

  const store = getStore();
  store.agents.push(agent);
  // Re-rank existing sellers so the new agent immediately sees leads
  // (and sellers see them) if they're a better fit.
  for (const seller of store.sellers) {
    refreshMatchesForSellerInStore(seller);
  }
  return agent;
}

export async function getAgent(id: string): Promise<Agent | null> {
  const supabase = getSupabase();
  if (supabase) {
    const { data } = await supabase
      .from("agents")
      .select()
      .eq("id", id)
      .maybeSingle();
    return (data as Agent) ?? null;
  }
  return getStore().agents.find((a) => a.id === id) ?? null;
}

export async function getAgentByEmail(email: string): Promise<Agent | null> {
  const normalized = email.trim().toLowerCase();
  const supabase = getSupabase();
  if (supabase) {
    const { data } = await supabase
      .from("agents")
      .select()
      .ilike("email", normalized)
      .maybeSingle();
    return (data as Agent) ?? null;
  }
  return (
    getStore().agents.find((a) => a.email.toLowerCase() === normalized) ?? null
  );
}

export async function listAgents(): Promise<Agent[]> {
  const supabase = getSupabase();
  if (supabase) {
    const { data } = await supabase
      .from("agents")
      .select()
      .order("created_at", { ascending: false });
    return (data as Agent[]) ?? [];
  }
  return [...getStore().agents].sort((a, b) =>
    b.created_at.localeCompare(a.created_at)
  );
}

/* ────────────────────────────── Matches ────────────────────────────── */

/** Persist top matches + "new" lead statuses for a seller (Supabase path). */
async function generateMatchesForSeller(seller: Seller): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  const agents = await listAgents();
  const ranked = rankAgentsForSeller(seller, agents).slice(0, 5);

  const { data: matches, error } = await supabase
    .from("matches")
    .insert(
      ranked.map((r) => ({
        seller_id: seller.id,
        agent_id: r.agent.id,
        score: r.score,
        reasons: r.reasons,
      }))
    )
    .select();
  if (error || !matches) return;

  await supabase.from("lead_statuses").insert(
    (matches as Match[]).map((m) => ({
      match_id: m.id,
      agent_id: m.agent_id,
      seller_id: m.seller_id,
      status: "new",
    }))
  );
}

/** Mock-store equivalent: drop and rebuild a seller's matches in place. */
function refreshMatchesForSellerInStore(seller: Seller): void {
  const store = getStore();
  const existingStatus = new Map(
    store.leadStatuses
      .filter((l) => l.seller_id === seller.id)
      .map((l) => [l.agent_id, l.status])
  );
  store.matches = store.matches.filter((m) => m.seller_id !== seller.id);
  store.leadStatuses = store.leadStatuses.filter(
    (l) => l.seller_id !== seller.id
  );
  const { matches, leadStatuses } = buildMatchesForSeller(seller, store.agents);
  // Preserve any lead-status progress an agent already made.
  for (const ls of leadStatuses) {
    ls.status = existingStatus.get(ls.agent_id) ?? "new";
  }
  store.matches.push(...matches);
  store.leadStatuses.push(...leadStatuses);
}

export interface MatchWithAgent extends Match {
  agent: Agent;
}

export interface MatchWithSeller extends Match {
  seller: Seller;
  lead_status: LeadStatus;
  lead_status_id: string;
}

/** Ranked matches (with agent profiles) for a seller's results page. */
export async function listMatchesForSeller(
  sellerId: string
): Promise<MatchWithAgent[]> {
  const supabase = getSupabase();
  if (supabase) {
    const { data } = await supabase
      .from("matches")
      .select("*, agent:agents(*)")
      .eq("seller_id", sellerId)
      .order("score", { ascending: false });
    return ((data as unknown as MatchWithAgent[]) ?? []).filter(
      (m) => m.agent
    );
  }

  const store = getStore();
  return store.matches
    .filter((m) => m.seller_id === sellerId)
    .map((m) => ({
      ...m,
      agent: store.agents.find((a) => a.id === m.agent_id)!,
    }))
    .filter((m) => m.agent)
    .sort((a, b) => b.score - a.score);
}

/** Lead opportunities (with seller details + status) for an agent. */
export async function listLeadsForAgent(
  agentId: string
): Promise<MatchWithSeller[]> {
  const supabase = getSupabase();
  if (supabase) {
    const { data } = await supabase
      .from("matches")
      .select("*, seller:sellers(*), lead_statuses(id, status)")
      .eq("agent_id", agentId)
      .order("score", { ascending: false });
    type Row = Match & {
      seller: Seller;
      lead_statuses: { id: string; status: LeadStatus }[];
    };
    return ((data as unknown as Row[]) ?? [])
      .filter((m) => m.seller)
      .map((m) => ({
        ...m,
        lead_status: m.lead_statuses?.[0]?.status ?? "new",
        lead_status_id: m.lead_statuses?.[0]?.id ?? "",
      }));
  }

  const store = getStore();
  return store.matches
    .filter((m) => m.agent_id === agentId)
    .map((m) => {
      const seller = store.sellers.find((s) => s.id === m.seller_id)!;
      const ls = store.leadStatuses.find((l) => l.match_id === m.id);
      return {
        ...m,
        seller,
        lead_status: ls?.status ?? ("new" as LeadStatus),
        lead_status_id: ls?.id ?? "",
      };
    })
    .filter((m) => m.seller)
    .sort((a, b) => b.score - a.score);
}

export async function updateLeadStatus(
  leadStatusId: string,
  status: LeadStatus
): Promise<void> {
  const supabase = getSupabase();
  if (supabase) {
    await supabase
      .from("lead_statuses")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", leadStatusId);
    return;
  }
  const store = getStore();
  const ls = store.leadStatuses.find((l) => l.id === leadStatusId);
  if (ls) {
    ls.status = status;
    ls.updated_at = new Date().toISOString();
  }
}

/* ─────────────────────────────── Admin ─────────────────────────────── */

export interface AdminStats {
  totalSellers: number;
  totalAgents: number;
  totalMatches: number;
  avgMatchScore: number;
  recentSellers: Seller[];
  recentAgents: Agent[];
}

export async function getAdminStats(): Promise<AdminStats> {
  const [sellers, agents, matches] = await Promise.all([
    listSellers(),
    listAgents(),
    listAllMatches(),
  ]);
  const avg =
    matches.length > 0
      ? matches.reduce((sum, m) => sum + m.score, 0) / matches.length
      : 0;
  return {
    totalSellers: sellers.length,
    totalAgents: agents.length,
    totalMatches: matches.length,
    avgMatchScore: Math.round(avg),
    recentSellers: sellers.slice(0, 5),
    recentAgents: agents.slice(0, 5),
  };
}

async function listAllMatches(): Promise<Match[]> {
  const supabase = getSupabase();
  if (supabase) {
    const { data } = await supabase.from("matches").select();
    return (data as Match[]) ?? [];
  }
  return getStore().matches;
}
