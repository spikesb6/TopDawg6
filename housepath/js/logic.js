/** Money and step rules for Housepath. Amounts are integer cents. */

export const CUSHION_BPS = 1000;
export const MAX_CENTS = 10_000_000_000;

export const CATEGORY_DEFS = [
  { id: "land", name: "Land", share: 0 },
  { id: "plans", name: "Plans and permits", share: 500 },
  { id: "foundation", name: "Foundation", share: 1100 },
  { id: "frame", name: "Frame and roof", share: 1800 },
  { id: "exterior", name: "Windows and exterior", share: 1200 },
  { id: "systems", name: "Plumbing, electric, and heat", share: 1500 },
  { id: "inside", name: "Inside finishes", share: 2300 },
  { id: "yard", name: "Driveway and yard", share: 800 },
  { id: "other", name: "Builder fee and other", share: 800 },
];

export const SAMPLE_AMOUNTS = {
  land: 15_000_000,
  plans: 1_500_000,
  foundation: 6_200_000,
  frame: 10_500_000,
  exterior: 6_400_000,
  systems: 8_600_000,
  inside: 12_800_000,
  yard: 4_000_000,
  other: 4_000_000,
};

const SAMPLE_LIMIT = 72_000_000;
const TEXT_LIMIT = 4000;

export function blankState() {
  return {
    version: 1,
    example: false,
    projectName: "",
    place: "",
    limitCents: null,
    cushionBps: CUSHION_BPS,
    categories: defaultCategories(),
    payments: [],
    changes: [],
    decisions: [],
    steps: {},
  };
}

export function defaultCategories() {
  return CATEGORY_DEFS.map((def) => ({
    id: def.id,
    name: def.name,
    share: def.share,
    cents: 0,
    source: "sketch",
  }));
}

export function uid() {
  return crypto.randomUUID();
}

export function formatMoney(cents) {
  if (cents == null || !Number.isFinite(cents)) return "—";
  const negative = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const dollars = Math.floor(abs / 100);
  const rem = abs % 100;
  const body = dollars.toLocaleString("en-US");
  const text = rem === 0 ? `$${body}` : `$${body}.${String(rem).padStart(2, "0")}`;
  return negative ? `−${text}` : text;
}

export function formatAmount(cents) {
  if (cents == null || !Number.isFinite(cents)) return "";
  const negative = cents < 0;
  const text = formatMoney(Math.abs(cents)).slice(1);
  return negative ? `-${text}` : text;
}

export function parseMoney(raw) {
  if (raw == null) return null;
  const text = String(raw).trim();
  if (text === "") return null;
  let negative = false;
  let body = text.replace(/[$,\s]/g, "");
  if (body.startsWith("(") && body.endsWith(")")) {
    negative = true;
    body = body.slice(1, -1);
  }
  if (body.startsWith("-") || body.startsWith("−")) {
    negative = true;
    body = body.slice(1);
  }
  if (!/^\d+(\.\d{1,2})?$/.test(body)) {
    return { error: "Use a dollar amount, like 425000 or 1,200.50." };
  }
  const cents = Math.round(Number(body) * 100);
  if (!Number.isFinite(cents)) {
    return { error: "Use a dollar amount, like 425000 or 1,200.50." };
  }
  if (Math.abs(cents) > MAX_CENTS) {
    return { error: "That amount is over $100 million. Check the number." };
  }
  return { cents: negative ? -cents : cents };
}

export function cushionOf(limitCents, cushionBps = CUSHION_BPS) {
  if (limitCents == null || !Number.isFinite(limitCents)) return 0;
  return Math.round(limitCents * cushionBps / 10000);
}

export function cushionSentence(limitCents, cushionBps = CUSHION_BPS) {
  if (limitCents == null || limitCents <= 0) {
    return "When you enter a limit, 10% is held back as a cushion. You plan with the other 90%.";
  }
  const cushion = cushionOf(limitCents, cushionBps);
  const plan = limitCents - cushion;
  return `You would plan with ${formatMoney(plan)}. The other ${formatMoney(cushion)} stays untouched for surprises.`;
}

