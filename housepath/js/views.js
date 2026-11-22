import { h } from "./dom.js";
import {
  approvalBlock,
  completionBlockers,
  cushionSentence,
  formatAmount,
  formatBytes,
  formatMoney,
  formatWhen,
  isUnlocked,
  largestCategory,
  meterParts,
  moneySentence,
  parseMoney,
  progress,
  stepRecord,
  summarize,
  todayInputValue,
} from "./logic.js";
import { PHASES, STEPS, WORDS } from "./steps.js";

const KIND_LABELS = {
  plan: "Plans",
  "build-sheet": "Build sheets",
  permit: "Permits",
  occupancy: "Certificate of occupancy",
};

export function previewKind(file) {
  const name = (file.name || "").toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if ((file.type || "").startsWith("image/") || /\.(png|jpe?g|webp)$/.test(name)) return "image";
  return null;
}

function callout(tone, children) {
  return h("div", { class: `callout callout-${tone}` }, children);
}

function moneyInput(id, cents, label, onCommit) {
  const error = h("p", { class: "field-error", id: `${id}-error` });
  const input = h("input", {
    id,
    inputmode: "decimal",
    autocomplete: "off",
    spellcheck: "false",
    "aria-label": label,
    "aria-describedby": error.id,
    value: cents == null ? "" : formatAmount(cents),
  });
  input.addEventListener("focus", () => input.select());
  input.addEventListener("blur", () => {
    const parsed = parseMoney(input.value);
    if (parsed == null) {
      input.value = cents == null ? "" : formatAmount(cents);
      error.textContent = "";
      input.removeAttribute("aria-invalid");
      return;
    }
    if (parsed.error) {
      error.textContent = parsed.error;
      input.setAttribute("aria-invalid", "true");
      return;
    }
    error.textContent = "";
    input.removeAttribute("aria-invalid");
    if (parsed.cents !== cents) onCommit(parsed.cents);
  });
  return h("div", { class: "money-field" }, [
    h("div", { class: "amount" }, [h("span", {}, "$"), input]),
    error,
  ]);
}

function meter(summary) {
  const parts = meterParts(summary);
  const sentence = moneySentence(summary);
  if (!parts) return h("p", { class: "sentence" }, sentence);
  const tickLabel = "Cushion starts";
  return h("div", { class: "meter-wrap" }, [
    h("div", { class: "meter", role: "img", "aria-label": sentence }, [
      h("span", { class: `fill fill-${parts.tone}`, style: `width:${(parts.width * 100).toFixed(2)}%` }),
      h("span", { class: "tick", style: `left:${(parts.tick * 100).toFixed(2)}%`, title: tickLabel }),
    ]),
    h("div", { class: "meter-key" }, [
      h("span", {}, "Filled to the planned total"),
      h("span", {}, tickLabel),
    ]),
    h("p", { class: "sentence" }, sentence),
  ]);
}

function figures(summary) {
  const over = summary.gap != null && summary.gap < 0;
  const items = [
    ["Limit", summary.limitCents, false],
    ["Planned", summary.tone === "unset" ? null : summary.committed, false],
    ["Paid", summary.tone === "unset" ? null : summary.spentCents, false],
    [over ? "Over the limit" : "Left under the limit", summary.gap == null ? null : Math.abs(summary.gap), over],
  ];
  return h("dl", { class: "figures" }, items.map(([label, cents, bad]) =>
    h("div", {}, [
      h("dt", {}, label),
      h("dd", { class: bad ? "over" : "" }, formatMoney(cents)),
    ]),
  ));
}

function stepLink(step, state, route, current) {
  const index = STEPS.findIndex((item) => item.id === step.id);
  const done = Boolean(state.steps[step.id]?.doneAt);
  const now = current?.id === step.id;
  const active = route.name === "step" && route.id === step.id;
  const status = done ? "Done" : now ? "Now" : "Later";
  const classes = ["step-link"];
  if (done) classes.push("done");
  if (now) classes.push("now");
  if (active) classes.push("active");
  return h("a", {
    href: `#step/${step.id}`,
    class: classes.join(" "),
    "aria-current": active ? "step" : null,
  }, [
    h("span", { class: "num" }, String(index + 1).padStart(2, "0")),
    h("span", { class: "step-title" }, step.title),
    h("span", { class: "status" }, status),
  ]);
}

