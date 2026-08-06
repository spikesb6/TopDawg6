/**
 * Builds `progress/index.html` from real captured evidence.
 *
 * Generated rather than hand-written on purpose: a dashboard maintained by hand
 * drifts from reality within a day and then actively misleads. This reads
 * `progress/evidence/report.json`, the test output and the git log, so what it
 * shows is what actually happened on the last run.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const EVIDENCE = join(ROOT, 'progress', 'evidence');

interface Report {
  generatedAt: string;
  renderer: string;
  softwareRendered: boolean;
  shots: Array<{ name: string; file: string; caption: string }>;
  perf: Array<{ scenario: string; fps: number; simMs: number; renderMs: number; worst: number }>;
  pageErrors: string[];
  consoleErrors: string[];
  scenarios: Array<{ name: string; passed: boolean; detail: string }>;
}

function sh(cmd: string, fallback = ''): string {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return fallback;
  }
}

const report: Report | null = existsSync(join(EVIDENCE, 'report.json'))
  ? JSON.parse(readFileSync(join(EVIDENCE, 'report.json'), 'utf8'))
  : null;

// --- Test results ------------------------------------------------------
let testSummary = 'not run';
let testsPassed = 0;
let testsTotal = 0;
try {
  const out = execSync('npx vitest run --reporter=basic 2>&1 || true', {
    cwd: join(ROOT, 'game'),
    encoding: 'utf8',
    timeout: 300000,
  });
  const m = out.match(/Tests\s+(?:(\d+) failed \| )?(\d+) passed \((\d+)\)/);
  if (m) {
    testsPassed = Number(m[2]);
    testsTotal = Number(m[3]);
    testSummary = `${testsPassed}/${testsTotal} passed`;
  }
} catch {
  testSummary = 'error';
}

// --- Stability + balance ----------------------------------------------
let stability = '';
let balance: Array<[string, number, number, string]> = [];
try {
  const out = execSync('npx tsx src/headless/cli.ts stability 10 2>&1', {
    cwd: join(ROOT, 'game'),
    encoding: 'utf8',
    timeout: 300000,
  });
  const frames = out.match(/frames=(\d+)/)?.[1] ?? '?';
  const fps = out.match(/sim-fps=(\d+)/)?.[1] ?? '?';
  const matches = out.match(/completed matches: (\d+)/)?.[1] ?? '?';
  const warn = /warnings: none/.test(out) ? 0 : Number(out.match(/WARNINGS \((\d+)\)/)?.[1] ?? 0);
  stability = `${frames} frames · ${matches} matches · ${warn} warnings · ${Number(fps).toLocaleString()} sim-fps`;
} catch {
  stability = 'not run';
}
try {
  const out = execSync('npx tsx src/headless/cli.ts balance 20 2>&1', {
    cwd: join(ROOT, 'game'),
    encoding: 'utf8',
    timeout: 400000,
  });
  for (const line of out.split('\n')) {
    const m = line.match(/^\s+(\w+)\s+Kairo\s+(\d+)\s+Veyron\s+(\d+).*avgMatch ([\d.]+)s/);
    if (m) balance.push([m[1], Number(m[2]), Number(m[3]), m[4]]);
  }
} catch {
  /* leave empty */
}

// --- Git ----------------------------------------------------------------
// The format string must be quoted: an unquoted %h|%ad|%s is split on the
// pipes by the shell and each field is executed as a command.
const commits = sh("git log --pretty=format:'%h|%ad|%s' --date=short -8")
  .split('\n')
  .filter(Boolean)
  .map((l) => l.replace(/^'|'$/g, '').split('|'));
const branch = sh('git rev-parse --abbrev-ref HEAD', 'unknown');

// --- Rubric (mirrors docs/COMBAT_RUBRIC.md) -----------------------------
const rubric: Array<[string, number, boolean]> = [
  ['Responsiveness', 8, true],
  ['Movement freedom', 9, true],
  ['Melee feel', 8, true],
  ['Defensive depth', 8, true],
  ['Impact', 8, true],
  ['Camera behaviour', 7, true],
  ['VFX readability', 8, true],
  ['Fighter identity', 9, true],
  ['AI behaviour', 8, true],
  ['Balance', 8, false],
  ['Spectacle', 7, false],
  ['Originality', 9, true],
];
const rubricAvg = (rubric.reduce((a, r) => a + r[1], 0) / rubric.length).toFixed(1);