export function resketch(categories, { limitCents, cushionBps = CUSHION_BPS }) {
  if (limitCents == null) {
    return categories.map((category) =>
      category.source === "sketch" ? { ...category, cents: 0 } : category,
    );
  }
  const planCents = limitCents - cushionOf(limitCents, cushionBps);
  const land = categories.find((category) => category.id === "land");
  const landCents = land ? land.cents : 0;
  const fixed = categories.filter((category) => category.id !== "land" && category.source !== "sketch");
  const flex = categories.filter((category) => category.id !== "land" && category.source === "sketch");
  const fixedSum = fixed.reduce((sum, category) => sum + category.cents, 0);
  let remaining = planCents - landCents - fixedSum;
  if (remaining < 0) remaining = 0;
  const shareTotal = flex.reduce((sum, category) => sum + category.share, 0) || 1;
  const flexIds = new Set(flex.map((category) => category.id));
  let used = 0;
  return categories.map((category) => {
    if (!flexIds.has(category.id)) return category;
    const index = flex.findIndex((item) => item.id === category.id);
    const last = index === flex.length - 1;
    const cents = last ? remaining - used : Math.floor((remaining * category.share) / shareTotal);
    if (!last) used += cents;
    return { ...category, cents };
  });
}

export function withLimit(state, cents) {
  return {
    ...state,
    limitCents: cents,
    categories: resketch(state.categories, {
      limitCents: cents,
      cushionBps: state.cushionBps,
    }),
  };
}

export function withCategoryCents(state, id, cents) {
  const categories = state.categories.map((category) =>
    category.id === id ? { ...category, cents, source: "entered" } : category,
  );
  if (id !== "land") return { ...state, categories };
  return {
    ...state,
    categories: resketch(categories, {
      limitCents: state.limitCents,
      cushionBps: state.cushionBps,
    }),
  };
}

export function touchMoney(state) {
  const record = state.steps.sheet;
  if (!record?.checks?.["use-cushion"]) return state;
  return {
    ...state,
    steps: {
      ...state.steps,
      sheet: {
        ...record,
        checks: { ...record.checks, "use-cushion": false },
      },
    },
  };
}

export function stepRecord(state, id) {
  return state.steps[id] || { fields: {}, checks: {}, doneAt: null };
}

export function patchStep(state, id, recipe) {
  const next = recipe(stepRecord(state, id));
  return { ...state, steps: { ...state.steps, [id]: next } };
}

export function reopenFrom(state, steps, id) {
  const index = steps.findIndex((step) => step.id === id);
  if (index < 0) return state;
  const nextSteps = { ...state.steps };
  for (const step of steps.slice(index)) {
    if (!nextSteps[step.id]?.doneAt) continue;
    nextSteps[step.id] = { ...nextSteps[step.id], doneAt: null };
  }
  return { ...state, steps: nextSteps };
}

export function sumCents(items) {
  return items.reduce((sum, item) => sum + (Number.isFinite(item.cents) ? item.cents : 0), 0);
}

export function summarize(state) {
  const limitCents = Number.isFinite(state.limitCents) ? state.limitCents : null;
  const cushionBps = state.cushionBps || CUSHION_BPS;
  const categoryCents = sumCents(state.categories);
  const approved = state.changes.filter((change) => change.status === "approved");
  const ideas = state.changes.filter((change) => change.status === "idea");
  const approvedChangeCents = sumCents(approved);
  const ideaCents = sumCents(ideas);
  const spentCents = sumCents(state.payments);
  const cushionCents = limitCents == null ? 0 : cushionOf(limitCents, cushionBps);
  const planCents = limitCents == null ? 0 : limitCents - cushionCents;
  const committed = categoryCents + approvedChangeCents;
  let tone = "unset";
  if (limitCents != null && limitCents > 0) {
    if (committed > limitCents) tone = "over";
    else if (committed > planCents) tone = "tight";
    else tone = "ok";
  }
  return {
    limitCents,
    cushionBps,
    cushionCents,
    planCents,
    categoryCents,
    approvedChangeCents,
    ideaCents,
    spentCents,
    committed,
    leftToPay: committed - spentCents,
    gap: limitCents == null ? null : limitCents - committed,
    planGap: limitCents == null ? null : planCents - committed,
    tone,
    overSpent: limitCents != null && spentCents > limitCents,
    paidAbovePlan: spentCents > committed,
  };
}

export function summarizeWithExtra(state, extraCents) {
  return summarize({
    ...state,
    changes: [...state.changes, { status: "approved", cents: extraCents, id: "preview", label: "" }],
  });
}

export function moneySentence(summary) {
  if (summary.tone === "unset") {
    return "Set the most you can spend in step 2. Until then, there is no budget to protect.";
  }
  if (summary.tone === "over") {
    return `The plan is ${formatMoney(summary.committed - summary.limitCents)} over your limit of ${formatMoney(summary.limitCents)}. Fix this before you finish the next step.`;
  }
  if (summary.tone === "tight") {
    return `The plan fits under the limit, but it uses ${formatMoney(summary.committed - summary.planCents)} of the cushion you set aside for surprises.`;
  }
  return `The plan fits. You still have ${formatMoney(summary.planCents - summary.committed)} before you touch the cushion, and the cushion is ${formatMoney(summary.cushionCents)}.`;
}

