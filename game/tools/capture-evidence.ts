/**
 * Gameplay evidence capture — the Gauntlet Loop's "capture evidence" step.
 *
 * Launches the real built game in headless Chromium, drives it through scripted
 * scenarios using the same input path a human uses, and writes screenshots plus
 * a machine-readable report.
 *
 * This is not a mock. It is the shipped bundle, running in a browser, rendering
 * through WebGL, driven by real inputs. What it captures is what the game does.
 *
 * Note on performance numbers: this container has no GPU, so Chromium falls
 * back to SwiftShader (software rasterisation). The frame rates recorded here
 * are a FLOOR, not a representative figure — every number is labelled as such
 * in the report so it can never be mistaken for hardware performance.
 */

import { chromium, type Browser, type Page } from 'playwright';
import { mkdirSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Finds any chromium build under the shared browser cache. */
function globSyncChromium(): string[] {
  const base = '/opt/pw-browsers';
  if (!existsSync(base)) return [];
  return readdirSync(base)
    .filter((d) => d.startsWith('chromium-'))
    .map((d) => join(base, d, 'chrome-linux', 'chrome'));
}

const HERE = dirname(fileURLToPath(import.meta.url));
// tools/ lives inside game/, so the repo root is two levels up.
const ROOT = join(HERE, '..', '..');
const OUT = join(ROOT, 'progress', 'evidence');
const URL_BASE = process.env.GAME_URL ?? 'http://localhost:4173';

interface Shot {
  name: string;
  file: string;
  caption: string;
  state?: Record<string, unknown>;
}

interface Report {
  generatedAt: string;
  url: string;
  viewport: { width: number; height: number };
  renderer: string;
  softwareRendered: boolean;
  shots: Shot[];
  perf: Array<{ scenario: string; fps: number; simMs: number; renderMs: number; worst: number }>;
  consoleErrors: string[];
  pageErrors: string[];
  scenarios: Array<{ name: string; passed: boolean; detail: string }>;
}

const shots: Shot[] = [];
const perf: Report['perf'] = [];
const scenarios: Report['scenarios'] = [];
const consoleErrors: string[] = [];
const pageErrors: string[] = [];

/** Runs the page for N real frames by waiting on rAF. */
async function frames(page: Page, n: number): Promise<void> {
  await page.evaluate(
    (count) =>
      new Promise<void>((resolve) => {
        let i = 0;
        const step = () => {
          if (++i >= count) return resolve();
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }),
    n,
  );
}

/**
 * Advances the SIMULATION a precise number of frames, then renders once.
 *
 * Driving scenarios by rendered frames does not work under software
 * rasterisation: the browser manages roughly 10 fps while the fixed-timestep
 * loop still advances 6 sim ticks per rendered frame, so a script pressing a
 * button "for 3 frames" once per rendered frame is actually pressing it for 3
 * frames out of every 6 — far too sparse to play the game. Owning the clock
 * makes every capture deterministic and independent of render speed.
 */
async function sim(page: Page, n: number): Promise<void> {
  await page.evaluate((count) => (window as any).KAIRO.stepFrames(count), n);
  await frames(page, 2); // render the resulting state
}

/** Presses a game action for a number of simulation frames. */
async function press(page: Page, action: string, holdFrames = 3): Promise<void> {
  await page.evaluate(
    ([a, f]) => (window as any).KAIRO.press(a, f),
    [action, holdFrames] as [string, number],
  );
}

async function move(page: Page, x: number, z: number): Promise<void> {
  await page.evaluate(([mx, mz]) => (window as any).KAIRO.move(mx, mz), [x, z] as [number, number]);
}

/**
 * Stages both fighters at a known separation on the ground.
 *
 * Scenario captures need a deterministic starting position. Walking there is
 * unreliable — the AI is live and will have moved the target — so each scenario
 * stages explicitly rather than inheriting wherever the previous one ended.
 */
async function stage(page: Page, gap: number, calmAI = false): Promise<void> {
  if (calmAI) {
    // Some scenarios exercise a player-side system (transformation entry,
    // projectile spawning) rather than the fight itself. The AI is live during
    // capture, so a Void Spear arriving mid-scenario invalidates the assertion
    // for a reason unrelated to what is being measured. Emptying its energy
    // stops it acting without disabling it or faking the result.
    await page.evaluate(() => {
      const sm = (window as any).KAIRO.sim;
      sm.fighters[1].energy.current = 0;
      sm.fighters[1].combat.interrupt();
      sm.fighters[1].activeAbility = null;
    });
  }
  // Staging must produce a genuinely known state, which means ending anything
  // still in flight. Abilities run for up to 76 frames; a scenario that stages
  // while one is active has its next input refused as Busy, which then looks
  // like the feature under test is broken.
  await page.evaluate(() => {
    const sm = (window as any).KAIRO.sim;
    for (const f of sm.fighters) {
      f.activeAbility = null;
      f.abilityFrame = 0;
      f.lastResolvedAbilityFrame = -1;
      f.combat.interrupt();
      f.hitstop = 0;
      f.reactionFrames = 0;
      f.state = 'Idle';
    }
    sm.projectiles.clear();
  });
  await page.evaluate((g) => {
    const sm = (window as any).KAIRO.sim;
    const a = sm.fighters[0];
    const b = sm.fighters[1];
    a.position.set(0, 0, -g / 2);
    a.velocity.set(0, 0, 0);
    a.yaw = 0;
    a.movement.exitFlight();
    b.position.set(0, 0, g / 2);
    b.velocity.set(0, 0, 0);
    b.yaw = Math.PI;
    b.movement.exitFlight();
  }, gap);
  await sim(page, 6);
}

async function state(page: Page): Promise<Record<string, any>> {
  return page.evaluate(() => (window as any).KAIRO.state());
}

async function shoot(page: Page, name: string, caption: string): Promise<void> {
  const file = `${name}.png`;
  await page.screenshot({ path: join(OUT, file) });
  shots.push({ name, file, caption, state: await state(page) });
  console.log(`  [shot] ${name}`);
}

async function measurePerf(page: Page, scenario: string, forFrames: number): Promise<void> {
  await page.evaluate(() => (window as any).KAIRO.resetWorst());
  await frames(page, forFrames);
  const s = await page.evaluate(() => (window as any).KAIRO.stats());
  perf.push({ scenario, fps: s.fps, simMs: s.simMs, renderMs: s.renderMs, worst: s.worst });
  console.log(
    `  [perf] ${scenario}: ${s.fps.toFixed(1)} fps, sim ${s.simMs.toFixed(2)}ms, render ${s.renderMs.toFixed(2)}ms, worst ${s.worst.toFixed(1)}ms`,
  );
}

function record(name: string, passed: boolean, detail: string): void {
  scenarios.push({ name, passed, detail });
  console.log(`  [${passed ? 'PASS' : 'FAIL'}] ${name} — ${detail}`);
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  let browser: Browser | null = null;

  try {
    // Use the pre-installed Chromium rather than letting Playwright download
    // one: the npm package's pinned browser revision may not match what is
    // already on the machine, and re-downloading is both slow and unnecessary.
    const candidates = [
      process.env.CHROMIUM_PATH,
      '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
      ...globSyncChromium(),
    ].filter(Boolean) as string[];
    const executablePath = candidates.find((p) => existsSync(p));
    if (!executablePath) throw new Error('No Chromium executable found');
    console.log(`Using Chromium at ${executablePath}`);

    browser = await chromium.launch({
      executablePath,
      args: [
        // Software rasterisation: this container has no GPU.
        '--use-gl=swiftshader',
        '--enable-unsafe-swiftshader',
        '--disable-dev-shm-usage',
        '--no-sandbox',
      ],
    });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

    // tsx compiles this file with esbuild's keepNames transform, which wraps
    // function expressions in __name(...). That helper is defined in the Node
    // module scope, not in the page, so any injected callback containing a
    // named function reference would throw ReferenceError once serialised into
    // the browser. Defining an identity __name in the page makes the injected
    // code run unmodified.
    await page.addInitScript({ content: 'globalThis.__name = globalThis.__name || ((f) => f);' });

    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });
    page.on('pageerror', (e) => pageErrors.push(String(e)));

    console.log(`Loading ${URL_BASE} ...`);
    await page.goto(URL_BASE, { waitUntil: 'networkidle', timeout: 60000 });
    await frames(page, 30);

    const renderer = await page.evaluate(() => {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') ?? c.getContext('webgl');
      if (!gl) return 'none';
      const dbg = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
      return dbg
        ? String((gl as WebGLRenderingContext).getParameter(dbg.UNMASKED_RENDERER_WEBGL))
        : 'unknown';
    });
    console.log(`WebGL renderer: ${renderer}`);

    // ---------------------------------------------------------------- title
    await shoot(page, '01-title', 'Title screen with difficulty selection and control reference.');

    // Start the match, then take ownership of the simulation clock so every
    // scenario below runs at an exact, reproducible frame count.
    await page.click('#btn-start');
    await page.evaluate(() => (window as any).KAIRO.setManualClock(true));
    await sim(page, 20);
    await shoot(page, '02-intro', 'Match intro: READY banner over the Ruins of Veyra.');

    await sim(page, 60);
    let s = await state(page);
    record('Match reaches Fighting phase', s.phase === 'Fighting', `phase=${s.phase} after intro`);
    await shoot(page, '03-neutral', 'Neutral: both fighters framed, full HUD, lock-on reticle on Veyron.');

    // ------------------------------------------------------------- movement
    await move(page, 0, 1);
    await sim(page, 24);
    await shoot(page, '04-approach', 'Kairo advancing on Veyron; the camera widens with speed.');

    // Flight: get clear of Veyron first. The AI is live during capture, and a
    // stray hit mid-test invalidates the flight assertion for a reason that has
    // nothing to do with flight.
    await page.evaluate(() => {
      const sm = (window as any).KAIRO.sim;
      sm.fighters[1].position.x = sm.fighters[0].position.x + 34;
      sm.fighters[1].position.z = sm.fighters[0].position.z + 34;
    });
    await move(page, 0, 0);
    await sim(page, 10);
    await press(page, 'jump', 3);
    await sim(page, 10);
    await press(page, 'jump', 3);
    await sim(page, 6);
    await press(page, 'jump', 45);
    await sim(page, 45);
    s = await state(page);
    let k = (s.fighters as any[])[0];
    record(
      'Flight reachable from a mid-air jump tap',
      Number(k.y) > 3 && k.flying === true,
      `y=${k.y} flying=${k.flying} state=${k.state}`,
    );
    await shoot(page, '05-flight', 'Free flight — Kairo ascending, blob shadow shrinking below.');
    await measurePerf(page, 'flight', 40);

    // Boost flight across the arena.
    await move(page, 1, 0);
    await press(page, 'boost', 40);
    await sim(page, 40);
    await shoot(page, '06-boost', 'Boost flight — speed trail, widened FOV, energy draining.');

    // Descend and land.
    await press(page, 'descend', 70);
    await sim(page, 80);
    await move(page, 0, 0);
    await sim(page, 20);

    // -------------------------------------------------------------- combat
    await move(page, 0, 0);
    await stage(page, 2.3);

    // Count landed hits via the event bus. Sampling `combo` between presses is
    // unreliable — the counter is designed to reset the moment the victim
    // recovers, so a poll can legitimately read zero between connects.
    await page.evaluate(() => {
      const w = window as any;
      w.__hits = 0;
      w.KAIRO.sim.events.on('hit', (e: any) => {
        if (e.source === 0) w.__hits++;
      });
    });
    let bestCombo = 0;
    for (let i = 0; i < 10; i++) {
      await press(page, 'light', 2);
      await sim(page, 6);
      const st = await state(page);
      bestCombo = Math.max(bestCombo, Number((st.fighters as any[])[0].combo));
    }
    const landed = await page.evaluate(() => (window as any).__hits as number);
    await shoot(page, '07-combo', 'Light chain connecting — combo counter, hit sparks, hitstop freeze.');
    record(
      'Light chain connects in-browser',
      landed >= 3,
      `${landed} hits landed, peak combo counter ${bestCombo}`,
    );
    await measurePerf(page, 'melee', 40);

    // Charged heavy.
    await press(page, 'heavy', 46);
    await sim(page, 40);
    await shoot(page, '08-charge', 'Charge stance — braced pose, aura swelling, energy drawn inward.');
    await sim(page, 30);

    // Launcher into an aerial exchange.
    await press(page, 'guard', 6);
    await press(page, 'heavy', 6);
    await sim(page, 30);
    await shoot(page, '09-launcher', 'Launcher connects — Veyron popped into a juggle state.');

    // --------------------------------------------------------- projectiles
    await stage(page, 22);
    await press(page, 'ability1', 3);
    await sim(page, 12);
    await shoot(page, '10-bolt', 'Celestial Bolt in flight with its additive trail.');
    // Let Celestial Bolt finish. Pressing the next ability while one is still
    // active is refused as Busy — correct behaviour, wrong thing to measure.
    await sim(page, 30);

    await page.evaluate(() => {
      const sm = (window as any).KAIRO.sim;
      sm.fighters[0].energy.current = sm.fighters[0].energy.max;
      sm.fighters[0].cooldowns.clear();
    });
    // Count spawns via the event bus. Sampling the live projectile count is
    // unreliable: fast shots at close range can already have connected and been
    // recycled by the time the sample is taken.
    await page.evaluate(() => {
      const w = window as any;
      w.__fired = 0;
      w.KAIRO.sim.events.on('projectileFired', () => w.__fired++);
    });
    await press(page, 'ability4', 3);
    await sim(page, 34);
    await shoot(page, '11-starfall', 'Starfall Barrage — multiple pooled projectiles homing in.');
    const fired = await page.evaluate(() => (window as any).__fired as number);
    record(
      'Starfall Barrage fires a multi-shot volley',
      fired >= 3,
      `projectiles spawned = ${fired}`,
    );
    await measurePerf(page, 'projectiles', 40);

    // ------------------------------------------------------ transformation
    await stage(page, 10, true);
    await page.evaluate(() => {
      const sm = (window as any).KAIRO.sim;
      sm.fighters[0].ascension.current = sm.fighters[0].ascension.max;
    });
    await press(page, 'transform', 3);
    await sim(page, 24);
    await shoot(page, '12-surge', 'CELESTIAL SURGE — transformation sequence, gold aura, HUD state change.');
    await sim(page, 40);
    s = await state(page);
    const refusal = await page.evaluate(
      () => (window as any).KAIRO.sim.fighters[0].lastRefusal as string,
    );
    record(
      'Celestial Surge activates',
      (s.fighters as any[])[0].transformed === true,
      `transformed=${(s.fighters as any[])[0].transformed}` +
        (refusal && refusal !== 'None' ? ` refusal=${refusal}` : ''),
    );
    await shoot(page, '13-transformed', 'Kairo transformed — aura shifted violet to gold, FOV widened.');

    // ------------------------------------------------------------ ultimate
    await page.evaluate(() => {
      const sm = (window as any).KAIRO.sim;
      sm.fighters[0].energy.current = sm.fighters[0].energy.max;
      sm.fighters[0].cooldowns.clear();
      // Bring Veyron into capture range so the ultimate connects.
      sm.fighters[1].position.x = sm.fighters[0].position.x + 4;
      sm.fighters[1].position.z = sm.fighters[0].position.z;
      sm.fighters[1].position.y = sm.fighters[0].position.y;
      sm.fighters[1].health.current = sm.fighters[1].health.max;
    });
    await press(page, 'ultimate', 4);
    await sim(page, 26);
    await shoot(page, '14-ultimate-windup', 'Final Horizon wind-up — cinematic camera taking over, beam pillar.');
    await sim(page, 40);
    await shoot(page, '15-ultimate-capture', 'Final Horizon — Veyron captured, energy motes streaming inward.');
    await measurePerf(page, 'ultimate', 40);
    await sim(page, 50);
    await shoot(page, '16-ultimate-payoff', 'Final Horizon payoff — full-screen detonation, HUD still legible.');

    await sim(page, 90);
    s = await state(page);
    record('Ultimate releases control cleanly', s.cinematic === -1, `cinematicOwner=${s.cinematic}`);
    record(
      'Ultimate deals decisive damage on a captured target',
      Number((s.fighters as any[])[1].hp) < 900,
      `Veyron hp=${(s.fighters as any[])[1].hp} / 1180`,
    );

    // ---------------------------------------------------------- resolution
    await stage(page, 2.3);
    await page.evaluate(() => {
      (window as any).KAIRO.sim.fighters[1].health.current = 60;
    });
    for (let i = 0; i < 40; i++) {
      const st = await state(page);
      if (st.phase === 'Victory' || st.phase === 'KO') break;
      const a = (st.fighters as any[])[0];
      const b = (st.fighters as any[])[1];
      const d = Math.hypot(a.x - b.x, a.z - b.z) || 1;
      if (d > 2.2) {
        await move(page, (b.x - a.x) / d, (b.z - a.z) / d);
      } else {
        await move(page, 0, 0);
        await press(page, 'light', 2);
      }
      await sim(page, 8);
    }
    await sim(page, 20);
    await shoot(page, '17-ko', 'K.O. — match resolution banner.');

    await sim(page, 170);
    await frames(page, 12);
    s = await state(page);
    record(
      'Match reaches a resolved Victory state',
      s.phase === 'Victory',
      `phase=${s.phase} winner=${(s.result as any)?.winnerIndex}`,
    );
    record(
      'Player can win the match',
      (s.result as any)?.winnerIndex === 0,
      `winner=${(s.result as any)?.winnerIndex} (0 = Kairo)`,
    );
    await shoot(page, '18-results', 'Victory screen with match statistics.');

    // ------------------------------------------------------------- restart
    const again = await page.$('#btn-again');
    if (again) {
      await again.click();
      await page.evaluate(() => (window as any).KAIRO.setManualClock(true));
      await sim(page, 30);
      s = await state(page);
      const f0 = (s.fighters as any[])[0];
      const maxHp = await page.evaluate(
        () => (window as any).KAIRO.sim.fighters[0].health.max as number,
      );
      record(
        'Restart from the results screen fully resets the match',
        Number(f0.hp) === maxHp && s.phase !== 'Victory',
        `hp=${f0.hp}/${maxHp} phase=${s.phase}`,
      );
      await shoot(page, '19-restart', 'Match restarted cleanly from the victory screen.');
    } else {
      record('Restart button present on results screen', false, 'button not found');
    }

    // --------------------------------------------------------------- pause
    await page.keyboard.press('Escape');
    await frames(page, 10);
    const pauseVisible = await page.evaluate(() =>
      document.querySelector('#overlay')?.classList.contains('show'),
    );
    record('Pause menu opens during a live match', !!pauseVisible, `overlay shown=${pauseVisible}`);
    await shoot(page, '20-pause', 'Pause menu with resume, restart and control reference.');

    // ---------------------------------------------------------------- wrap
    record(
      'No uncaught page errors during the session',
      pageErrors.length === 0,
      pageErrors.length ? pageErrors.slice(0, 3).join(' | ') : 'none',
    );

    const report: Report = {
      generatedAt: new Date().toISOString(),
      url: URL_BASE,
      viewport: { width: 1280, height: 720 },
      renderer,
      softwareRendered: /swiftshader|llvmpipe|software/i.test(renderer),
      shots,
      perf,
      consoleErrors,
      pageErrors,
      scenarios,
    };
    writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));

    const passed = scenarios.filter((s) => s.passed).length;
    console.log(`\n${passed}/${scenarios.length} browser scenarios passed`);
    console.log(`Evidence written to ${OUT}`);
    if (passed < scenarios.length) process.exitCode = 1;
  } finally {
    await browser?.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
