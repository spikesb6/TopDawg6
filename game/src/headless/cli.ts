/**
 * Headless CLI — the Gauntlet Loop's "RUN" step.
 *
 *   npm run sim -- match          one AI-vs-AI match, summary report
 *   npm run sim -- stability      the ten-minute stability requirement
 *   npm run sim -- balance N      N matches across difficulties, win rates
 *   npm run sim -- probe          per-system probes with frame-level output
 */

import { HeadlessMatch, idleController, pressure, holding } from './Match';
import { KAIRO } from '../characters/kairo';
import { VEYRON } from '../characters/veyron';
import { MatchPhase } from '../gameplay/Simulation';

const arg = (i: number, d = '') => process.argv[i + 2] ?? d;

function fmtReport(label: string, r: ReturnType<HeadlessMatch['run']>): void {
  const secs = (r.frames / 60).toFixed(1);
  console.log(`\n=== ${label} ===`);
  console.log(
    `  frames=${r.frames} (${secs}s game) wall=${r.wallMs.toFixed(0)}ms  sim-fps=${r.fps.toFixed(0)}`,
  );
  console.log(`  phase=${r.phase} winner=${r.winner} reason=${r.reason}`);
  console.log(`  health   K=${r.health[0]} V=${r.health[1]}`);
  console.log(`  dmgDealt K=${r.damageDealt[0]} V=${r.damageDealt[1]}`);
  console.log(`  bestCombo K=${r.bestCombo[0]} V=${r.bestCombo[1]}`);
  console.log(`  peakProjectiles=${r.peakProjectiles}`);
  const top = Object.entries(r.events)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 14)
    .map(([k, v]) => `${k}:${v}`)
    .join('  ');
  console.log(`  events   ${top}`);
  if (r.warnings.length) {
    console.log(`  WARNINGS (${r.warnings.length}):`);
    const uniq = [...new Set(r.warnings)].slice(0, 8);
    for (const w of uniq) console.log(`    ! ${w}`);
  } else {
    console.log('  warnings: none');
  }
}

function stateSummary(hist: Record<string, number>, total: number): string {
  return Object.entries(hist)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([k, v]) => `${k}:${((v / total) * 100).toFixed(0)}%`)
    .join(' ');
}

function runMatch(): void {
  const diffA = arg(1, 'warrior');
  const diffB = arg(2, 'warrior');
  const m = new HeadlessMatch(KAIRO, VEYRON, 'ai', 'ai', {
    difficultyA: diffA,
    difficultyB: diffB,
    seed: Number(arg(3, '12345')),
  });
  const r = m.run();
  fmtReport(`AI MATCH  Kairo(${diffA}) vs Veyron(${diffB})`, r);
  console.log(`  Kairo  states: ${stateSummary(r.stateHistogram[0], r.frames)}`);
  console.log(`  Veyron states: ${stateSummary(r.stateHistogram[1], r.frames)}`);
}

function runStability(): void {
  const minutes = Number(arg(1, '10'));
  const frames = Math.round(minutes * 60 * 60);
  console.log(`Running ${minutes}-minute stability session (${frames} frames)...`);
  let restarts = 0;
  let matches = 0;
  const m = new HeadlessMatch(KAIRO, VEYRON, 'ai', 'ai', {
    difficultyA: 'warlord',
    difficultyB: 'warlord',
    seed: 0xfeed,
    matchSeconds: 99,
    onFrame: (sim) => {
      // Auto-restart on victory so the session keeps fighting for the full
      // duration, which also exercises the restart path repeatedly.
      if (sim.phase === MatchPhase.Victory) {
        sim.reset();
        restarts++;
        matches++;
      }
      return false;
    },
  });
  const r = m.run(frames);
  fmtReport(`STABILITY ${minutes}min`, r);
  console.log(`  completed matches: ${matches}  restarts: ${restarts}`);
  const ok = r.warnings.length === 0 && r.frames >= frames - 1;
  console.log(`  RESULT: ${ok ? 'PASS' : 'CHECK WARNINGS'}`);
}