export function approvalBlock(state, cents) {
  if (state.limitCents == null || state.limitCents <= 0) {
    return "Set a spending limit before you approve a change.";
  }
  const next = summarizeWithExtra(state, cents);
  if (next.tone === "over") {
    const over = next.committed - next.limitCents;
    return `This would put you ${formatMoney(over)} over your limit. Lower another line, or raise the limit on purpose, before you say yes.`;
  }
  return null;
}

export function largestCategory(categories) {
  if (!categories.length) return null;
  return [...categories].sort((a, b) => b.cents - a.cents)[0];
}

export function meterParts(summary) {
  if (summary.tone === "unset" || !summary.limitCents) return null;
  const committed = Math.max(0, summary.committed);
  return {
    width: summary.tone === "over" ? 1 : Math.min(committed / summary.limitCents, 1),
    tick: summary.planCents / summary.limitCents,
    tone: summary.tone,
  };
}

function fieldFilled(field, raw) {
  if (field.type === "money") {
    const parsed = parseMoney(raw);
    if (!parsed || parsed.error) return false;
    if (!field.allowZero && parsed.cents <= 0) return false;
    if (field.allowZero && parsed.cents < 0) return false;
    return true;
  }
  return String(raw ?? "").trim().length > 0;
}

export function isUnlocked(steps, state, stepId) {
  const index = steps.findIndex((step) => step.id === stepId);
  if (index < 0) return false;
  return steps.slice(0, index).every((step) => state.steps[step.id]?.doneAt);
}

export function currentStep(steps, state) {
  return steps.find((step) => !state.steps[step.id]?.doneAt) || null;
}

export function completionBlockers({ state, steps, step, files }) {
  const reasons = [];
  const index = steps.findIndex((item) => item.id === step.id);
  const earlier = steps.slice(0, index).find((item) => !state.steps[item.id]?.doneAt);
  if (earlier) {
    reasons.push(`Finish “${earlier.title}” first. Later steps stay locked so nothing is skipped.`);
  }
  const record = stepRecord(state, step.id);
  for (const field of step.fields || []) {
    if (!field.required) continue;
    if (!fieldFilled(field, record.fields?.[field.id])) reasons.push(field.missing);
  }
  for (const upload of step.uploads || []) {
    if (!upload.required) continue;
    const found = files.some((file) => file.kind === upload.kind);
    if (!found) reasons.push(upload.missing);
  }
  const summary = summarize(state);
  if (step.confirmSheet) {
    const unconfirmed = state.categories.filter(
      (category) => category.id !== "land" && category.source !== "entered",
    );
    if (unconfirmed.length) {
      const noun = unconfirmed.length === 1 ? "line is" : "lines are";
      reasons.push(
        `${unconfirmed.length} money ${noun} still a rough split. Confirm each one against the build sheet.`,
      );
    }
    if (summary.tone === "tight" && !record.checks?.["use-cushion"]) {
      reasons.push("Confirm that you mean to spend part of the cushion.");
    }
  }
  if (step.moneyGate) {
    if (summary.tone === "over") {
      reasons.push(
        `You are ${formatMoney(summary.committed - summary.limitCents)} over the limit. Fix the money page before this step can be finished.`,
      );
    }
    if (summary.overSpent) {
      reasons.push("You have already paid more than your limit. Fix the money page before this step can be finished.");
    }
    if (summary.paidAbovePlan) {
      reasons.push(
        `You have paid ${formatMoney(summary.spentCents - summary.committed)} more than the plan lists. Add it on the money page before you continue.`,
      );
    }
  }
  for (const check of step.checks || []) {
    if (!record.checks?.[check.id]) reasons.push(check.label);
  }
  return reasons;
}

export function progress(steps, state) {
  const done = steps.filter((step) => state.steps[step.id]?.doneAt).length;
  return { done, total: steps.length, current: currentStep(steps, state) };
}

function clip(value, max) {
  return String(value ?? "").slice(0, max);
}