export function renderRail({ state, route, pathOpen, onTogglePath }) {
  const { done, total, current } = progress(STEPS, state);
  const links = [
    ["today", "Today"],
    ["money", "Money"],
    ["papers", "Papers"],
  ];
  const details = h("details", { class: "path", open: pathOpen });
  details.addEventListener("toggle", () => onTogglePath(details.open));
  details.append(
    h("summary", {}, "All 12 steps"),
    h("div", { class: "step-links" }, PHASES.map((phase) =>
      h("div", { class: "phase" }, [
        h("p", { class: "phase-label" }, phase.title),
        ...STEPS.filter((step) => step.phase === phase.id).map((step) => stepLink(step, state, route, current)),
      ]),
    )),
  );
  return h("div", {}, [
    h("p", { class: "rail-progress" }, `${done} of ${total} steps finished`),
    h("div", { class: "nav" }, links.map(([id, label]) =>
      h("a", {
        href: `#${id}`,
        class: route.name === id ? "nav-link now" : "nav-link",
        "aria-current": route.name === id ? "page" : null,
      }, label),
    )),
    details,
    h("p", { class: "rail-note" }, "Saved on this device. Download the papers if you might switch computers."),
  ]);
}

function mapOf(state) {
  const { current } = progress(STEPS, state);
  return h("ol", { class: "map" }, STEPS.map((step, index) => {
    const done = Boolean(state.steps[step.id]?.doneAt);
    const now = current?.id === step.id;
    const status = done ? "Done" : now ? "Now" : "Later";
    return h("li", {}, h("a", {
      href: `#step/${step.id}`,
      class: done ? "done" : now ? "now" : "later",
      title: `${step.title}. ${status}.`,
      "aria-label": `Step ${index + 1}, ${step.title}, ${status}`,
    }, String(index + 1)));
  }));
}

function exampleNote(state) {
  if (!state.example) return null;
  return callout("note", [
    h("p", {}, "This is the Maple Street example, so you can see a house already on the path. Erase it when you want your own numbers."),
  ]);
}

export function renderToday({ state, files, storageBroken }) {
  const summary = summarize(state);
  const { done, total, current } = progress(STEPS, state);
  const phase = current ? PHASES.find((item) => item.id === current.phase) : null;
  const reasons = current
    ? completionBlockers({ state, steps: STEPS, step: current, files: files || [] })
    : [];
  return h("div", {}, [
    exampleNote(state),
    storageBroken
      ? callout("over", [h("p", {}, "This browser blocked saving. Your answers will disappear when you close the tab.")])
      : null,
    current
      ? h("p", { class: "kicker" }, `Step ${STEPS.indexOf(current) + 1} of ${total} · ${phase?.title || ""}`)
      : h("p", { class: "kicker" }, `${total} of ${total} finished`),
    h("h1", {}, current ? current.title : "You walked the whole path"),
    h("p", { class: "lede" }, current
      ? current.plain
      : "If the certificate of occupancy is in hand and the money page is still within the limit, this house is ready to live in."),
    h("p", { class: "why" }, current
      ? "You can open a later step and read it. You cannot finish it until the earlier steps are done."
      : "The papers and the money record stay on this device."),
    current ? h("div", { class: "actions" }, [
      h("a", { class: "btn", href: `#step/${current.id}` }, "Open this step"),
    ]) : null,
    mapOf(state),
    h("div", { class: "split" }, [
      h("section", {}, [
        h("h2", {}, "The money"),
        meter(summary),
        figures(summary),
        h("p", {}, h("a", { href: "#money" }, "Open the money page")),
      ]),
      h("section", {}, [
        h("h2", {}, current ? "To finish this step" : "What you kept"),
        reasons.length
          ? h("ul", { class: "blockers" }, reasons.slice(0, 4).map((reason) => h("li", {}, reason)))
          : h("p", {}, current ? "The pieces for this step are in place. Open it and finish it." : `${done} steps are finished.`),
      ]),
    ]),
    h("h2", {}, "The path"),
    h("div", {}, STEPS.map((step, index) => {
      const doneAt = state.steps[step.id]?.doneAt;
      const now = current?.id === step.id;
      const status = doneAt ? "Done" : now ? "Now" : "Later";
      return h("a", { class: `step-row${now ? " now" : ""}`, href: `#step/${step.id}` }, [
        h("span", { class: "num" }, String(index + 1).padStart(2, "0")),
        h("span", {}, [
          h("strong", {}, step.title),
          h("span", { class: "soon" }, step.soon),
        ]),
        h("span", { class: "status" }, status),
      ]);
    })),
    h("section", { class: "words" }, [
      h("h2", {}, "Words you will hear"),
      h("dl", {}, WORDS.flatMap(([term, meaning]) => [h("dt", {}, term), h("dd", {}, meaning)])),
    ]),
    h("p", { class: "footnote" }, "This keeps the order and the money in front of you. It does not replace a licensed builder, a lender, or the town inspector."),
  ]);
}