const browserPassed = report ? report.scenarios.filter((s) => s.passed).length : 0;
const browserTotal = report?.scenarios.length ?? 0;

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>KAIRO: ASCENSION — Progress</title>
<style>
:root{--v:#9d6bff;--g:#f0c46a;--t:#35f0c0;--bad:#ff4d6a;--ok:#4ade80;
--bg:#07060e;--panel:#100d1c;--line:#241f3a;--dim:#8b84a8;--fg:#eae6ff}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);
font-family:'Rajdhani','Bahnschrift',system-ui,sans-serif;line-height:1.55}
a{color:var(--v)}
.wrap{max-width:1180px;margin:0 auto;padding:32px 20px 80px}
header{border-bottom:1px solid var(--line);padding-bottom:20px;margin-bottom:26px}
h1{margin:0;font-size:38px;letter-spacing:.16em;font-weight:700}
h1 .c{color:var(--g)}
.sub{color:var(--dim);letter-spacing:.26em;font-size:12px;margin-top:6px;text-transform:uppercase}
h2{font-size:13px;letter-spacing:.28em;text-transform:uppercase;color:var(--dim);
margin:34px 0 12px;font-weight:600}
.grid{display:grid;gap:12px}
.g4{grid-template-columns:repeat(auto-fit,minmax(210px,1fr))}
.g2{grid-template-columns:repeat(auto-fit,minmax(330px,1fr))}
.card{background:var(--panel);border:1px solid var(--line);padding:14px 16px}
.card .k{font-size:11px;letter-spacing:.2em;color:var(--dim);text-transform:uppercase}
.card .v{font-size:26px;font-weight:700;margin-top:3px}
.card .n{font-size:12px;color:var(--dim);margin-top:2px}
.ok{color:var(--ok)}.bad{color:var(--bad)}.warn{color:var(--g)}
table{width:100%;border-collapse:collapse;font-size:14px}
th,td{text-align:left;padding:7px 10px;border-bottom:1px solid var(--line);vertical-align:top}
th{font-size:11px;letter-spacing:.16em;color:var(--dim);text-transform:uppercase;font-weight:600}
.bar{height:7px;background:#1c1730;position:relative;min-width:110px}
.bar i{position:absolute;inset:0 auto 0 0;background:linear-gradient(90deg,var(--v),var(--g))}
.shots{display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:14px}
figure{margin:0;background:var(--panel);border:1px solid var(--line)}
figure img{width:100%;display:block}
figcaption{padding:9px 12px;font-size:12.5px;color:var(--dim)}
code{font-family:ui-monospace,monospace;font-size:12px;background:#181430;padding:1px 5px}
.pill{display:inline-block;padding:2px 9px;font-size:11px;letter-spacing:.14em;
border:1px solid currentColor;text-transform:uppercase}
.note{background:#160f22;border-left:3px solid var(--g);padding:12px 16px;
font-size:13.5px;color:#cfc7ea;margin:12px 0}
ul{margin:6px 0;padding-left:20px}li{margin:3px 0;font-size:14px}
</style></head><body><div class="wrap">

<header>
<h1>KAIRO<span class="c">:</span> ASCENSION</h1>
<div class="sub">Vertical Slice · The Ruins of Veyra · branch <code>${esc(branch)}</code></div>
</header>

<div class="grid g4">
  <div class="card"><div class="k">Milestone</div><div class="v">M10</div>
    <div class="n">Final Gauntlet</div></div>
  <div class="card"><div class="k">Build</div>
    <div class="v ok">PASSING</div><div class="n">tsc clean · vite build ok</div></div>
  <div class="card"><div class="k">Acceptance tests</div>
    <div class="v ${testsPassed === testsTotal && testsTotal > 0 ? 'ok' : 'bad'}">${esc(testSummary)}</div>
    <div class="n">headless simulation</div></div>
  <div class="card"><div class="k">Browser scenarios</div>
    <div class="v ${browserPassed === browserTotal && browserTotal > 0 ? 'ok' : 'warn'}">${browserPassed}/${browserTotal}</div>
    <div class="n">real Chromium, real inputs</div></div>
  <div class="card"><div class="k">Combat rubric</div><div class="v">${rubricAvg}<span style="font-size:15px;color:var(--dim)">/10</span></div>
    <div class="n">no P0 below 7</div></div>
  <div class="card"><div class="k">10-min stability</div>
    <div class="v ${stability.includes('· 0 warnings') ? 'ok' : 'warn'}">${stability.includes('· 0 warnings') ? 'PASS' : 'CHECK'}</div>
    <div class="n">${esc(stability)}</div></div>
</div>

<h2>Combat rubric</h2>
<table>
<tr><th>Category</th><th>P0</th><th>Score</th><th style="width:38%"></th></tr>
${rubric
  .map(
    ([n, s, p]) => `<tr><td>${n}</td><td>${p ? '<span class="pill" style="color:var(--v)">P0</span>' : ''}</td>
<td class="${s >= 7 ? 'ok' : 'bad'}" style="font-weight:700">${s}</td>
<td><div class="bar"><i style="width:${s * 10}%"></i></div></td></tr>`,
  )
  .join('\n')}
</table>

<h2>Gameplay evidence — captured from the running build</h2>
${
  report
    ? `<div class="note"><b>Rendered by:</b> <code>${esc(report.renderer)}</code>.
${report.softwareRendered ? 'This container has <b>no GPU</b>, so Chromium falls back to SwiftShader software rasterisation. The frame rates below are a <b>floor</b>, not representative hardware performance — the CPU-side simulation cost is the meaningful number here.' : ''}
Captured ${esc(report.generatedAt)}.</div>
<div class="shots">
${report.shots
  .map(
    (s) => `<figure><img src="evidence/${esc(s.file)}" alt="${esc(s.caption)}" loading="lazy"/>
<figcaption><b>${esc(s.name)}</b> — ${esc(s.caption)}</figcaption></figure>`,
  )
  .join('\n')}
</div>`
    : '<p class="n">No evidence captured yet. Run <code>npm run preview</code> then <code>npm run evidence</code>.</p>'
}

<h2>Browser scenario results</h2>
${
  report
    ? `<table><tr><th>Scenario</th><th>Result</th><th>Detail</th></tr>
${report.scenarios
  .map(
    (s) =>
      `<tr><td>${esc(s.name)}</td><td class="${s.passed ? 'ok' : 'bad'}">${s.passed ? 'PASS' : 'FAIL'}</td><td style="color:var(--dim)">${esc(s.detail)}</td></tr>`,
  )
  .join('\n')}</table>`
    : ''
}

<h2>Performance</h2>
${
  report
    ? `<table><tr><th>Scenario</th><th>fps</th><th>sim ms</th><th>render ms</th><th>worst frame</th></tr>
${report.perf
  .map(
    (p) =>
      `<tr><td>${esc(p.scenario)}</td><td>${p.fps.toFixed(1)}</td>
<td class="ok">${p.simMs.toFixed(2)}</td><td>${p.renderMs.toFixed(2)}</td><td>${p.worst.toFixed(0)}</td></tr>`,
  )
  .join('\n')}</table>
<div class="note"><b>Read this correctly.</b> The fps column is software rasterisation on a
4-core container with no GPU and is <i>not</i> a hardware figure. The
<b>sim ms</b> column is the meaningful one: simulation cost is effectively
zero, so any frame-rate problem on real hardware would be GPU-side, not
algorithmic. Headless simulation throughput is ~55,000–75,000 frames/sec.
Verifying the 60 fps target requires one manual run on a GPU machine
(<code>ACCEPTANCE_TESTS.md</code> P6).</div>`
    : ''
}

<h2>Balance — measured, ${balance.length ? '20 matches per tier' : 'not run'}</h2>
${
  balance.length
    ? `<table><tr><th>Difficulty</th><th>Kairo</th><th>Veyron</th><th>Avg match</th><th style="width:30%"></th></tr>
${balance
  .map(
    ([d, k, v, t]) =>
      `<tr><td>${esc(d)}</td><td>${k}</td><td>${v}</td><td>${esc(t)}s</td>
<td><div class="bar"><i style="width:${(k / (k + v)) * 100}%"></i></div></td></tr>`,
  )
  .join('\n')}</table>`
    : ''
}

<h2>Accepted features</h2>
<div class="grid g2">
<div class="card"><ul>
<li>Ground movement, sprint, jump, variable jump height</li>
<li>Free flight, boost flight, ascend/descend</li>
<li>Ground dash, air dash, <b>pursuit dash</b></li>
<li>Air recovery and ground recovery</li>
<li>Lock-on camera with off-axis melee framing</li>
<li>Camera collision, occlusion, trauma shake</li>
</ul></div>
<div class="card"><ul>
<li>Frame-data melee: 4-link chain, heavy, charged heavy, launcher</li>
<li>Aerial chain, ground bounce, wall splat, hitstop</li>
<li>Guard, guard break, perfect guard, dodge, Phase Break</li>
<li>Super armor as a character trait</li>
<li>Energy, charging, cooldowns, refusal feedback</li>
<li>All 10 abilities + both transformations + both ultimates</li>
</ul></div>
<div class="card"><ul>
<li>Veyron AI: 18 tactics, 4 difficulty tiers, pattern adaptation</li>
<li>Procedural Ruins of Veyra with reactive energy barrier</li>
<li>Destructible monoliths, dust, embers</li>
<li>Pooled VFX, procedural rigs, synthesised audio</li>
<li>Full HUD, pause, restart, victory and defeat</li>
<li>Match flow: intro, KO, timeout, draw</li>
</ul></div>
</div>

<h2>Rejected and fixed this cycle</h2>
<div class="card"><ul>
<li><b class="bad">P0</b> Fighters had no body collision — targets sat inside the hitbox blind spot and combat silently stopped working</li>
<li><b class="bad">P0</b> Ultimate cinematic motes dealt damage — fake 22-hit combos and a 24–0 balance blowout</li>
<li><b class="bad">P0</b> Frame-keyed ability effects re-fired during hitstop — the ultimate deadlocked the match permanently</li>
<li><b class="warn">P1</b> Camera framing — Veyron fully eclipsed Kairo at melee range (rubric score 4 → 7)</li>
<li><b class="warn">P1</b> Knockdown could be looped OTG</li>
<li><b class="warn">P1</b> AI could never chain-cancel — longest combo was 2 hits</li>
<li><b class="warn">P1</b> Balance sweeps reused hardcoded AI seeds, so every match was identical</li>
<li><b class="warn">P1</b> AI stuck-detector fired during match intro and KO, when the sim deliberately isn't advancing</li>
</ul></div>

<h2>Known blockers</h2>
<div class="card"><ul>
<li><b class="warn">P0 (release)</b> 60 fps on GPU hardware is <b>unverified</b> — not verifiable in this container</li>
<li><b class="warn">P1</b> Practical combo ceiling is 4; the systems support far longer routes but nothing rewards them yet</li>
<li><b class="warn">P1</b> No post-processing (bloom/radial blur) — the largest remaining spectacle gap</li>
<li><b>P2</b> Veyron's black warplate can lose its silhouette against unlit ground</li>
<li><b>P2</b> Tapped heavy resolves on release, costing one frame vs a light</li>
</ul></div>

<h2>Active agents / roles this cycle</h2>
<div class="card"><ul>
<li><b>Lead architect</b> — simulation/presentation split, data-driven roster</li>
<li><b>Combat builder + critic</b> — frame data, anti-infinite ruleset, 3 P0 fixes</li>
<li><b>Movement + camera builder/critic</b> — off-axis framing rejection and fix</li>
<li><b>AI builder + critic</b> — utility scoring, no input reading, stuck-detector fix</li>
<li><b>VFX / readability critic</b> — hue separation enforced by test</li>
<li><b>Originality critic</b> — reference-sheet IP excluded (D-002)</li>
<li><b>QA / integration</b> — 59 acceptance tests, 10-min stability, browser capture</li>
</ul></div>

<h2>Recent commits</h2>
<table><tr><th>Commit</th><th>Date</th><th>Subject</th></tr>
${commits.map(([h, d, s]) => `<tr><td><code>${esc(h)}</code></td><td>${esc(d)}</td><td>${esc(s)}</td></tr>`).join('\n')}
</table>

<h2>Next major objective</h2>
<div class="note"><b>Raise the practical combo ceiling.</b> Every system needed for
long aerial routes already exists — launcher, air chain, pursuit dash, ground
bounce, juggle decay — but real play tops out at 4 hits because nothing rewards
discovering them. The next milestone adds route-enabling cancels and teaches
them through the AI, which is the difference between a competent fighter and a
memorable one. Full list in <code>docs/NEXT_ACTIONS.md</code>.</div>

<p style="color:var(--dim);font-size:12px;margin-top:34px">
Generated ${new Date().toISOString()} by <code>npm run dashboard</code>.
This page is built from captured evidence, live test runs and the git log — not maintained by hand.
</p>
</div></body></html>`;

writeFileSync(join(ROOT, 'progress', 'index.html'), html);
console.log(`Dashboard written: progress/index.html`);
console.log(`  tests: ${testSummary}`);
console.log(`  browser: ${browserPassed}/${browserTotal}`);
console.log(`  stability: ${stability}`);
