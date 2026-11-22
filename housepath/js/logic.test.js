import assert from "node:assert/strict";
import test from "node:test";
import { STEPS } from "./steps.js";
import { buildPdf } from "./sample.js";
import {
  approvalBlock,
  blankState,
  CATEGORY_DEFS,
  completionBlockers,
  cushionOf,
  formatAmount,
  formatMoney,
  formatWhen,
  importBuildSheet,
  moneySentence,
  normalize,
  parseMoney,
  patchStep,
  resketch,
  sampleCsv,
  sampleHouse,
  summarize,
  todayInputValue,
  touchMoney,
  withCategoryCents,
  withLimit,
} from "./logic.js";

const planFile = [{ kind: "plan", name: "plan.pdf" }];
const sheetFile = [{ kind: "build-sheet", name: "sheet.csv" }];

test("money parses and round-trips", () => {
  assert.equal(parseMoney(""), null);
  assert.equal(parseMoney("  "), null);
  assert.deepEqual(parseMoney("$1,200.50"), { cents: 120050 });
  assert.deepEqual(parseMoney("(40)"), { cents: -4000 });
  assert.equal(parseMoney("abc").error.includes("dollar"), true);
  assert.equal(parseMoney("12.345").error.includes("dollar"), true);
  assert.equal(parseMoney("1000000000").error.includes("100 million"), true);
  assert.equal(formatMoney(120050), "$1,200.50");
  assert.equal(formatMoney(72000000), "$720,000");
  assert.equal(formatMoney(-50000), "−$500");
  assert.deepEqual(parseMoney(formatAmount(120050)), { cents: 120050 });
});

test("a new limit sketches the plan and holds back 10 percent", () => {
  const state = withLimit(blankState(), 100000);
  assert.equal(cushionOf(100000), 10000);
  const sum = state.categories.reduce((total, category) => total + category.cents, 0);
  assert.equal(sum, 90000);
  assert.equal(state.categories.find((category) => category.id === "land").cents, 0);
  assert.equal(CATEGORY_DEFS.reduce((total, category) => total + category.share, 0), 10000);
});

test("setting the land price redraws the rough split around it", () => {
  let state = withLimit(blankState(), 50_000_000);
  state = withCategoryCents(state, "land", 10_000_000);
  const sum = state.categories.reduce((total, category) => total + category.cents, 0);
  assert.equal(sum, 45_000_000);
  assert.equal(state.categories.find((category) => category.id === "land").cents, 10_000_000);
  assert.equal(summarize(state).tone, "ok");
});

test("entered lines survive a new sketch", () => {
  let state = withLimit(blankState(), 100000);
  state = withCategoryCents(state, "land", 20000);
  state = withCategoryCents(state, "frame", 80000);
  state = withLimit(state, 100000);
  assert.equal(state.categories.find((category) => category.id === "land").cents, 20000);
  assert.equal(state.categories.find((category) => category.id === "frame").cents, 80000);
  assert.equal(state.categories.find((category) => category.id === "plans").cents, 0);
  assert.equal(summarize(state).tone, "tight");
  const again = resketch(state.categories, { limitCents: null });
  assert.equal(again.find((category) => category.id === "plans").cents, 0);
  assert.equal(again.find((category) => category.id === "frame").cents, 80000);
});

test("the example house is on the build sheet and using its cushion", () => {
  const state = sampleHouse();
  const summary = summarize(state);
  assert.equal(summary.tone, "tight");
  assert.equal(summary.committed, 69_000_000);
  assert.equal(summary.limitCents - summary.committed, 3_000_000);
  assert.match(moneySentence(summary), /\$42,000/);
  assert.equal(formatWhen("2026-04-02T15:00:00.000Z"), "Apr 2, 2026");
  assert.equal(todayInputValue(new Date("2026-11-22T20:00:00.000Z")), "2026-11-22");
  for (const step of STEPS) {
    if (!state.steps[step.id]?.doneAt) continue;
    const reasons = completionBlockers({ state, steps: STEPS, step, files: planFile });
    assert.deepEqual(reasons, [], step.id);
  }
  const sheet = STEPS.find((step) => step.id === "sheet");
  const blocked = completionBlockers({ state, steps: STEPS, step: sheet, files: planFile });
  assert.equal(blocked.some((reason) => reason.includes("build sheet")), true);
  assert.equal(blocked.some((reason) => reason.includes("cushion")), true);
});