function textControl(step, field, value, onField) {
  const tag = field.type === "textarea" ? "textarea" : "input";
  const input = h(tag, {
    id: `field-${step.id}-${field.id}`,
    maxlength: field.type === "textarea" ? "4000" : "500",
    placeholder: field.placeholder || "",
    value: value || "",
    autocomplete: "off",
  });
  const send = (paint) => onField(step.id, field.id, input.value, { paint });
  input.addEventListener("input", () => send(false));
  input.addEventListener("blur", () => send(true));
  return input;
}

function fileBlock(step, upload, files, blobUrl, onUpload, onAskRemove) {
  const mine = files.filter((file) => file.kind === upload.kind);
  const input = h("input", {
    type: "file",
    accept: upload.accept,
    multiple: true,
  });
  input.addEventListener("change", () => {
    if (input.files?.length) onUpload(step.id, upload.kind, input.files);
    input.value = "";
  });
  return h("section", {}, [
    h("h2", {}, upload.label),
    h("p", { class: "hint" }, upload.help),
    h("label", { class: "upload" }, [input, h("span", {}, "Add a file")]),
    mine.length ? h("ul", { class: "files" }, mine.map((file) => fileRow(file, blobUrl, onAskRemove))) : null,
  ]);
}

function fileRow(file, blobUrl, onAskRemove) {
  const kind = previewKind(file);
  const url = file.blob ? blobUrl(file.blob) : "";
  return h("li", {}, [
    h("span", {}, [
      h("strong", {}, file.name),
      h("span", { class: "file-meta" }, ` ${formatBytes(file.size)} · ${formatWhen(file.addedAt)}`),
    ]),
    url && kind === "pdf" ? h("a", { href: url, target: "_blank", rel: "noopener" }, "Open") : null,
    url ? h("a", { href: url, download: file.name }, "Download") : null,
    h("button", { type: "button", class: "text-btn", onclick: () => onAskRemove(file) }, "Remove"),
    url && kind === "image" ? h("img", { class: "preview", alt: file.name, src: url }) : null,
  ]);
}

