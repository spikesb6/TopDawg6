import { clear } from "./dom.js";
import {
  approvalBlock,
  blankState,
  completionBlockers,
  currentStep,
  formatAmount,
  formatMoney,
  hasProgress,
  importBuildSheet,
  isUnlocked,
  normalize,
  parseMoney,
  patchStep,
  reopenFrom,
  stepRecord,
  summarize,
  touchMoney,
  uid,
  sampleHouse,
  withCategoryCents,
  withLimit,
  MAX_FILE_BYTES,
} from "./logic.js";
import { STEPS } from "./steps.js";
import { sampleFiles } from "./sample.js";
import { createStore } from "./store.js";
import { renderDialog, renderMain, renderRail } from "./views.js";

const store = createStore();
const desktop = window.matchMedia("(min-width: 861px)");

let state = blankState();
let files = [];
let pathOpen = desktop.matches;
let pending = null;
let trial = null;
let storageBroken = false;
let liveUrls = [];

const rail = document.getElementById("rail");
const main = document.getElementById("main");
const dialog = document.getElementById("dialog");
const announceNode = document.getElementById("announce");

function announce(text) {
  announceNode.textContent = "";
  announceNode.textContent = text;
}

function route() {
  const hash = location.hash.replace(/^#/, "");
  if (hash === "money" || hash === "papers") return { name: hash };
  if (hash.startsWith("step/")) {
    const id = decodeURIComponent(hash.slice(5));
    if (STEPS.some((step) => step.id === id)) return { name: "step", id };
  }
  return { name: "today" };
}

function blobUrl(blob) {
  const url = URL.createObjectURL(blob);
  liveUrls.push(url);
  return url;
}

function paintPill() {
  const summary = summarize(state);
  const pill = document.getElementById("pill");
  let text = "Set a limit";
  let tone = "unset";
  if (summary.overSpent) {
    text = "Paid over the limit";
    tone = "over";
  } else if (summary.tone === "over") {
    text = `Over by ${formatMoney(summary.committed - summary.limitCents)}`;
    tone = "over";
  } else if (summary.tone === "tight") {
    text = "Using cushion";
    tone = "tight";
  } else if (summary.tone === "ok") {
    text = "Under budget";
    tone = "ok";
  }
  pill.textContent = text;
  pill.className = `pill pill-${tone}`;
}

function fillIdentity() {
  const name = document.getElementById("project-name");
  const place = document.getElementById("project-place");
  if (document.activeElement !== name && name.value !== state.projectName) name.value = state.projectName;
  if (document.activeElement !== place && place.value !== state.place) place.value = state.place;
}

function paintTitle() {
  const house = state.projectName.trim() || "Housepath";
  const here = route();
  if (here.name === "step") {
    const step = STEPS.find((item) => item.id === here.id);
    document.title = step ? `${step.title} · ${house}` : house;
  } else if (here.name === "money") document.title = `Money · ${house}`;
  else if (here.name === "papers") document.title = `Papers · ${house}`;
  else document.title = house === "Housepath" ? "Housepath" : `${house} · Housepath`;
}

function recheck(next) {
  for (const step of STEPS) {
    if (!next.steps[step.id]?.doneAt) continue;
    const reasons = completionBlockers({ state: next, steps: STEPS, step, files });
    if (reasons.length) return { next: reopenFrom(next, STEPS, step.id), opened: step };
  }
  return { next, opened: null };
}

function persist() {
  store.save(state).catch(() => announce("Could not save on this device."));
}

function commit(next) {
  const checked = recheck(next);
  state = checked.next;
  persist();
  if (checked.opened) {
    announce(`“${checked.opened.title}” is open again. Later steps stay locked until it is finished.`);
  }
  render();
}

function withDecision(next, text) {
  return {
    ...next,
    decisions: [...next.decisions, { id: uid(), at: new Date().toISOString(), text }],
  };
}

function render() {
  const previous = liveUrls;
  liveUrls = [];
  const here = route();
  paintPill();
  fillIdentity();
  paintTitle();
  const api = {
    state,
    files,
    route: here,
    pathOpen,
    trial,
    storageBroken,
    onTogglePath: (open) => {
      pathOpen = open;
    },
    onField,
    onCheck,
    onUpload,
    onAskRemove,
    onComplete,
    onReopen,
    onCategory,
    onRemoveCategory,
    onLimit,
    onPayment,
    onDeletePayment,
    onTry,
    onIdea,
    onApprove,
    onDeleteChange,
    onDownloadAnswers,
    blobUrl,
  };
  clear(rail);
  rail.append(renderRail(api));
  clear(main);
  main.append(renderMain(api));
  clear(dialog);
  const modal = renderDialog(pending);
  if (modal) dialog.append(modal);
  document.getElementById("dialog-keep")?.focus();
  for (const url of previous) URL.revokeObjectURL(url);
}

function onField(stepId, fieldId, value, { paint }) {
  let next = patchStep(state, stepId, (record) => ({
    ...record,
    fields: { ...record.fields, [fieldId]: value.slice(0, 4000) },
  }));
  if (paint && stepId === "budget" && fieldId === "limit") {
    const parsed = parseMoney(value);
    if (parsed && !parsed.error && parsed.cents > 0 && parsed.cents !== next.limitCents) {
      const previous = next.limitCents;
      next = touchMoney(withLimit(next, parsed.cents));
      const text = previous == null
        ? `Spending limit set to ${formatMoney(parsed.cents)}.`
        : `Spending limit changed from ${formatMoney(previous)} to ${formatMoney(parsed.cents)}.`;
      next = withDecision(next, text);
    }
  }
  if (paint && stepId === "land" && fieldId === "price") {
    const parsed = parseMoney(value);
    if (parsed && !parsed.error && parsed.cents >= 0) {
      const land = next.categories.find((category) => category.id === "land");
      if (!land || land.cents !== parsed.cents || land.source !== "entered") {
        next = touchMoney(withCategoryCents(next, "land", parsed.cents));
      }
    }
  }
  if (!paint) {
    state = next;
    persist();
    paintPill();
    return;
  }
  commit(next);
}

function onCheck(stepId, checkId, checked) {
  commit(patchStep(state, stepId, (record) => ({
    ...record,
    checks: { ...record.checks, [checkId]: Boolean(checked) },
  })));
}

function allowedFile(kind, name) {
  if (kind === "build-sheet") return /\.(pdf|png|jpe?g|webp|csv)$/i.test(name);
  return /\.(pdf|png|jpe?g|webp)$/i.test(name);
}

async function onUpload(stepId, kind, fileList) {
  let notice = "";
  try {
    for (const file of [...fileList]) {
      if (files.length >= 40) {
        notice = "You can keep 40 files. Remove one, then add another.";
        break;
      }
      if (!allowedFile(kind, file.name)) {
        notice = kind === "build-sheet"
          ? "Use a PDF, a photo, or a .csv spreadsheet."
          : "Use a PDF or a photo.";
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        notice = `${file.name} is larger than 20 MB. Add a smaller copy.`;
        continue;
      }
      const isCsv = kind === "build-sheet" && /\.csv$/i.test(file.name);
      const csvText = isCsv ? await file.text() : null;
      await store.addFile({
        id: uid(),
        stepId,
        kind,
        name: file.name.slice(0, 180),
        type: file.type || (isCsv ? "text/csv" : "application/octet-stream"),
        size: file.size,
        addedAt: new Date().toISOString(),
        blob: file,
      });
      files = await store.listFiles();
      if (csvText != null) {
        const result = importBuildSheet(state.categories, csvText);
        if (result.error) notice = result.error;
        else {
          state = touchMoney({ ...state, categories: result.categories });
          notice = `Filled ${result.applied} lines from the spreadsheet. Check them against the builder’s file.`;
        }
      } else notice = `${file.name} is filed.`;
    }
  } catch {
    notice = "That file could not be saved on this device.";
  }
  const checked = recheck(state);
  state = checked.next;
  persist();
  if (checked.opened) {
    notice = `“${checked.opened.title}” is open again. Later steps stay locked until it is finished.`;
  }
  if (notice) announce(notice);
  render();
}

function onAskRemove(file) {
  pending = {
    title: "Remove this file?",
    body: `${file.name} will be removed from this device.`,
    yes: "Remove",
    onYes: () => {
      pending = null;
      removeFile(file.id);
    },
    onNo: () => {
      pending = null;
      render();
    },
  };
  render();
}

async function removeFile(id) {
  try {
    await store.removeFile(id);
    files = await store.listFiles();
  } catch {
    announce("That file could not be removed.");
    render();
    return;
  }
  commit(state);
}

function onComplete(stepId) {
  const step = STEPS.find((item) => item.id === stepId);
  const reasons = completionBlockers({ state, steps: STEPS, step, files });
  if (reasons.length || !isUnlocked(STEPS, state, stepId)) return;
  state = patchStep(state, stepId, (record) => ({
    ...record,
    doneAt: new Date().toISOString(),
  }));
  persist();
  announce(`${step.title} is finished.`);
  const upcoming = currentStep(STEPS, state);
  const nextHash = upcoming ? `#step/${upcoming.id}` : "#today";
  if (location.hash === nextHash) render();
  else location.hash = nextHash;
}

function onReopen(stepId) {
  const step = STEPS.find((item) => item.id === stepId);
  state = reopenFrom(state, STEPS, stepId);
  persist();
  announce(`“${step.title}” is open again. Later steps stay locked until it is finished.`);
  render();
}

function onCategory(id, cents) {
  let next = touchMoney(withCategoryCents(state, id, cents));
  if (id === "land") {
    next = patchStep(next, "land", (record) => ({
      ...record,
      fields: { ...record.fields, price: formatAmount(cents) },
    }));
  }
  commit(next);
}

function onRemoveCategory(id) {
  if (!id.startsWith("extra-")) return;
  commit(touchMoney({
    ...state,
    categories: state.categories.filter((category) => category.id !== id),
  }));
}

function onLimit(cents) {
  const previous = state.limitCents;
  let next = touchMoney(withLimit(state, cents));
  next = patchStep(next, "budget", (record) => ({
    ...record,
    fields: { ...stepRecord(next, "budget").fields, limit: formatAmount(cents) },
  }));
  const text = previous == null
    ? `Spending limit set to ${formatMoney(cents)}.`
    : `Spending limit changed from ${formatMoney(previous)} to ${formatMoney(cents)}.`;
  commit(withDecision(next, text));
}

function onPayment(payment) {
  commit(touchMoney({
    ...state,
    payments: [...state.payments, { ...payment, id: uid() }],
  }));
  announce("Payment added.");
}

function onDeletePayment(id) {
  commit(touchMoney({
    ...state,
    payments: state.payments.filter((payment) => payment.id !== id),
  }));
}

function onTry(label, cents) {
  trial = {
    label,
    cents,
    summary: summarize({
      ...state,
      changes: [...state.changes, { status: "approved", cents, id: "preview", label }],
    }),
    block: approvalBlock(state, cents),
  };
  render();
}

function onIdea(change) {
  trial = null;
  state = {
    ...state,
    changes: [...state.changes, {
      id: uid(),
      label: change.label,
      cents: change.cents,
      status: "idea",
      at: new Date().toISOString(),
    }],
  };
  persist();
  announce("Saved with the ideas. It is not in the total until you approve it.");
  render();
}

function onApprove(change) {
  const block = approvalBlock(state, change.cents);
  if (block) {
    announce(block);
    return;
  }
  trial = null;
  const exists = state.changes.some((item) => item.id && item.id === change.id);
  const changes = exists
    ? state.changes.map((item) => (item.id === change.id ? { ...item, status: "approved" } : item))
    : [...state.changes, {
        id: uid(),
        label: change.label,
        cents: change.cents,
        status: "approved",
        at: new Date().toISOString(),
      }];
  commit(withDecision(touchMoney({ ...state, changes }), `Approved a change: ${change.label}, ${formatMoney(change.cents)}.`));
}

function onDeleteChange(id) {
  trial = null;
  commit(touchMoney({
    ...state,
    changes: state.changes.filter((change) => change.id !== id),
  }));
}

function onDownloadAnswers() {
  const blob = new Blob([JSON.stringify(normalize(state), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "housepath-answers.json";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function askExample() {
  const run = () => {
    pending = null;
    loadExample();
  };
  if (!hasProgress(state, files)) {
    run();
    return;
  }
  pending = {
    title: "Look at the example house?",
    body: "This replaces the house saved on this device, including its papers.",
    yes: "Replace it",
    onYes: run,
    onNo: () => {
      pending = null;
      render();
    },
  };
  render();
}

async function loadExample() {
  try {
    await store.clear();
    state = sampleHouse();
    await store.save(state);
    for (const file of await sampleFiles()) await store.addFile(file);
    files = await store.listFiles();
    trial = null;
    location.hash = "#today";
    announce("Maple Street is loaded. The price uses part of the cushion.");
    render();
  } catch {
    announce("The example could not be saved on this device.");
    render();
  }
}

function askErase() {
  if (!hasProgress(state, files)) {
    announce("There is nothing to erase yet.");
    return;
  }
  pending = {
    title: "Erase this house?",
    body: "This removes the answers, the plans, and the build sheet saved on this device.",
    yes: "Erase",
    onYes: () => {
      pending = null;
      erase();
    },
    onNo: () => {
      pending = null;
      render();
    },
  };
  render();
}

async function erase() {
  try {
    await store.clear();
  } catch {
    announce("Could not erase what is saved on this device.");
  }
  state = blankState();
  files = [];
  trial = null;
  location.hash = "#today";
  announce("Erased. You can start again.");
  render();
}

function bind() {
  const name = document.getElementById("project-name");
  const place = document.getElementById("project-place");
  name.addEventListener("input", () => {
    state = { ...state, projectName: name.value };
    persist();
  });
  place.addEventListener("input", () => {
    state = { ...state, place: place.value };
    persist();
  });
  document.getElementById("pill").addEventListener("click", () => {
    location.hash = "#money";
  });
  document.getElementById("example").addEventListener("click", askExample);
  document.getElementById("erase").addEventListener("click", askErase);
  window.addEventListener("hashchange", () => {
    if (route().name !== "money") trial = null;
    render();
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && pending) {
      pending.onNo();
    }
  });
  desktop.addEventListener("change", () => {
    if (desktop.matches) pathOpen = true;
    render();
  });
}

async function boot() {
  try {
    const saved = await store.load();
    if (saved) state = normalize(saved);
    files = await store.listFiles();
  } catch {
    storageBroken = true;
  }
  bind();
  render();
  if (storageBroken) announce("This browser blocked saving. Your answers will disappear when you close the tab.");
}

boot();