test("a later step stays locked even if its boxes are checked", () => {
  const state = sampleHouse();
  const foundation = STEPS.find((step) => step.id === "foundation");
  const reasons = completionBlockers({
    state: patchStep(state, "foundation", (record) => ({
      ...record,
      checks: Object.fromEntries(foundation.checks.map((check) => [check.id, true])),
    })),
    steps: STEPS,
    step: foundation,
    files: [...planFile, ...sheetFile],
  });
  assert.match(reasons[0], /Price it with a build sheet/);
});

test("the build sheet step finishes only when the price fits", () => {
  let state = sampleHouse();
  state = patchStep(state, "sheet", (record) => ({
    ...record,
    checks: {
      matches: true,
      waiting: true,
      excluded: true,
      "use-cushion": true,
    },
  }));
  const sheet = STEPS.find((step) => step.id === "sheet");
  const files = [...planFile, ...sheetFile];
  assert.deepEqual(completionBlockers({ state, steps: STEPS, step: sheet, files }), []);
  state = touchMoney(withCategoryCents(state, "inside", 20_000_000));
  assert.equal(state.steps.sheet.checks["use-cushion"], false);
  const over = completionBlockers({ state, steps: STEPS, step: sheet, files });
  assert.equal(over.some((reason) => /over the limit/i.test(reason)), true);
});

test("move-in is blocked when the plan is over the limit", () => {
  let state = sampleHouse();
  for (const step of STEPS) {
    if (step.id === "movein") continue;
    state = patchStep(state, step.id, (record) => ({
      ...record,
      doneAt: record.doneAt || "2026-05-01T18:00:00.000Z",
      checks: {
        ...record.checks,
        ...Object.fromEntries((step.checks || []).map((check) => [check.id, true])),
      },
      fields: step.id === "permit" ? { ...record.fields, number: "BP-100" } : record.fields,
    }));
  }
  state = withCategoryCents(state, "inside", 50_000_000);
  const movein = STEPS.find((step) => step.id === "movein");
  const reasons = completionBlockers({
    state,
    steps: STEPS,
    step: movein,
    files: [...planFile, ...sheetFile],
  });
  assert.equal(reasons.some((reason) => /over the limit/i.test(reason)), true);
});

test("a spreadsheet fills the build sheet and ignores the total row", () => {
  const ready = withCategoryCents(withLimit(blankState(), 72_000_000), "land", 15_000_000);
  const result = importBuildSheet(ready.categories, sampleCsv());
  assert.equal(result.error, null);
  assert.equal(result.categories.length, CATEGORY_DEFS.length);
  assert.equal(result.categories.find((category) => category.id === "land").cents, 15_000_000);
  const build = result.categories
    .filter((category) => category.id !== "land")
    .reduce((total, category) => total + category.cents, 0);
  assert.equal(build, 54_000_000);
  const quoted = importBuildSheet(ready.categories, 'Part,Amount\n"Porch, screened","2,200.00"\n');
  assert.equal(quoted.applied, 1);
  assert.equal(quoted.categories.at(-1).cents, 220000);
  assert.equal(quoted.categories.at(-1).name, "Porch, screened");
});

test("a change is refused when it breaks the limit", () => {
  const state = sampleHouse();
  assert.equal(approvalBlock(state, 2_200_000), null);
  assert.match(approvalBlock(state, 4_000_000), /over your limit/);
  assert.match(approvalBlock(blankState(), 100), /spending limit/);
});

test("saved answers drop broken values and keep extra lines", () => {
  const state = normalize({
    example: true,
    projectName: "Oak",
    limitCents: 500,
    categories: [
      { id: "land", cents: 100, source: "entered" },
      { id: "extra-well", name: "Well", cents: 50, source: "entered" },
      { id: "nope", cents: "lots" },
    ],
    payments: [{ id: "p", label: "Survey", cents: 10, on: "2026-01-02" }, { cents: "x" }],
    steps: { wish: { fields: { who: "Ada" }, checks: { shared: true }, doneAt: "2026-01-01T00:00:00.000Z" } },
  });
  assert.equal(state.example, true);
  assert.equal(state.categories.find((category) => category.id === "land").cents, 100);
  assert.equal(state.categories.find((category) => category.id === "extra-well").name, "Well");
  assert.equal(state.categories.some((category) => category.id === "nope"), false);
  assert.equal(state.payments.length, 1);
  assert.equal(state.steps.wish.fields.who, "Ada");
  assert.equal(state.cushionBps, 1000);
});

test("the example plan file is a readable pdf", () => {
  const bytes = buildPdf("Maple Street example. Not a real plan.");
  assert.equal(bytes.startsWith("%PDF-1.4\n"), true);
  assert.equal(bytes.includes("%%EOF"), true);
  const start = Number(bytes.match(/startxref\n(\d+)/)[1]);
  assert.equal(bytes.slice(start, start + 4), "xref");
});