export function renderStep(api) {
  const { state, files, route, onField, onCheck, onUpload, onAskRemove, onComplete, onReopen } = api;
  const step = STEPS.find((item) => item.id === route.id);
  if (!step) return renderToday(api);
  const summary = summarize(state);
  const index = STEPS.indexOf(step);
  const phase = PHASES.find((item) => item.id === step.phase);
  const record = stepRecord(state, step.id);
  const unlocked = isUnlocked(STEPS, state, step.id);
  const earlier = STEPS.slice(0, index).find((item) => !state.steps[item.id]?.doneAt);
  const reasons = completionBlockers({ state, steps: STEPS, step, files });
  const checks = [...(step.checks || [])];
  if (step.confirmSheet && summary.tone === "tight") {
    checks.unshift({
      id: "use-cushion",
      label: `I mean to spend part of the cushion. ${formatMoney(summary.committed - summary.planCents)} of it is in this plan, with ${formatMoney(summary.gap)} left under the limit.`,
    });
  }
  const unconfirmed = state.categories.filter((category) => category.id !== "land" && category.source !== "entered");
  const later = state.steps.wish?.fields?.later;

  return h("div", {}, [
    exampleNote(state),
    h("p", { class: "kicker" }, `Step ${index + 1} of ${STEPS.length} · ${phase?.title || ""}`),
    h("h1", {}, step.title),
    h("p", { class: "lede" }, step.plain),
    h("p", { class: "why" }, step.why),
    unlocked ? null : callout("locked", [
      h("p", {}, `You can read this step so you know what is coming. It stays locked until “${earlier?.title || "the earlier step"}” is finished.`),
    ]),
    record.doneAt ? callout("ok", [
      h("p", {}, `Finished ${formatWhen(record.doneAt)}.`),
    ]) : null,
    step.confirmSheet ? h("section", {}, [
      h("h2", {}, "Does the price fit?"),
      meter(summary),
      summary.tone === "over" ? callout("over", [
        h("p", {}, moneySentence(summary)),
        largestLine(state) ? h("p", {}, largestLine(state)) : null,
        later ? h("p", {}, `You said these could wait: ${later}`) : null,
        h("p", {}, h("a", { href: "#money" }, "Fix it on the money page")),
      ]) : null,
      unconfirmed.length ? h("p", {}, "The lines on the money page start as a rough split, not a builder’s price. Confirm each one against the build sheet.") : null,
      h("p", {}, h("a", { href: "#money" }, "Open the money page")),
    ]) : null,
    ...(step.fields || []).map((field) => h("label", { class: "field" }, [
      h("span", {}, field.label),
      field.hint ? h("span", { class: "hint" }, field.hint) : null,
      field.type === "money"
        ? moneyInput(`field-${step.id}-${field.id}`, moneyFieldCents(state, step, field, record), field.label, (cents) => {
            onField(step.id, field.id, formatAmount(cents), { paint: true });
          })
        : textControl(step, field, record.fields?.[field.id] || "", onField),
    ])),
    step.id === "budget" ? h("p", { class: "why" }, cushionSentence(summary.limitCents)) : null,
    ...(step.uploads || []).map((upload) => fileBlock(step, upload, files, api.blobUrl, onUpload, onAskRemove)),
    h("label", { class: "field" }, [
      h("span", {}, "Notes"),
      textControl(step, { id: "notes", type: "textarea", placeholder: "Dates, names, anything you need at the next meeting" }, record.fields?.notes || "", onField),
    ]),
    h("div", { class: "checks" }, checks.map((check) => h("label", { class: "check" }, [
      h("input", {
        type: "checkbox",
        id: `check-${step.id}-${check.id}`,
        checked: Boolean(record.checks?.[check.id]),
        disabled: !unlocked,
        onchange: (event) => onCheck(step.id, check.id, event.target.checked),
      }),
      h("span", {}, check.label),
    ]))),
    h("div", { class: "finish" }, finishBox({ step, record, unlocked, reasons, onComplete, onReopen })),
  ]);
}

function moneyFieldCents(state, step, field, record) {
  const raw = record.fields?.[field.id];
  const parsed = parseMoney(raw);
  if (parsed && !parsed.error) return parsed.cents;
  if (step.id === "budget" && field.id === "limit") return state.limitCents;
  if (step.id === "land" && field.id === "price") {
    return state.categories.find((category) => category.id === "land")?.cents ?? null;
  }
  return null;
}

function largestLine(state) {
  const big = largestCategory(state.categories.filter((category) => category.cents > 0));
  if (!big) return "";
  return `The largest line is ${big.name} at ${formatMoney(big.cents)}. That is the first place to simplify.`;
}

function finishBox({ step, record, unlocked, reasons, onComplete, onReopen }) {
  if (!unlocked) return null;
  if (record.doneAt) {
    return h("button", { type: "button", class: "btn quiet", onclick: () => onReopen(step.id) }, "Reopen this step");
  }
  return h("div", {}, [
    h("button", {
      type: "button",
      class: "btn",
      disabled: reasons.length > 0,
      onclick: () => onComplete(step.id),
    }, reasons.length ? "This step is not done yet" : "This step is done"),
    reasons.length ? h("div", {}, [
      h("p", {}, "You can finish this step after:"),
      h("ul", { class: "blockers" }, reasons.map((reason) => h("li", {}, reason))),
    ]) : h("p", { class: "hint" }, "Finishing unlocks the next step."),
  ]);
}

