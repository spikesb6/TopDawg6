"use server";

/**
 * Server actions: form submissions, mock authentication, lead status updates.
 *
 * Mock auth: we store the seller/agent id in an httpOnly cookie. This proves
 * the workflow without a real auth provider. Swap for Supabase Auth
 * (supabase.auth.signInWithOtp etc.) when moving past the MVP.
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createAgent,
  createSeller,
  getAgentByEmail,
  getSellerByEmail,
  updateLeadStatus,
} from "@/lib/db";
import {
  Condition,
  LeadStatus,
  LEAD_STATUSES,
  PropertyType,
  SellingGoal,
  SellingReason,
  Specialty,
  SPECIALTIES,
  Timeline,
} from "@/lib/types";

const SELLER_COOKIE = "am_seller_id";
const AGENT_COOKIE = "am_agent_id";
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

export interface FormState {
  error?: string;
}

/* ─────────────────────── Homeowner intake ─────────────────────── */

export async function submitSellerIntake(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const required = [
    "full_name",
    "email",
    "phone",
    "property_address",
    "city",
    "state",
    "zip_code",
    "property_type",
    "condition",
    "timeline",
    "selling_reason",
    "selling_goal",
  ];
  for (const field of required) {
    if (!String(formData.get(field) ?? "").trim()) {
      return { error: `Please fill out all required fields.` };
    }
  }

  const zip = String(formData.get("zip_code")).trim();
  if (!/^\d{5}$/.test(zip)) {
    return { error: "ZIP code must be 5 digits." };
  }

  const seller = await createSeller({
    full_name: String(formData.get("full_name")).trim(),
    email: String(formData.get("email")).trim(),
    phone: String(formData.get("phone")).trim(),
    property_address: String(formData.get("property_address")).trim(),
    city: String(formData.get("city")).trim(),
    state: String(formData.get("state")).trim(),
    zip_code: zip,
    property_type: formData.get("property_type") as PropertyType,
    condition: formData.get("condition") as Condition,
    bedrooms: Number(formData.get("bedrooms") || 0),
    bathrooms: Number(formData.get("bathrooms") || 0),
    square_footage: Number(formData.get("square_footage") || 0),
    estimated_value: Number(formData.get("estimated_value") || 0),
    timeline: formData.get("timeline") as Timeline,
    selling_reason: formData.get("selling_reason") as SellingReason,
    selling_goal: formData.get("selling_goal") as SellingGoal,
    notes: String(formData.get("notes") ?? "").trim(),
  });

  cookies().set(SELLER_COOKIE, seller.id, COOKIE_OPTS);
  redirect(`/matches/${seller.id}`);
}

/* ─────────────────────── Agent signup ─────────────────────── */

export async function submitAgentSignup(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const required = [
    "full_name",
    "brokerage",
    "email",
    "phone",
    "license_number",
    "service_zip_codes",
  ];
  for (const field of required) {
    if (!String(formData.get(field) ?? "").trim()) {
      return { error: "Please fill out all required fields." };
    }
  }

  const zips = String(formData.get("service_zip_codes"))
    .split(/[,\s]+/)
    .map((z) => z.trim())
    .filter(Boolean);
  if (zips.length === 0 || zips.some((z) => !/^\d{5}$/.test(z))) {
    return { error: "Service ZIP codes must be 5-digit ZIPs, comma separated." };
  }

  const specialties = formData
    .getAll("specialties")
    .map(String)
    .filter((s): s is Specialty => (SPECIALTIES as readonly string[]).includes(s));

  const agent = await createAgent({
    full_name: String(formData.get("full_name")).trim(),
    brokerage: String(formData.get("brokerage")).trim(),
    email: String(formData.get("email")).trim(),
    phone: String(formData.get("phone")).trim(),
    license_number: String(formData.get("license_number")).trim(),
    service_zip_codes: zips,
    years_experience: Number(formData.get("years_experience") || 0),
    total_homes_sold: Number(formData.get("total_homes_sold") || 0),
    homes_sold_last_12mo: Number(formData.get("homes_sold_last_12mo") || 0),
    avg_days_on_market: Number(formData.get("avg_days_on_market") || 30),
    avg_list_to_sale_ratio:
      Number(formData.get("avg_list_to_sale_ratio") || 0.97),
    specialties,
    bio: String(formData.get("bio") ?? "").trim(),
    photo_url: String(formData.get("photo_url") ?? "").trim(),
  });

  cookies().set(AGENT_COOKIE, agent.id, COOKIE_OPTS);
  redirect("/dashboard/agent");
}

/* ─────────────────────── Mock login / logout ─────────────────────── */

export async function loginWithEmail(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  const role = String(formData.get("role") ?? "seller");
  if (!email) return { error: "Enter the email you signed up with." };

  if (role === "agent") {
    const agent = await getAgentByEmail(email);
    if (!agent) {
      return { error: "No agent profile found for that email. Try a seed email like maria.vasquez@example.com." };
    }
    cookies().set(AGENT_COOKIE, agent.id, COOKIE_OPTS);
    redirect("/dashboard/agent");
  }

  const seller = await getSellerByEmail(email);
  if (!seller) {
    return { error: "No seller profile found for that email. Try a seed email like karen.mitchell@example.com." };
  }
  cookies().set(SELLER_COOKIE, seller.id, COOKIE_OPTS);
  redirect("/dashboard/seller");
}

export async function logout(): Promise<void> {
  cookies().delete(SELLER_COOKIE);
  cookies().delete(AGENT_COOKIE);
  redirect("/");
}

export async function getSessionIds(): Promise<{
  sellerId: string | null;
  agentId: string | null;
}> {
  const jar = cookies();
  return {
    sellerId: jar.get(SELLER_COOKIE)?.value ?? null,
    agentId: jar.get(AGENT_COOKIE)?.value ?? null,
  };
}

/* ─────────────────────── Lead status updates ─────────────────────── */

export async function setLeadStatus(formData: FormData): Promise<void> {
  const leadStatusId = String(formData.get("lead_status_id") ?? "");
  const status = String(formData.get("status") ?? "") as LeadStatus;
  if (!leadStatusId || !(LEAD_STATUSES as readonly string[]).includes(status)) {
    return;
  }
  await updateLeadStatus(leadStatusId, status);
  revalidatePath("/dashboard/agent");
}