function sanitizeSteps(raw) {
  if (!raw || typeof raw !== "object") return {};
  const steps = {};
  for (const [id, record] of Object.entries(raw)) {
    if (!record || typeof record !== "object") continue;
    const fields = {};
    const checks = {};
    if (record.fields && typeof record.fields === "object") {
      for (const [key, value] of Object.entries(record.fields)) {
        if (typeof value === "string" || typeof value === "number") fields[key] = clip(value, TEXT_LIMIT);
      }
    }
    if (record.checks && typeof record.checks === "object") {
      for (const [key, value] of Object.entries(record.checks)) checks[key] = value === true;
    }
    steps[id] = {
      fields,
      checks,
      doneAt: typeof record.doneAt === "string" ? record.doneAt : null,
    };
  }
  return steps;
}

export function normalize(raw) {
  const base = blankState();
  if (!raw || typeof raw !== "object") return base;
  const saved = Array.isArray(raw.categories) ? raw.categories : [];
  const categories = defaultCategories().map((def) => {
    const found = saved.find((category) => category && category.id === def.id);
    if (!found) return def;
    return {
      ...def,
      cents: Number.isFinite(found.cents) ? Math.round(found.cents) : 0,
      source: found.source === "entered" ? "entered" : "sketch",
    };
  });
  const known = new Set(categories.map((category) => category.id));
  for (const extra of saved) {
    if (!extra || typeof extra.id !== "string" || known.has(extra.id)) continue;
    if (!Number.isFinite(extra.cents)) continue;
    known.add(extra.id);
    categories.push({
      id: extra.id.slice(0, 80),
      name: clip(extra.name || "Other line", 120),
      share: 0,
      cents: Number.isFinite(extra.cents) ? Math.round(extra.cents) : 0,
      source: "entered",
    });
  }
  const payments = Array.isArray(raw.payments)
    ? raw.payments.slice(0, 500).filter((item) => item && Number.isFinite(item.cents)).map((item) => ({
        id: clip(item.id || uid(), 80),
        label: clip(item.label || "Payment", 200),
        cents: Math.round(item.cents),
        categoryId: clip(item.categoryId || "", 80),
        on: clip(item.on || "", 20),
      }))
    : [];
  const changes = Array.isArray(raw.changes)
    ? raw.changes.slice(0, 200).filter((item) => item && Number.isFinite(item.cents)).map((item) => ({
        id: clip(item.id || uid(), 80),
        label: clip(item.label || "Change", 200),
        cents: Math.round(item.cents),
        status: item.status === "approved" ? "approved" : "idea",
        at: typeof item.at === "string" ? item.at : "",
      }))
    : [];
  const decisions = Array.isArray(raw.decisions)
    ? raw.decisions.slice(0, 200).filter((item) => item && typeof item.text === "string").map((item) => ({
        id: clip(item.id || uid(), 80),
        at: typeof item.at === "string" ? item.at : "",
        text: clip(item.text, 500),
      }))
    : [];
  return {
    ...base,
    example: raw.example === true,
    projectName: clip(raw.projectName || "", 120),
    place: clip(raw.place || "", 160),
    limitCents: Number.isFinite(raw.limitCents) ? Math.round(raw.limitCents) : null,
    categories,
    payments,
    changes,
    decisions,
    steps: sanitizeSteps(raw.steps),
  };
}

export function hasProgress(state, files) {
  if (state.example) return true;
  if (state.projectName.trim() || state.place.trim()) return true;
  if (state.limitCents != null) return true;
  if (files.length) return true;
  return Object.values(state.steps).some((record) => {
    if (record.doneAt) return true;
    if (Object.values(record.checks || {}).some(Boolean)) return true;
    return Object.values(record.fields || {}).some((value) => String(value).trim());
  });
}

function normName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const TOTAL_ROW = /^(total|subtotal|grand total|sum|balance|amount due)$/;

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  const source = String(text || "").replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (inQuotes) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else inQuotes = false;
      } else cell += char;
    } else if (char === '"') inQuotes = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") cell += char;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((item) => item.some((value) => String(value).trim() !== ""));
}

function namesMatch(left, right) {
  if (!left || !right) return false;
  if (left === right) return true;
  const shorter = left.length < right.length ? left : right;
  const longer = shorter === left ? right : left;
  return shorter.length > 3 && longer.includes(shorter);
}

export function slugId(name, used) {
  const base = `extra-${normName(name).replace(/\s+/g, "-").slice(0, 40) || "line"}`;
  let id = base;
  let n = 2;
  while (used.has(id)) {
    id = `${base}-${n}`;
    n += 1;
  }
  return id;
}