function shareText(category, summary) {
  if (category.id === "land") {
    return category.source === "entered" ? "Entered with the lot" : "Set this in the land step";
  }
  if (!summary.planCents) return "";
  const percent = Math.round((category.cents / summary.planCents) * 100);
  const kind = category.source === "entered" ? "On your sheet" : "Rough split";
  return `${kind} · ${percent}% of what you may plan`;
}

export function renderMoney(api) {
  const { state, trial, onCategory, onRemoveCategory, onLimit, onPayment, onDeletePayment, onTry, onIdea, onApprove, onDeleteChange } = api;
  const summary = summarize(state);
  const big = largestCategory(state.categories.filter((category) => category.cents > 0));
  const later = state.steps.wish?.fields?.later;
  return h("div", {}, [
    exampleNote(state),
    h("p", { class: "kicker" }, "Plan the money before the work"),
    h("h1", {}, "The money"),
    h("p", { class: "lede" }, "One limit. Ten percent stays untouched as a cushion. The build sheet has to fit in what is left, or the next step stays locked."),
    meter(summary),
    figures(summary),
    summary.paidAbovePlan
      ? callout("over", [h("p", {}, `You have paid ${formatMoney(summary.spentCents - summary.committed)} more than the plan lists. Add the missing cost to a line or as a change.`)])
      : null,
    summary.tone === "over"
      ? callout("over", [
          h("p", {}, big ? `The largest line is ${big.name} at ${formatMoney(big.cents)}. Start there if you need to simplify.` : "Lower a line, or raise the limit on purpose."),
          later ? h("p", {}, `You said these could wait: ${later}`) : null,
        ])
      : null,
    h("h2", {}, "Where the money goes"),
    summary.tone === "unset"
      ? h("p", {}, "Set a limit in step 2. A rough split will show up so you can plan, and you will replace it with the build sheet.")
      : h("p", { class: "hint" }, "Lines marked “rough split” are a sketch, not a bid. Change the number, or confirm it, once you have the build sheet."),
    h("div", {}, state.categories.map((category) => h("div", { class: "line" }, [
      h("div", {}, [
        h("div", { class: "line-name" }, category.name),
        h("div", { class: "line-meta" }, shareText(category, summary)),
      ]),
      moneyInput(`cat-${category.id}`, category.cents, category.name, (cents) => onCategory(category.id, cents)),
      category.source !== "entered" && category.id !== "land" && summary.tone !== "unset"
        ? h("button", {
            type: "button",
            class: "btn quiet",
            onclick: () => onCategory(category.id, category.cents),
          }, "This is the sheet amount")
        : null,
      category.id.startsWith("extra-")
        ? h("button", { type: "button", class: "text-btn", onclick: () => onRemoveCategory(category.id) }, "Remove line")
        : null,
    ]))),
    h("h2", {}, "Try a cost before you say yes"),
    h("p", {}, "A change order is a written price for anything that was not on the build sheet. See if it fits before you approve it."),
    tryForm(onTry),
    trial ? callout(trial.summary.tone === "unset" ? "note" : trial.summary.tone, [
      h("p", {}, `${trial.label}: ${formatMoney(trial.cents)}. ${moneySentence(trial.summary)}`),
      trial.block ? h("p", {}, trial.block) : null,
      h("div", { class: "row" }, [
        h("button", { type: "button", class: "btn quiet", onclick: () => onIdea(trial) }, "Save this as an idea"),
        trial.block ? null : h("button", { type: "button", class: "btn", onclick: () => onApprove(trial) }, "Approve it"),
      ]),
    ]) : null,
    h("h2", {}, "Changes"),
    state.changes.length ? null : h("p", { class: "hint" }, "Ideas stay out of the total until you approve them."),
    h("ul", { class: "change-list" }, state.changes.map((change) => {
      const block = change.status === "idea" ? approvalBlock(state, change.cents) : null;
      return h("li", {}, [
        h("span", {}, [
          h("strong", {}, change.label),
          h("span", { class: "file-meta" }, change.status === "approved" ? " Approved" : " Idea, not in the total"),
          block ? h("span", { class: "hint" }, block) : null,
        ]),
        h("span", { class: "money" }, formatMoney(change.cents)),
        h("span", { class: "row" }, [
          change.status === "idea"
            ? h("button", { type: "button", class: "btn quiet", disabled: Boolean(block), onclick: () => onApprove(change) }, "Approve")
            : null,
          h("button", { type: "button", class: "text-btn", onclick: () => onDeleteChange(change.id) }, "Remove"),
        ]),
      ]);
    })),
    h("h2", {}, "Payments"),
    paymentForm(state, onPayment),
    h("ul", { class: "pay-list" }, state.payments.map((payment) => h("li", {}, [
      h("span", {}, [
        h("strong", {}, payment.label),
        h("span", { class: "file-meta" }, ` ${payment.on || ""}`),
      ]),
      h("span", { class: "money" }, formatMoney(payment.cents)),
      h("button", { type: "button", class: "text-btn", onclick: () => onDeletePayment(payment.id) }, "Remove"),
    ]))),
    summary.leftToPay >= 0 && summary.tone !== "unset"
      ? h("p", {}, `Still unpaid on the plan: ${formatMoney(summary.leftToPay)}.`)
      : null,
    h("h2", {}, "Limit"),
    raiseLimit(state, onLimit),
    state.decisions.length ? h("h2", {}, "Decisions") : null,
    state.decisions.length ? h("ul", { class: "decisions" }, [...state.decisions].reverse().map((decision) =>
      h("li", {}, [
        h("span", {}, decision.text),
        h("span", { class: "file-meta" }, formatWhen(decision.at)),
      ]),
    )) : null,
  ]);
}