function runBalance(): void {
  const n = Number(arg(1, '20'));
  const diffs = ['cadet', 'warrior', 'warlord', 'tyrant'];
  console.log(`\nBalance sweep: ${n} matches per difficulty pairing\n`);
  for (const d of diffs) {
    let kWins = 0;
    let vWins = 0;
    let draws = 0;
    let totalFrames = 0;
    let maxCombo = 0;
    for (let i = 0; i < n; i++) {
      const m = new HeadlessMatch(KAIRO, VEYRON, 'ai', 'ai', {
        difficultyA: d,
        difficultyB: d,
        seed: 1000 + i * 7919,
        matchSeconds: 120,
      });
      const r = m.run();
      if (r.winner === 0) kWins++;
      else if (r.winner === 1) vWins++;
      else draws++;
      totalFrames += r.frames;
      maxCombo = Math.max(maxCombo, r.bestCombo[0], r.bestCombo[1]);
    }
    const avg = (totalFrames / n / 60).toFixed(1);
    console.log(
      `  ${d.padEnd(8)} Kairo ${String(kWins).padStart(3)}  Veyron ${String(vWins).padStart(3)}  draw ${draws}   avgMatch ${avg}s  maxCombo ${maxCombo}`,
    );
  }
}

function runProbe(): void {
  console.log('\n--- PROBE: idle Kairo vs idle Veyron (10s) ---');
  {
    const m = new HeadlessMatch(KAIRO, VEYRON, idleController, idleController, {
      skipIntro: true,
      seed: 1,
    });
    const r = m.run(600);
    console.log(`  no-input drift: K hp=${r.health[0]} V hp=${r.health[1]}`);
    console.log(`  Kairo states: ${stateSummary(r.stateHistogram[0], r.frames)}`);
    console.log(`  warnings=${r.warnings.length}`);
  }

  console.log('\n--- PROBE: Kairo light-mash vs idle Veyron (15s) ---');
  {
    const m = new HeadlessMatch(KAIRO, VEYRON, pressure('light', 2.0, 8), idleController, {
      skipIntro: true,
      seed: 2,
    });
    const r = m.run(900);
    console.log(`  V hp=${r.health[1]}  bestCombo=${r.bestCombo[0]}  hits=${r.events.hit ?? 0}`);
    console.log(`  comboEscape(forced)=${r.events.comboEscape ?? 0}`);
  }

  console.log('\n--- PROBE: Kairo light-mash vs GUARDING Veyron (15s) ---');
  {
    const m = new HeadlessMatch(
      KAIRO,
      VEYRON,
      pressure('light', 2.0, 8),
      holding('guard'),
      { skipIntro: true, seed: 3 },
    );
    const r = m.run(900);
    console.log(
      `  V hp=${r.health[1]}  blocks=${r.events.block ?? 0}  parries=${r.events.parry ?? 0}  guardBreaks=${r.events.guardBreak ?? 0}`,
    );
  }

  console.log('\n--- PROBE: infinite-combo attempt (Kairo mash, Veyron never acts, 60s) ---');
  {
    const m = new HeadlessMatch(KAIRO, VEYRON, pressure('light', 2.2, 6), idleController, {
      skipIntro: true,
      seed: 4,
      matchSeconds: 300,
    });
    const r = m.run(3600);
    console.log(
      `  maxCombo=${r.bestCombo[0]}  hardCapEjects=${r.events.comboEscape ?? 0}  V hp=${r.health[1]}`,
    );
    console.log(`  -> combo must be bounded; hard cap is 22`);
  }
}

const cmd = arg(0, 'match');
switch (cmd) {
  case 'match':
    runMatch();
    break;
  case 'stability':
    runStability();
    break;
  case 'balance':
    runBalance();
    break;
  case 'probe':
    runProbe();
    break;
  default:
    console.log('usage: npm run sim -- [match|stability|balance|probe] ...');
}