export function importBuildSheet(categories, csvText) {
  const rows = parseCsv(csvText);
  if (!rows.length) return { error: "That file has no rows.", categories, applied: 0, skipped: [] };
  let start = 0;
  const headerAmount = parseMoney(rows[0][1] ?? "");
  if (!headerAmount || headerAmount.error) start = 1;
  const next = categories.map((category) => ({ ...category }));
  const used = new Set(next.map((category) => category.id));
  let applied = 0;
  const skipped = [];
  for (const row of rows.slice(start)) {
    const firstAmount = parseMoney(row[1] ?? "");
    const lastAmount = parseMoney(row.at(-1) ?? "");
    let name = String(row[0] || "").trim();
    let money = null;
    if (firstAmount && !firstAmount.error) money = firstAmount;
    else if (row.length > 2 && lastAmount && !lastAmount.error) {
      name = row.slice(0, -1).join(", ").trim();
      money = lastAmount;
    }
    if (!name) continue;
    if (TOTAL_ROW.test(normName(name))) continue;
    if (!money || money.error) {
      skipped.push(name);
      continue;
    }
    const target = normName(name);
    const match = next.find((category) => namesMatch(normName(category.name), target));
    if (match) {
      match.cents = money.cents;
      match.source = "entered";
      applied += 1;
    } else {
      const id = slugId(name, used);
      used.add(id);
      next.push({ id, name: name.slice(0, 120), share: 0, cents: money.cents, source: "entered" });
      applied += 1;
    }
  }
  if (!applied) {
    return {
      error: "No amounts found. Use two columns: the part of the house, then the amount.",
      categories,
      applied: 0,
      skipped,
    };
  }
  return { categories: next, applied, skipped, error: null };
}

function csvCell(value) {
  const text = String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

export function sampleCsv() {
  const lines = ["Part,Amount"];
  for (const def of CATEGORY_DEFS) {
    if (def.id === "land") continue;
    lines.push(`${csvCell(def.name)},${(SAMPLE_AMOUNTS[def.id] / 100).toFixed(2)}`);
  }
  lines.push("Total,540000.00");
  return lines.join("\n");
}

export function sampleHouse() {
  let state = blankState();
  state.example = true;
  state.projectName = "Maple Street";
  state.place = "Corner lot in town";
  state = withLimit(state, SAMPLE_LIMIT);
  state = {
    ...state,
    categories: state.categories.map((category) => ({
      ...category,
      cents: SAMPLE_AMOUNTS[category.id] ?? category.cents,
      source: "entered",
    })),
  };
  const doneAt = "2026-04-02T15:00:00.000Z";
  const done = (fields) => ({ fields, checks: {}, doneAt });
  state.steps = {
    wish: done({
      who: "Two adults and one child",
      must: "Three bedrooms, a kitchen with a table, and one bedroom on the first floor",
      later: "A deck, a finished basement, and a third bathroom",
    }),
    budget: done({
      limit: formatAmount(SAMPLE_LIMIT),
      source: "Savings and a construction loan",
    }),
    land: done({
      where: "Maple Street, corner lot",
      price: formatAmount(SAMPLE_AMOUNTS.land),
    }),
    people: done({
      builder: "Harbor and Co. Builders",
      license: "Example license, checked with the state board",
      designer: "North Room Studio",
    }),
    plans: done({}),
  };
  for (const id of ["wish", "budget", "land", "people", "plans"]) {
    const stepChecks = {
      wish: ["shared"],
      budget: ["lender", "cushion-ok"],
      land: ["zoning", "flood", "utilities", "access"],
      people: ["licensed", "contract"],
      plans: ["matches", "rooms", "walkthrough", "fits"],
    }[id];
    state.steps[id].checks = Object.fromEntries(stepChecks.map((check) => [check, true]));
  }
  state.payments = [
    { id: "pay-survey", label: "Lot survey", cents: 220_000, categoryId: "land", on: "2026-03-12" },
    { id: "pay-design", label: "Design drawings", cents: 940_000, categoryId: "plans", on: "2026-03-28" },
  ];
  state.changes = [
    {
      id: "idea-porch",
      label: "Screened porch",
      cents: 2_200_000,
      status: "idea",
      at: "2026-04-02T15:00:00.000Z",
    },
  ];
  state.decisions = [
    {
      id: "decision-limit",
      at: "2026-03-02T15:00:00.000Z",
      text: "Spending limit set to $720,000.",
    },
  ];
  return state;
}

export function formatWhen(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function todayInputValue(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function formatBytes(size) {
  if (!Number.isFinite(size) || size < 1024) return `${Math.max(0, size || 0)} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