function tryForm(onTry) {
  const label = h("input", { id: "try-label", maxlength: "200", placeholder: "Screened porch" });
  const amount = h("input", { id: "try-amount", inputmode: "decimal", placeholder: "22000" });
  const error = h("p", { class: "field-error" });
  const button = h("button", { type: "button", class: "btn quiet" }, "See if it fits");
  button.addEventListener("click", () => {
    const name = label.value.trim();
    const parsed = parseMoney(amount.value);
    if (!name) {
      error.textContent = "Name the change.";
      return;
    }
    if (!parsed || parsed.error || parsed.cents === 0) {
      error.textContent = parsed?.error || "Enter the cost. A credit starts with a minus.";
      return;
    }
    error.textContent = "";
    onTry(name, parsed.cents);
  });
  return h("div", {}, [
    h("div", { class: "try" }, [
      h("label", {}, ["What is it?", label]),
      h("label", {}, ["Cost", amount]),
      button,
    ]),
    error,
  ]);
}

function paymentForm(state, onPayment) {
  const label = h("input", { id: "pay-label", maxlength: "200", placeholder: "Foundation draw" });
  const amount = h("input", { id: "pay-amount", inputmode: "decimal", placeholder: "0" });
  const date = h("input", { id: "pay-date", type: "date", value: todayInputValue() });
  const category = h("select", { id: "pay-category" }, state.categories.map((item) =>
    h("option", { value: item.id }, item.name),
  ));
  const error = h("p", { class: "field-error" });
  const button = h("button", { type: "button", class: "btn quiet" }, "Add this payment");
  button.addEventListener("click", () => {
    const name = label.value.trim();
    const parsed = parseMoney(amount.value);
    if (!name) {
      error.textContent = "Write what the payment was for.";
      return;
    }
    if (!parsed || parsed.error || parsed.cents <= 0) {
      error.textContent = parsed?.error || "Enter the amount you paid.";
      return;
    }
    error.textContent = "";
    onPayment({ label: name, cents: parsed.cents, categoryId: category.value, on: date.value });
  });
  return h("div", {}, [
    h("div", { class: "stack" }, [
      h("label", {}, ["What was it for?", label]),
      h("label", {}, ["Amount", amount]),
      h("label", {}, ["Date", date]),
      h("label", {}, ["Part of the house", category]),
    ]),
    error,
    button,
  ]);
}

function raiseLimit(state, onLimit) {
  const input = h("input", {
    id: "raise-limit",
    inputmode: "decimal",
    value: state.limitCents == null ? "" : formatAmount(state.limitCents),
  });
  const ack = h("input", { type: "checkbox", id: "raise-ack" });
  const error = h("p", { class: "field-error" });
  const button = h("button", { type: "button", class: "btn" }, "Save the limit");
  button.addEventListener("click", () => {
    const parsed = parseMoney(input.value);
    if (!parsed || parsed.error || parsed.cents <= 0) {
      error.textContent = parsed?.error || "Enter the limit.";
      return;
    }
    const raising = state.limitCents != null && parsed.cents > state.limitCents;
    if (raising && !ack.checked) {
      error.textContent = "Check the box if you mean to raise the limit.";
      return;
    }
    if (state.limitCents === parsed.cents) {
      error.textContent = "That is already the limit.";
      return;
    }
    error.textContent = "";
    onLimit(parsed.cents);
  });
  return h("details", { class: "raise" }, [
    h("summary", {}, "Change the limit on purpose"),
    h("p", {}, "Raising the limit is a decision you write down. Lowering it is allowed too. Either way, the cushion stays at 10% of the new number."),
    h("label", { class: "field" }, ["New limit", h("div", { class: "amount" }, [h("span", {}, "$"), input])]),
    h("label", { class: "check" }, [
      ack,
      h("span", {}, "If this number is higher, I am choosing a higher limit on purpose."),
    ]),
    error,
    button,
  ]);
}

export function renderPapers(api) {
  const { state, files, blobUrl, onAskRemove, onDownloadAnswers } = api;
  const order = ["plan", "build-sheet", "permit", "occupancy"];
  const kinds = [...new Set([...order, ...files.map((file) => file.kind)])];
  return h("div", {}, [
    exampleNote(state),
    h("p", { class: "kicker" }, "On file"),
    h("h1", {}, "Papers"),
    h("p", { class: "lede" }, "Plans, the build sheet, the permit, and the certificate of occupancy stay with the house. They are saved on this device."),
    h("div", { class: "actions" }, [
      h("button", { type: "button", class: "btn quiet", onclick: onDownloadAnswers }, "Download my answers"),
      h("a", { href: "#step/plans" }, "Add plans"),
      h("a", { href: "#step/sheet" }, "Add the build sheet"),
    ]),
    files.length ? null : h("p", {}, "Nothing is filed yet. Add the drawings on the plans step, and the builder’s price on the build-sheet step."),
    ...kinds.map((kind) => {
      const mine = files.filter((file) => file.kind === kind).sort((a, b) => String(a.addedAt).localeCompare(String(b.addedAt)));
      if (!mine.length) return null;
      return h("section", {}, [
        h("h2", {}, KIND_LABELS[kind] || "Other"),
        h("ul", { class: "files" }, mine.map((file) => fileRow(file, blobUrl, onAskRemove))),
      ]);
    }),
  ]);
}

export function renderDialog(pending) {
  if (!pending) return null;
  const back = h("div", { class: "modal-back" }, [
    h("div", { class: "modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "dialog-title" }, [
      h("h2", { id: "dialog-title" }, pending.title),
      h("p", {}, pending.body),
      h("div", { class: "row" }, [
        h("button", { type: "button", class: "btn danger", onclick: pending.onYes }, pending.yes),
        h("button", { type: "button", class: "btn quiet", id: "dialog-keep", onclick: pending.onNo }, "Keep it"),
      ]),
    ]),
  ]);
  back.addEventListener("click", (event) => {
    if (event.target === back) pending.onNo();
  });
  return back;
}

export function renderMain(api) {
  if (api.route.name === "money") return renderMoney(api);
  if (api.route.name === "papers") return renderPapers(api);
  if (api.route.name === "step") return renderStep(api);
  return renderToday(api);
}
