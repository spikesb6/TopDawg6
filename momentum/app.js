/* Momentum: job control for project managers.
   Plain JS, no build step. State lives in localStorage; everything else is derived in compute(). */
(function () {
  'use strict';

  const D = window.MomentumData;
  const DAY = D.DAY;
  const HOUR = 3600000;
  const STORE = 'momentum.v1';
  const PREFS = 'momentum.prefs';
  const STAGES = ['backlog', 'ready', 'doing', 'review', 'done'];
  const STAGE_LABEL = { backlog: 'Backlog', ready: 'Ready', doing: 'In progress', review: 'Review', done: 'Done' };
  const FLOW_STAGES = ['ready', 'doing', 'review'];
  const BLOCK_LABEL = { client: 'client', permit: 'permit', materials: 'materials', inspection: 'inspection', sub: 'subcontractor', internal: 'internal decision' };
  const LEVELS = [[0, 'Pup'], [150, 'Runner'], [400, 'Crew Lead'], [800, 'Foreman'], [1500, 'Top Dawg'], [3000, 'Legend']];
  const SEV_RANK = { crit: 3, serious: 2, warn: 1 };
  const SEV_LABEL = { crit: 'Critical', serious: 'Serious', warn: 'Heads up' };
  const VIEW_KEYS = ['pulse', 'jobs', 'board', 'timeline', 'radar', 'team'];

  let TODAY = D.sod(Date.now());

  /* ---------- utilities ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sum = (arr, f) => arr.reduce((s, x) => s + (f ? f(x) : x), 0);
  const mean = (arr) => (arr.length ? sum(arr) / arr.length : 0);
  const median = (arr) => {
    if (!arr.length) return 0;
    const a = arr.slice().sort((x, y) => x - y);
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  };
  const dd = (a, b) => Math.round((D.sod(a) - D.sod(b)) / DAY);
  const fmtDate = (t, opts) => new Date(t).toLocaleDateString(undefined, Object.assign({ month: 'short', day: 'numeric' }, opts || {}));
  const rel = (t) => {
    const n = dd(t, TODAY);
    if (n === 0) return 'today';
    if (n === 1) return 'tomorrow';
    if (n === -1) return 'yesterday';
    return n > 0 ? 'in ' + n + 'd' : Math.abs(n) + 'd ago';
  };
  const ago = (t) => {
    const m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return m + 'm ago';
    const h = Math.round(m / 60);
    if (h < 24) return h + 'h ago';
    const d = Math.round(h / 24);
    return d === 1 ? 'yesterday' : d + 'd ago';
  };
  const money = (n, full) => {
    const sign = n < 0 ? '-' : '';
    const a = Math.abs(n);
    if (full) return sign + '$' + Math.round(a).toLocaleString();
    if (a >= 1e6) return sign + '$' + (a / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
    if (a >= 1e3) return sign + '$' + (a / 1e3).toFixed(a >= 1e5 ? 0 : 1).replace(/\.0$/, '') + 'k';
    return sign + '$' + Math.round(a);
  };
  const pct = (x) => Math.round(x * 100) + '%';
  const plural = (n, w, p) => n + ' ' + (n === 1 ? w : (p || w + 's'));
  const initials = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0].toUpperCase()).join('');
  const toISO = (t) => D.isoDay(t);
  const fromISO = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1).getTime(); };
  const niceMax = (v) => {
    if (v <= 0) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    for (const m of [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
    return 10 * p;
  };

  /* ---------- state ---------- */
  function load() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(STORE)); } catch (e) { s = null; }
    if (!s || s.version !== 1 || !Array.isArray(s.jobs)) return D.makeSample();
    // Untouched sample data is regenerated each day so it never goes stale.
    if (s.sample && !s.dirty && s.seededFor !== TODAY) return D.makeSample();
    s.snoozed = s.snoozed || {};
    s.wip = s.wip || { ready: 12, doing: 9, review: 5 };
    s.doneDays = s.doneDays || [];
    s.log = s.log || [];
    return s;
  }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) { /* storage unavailable: keep working in memory */ } }
  function loadPrefs() { try { return JSON.parse(localStorage.getItem(PREFS)) || {}; } catch (e) { return {}; } }
  function savePrefs() { try { localStorage.setItem(PREFS, JSON.stringify(prefs)); } catch (e) { /* ignore */ } }

  let S = load();
  const prefs = loadPrefs();
  const hostTheme = document.documentElement.getAttribute('data-theme');
  const UI = {
    view: 'pulse',
    jobsFilter: 'all',
    jobsSort: 'health',
    jobsQuery: '',
    boardJob: '',
    boardPerson: '',
    boardBlocked: false,
    backlogAll: false,
    radarType: 'all',
    tlDone: false,
    drawerJob: null,
    entering: true,
  };
  let M = null;

  function commit() {
    S.dirty = true;
    save();
    M = compute();
    render();
  }
  const snapshot = () => JSON.stringify(S);
  function restore(snap) { S = JSON.parse(snap); commit(); }

  const job = (id) => S.jobs.find((j) => j.id === id);
  const task = (id) => S.tasks.find((t) => t.id === id);
  const person = (id) => S.people.find((p) => p.id === id);

  /* ---------- metrics ---------- */
  // Earned-value credit by stage: half for started work, most of it once it's in review.
  const CREDIT = { done: 1, review: 0.9, doing: 0.5 };
  const planStart = (t) => Math.min(t.plannedStart || t.due, t.due - DAY);
  const pvAt = (list, at) => sum(list, (t) => t.est * clamp((at - planStart(t)) / Math.max(DAY, t.due - planStart(t)), 0, 1));
  const statusAt = (t, at) => {
    let s = null;
    for (const h of t.history || []) { if (h.t <= at) s = h.s; else break; }
    return s;
  };

  function compute() {
    TODAY = D.sod(Date.now());
    const N = Date.now();
    const jobs = S.jobs;
    const tasks = S.tasks;
    const active = new Set(jobs.filter((j) => j.status === 'active').map((j) => j.id));
    const byJob = new Map(jobs.map((j) => [j.id, []]));
    tasks.forEach((t) => { if (byJob.has(t.jobId)) byJob.get(t.jobId).push(t); });
    const liveTasks = tasks.filter((t) => active.has(t.jobId));
    const openLive = liveTasks.filter((t) => t.status !== 'done');

    const dependents = new Map();
    tasks.forEach((t) => (t.deps || []).forEach((d) => {
      if (!dependents.has(d)) dependents.set(d, []);
      dependents.get(d).push(t.id);
    }));
    const downstream = (id) => {
      const seen = new Set();
      const stack = [id];
      while (stack.length) {
        (dependents.get(stack.pop()) || []).forEach((n) => {
          if (seen.has(n)) return;
          const nt = task(n);
          if (nt && nt.status !== 'done') { seen.add(n); stack.push(n); }
        });
      }
      return seen.size;
    };

    // How long work sits in each stage, and how fast it arrives and leaves.
    const dwell = { ready: [], doing: [], review: [] };
    const arrivals = { ready: 0, doing: 0, review: 0 };
    const departures = { ready: 0, doing: 0, review: 0 };
    const since14 = N - 14 * DAY;
    tasks.forEach((t) => {
      const h = t.history || [];
      for (let i = 0; i < h.length; i++) {
        const cur = h[i];
        const next = h[i + 1];
        if (!dwell[cur.s]) continue;
        if (cur.t >= since14) arrivals[cur.s]++;
        if (next) {
          if (next.t > N - 60 * DAY) dwell[cur.s].push((next.t - cur.t) / DAY);
          if (next.t >= since14) departures[cur.s]++;
        }
      }
    });
    const typical = {
      ready: median(dwell.ready) || 2,
      doing: median(dwell.doing) || 3,
      review: median(dwell.review) || 1.5,
    };

    const TS = new Map();
    tasks.forEach((t) => {
      const last = (t.history || [])[t.history.length - 1];
      const age = last ? Math.max(0, (N - last.t) / DAY) : 0;
      const open = t.status !== 'done';
      const dur = Math.max(1, Math.ceil(t.est / 6));
      let agingLimit = Infinity;
      if (t.status === 'doing') agingLimit = Math.max(3, dur * 1.6);
      if (t.status === 'review') agingLimit = Math.max(2, typical.review * 1.6);
      const remaining = !open ? 0 : t.status === 'doing' ? t.est * 0.5 : t.status === 'review' ? t.est * 0.1 : t.est;
      const firstDoing = (t.history || []).find((h) => h.s === 'doing');
      TS.set(t.id, {
        age,
        open,
        overdue: open && t.due < TODAY,
        aging: open && age > agingLimit,
        agingLimit,
        remaining,
        cycle: t.completedAt && firstDoing ? (t.completedAt - firstDoing.t) / DAY : null,
        ontime: t.completedAt ? t.completedAt < t.due + DAY : null,
      });
    });

    // Jobs: earned value, forecast finish, health.
    const JS = new Map();
    jobs.forEach((j) => {
      const jt = byJob.get(j.id) || [];
      const total = sum(jt, (t) => t.est);
      const doneH = sum(jt, (t) => t.est * (CREDIT[t.status] || 0));
      const pvH = pvAt(jt, N);
      const span = Math.max(1, (j.due - j.start) / DAY);
      const timePct = clamp((N - j.start) / DAY / span, 0, 1);
      const progress = total ? doneH / total : (j.status === 'done' ? 1 : 0);
      const plannedPct = total ? pvH / total : timePct;
      const spi = pvH > 0.5 ? doneH / pvH : 1;
      const ev = progress * j.budget;
      const cpi = j.spent > 0 && progress > 0 ? ev / j.spent : 1;
      const eac = progress > 0.05 && cpi > 0 ? j.budget / cpi : Math.max(j.budget, j.spent);
      const elapsed = (N - j.start) / DAY;
      const remainingH = total - doneH;
      // Earned schedule: the date on the plan when today's earned hours were due.
      const planEnd = Math.max(j.due, ...jt.map((t) => t.due));
      let es = 0;
      if (total && doneH >= total - 0.01) es = (planEnd - j.start) / DAY;
      else if (total) {
        let lo = j.start, hi = planEnd;
        for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (pvAt(jt, mid) < doneH) lo = mid; else hi = mid; }
        es = (lo - j.start) / DAY;
      }
      const spiT = elapsed >= 5 ? clamp(es / elapsed, 0.25, 2) : 1;
      const vel = sum(jt.filter((t) => t.completedAt && t.completedAt >= N - 14 * DAY), (t) => t.est) / 14;
      let forecast;
      if (j.status === 'done') forecast = j.completedAt || j.due;
      else if (N < j.start) forecast = j.due;
      else if (remainingH <= 0.01) forecast = TODAY;
      else forecast = TODAY + Math.ceil(Math.max(0, (planEnd - j.start) / DAY - es) / spiT) * DAY;
      forecast = Math.min(forecast, TODAY + 730 * DAY);
      const slip = dd(forecast, j.due);
      const daysLeft = Math.max(1, dd(j.due, TODAY));
      const need = remainingH / daysLeft;
      const open = jt.filter((t) => t.status !== 'done');
      const blocked = open.filter((t) => t.blocked).length;
      const overdue = open.filter((t) => TS.get(t.id).overdue).length;
      const aging = open.filter((t) => TS.get(t.id).aging).length;
      let health = 100;
      if (j.status === 'active') {
        if (slip > 0 && elapsed >= 7) health -= Math.min(40, slip * 2.5);
        if (cpi < 1) health -= Math.min(25, (1 - cpi) * 120);
        health -= Math.min(24, blocked * 8);
        health -= Math.min(15, overdue * 3);
        health -= Math.min(10, aging * 3);
      }
      health = Math.round(clamp(health, 0, 100));
      const band = j.status === 'done' ? 'done' : j.status === 'hold' ? 'hold' : health >= 75 ? 'good' : health >= 50 ? 'warn' : 'crit';
      const lastMove = Math.max(j.start, ...jt.map((t) => (t.history.length ? t.history[t.history.length - 1].t : 0)));
      JS.set(j.id, { total, doneH, pvH, progress, plannedPct, spi, spiT, elapsed, ev, cpi, eac, vel, remainingH, forecast, slip, need, open: open.length, blocked, overdue, aging, health, band, lastMove, tasks: jt });
    });

    // People: hours due in the next two weeks against capacity.
    const horizon = TODAY + 14 * DAY;
    const PS = new Map();
    S.people.forEach((p) => {
      const mine = tasks.filter((t) => t.assignee === p.id);
      const open = mine.filter((t) => t.status !== 'done' && active.has(t.jobId));
      const soon = open.filter((t) => t.due <= horizon);
      const load = sum(soon, (t) => TS.get(t.id).remaining);
      const cap = (p.capacity || 0) * 2;
      const done30 = mine.filter((t) => t.completedAt && t.completedAt >= N - 30 * DAY);
      PS.set(p.id, {
        open,
        soon,
        load,
        cap,
        util: cap ? load / cap : (load ? 9 : 0),
        wip: open.filter((t) => t.status === 'doing' || t.status === 'review').length,
        done30: done30.length,
        ontime: done30.length ? done30.filter((t) => TS.get(t.id).ontime).length / done30.length : null,
        overdue: open.filter((t) => TS.get(t.id).overdue).length,
      });
    });

    // Portfolio KPIs.
    const activeJobs = jobs.filter((j) => j.status === 'active');
    const aj = activeJobs.map((j) => JS.get(j.id));
    const evH = sum(aj, (x) => x.doneH);
    const pvH = sum(aj, (x) => x.pvH);
    const evMoney = sum(aj, (x) => x.ev);
    const spent = sum(activeJobs, (j) => j.spent);
    const doneIn = (a, b) => tasks.filter((t) => t.completedAt && t.completedAt >= a && t.completedAt < b);
    const d30 = doneIn(N - 30 * DAY, N + 1);
    const p30 = doneIn(N - 60 * DAY, N - 30 * DAY);
    const onTimeOf = (list) => (list.length ? list.filter((t) => TS.get(t.id).ontime).length / list.length : null);
    const cycleOf = (list) => { const c = list.map((t) => TS.get(t.id).cycle).filter((v) => v != null); return c.length ? mean(c) : null; };

    const weeks = [];
    for (let i = 7; i >= 0; i--) {
      const end = TODAY + DAY - i * 7 * DAY;
      const start = end - 7 * DAY;
      const list = doneIn(start, end);
      weeks.push({ start, end, count: list.length, hours: sum(list, (t) => t.est), ontime: onTimeOf(list), cycle: cycleOf(list) });
    }
    const evpv = weeks.map((w, i) => {
      const at = i === weeks.length - 1 ? N : w.end;
      return {
        t: w.end - DAY,
        pv: pvAt(liveTasks, at),
        ev: sum(liveTasks, (t) => t.est * (CREDIT[statusAt(t, at)] || 0)),
      };
    });

    const flow = {};
    FLOW_STAGES.forEach((s) => {
      const items = openLive.filter((t) => t.status === s);
      const limit = S.wip[s] || 0;
      const net = (arrivals[s] - departures[s]) / 14;
      const daysToLimit = items.length >= limit ? 0 : net > 0.05 ? Math.ceil((limit - items.length) / net) : null;
      flow[s] = {
        count: items.length,
        limit,
        arrivals: arrivals[s],
        departures: departures[s],
        net,
        avgWait: dwell[s].length ? mean(dwell[s]) : 0,
        nowWait: items.length ? mean(items.map((t) => TS.get(t.id).age)) : 0,
        oldest: items.slice().sort((a, b) => TS.get(b.id).age - TS.get(a.id).age)[0] || null,
        daysToLimit,
      };
    });
    FLOW_STAGES.forEach((s) => { flow[s].typical = typical[s]; flow[s].ratio = flow[s].count ? flow[s].nowWait / Math.max(0.5, typical[s]) : 0; });
    const waitScore = (s) => flow[s].ratio * Math.max(1, flow[s].count / Math.max(1, flow[s].limit));
    const bottleneck = FLOW_STAGES.slice().sort((a, b) => waitScore(b) - waitScore(a))[0];

    const teamLoad = sum([...PS.values()], (p) => p.load);
    const teamCap = sum([...PS.values()], (p) => p.cap);
    const thisWeek = weeks[7].count;
    const prevAvg = mean(weeks.slice(0, 7).map((w) => w.count));

    const kpi = {
      activeJobs: activeJobs.length,
      onTime: onTimeOf(d30),
      onTimePrev: onTimeOf(p30),
      spi: pvH > 0 ? evH / pvH : 1,
      cpi: spent > 0 && evMoney > 0 ? evMoney / spent : 1,
      budgetVar: evMoney - spent,
      eacOver: sum(activeJobs, (j) => JS.get(j.id).eac - j.budget),
      thisWeek,
      prevAvg,
      cycle: cycleOf(d30),
      cyclePrev: cycleOf(p30),
      blocked: openLive.filter((t) => t.blocked).length,
      overdue: openLive.filter((t) => TS.get(t.id).overdue).length,
      oldestBlock: Math.max(0, ...openLive.filter((t) => t.blocked).map((t) => dd(TODAY, t.blocked.since))),
      util: teamCap ? teamLoad / teamCap : 0,
      overloaded: [...PS.values()].filter((p) => p.util > 1.1).length,
      forecastOnTime: aj.filter((x) => x.slip <= 0).length,
      atRisk: aj.filter((x) => x.band === 'crit').length,
      watch: aj.filter((x) => x.band === 'warn').length,
      momentum: aj.length ? Math.round(mean(aj.map((x) => x.health))) : null,
      wip: openLive.filter((t) => t.status === 'doing' || t.status === 'review').length,
    };

    const ctx = { JS, TS, PS, flow, typical, downstream, active, N, weeks };
    const warnings = buildWarnings(ctx);
    return { JS, TS, PS, kpi, weeks, evpv, flow, bottleneck, typical, warnings, downstream };
  }

  /* ---------- early-warning rules ---------- */
  function buildWarnings(c) {
    const W = [];
    const N = c.N;
    const add = (w) => {
      w.key = w.type + ':' + (w.taskId || w.personId || w.stage || w.jobId);
      if (S.snoozed[w.key] && S.snoozed[w.key] > N) return;
      W.push(w);
    };
    const who = (pid) => (person(pid) ? person(pid).name.split(' ')[0] : 'Unassigned');

    S.jobs.filter((j) => j.status === 'active').forEach((j) => {
      const x = c.JS.get(j.id);
      if (x.slip >= 3 && x.elapsed >= 7) {
        add({
          type: 'slip', group: 'schedule', jobId: j.id,
          sev: x.slip >= 10 ? 'crit' : x.slip >= 5 ? 'serious' : 'warn',
          score: x.slip,
          title: j.name + ' is trending ' + plural(x.slip, 'day') + ' late',
          detail: 'Work is getting done at ' + x.spiT.toFixed(2) + '\u00d7 the planned rate, so it lands ' + fmtDate(x.forecast) + ' against a ' + fmtDate(j.due) +
            ' due date. Landing on time takes ' + x.need.toFixed(1) + ' h/day' + (x.vel > 0.05 ? '; the crew averaged ' + x.vel.toFixed(1) + ' h/day of finished work over the last 2 weeks.' : ', and nothing on this job finished in the last 2 weeks.'),
          actions: [{ act: 'open', label: 'Open job', primary: true }, { act: 'snooze', label: 'Snooze 2d' }],
        });
      }
      if (x.cpi < 0.93 && x.progress > 0.1) {
        add({
          type: 'cost', group: 'cost', jobId: j.id,
          sev: x.cpi < 0.8 ? 'crit' : x.cpi < 0.88 ? 'serious' : 'warn',
          score: (1 - x.cpi) * 40,
          title: j.name + ' is spending faster than it progresses',
          detail: 'CPI ' + x.cpi.toFixed(2) + ': each $1 spent earns ' + Math.round(x.cpi * 100) + '¢ of progress. Forecast at completion ' +
            money(x.eac) + ', ' + money(x.eac - j.budget) + ' over budget.',
          actions: [{ act: 'open', label: 'Review costs', primary: true }, { act: 'snooze', label: 'Snooze 2d' }],
        });
      }
      if (x.overdue >= 2) {
        add({
          type: 'overdue', group: 'schedule', jobId: j.id,
          sev: x.overdue >= 5 ? 'serious' : 'warn',
          score: x.overdue,
          title: plural(x.overdue, 'task') + ' past due on ' + j.name,
          detail: 'Re-plan the dates or add hands. Overdue work hides the real finish date.',
          actions: [{ act: 'open', label: 'Open job', primary: true }, { act: 'snooze', label: 'Snooze 2d' }],
        });
      }
      const idle = dd(TODAY, x.lastMove);
      if (x.open > 0 && idle >= 6 && TODAY > j.start + 3 * DAY) {
        add({
          type: 'stale', group: 'flow', jobId: j.id, sev: idle >= 10 ? 'serious' : 'warn', score: idle,
          title: 'Nothing has moved on ' + j.name + ' in ' + idle + ' days',
          detail: 'Check in with ' + who(j.lead) + ' to confirm the next step and who owns it.',
          actions: [{ act: 'nudge', label: 'Nudge ' + who(j.lead), primary: true }, { act: 'open', label: 'Open job' }],
        });
      }
    });

    S.tasks.forEach((t) => {
      if (!c.active.has(t.jobId) || t.status === 'done') return;
      const ts = c.TS.get(t.id);
      const j = job(t.jobId);
      if (t.blocked) {
        const days = Math.max(0, dd(TODAY, t.blocked.since));
        const down = c.downstream(t.id);
        add({
          type: 'blocked', group: 'blocked', jobId: t.jobId, taskId: t.id,
          sev: days >= 5 || down >= 5 ? 'crit' : days >= 2 || down >= 2 ? 'serious' : 'warn',
          score: days + down,
          title: t.title + ' is waiting on ' + (BLOCK_LABEL[t.blocked.type] || 'something') + ' (' + plural(days, 'day') + ')',
          detail: (t.blocked.note ? t.blocked.note + '. ' : '') + (down ? plural(down, 'downstream task') + ' can’t start until this clears.' : 'Nothing else is waiting on it yet.'),
          actions: [{ act: 'nudge', label: 'Nudge', primary: true }, { act: 'unblock', label: 'Mark unblocked' }, { act: 'open', label: 'Open job' }],
        });
        return;
      }
      if (ts.aging) {
        const next = STAGES[STAGES.indexOf(t.status) + 1];
        add({
          type: 'aging', group: 'flow', jobId: t.jobId, taskId: t.id,
          sev: ts.age > ts.agingLimit * 2 ? 'serious' : 'warn',
          score: ts.age / ts.agingLimit,
          title: t.title + ' has sat in ' + STAGE_LABEL[t.status] + ' for ' + plural(Math.round(ts.age), 'day'),
          detail: (t.status === 'review' ? 'Reviews usually clear in ' + c.typical.review.toFixed(1) + ' days. ' : 'Expected about ' + plural(Math.ceil(ts.agingLimit / 1.6), 'day') + ' of work. ') +
            who(t.assignee) + ' owns it on ' + j.code + '.',
          actions: [{ act: 'advance', label: 'Move to ' + STAGE_LABEL[next], primary: true }, { act: 'nudge', label: 'Nudge ' + who(t.assignee) }, { act: 'snooze', label: 'Snooze 2d' }],
        });
        return;
      }
      const left = dd(t.due, TODAY);
      if ((t.status === 'backlog' || t.status === 'ready') && left >= 0 && left <= 3) {
        const depsOpen = (t.deps || []).filter((d) => task(d) && task(d).status !== 'done').length;
        add({
          type: 'duesoon', group: 'schedule', jobId: t.jobId, taskId: t.id,
          sev: depsOpen ? 'serious' : 'warn', score: 4 - left,
          title: t.title + ' is due ' + rel(t.due) + ' and hasn’t started',
          detail: (depsOpen ? 'It still waits on ' + plural(depsOpen, 'earlier task') + '. ' : '') + who(t.assignee) + ' · ' + t.est + 'h · ' + j.code,
          actions: [{ act: 'start', label: 'Start now', primary: true }, { act: 'open', label: 'Open job' }],
        });
      }
    });

    FLOW_STAGES.forEach((s) => {
      const f = c.flow[s];
      if (!f.limit) return;
      if (f.count > f.limit) {
        add({
          type: 'wip', group: 'flow', stage: s,
          sev: f.count >= f.limit * 1.5 ? 'crit' : 'serious', score: f.count - f.limit + 5,
          title: STAGE_LABEL[s] + ' is over its limit: ' + f.count + ' items, limit ' + f.limit,
          detail: f.arrivals + ' came in and ' + f.departures + ' went out in the last 14 days. Items wait ' + f.nowWait.toFixed(1) +
            ' days on average. Clear the oldest before starting anything new.',
          actions: [{ act: 'board', label: 'Open board', primary: true }, { act: 'snooze', label: 'Snooze 2d' }],
        });
      } else if (f.daysToLimit != null && f.daysToLimit > 0 && f.daysToLimit <= 10) {
        add({
          type: 'flow', group: 'flow', stage: s, sev: f.daysToLimit <= 4 ? 'serious' : 'warn', score: 10 - f.daysToLimit,
          title: STAGE_LABEL[s] + ' will hit its limit in about ' + plural(f.daysToLimit, 'day'),
          detail: f.arrivals + ' in vs ' + f.departures + ' out over 14 days. At this rate it becomes your bottleneck.',
          actions: [{ act: 'board', label: 'Open board', primary: true }, { act: 'snooze', label: 'Snooze 2d' }],
        });
      }
    });

    const wk = c.weeks;
    const prevAvg = mean(wk.slice(0, 7).map((w) => w.count));
    if (prevAvg >= 3 && wk[7].count < prevAvg * 0.6) {
      add({
        type: 'throughput', group: 'flow', stage: 'all', sev: wk[7].count < prevAvg * 0.4 ? 'serious' : 'warn', score: prevAvg - wk[7].count,
        title: 'Throughput dropped to ' + plural(wk[7].count, 'task') + ' this week',
        detail: 'Down from a ' + prevAvg.toFixed(1) + '/week average. Fewer finishes now means late jobs in 2 to 3 weeks. Look for work stuck in Review or waiting on blockers.',
        actions: [{ act: 'board', label: 'Open board', primary: true }, { act: 'snooze', label: 'Snooze 2d' }],
      });
    }

    S.people.forEach((p) => {
      const x = c.PS.get(p.id);
      if (x.util <= 1.1) return;
      const fam = (r) => String(r || '').replace(/\d+$/, '');
      const roles = (p.roles || []).map(fam);
      const others = S.people.filter((o) => o.id !== p.id).map((o) => ({ o, x: c.PS.get(o.id) })).filter((r) => r.x.util < 0.8);
      const sameRole = others.filter((r) => (r.o.roles || []).some((ro) => roles.includes(fam(ro))));
      const pool = (sameRole.length ? sameRole : others).sort((a, b) => a.x.util - b.x.util);
      const cand = pool[0];
      let move = null;
      if (cand) {
        const spare = cand.x.cap - cand.x.load;
        const movable = x.soon.filter((t) => (t.status === 'ready' || t.status === 'backlog') && !t.blocked).sort((a, b) => b.est - a.est);
        move = movable.find((t) => t.est <= spare) || movable[movable.length - 1] || null;
      }
      add({
        type: 'overload', group: 'people', personId: p.id,
        sev: x.util > 1.5 ? 'crit' : x.util > 1.25 ? 'serious' : 'warn', score: x.util * 5,
        title: p.name + ' is booked at ' + pct(x.util) + ' for the next 2 weeks',
        detail: Math.round(x.load) + 'h of work due against ' + x.cap + 'h available.' +
          (move ? ' Move “' + move.title + '” (' + move.est + 'h, ' + job(move.jobId).code + ') to ' + cand.o.name + ', who is at ' + pct(cand.x.util) + '.' : ' Nobody has spare capacity: push a due date or add help.'),
        move: move ? { taskId: move.id, to: cand.o.id } : null,
        actions: move
          ? [{ act: 'reassign', label: 'Move to ' + cand.o.name.split(' ')[0], primary: true }, { act: 'team', label: 'See team' }]
          : [{ act: 'team', label: 'See team', primary: true }, { act: 'snooze', label: 'Snooze 2d' }],
      });
    });

    return W.sort((a, b) => SEV_RANK[b.sev] - SEV_RANK[a.sev] || b.score - a.score);
  }

  /* ---------- icons ---------- */
  const IC = {
    pulse: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    jobs: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
    board: '<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="10" rx="1.5"/><rect x="17" y="4" width="4" height="13" rx="1.5"/>',
    timeline: '<path d="M4 6h9M8 12h12M4 18h7"/>',
    radar: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 12l6-6"/>',
    team: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2a5 5 0 0 1 6 4.8"/>',
    alert: '<path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4M12 17h.01"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    money: '<path d="M12 3v18M17 7H9.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H6"/>',
    block: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5 9-5z"/><path d="m3 13 9 5 9-5"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    flame: '<path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5 1-8.5z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    system: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    trend: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    swap: '<path d="M7 7h13l-3-3M17 17H4l3 3"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    edit: '<path d="M4 20h4L20 8l-4-4L4 16v4z"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    play: '<path d="M7 5v14l11-7z"/>',
    unlock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    upload: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
    refresh: '<path d="M20 11A8 8 0 0 0 6 6L4 8M4 4v4h4M4 13a8 8 0 0 0 14 5l2-2M20 20v-4h-4"/>',
    gauge: '<path d="M4 18a8 8 0 1 1 16 0"/><path d="M12 18l4-6"/>',
    zap: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/>',
  };
  const PAW = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5.5" cy="10" r="2.2"/><circle cx="9.5" cy="5.5" r="2.2"/><circle cx="14.5" cy="5.5" r="2.2"/><circle cx="18.5" cy="10" r="2.2"/><path d="M12 11.5c-3.2 0-5.5 3.2-5.5 5.8 0 1.6 1.2 2.7 2.8 2.7 1 0 1.7-.5 2.7-.5s1.7.5 2.7.5c1.6 0 2.8-1.1 2.8-2.7 0-2.6-2.3-5.8-5.5-5.8z"/></svg>';
  const icon = (n) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IC[n] || '') + '</svg>';
  const SEV_ICON = { crit: 'alert', serious: 'alert', warn: 'info' };
  const TYPE_ICON = { slip: 'clock', cost: 'money', blocked: 'block', aging: 'clock', duesoon: 'calendar', overdue: 'calendar', wip: 'layers', flow: 'trend', overload: 'user', stale: 'pulse', throughput: 'trend' };

  function avatar(pid, cls) {
    const p = person(pid);
    if (!p) return '<span class="avatar none ' + (cls || '') + '" title="Unassigned">?</span>';
    return '<span class="avatar ' + (cls || '') + '" style="background:' + esc(p.color || '#4a6272') + '" title="' + esc(p.name) + '">' + esc(initials(p.name)) + '</span>';
  }
  const bandChip = (band, score) => {
    const map = { good: ['good', 'check', 'On track'], warn: ['warn', 'info', 'Watch'], crit: ['crit', 'alert', 'At risk'], done: ['brand', 'check', 'Complete'], hold: ['', 'clock', 'On hold'] };
    const m = map[band] || map.good;
    return '<span class="chip ' + m[0] + '">' + icon(m[1]) + m[2] + (score != null && band !== 'done' && band !== 'hold' ? ' · ' + score : '') + '</span>';
  };
  const slipText = (slip, done) => {
    if (slip > 0) return '<span class="txt-crit">' + slip + 'd ' + (done ? 'late' : 'late') + '</span>';
    if (slip < 0) return '<span class="txt-good">' + Math.abs(slip) + 'd early</span>';
    return '<span class="txt-good">On time</span>';
  };

  /* ---------- charts ---------- */
  function sparkline(values, opts) {
    const vals = values.map((v, i) => (v == null ? (i ? values.slice(0, i).reverse().find((x) => x != null) : null) : v));
    const clean = vals.filter((v) => v != null);
    if (clean.length < 2) return '<svg class="spark" viewBox="0 0 84 30"></svg>';
    const w = 84, h = 30, p = 4;
    let lo = Math.min(...clean), hi = Math.max(...clean);
    if (opts && opts.zero) lo = Math.min(0, lo);
    if (hi - lo < 1e-6) { hi += 1; lo -= 1; }
    const pts = vals.map((v, i) => [p + (i * (w - 2 * p)) / (vals.length - 1), v == null ? null : h - p - ((v - lo) / (hi - lo)) * (h - 2 * p)]).filter((q) => q[1] != null);
    const line = pts.map((q, i) => (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join(' ');
    const area = line + ' L' + pts[pts.length - 1][0].toFixed(1) + ' ' + (h - 1) + ' L' + pts[0][0].toFixed(1) + ' ' + (h - 1) + 'Z';
    const last = pts[pts.length - 1];
    return '<svg class="spark" viewBox="0 0 84 30" aria-hidden="true"><path class="area" d="' + area + '"/><path class="line" d="' + line + '"/><circle cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="3"/></svg>';
  }

  function topRounded(x, y, w, h, r) {
    if (h <= 0) return '';
    r = Math.min(r, w / 2, h);
    return 'M' + x + ' ' + (y + h) + 'V' + (y + r) + 'Q' + x + ' ' + y + ' ' + (x + r) + ' ' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ' ' + y + ' ' + (x + w) + ' ' + (y + r) + 'V' + (y + h) + 'Z';
  }

  function throughputChart(weeks) {
    const W = 360, H = 190, pl = 28, pr = 8, pt = 18, pb = 24;
    const max = niceMax(Math.max(4, ...weeks.map((w) => w.count)));
    const iw = W - pl - pr, ih = H - pt - pb;
    const bw = iw / weeks.length;
    const y = (v) => pt + ih - (v / max) * ih;
    let g = '';
    for (let i = 0; i <= 4; i++) {
      const v = (max / 4) * i;
      g += '<line class="gridline" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>';
      g += '<text class="tick" x="' + (pl - 6) + '" y="' + (y(v) + 3.5) + '" text-anchor="end">' + Math.round(v) + '</text>';
    }
    weeks.forEach((w, i) => {
      const x = pl + i * bw + bw * 0.2;
      const bwid = bw * 0.6;
      const yy = y(w.count);
      const last = i === weeks.length - 1;
      const tip = '<b>Week of ' + esc(fmtDate(w.start)) + '</b><br>' + plural(w.count, 'task') + ' finished · ' + w.hours + 'h' +
        (w.ontime != null ? '<br>' + pct(w.ontime) + ' on time' : '');
      g += '<g class="col"><path class="bar' + (last ? '' : ' dim') + '" d="' + topRounded(x, yy, bwid, pt + ih - yy, 4) + '"/>' +
        '<rect class="hit" x="' + (pl + i * bw) + '" y="' + pt + '" width="' + bw + '" height="' + ih + '" data-tip="' + esc(tip) + '"/></g>';
      if (i % 2 === 1 || last) g += '<text class="tick" x="' + (x + bwid / 2) + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(last ? 'This wk' : fmtDate(w.start)) + '</text>';
      if (last) g += '<text class="lbl-strong" x="' + (x + bwid / 2) + '" y="' + (yy - 6) + '" text-anchor="middle">' + w.count + '</text>';
    });
    g += '<line class="baseline" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + (pt + ih) + '" y2="' + (pt + ih) + '"/>';
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Tasks finished per week, last 8 weeks">' + g + '</svg>';
  }

  function evpvChart(points) {
    const W = 560, H = 220, pl = 40, pr = 78, pt = 14, pb = 26;
    const max = niceMax(Math.max(10, ...points.map((p) => Math.max(p.pv, p.ev))));
    const iw = W - pl - pr, ih = H - pt - pb;
    const x = (i) => pl + (i * iw) / (points.length - 1);
    const y = (v) => pt + ih - (v / max) * ih;
    let g = '';
    for (let i = 0; i <= 4; i++) {
      const v = (max / 4) * i;
      g += '<line class="gridline" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>';
      g += '<text class="tick" x="' + (pl - 6) + '" y="' + (y(v) + 3.5) + '" text-anchor="end">' + Math.round(v) + 'h</text>';
    }
    const path = (k) => points.map((p, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p[k]).toFixed(1)).join(' ');
    g += '<path class="area-earned" d="' + path('ev') + ' L' + x(points.length - 1) + ' ' + (pt + ih) + ' L' + x(0) + ' ' + (pt + ih) + 'Z"/>';
    g += '<path class="ln planned" d="' + path('pv') + '"/>';
    g += '<path class="ln earned" d="' + path('ev') + '"/>';
    g += '<line class="baseline" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + (pt + ih) + '" y2="' + (pt + ih) + '"/>';
    points.forEach((p, i) => {
      if (i % 2 === 1 || i === points.length - 1) g += '<text class="tick" x="' + x(i) + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(i === points.length - 1 ? 'Today' : fmtDate(p.t)) + '</text>';
      const gap = p.ev - p.pv;
      const tip = '<b>' + esc(fmtDate(p.t)) + '</b><br>Planned ' + Math.round(p.pv) + 'h<br>Earned ' + Math.round(p.ev) + 'h<br>' + (gap >= 0 ? 'Ahead ' : 'Behind ') + Math.abs(Math.round(gap)) + 'h';
      const bw = iw / (points.length - 1);
      g += '<g class="col"><line class="xhair" x1="' + x(i) + '" x2="' + x(i) + '" y1="' + pt + '" y2="' + (pt + ih) + '"/>' +
        '<circle class="pt planned" cx="' + x(i) + '" cy="' + y(p.pv) + '" r="4"/><circle class="pt earned" cx="' + x(i) + '" cy="' + y(p.ev) + '" r="4"/>' +
        '<rect class="hit" x="' + (x(i) - bw / 2) + '" y="' + pt + '" width="' + bw + '" height="' + ih + '" data-tip="' + esc(tip) + '"/></g>';
    });
    const last = points[points.length - 1];
    let ye = y(last.ev), yp = y(last.pv);
    if (Math.abs(ye - yp) < 26) { if (ye > yp) { ye = yp + 26; } else { yp = ye + 26; } }
    g += '<text class="lbl-strong" x="' + (W - pr + 8) + '" y="' + (ye - 2) + '">Earned</text><text class="tick" x="' + (W - pr + 8) + '" y="' + (ye + 11) + '">' + Math.round(last.ev) + 'h</text>';
    g += '<text class="lbl" x="' + (W - pr + 8) + '" y="' + (yp - 2) + '">Planned</text><text class="tick" x="' + (W - pr + 8) + '" y="' + (yp + 11) + '">' + Math.round(last.pv) + 'h</text>';
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Planned versus earned hours, last 8 weeks">' + g + '</svg>';
  }

  /* ---------- shell ---------- */
  const VIEWS = {
    pulse: { title: 'Pulse', icon: 'pulse', sub: () => new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) + ' · portfolio at a glance', render: viewPulse },
    jobs: { title: 'Jobs', icon: 'jobs', sub: () => plural(M.kpi.activeJobs, 'active job') + ' · ' + S.jobs.filter((j) => j.status === 'done').length + ' complete', render: viewJobs },
    board: { title: 'Board', icon: 'board', sub: () => 'Drag work across stages. Limits flag bottlenecks as they form.', render: viewBoard },
    timeline: { title: 'Timeline', icon: 'timeline', sub: () => 'Plan vs forecast for every job', render: viewTimeline },
    radar: { title: 'Radar', icon: 'radar', sub: () => plural(M.warnings.length, 'early warning') + ', sorted by what will hurt most', render: viewRadar },
    team: { title: 'Team', icon: 'team', sub: () => 'Workload for the next 14 days', render: viewTeam },
  };

  function renderNav() {
    const urgent = M.warnings.filter((w) => w.sev !== 'warn').length;
    $('#nav').innerHTML = VIEW_KEYS.map((k, i) => {
      const v = VIEWS[k];
      const badge = k === 'radar' && urgent ? '<span class="count">' + urgent + '</span>' : '';
      return '<button class="nav-btn" data-action="nav" data-view="' + k + '"' + (UI.view === k ? ' aria-current="page"' : '') + '>' + icon(v.icon) + '<span>' + v.title + '</span>' + badge + '<span class="nav-kbd">' + (i + 1) + '</span></button>';
    }).join('');
  }

  function levelOf(xp) {
    let idx = 0;
    LEVELS.forEach((l, i) => { if (xp >= l[0]) idx = i; });
    const cur = LEVELS[idx];
    const next = LEVELS[idx + 1];
    return { idx, name: cur[1], floor: cur[0], next: next ? next[0] : null, nextName: next ? next[1] : null };
  }
  function renderLevel() {
    const L = levelOf(S.xp);
    const frac = L.next ? (S.xp - L.floor) / (L.next - L.floor) : 1;
    $('#level').innerHTML = '<div class="level-top"><div class="level-badge">' + PAW + '</div><div><div class="level-name">' + esc(L.name) + '</div><div class="level-xp num">' + S.xp + ' XP' + (L.next ? ' · ' + (L.next - S.xp) + ' to ' + esc(L.nextName) : '') + '</div></div></div>' +
      '<div class="xp-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(frac * 100) + '" aria-label="Progress to next level"><span style="width:' + (frac * 100).toFixed(1) + '%"></span></div>';
  }
  function streakCount() {
    const set = new Set(S.doneDays);
    let n = 0;
    let d = TODAY;
    if (!set.has(D.isoDay(d))) d = D.addDays(d, -1);
    while (set.has(D.isoDay(d))) { n++; d = D.addDays(d, -1); }
    return { n, today: set.has(D.isoDay(TODAY)) };
  }
  function renderStreak() {
    const s = streakCount();
    const el = $('#streak');
    el.innerHTML = icon('flame') + '<span><span class="num">' + s.n + '</span><span class="hide-sm">-day streak</span></span>';
    el.setAttribute('data-tip', s.today ? '<b>Streak is safe today.</b><br>Keep moving work tomorrow to grow it.' : '<b>Keep it alive:</b> finish, unblock or nudge something today.');
  }
  function applyTheme() {
    const t = prefs.theme || 'system';
    if (t === 'system') {
      if (hostTheme) document.documentElement.setAttribute('data-theme', hostTheme);
      else document.documentElement.removeAttribute('data-theme');
    } else document.documentElement.setAttribute('data-theme', t);
    const label = { system: 'System', light: 'Light', dark: 'Dark' }[t];
    $('#themeBtn').innerHTML = icon(t === 'system' ? 'system' : t === 'light' ? 'sun' : 'moon') + label;
  }

  function render() {
    renderNav();
    renderLevel();
    renderStreak();
    const v = VIEWS[UI.view];
    $('#pageTitle').textContent = v.title;
    $('#pageSub').textContent = v.sub();
    const view = $('#view');
    view.classList.toggle('enter', UI.entering);
    view.innerHTML = v.render();
    UI.entering = false;
    if (UI.drawerJob) renderDrawer();
  }

  function go(view) {
    if (!VIEWS[view]) view = 'pulse';
    if (UI.view !== view) UI.entering = true;
    UI.view = view;
    if (location.hash.slice(1) !== view) { try { history.replaceState(null, '', '#' + view); } catch (e) { location.hash = view; } }
    render();
    window.scrollTo({ top: 0 });
  }

  /* ---------- shared bits ---------- */
  function alertRow(w, compact, inJob) {
    const j = w.jobId ? job(w.jobId) : null;
    const meta = [];
    if (j) meta.push('<span class="mono">' + esc(j.code) + '</span>');
    if (w.taskId && task(w.taskId)) meta.push(avatar(task(w.taskId).assignee));
    const pool = inJob ? w.actions.filter((a) => a.act !== 'open') : w.actions;
    const acts = (compact ? pool.slice(0, 2) : pool).map((a) =>
      '<button class="btn sm' + (a.primary ? ' primary' : '') + '" data-action="w-' + a.act + '" data-key="' + esc(w.key) + '">' + esc(a.label) + '</button>').join('');
    return '<div class="alert ' + w.sev + '"><span class="stripe"></span><span class="ico">' + icon(TYPE_ICON[w.type] || SEV_ICON[w.sev]) + '</span>' +
      '<div style="min-width:0"><div class="sev-label">' + SEV_LABEL[w.sev] + '</div><div class="alert-title">' + esc(w.title) + '</div>' +
      '<div class="alert-detail">' + esc(w.detail) + '</div>' + (meta.length ? '<div class="alert-meta">' + meta.join('') + '</div>' : '') + '</div>' +
      '<div class="alert-actions">' + acts + '</div></div>';
  }
  function emptyState(ic, title, text, btn) {
    return '<div class="empty"><div class="empty-ico">' + icon(ic) + '</div><h3>' + esc(title) + '</h3><p>' + esc(text) + '</p>' + (btn || '') + '</div>';
  }
  function sampleBanner() {
    if (!S.sample) return '';
    return '<div class="sample-banner">' + icon('info').replace('<svg', '<svg width="18" height="18"') +
      '<div class="grow"><b>You’re looking at sample jobs.</b> Play with them freely: changes save in this browser. Start fresh when you’re ready to add your own.</div>' +
      '<button class="btn sm" data-action="start-fresh">Start fresh</button></div>';
  }
  function tickBox(t) {
    const on = t.status === 'done';
    return '<button class="tick-box' + (on ? ' on' : '') + '" data-action="toggle-done" data-id="' + t.id + '" aria-label="' + (on ? 'Reopen ' : 'Complete ') + esc(t.title) + '" aria-pressed="' + on + '">' + icon('check') + '</button>';
  }

  /* ---------- Pulse ---------- */
  function viewPulse() {
    const k = M.kpi;
    const hr = new Date().getHours();
    const hello = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
    const urgent = M.warnings.filter((w) => w.sev !== 'warn');
    const active = S.jobs.filter((j) => j.status === 'active');

    if (!active.length) {
      return sampleBanner() + '<section class="hero"><div><div class="hero-hello">' + hello + '.</div><p class="hero-line">No active jobs yet. Create one from a template and Momentum will lay out the tasks, track the KPIs and watch for trouble.</p>' +
        '<div class="hero-chips"><button class="btn primary" data-action="new-job">' + icon('plus') + 'Create your first job</button><button class="btn" data-action="load-sample">Load sample jobs</button></div></div></section>';
    }

    const score = k.momentum;
    const band = score >= 75 ? 'good' : score >= 50 ? 'warn' : 'crit';
    const ringColor = { good: 'var(--good)', warn: 'var(--warn)', crit: 'var(--crit)' }[band];
    const C = 2 * Math.PI * 44;
    const verdict = { good: 'Rolling', warn: 'Wobbling', crit: 'Stalling' }[band];
    const verdictText = { good: 'Work is flowing. Keep the queues short.', warn: 'A few jobs need a push this week.', crit: 'Several jobs are off plan. Clear blockers first.' }[band];

    let line = plural(active.length, 'active job') + '. ';
    line += urgent.length ? '<b>' + plural(urgent.length, 'thing needs', 'things need') + ' you today.</b> ' : '<b>Nothing urgent.</b> ';
    line += k.forecastOnTime + ' of ' + active.length + ' jobs are forecast to finish on time.';

    const hero = '<section class="hero"><div><div class="hero-hello">' + hello + '.</div><p class="hero-line">' + line + '</p><div class="hero-chips">' +
      (k.atRisk ? '<span class="chip crit">' + icon('alert') + plural(k.atRisk, 'job') + ' at risk</span>' : '<span class="chip good">' + icon('check') + 'No jobs at risk</span>') +
      (k.blocked ? '<span class="chip serious">' + icon('block') + k.blocked + ' blocked</span>' : '') +
      (k.overloaded ? '<span class="chip warn">' + icon('user') + plural(k.overloaded, 'person', 'people') + ' overloaded</span>' : '') +
      '<span class="chip outline">' + icon('money') + money(Math.abs(k.budgetVar)) + (k.budgetVar >= 0 ? ' under' : ' over') + ' budget on work done</span>' +
      '</div></div><div class="score"><svg class="score-ring" viewBox="0 0 108 108" role="img" aria-label="Momentum score ' + score + ' of 100">' +
      '<circle class="track" cx="54" cy="54" r="44" fill="none" stroke-width="10"/>' +
      '<circle class="val" cx="54" cy="54" r="44" fill="none" stroke="' + ringColor + '" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + (C * (1 - score / 100)).toFixed(1) + '" transform="rotate(-90 54 54)"/>' +
      '<text class="score-num" x="54" y="58" text-anchor="middle">' + score + '</text><text class="score-cap" x="54" y="74" text-anchor="middle">MOMENTUM</text></svg>' +
      '<div class="score-text"><b>' + verdict + '</b><span>' + verdictText + ' Average health of active jobs.</span></div></div></section>';

    const tone = (good, warn) => (good ? 'good' : warn ? 'warn' : 'crit');
    const toneChip = (t) => ({ good: '<span class="chip good">' + icon('check') + 'On target</span>', warn: '<span class="chip warn">' + icon('info') + 'Watch</span>', crit: '<span class="chip crit">' + icon('alert') + 'Off target</span>' }[t]);
    const delta = (cur, prev, opts) => {
      if (cur == null || prev == null) return '<span class="delta flat">no prior data</span>';
      const d = cur - prev;
      const good = opts.lowerBetter ? d < 0 : d > 0;
      const txt = opts.fmt(Math.abs(d));
      if (Math.abs(d) < (opts.eps || 0.005)) return '<span class="delta flat">→ flat</span>';
      return '<span class="delta ' + (good ? 'up' : 'down') + '">' + (d > 0 ? '↑' : '↓') + ' ' + txt + '</span>';
    };
    const tile = (label, tip, value, foot, extra, chip) =>
      '<div class="kpi"><div class="kpi-label">' + esc(label) + '<span class="info" data-tip="' + esc(tip) + '">' + icon('info') + '</span>' + (chip ? '<span style="margin-left:auto">' + chip + '</span>' : '') + '</div>' +
      '<div class="kpi-row"><div class="kpi-value num">' + value + '</div>' + (extra || '') + '</div><div class="kpi-foot">' + foot + '</div></div>';

    const kpis = '<section class="kpis">' +
      tile('On-time delivery', 'Share of tasks finished on or before their due date in the last 30 days.', k.onTime == null ? '—' : Math.round(k.onTime * 100) + '<small>%</small>',
        delta(k.onTime, k.onTimePrev, { fmt: (v) => Math.round(v * 100) + ' pts' }) + ' vs prior 30d', sparkline(M.weeks.map((w) => w.ontime)), k.onTime == null ? '' : toneChip(tone(k.onTime >= 0.85, k.onTime >= 0.7))) +
      tile('Schedule (SPI)', 'Schedule Performance Index: hours earned ÷ hours planned to date. 1.00 is on plan; below 0.95 means falling behind.', k.spi.toFixed(2),
        Math.round(sum(S.jobs.filter((j) => j.status === 'active'), (j) => M.JS.get(j.id).doneH)) + 'h earned of ' + Math.round(sum(S.jobs.filter((j) => j.status === 'active'), (j) => M.JS.get(j.id).pvH)) + 'h planned', sparkline(M.evpv.map((p) => (p.pv ? p.ev / p.pv : null))), toneChip(tone(k.spi >= 0.95, k.spi >= 0.85))) +
      tile('Cost (CPI)', 'Cost Performance Index: earned value ÷ actual cost. Below 1.00 means spending more than the work completed is worth.', k.cpi.toFixed(2),
        money(Math.abs(k.budgetVar)) + (k.budgetVar >= 0 ? ' under' : ' over') + ' on work done', '', toneChip(tone(k.cpi >= 0.97, k.cpi >= 0.9))) +
      tile('Forecast overrun', 'Estimate at completion minus budget, summed across active jobs, at today’s cost efficiency.', (k.eacOver > 0 ? '+' : '') + money(k.eacOver),
        'at completion · ' + plural(S.jobs.filter((j) => j.status === 'active' && M.JS.get(j.id).eac > j.budget * 1.02).length, 'job') + ' over', '', toneChip(tone(k.eacOver <= 0, k.eacOver < 15000))) +
      tile('Throughput', 'Tasks finished in the last 7 days, compared with the weekly average of the 7 weeks before.', k.thisWeek + '<small>/wk</small>',
        delta(k.thisWeek, k.prevAvg, { fmt: (v) => v.toFixed(1), eps: 0.05 }) + ' vs 7-wk avg ' + k.prevAvg.toFixed(1), sparkline(M.weeks.map((w) => w.count), { zero: true })) +
      tile('Cycle time', 'Average days from starting a task to finishing it, last 30 days. Lower is better.', k.cycle == null ? '—' : k.cycle.toFixed(1) + '<small>days</small>',
        delta(k.cycle, k.cyclePrev, { fmt: (v) => v.toFixed(1) + 'd', lowerBetter: true, eps: 0.05 }) + ' vs prior 30d', sparkline(M.weeks.map((w) => w.cycle))) +
      tile('Blocked work', 'Open tasks waiting on someone outside the crew: clients, permits, materials, inspections.', String(k.blocked),
        k.blocked ? 'oldest ' + plural(k.oldestBlock, 'day') + ' · ' + k.overdue + ' overdue' : k.overdue + ' overdue tasks', '', toneChip(tone(k.blocked === 0, k.blocked <= 2))) +
      tile('Team load', 'Hours of work due in the next 14 days ÷ team capacity for the same period.', Math.round(k.util * 100) + '<small>%</small>',
        k.overloaded ? plural(k.overloaded, 'person', 'people') + ' over capacity' : 'everyone has room', '', toneChip(tone(k.util <= 0.9 && !k.overloaded, k.util <= 1.05))) +
      '</section>';

    const moves = M.warnings.slice(0, 4);
    const movesCard = '<div class="card"><div class="card-head"><div class="card-title">Today’s moves</div><div class="card-sub grow">The highest-impact things to unstick</div>' +
      (M.warnings.length > 4 ? '<button class="btn sm ghost" data-action="nav" data-view="radar">All ' + M.warnings.length + icon('arrow') + '</button>' : '') + '</div>' +
      (moves.length ? '<div class="alerts">' + moves.map((w) => alertRow(w, true)).join('') + '</div>' : emptyState('check', 'Nothing is stuck', 'No blockers, no slipping jobs, no overloaded teammates. Nice work.')) + '</div>';

    const evCard = '<div class="card"><div class="card-head"><div class="card-title">Planned vs earned hours</div><div class="card-sub grow">Active jobs, cumulative</div>' +
      '<div class="legend"><span><i></i>Earned</span><span><i class="planned"></i>Planned</span></div></div>' + evpvChart(M.evpv) +
      '<p class="card-sub" style="margin-top:8px">The gap between the lines is schedule variance. Earned below planned means the portfolio is behind.</p></div>';

    const f = M.flow;
    const maxWait = Math.max(0.5, ...FLOW_STAGES.map((s) => Math.max(f[s].nowWait, f[s].typical)));
    const bn = M.bottleneck;
    const stages = '<div class="card"><div class="card-head"><div class="card-title">Where work waits</div><div class="card-sub grow">Days open items have waited</div></div><div class="stages">' +
      FLOW_STAGES.map((s) => '<div class="stage-row" data-tip="' + esc('<b>' + STAGE_LABEL[s] + '</b><br>' + f[s].count + ' waiting now (limit ' + f[s].limit + ')<br>Waiting ' + f[s].nowWait.toFixed(1) + ' days on average<br>Usual: ' + f[s].typical.toFixed(1) + ' days<br>' + f[s].arrivals + ' in / ' + f[s].departures + ' out, 14 days') + '">' +
        '<span class="name">' + STAGE_LABEL[s] + '</span><div class="stage-track"><div class="stage-fill' + (s === bn && f[s].count ? ' hot' : '') + '" style="width:' + ((f[s].nowWait / maxWait) * 100).toFixed(1) + '%"></div>' +
        '<span class="stage-typ" style="left:' + ((f[s].typical / maxWait) * 100).toFixed(1) + '%"></span></div>' +
        '<span class="stage-val num">' + f[s].nowWait.toFixed(1) + 'd</span></div>').join('') + '</div>' +
      (f[bn].count ? '<p class="stage-note"><b>' + STAGE_LABEL[bn] + '</b> is your bottleneck: ' + plural(f[bn].count, 'item') + ' waiting ' + f[bn].nowWait.toFixed(1) + ' days, ' + f[bn].ratio.toFixed(1) + '\u00d7 the usual ' + f[bn].typical.toFixed(1) + (f[bn].count > f[bn].limit ? ', and over its limit of ' + f[bn].limit : '') + '.</p>' : '<p class="stage-note">Queues are empty.</p>') +
      '<div class="legend" style="margin-top:10px"><span><i class="box hot"></i>Bottleneck</span><span><i class="box"></i>Other stages</span><span><i class="tick-key"></i>Usual wait</span></div></div>';

    const thr = '<div class="card"><div class="card-head"><div class="card-title">Throughput</div><div class="card-sub grow">Tasks finished per week</div></div>' + throughputChart(M.weeks) + '</div>';

    const jobsSorted = active.slice().sort((a, b) => M.JS.get(a.id).health - M.JS.get(b.id).health);
    const health = '<div class="card"><div class="card-head"><div class="card-title">Job health</div><div class="card-sub grow">Worst first</div><button class="btn sm ghost" data-action="nav" data-view="jobs">All jobs' + icon('arrow') + '</button></div><div class="hlist">' +
      jobsSorted.slice(0, 6).map((j) => {
        const x = M.JS.get(j.id);
        return '<button class="hrow" data-action="open-job" data-id="' + j.id + '"><span class="hscore ' + x.band + '">' + x.health + '</span><span style="min-width:0"><div class="hname">' + esc(j.name) + '</div><div class="hsub">' + esc(j.code) + ' · ' + pct(x.progress) + ' done · due ' + esc(fmtDate(j.due)) + '</div></span><span class="hright">' + slipText(x.slip) + '<div class="muted">SPI ' + x.spi.toFixed(2) + '</div></span></button>';
      }).join('') + '</div></div>';

    const soon = S.tasks.filter((t) => M.TS.get(t.id).open && job(t.jobId) && job(t.jobId).status === 'active' && t.due <= TODAY + 7 * DAY).sort((a, b) => a.due - b.due).slice(0, 8);
    const dueCard = '<div class="card"><div class="card-head"><div class="card-title">Due in the next 7 days</div><div class="card-sub grow">Tick to finish</div></div>' +
      (soon.length ? '<div class="mini-list">' + soon.map((t) => {
        const late = t.due < TODAY;
        return '<div class="mini-task">' + tickBox(t) + '<button class="t" style="border:0;background:none;text-align:left;padding:0;font-weight:550" data-action="open-task" data-id="' + t.id + '">' + esc(t.title) + ' <span class="muted mono">' + esc(job(t.jobId).code) + '</span></button>' +
          (t.blocked ? '<span class="chip crit">' + icon('block') + 'Blocked</span>' : '') + '<span class="' + (late ? 'txt-crit' : 'muted') + '" style="font-size:12px;white-space:nowrap">' + (late ? rel(t.due).replace('ago', 'late') : rel(t.due)) + '</span>' + avatar(t.assignee) + '</div>';
      }).join('') + '</div>' : emptyState('calendar', 'Clear week ahead', 'Nothing is due in the next 7 days.')) + '</div>';

    const feed = activity(9);
    const feedCard = '<div class="card"><div class="card-head"><div class="card-title">Recent activity</div></div>' +
      (feed.length ? '<div class="feed">' + feed.map((e) => '<div class="feed-row">' + avatar(e.who) + '<div style="min-width:0">' + e.html + '</div><span class="when">' + ago(e.t) + '</span></div>').join('') + '</div>' : emptyState('pulse', 'No activity yet', 'Moves, nudges and notes show up here.')) + '</div>';

    return sampleBanner() + hero + kpis +
      '<section class="grid cols-2">' + movesCard + evCard + '</section>' +
      '<section class="grid cols-3">' + thr + stages + health + '</section>' +
      '<section class="grid cols-2">' + dueCard + feedCard + '</section>';
  }

  function activity(n) {
    const out = [];
    const cutoff = Date.now() - 10 * DAY;
    S.tasks.forEach((t) => {
      const j = job(t.jobId);
      if (!j) return;
      t.history.forEach((h, i) => {
        if (i === 0 || h.t < cutoff || h.t > Date.now()) return;
        const verb = h.s === 'done' ? 'finished' : 'moved';
        out.push({ t: h.t, who: t.assignee, html: '<b>' + esc(person(t.assignee) ? person(t.assignee).name.split(' ')[0] : 'Someone') + '</b> ' + verb + ' “' + esc(t.title) + '”' + (h.s === 'done' ? '' : ' to ' + STAGE_LABEL[h.s]) + ' <span class="muted mono">' + esc(j.code) + '</span>' });
      });
    });
    S.log.forEach((l) => { if (l.t >= cutoff) out.push({ t: l.t, who: null, html: esc(l.text) }); });
    return out.sort((a, b) => b.t - a.t).slice(0, n);
  }

  /* ---------- Jobs ---------- */
  function jobsList() {
    const q = UI.jobsQuery.trim().toLowerCase();
    let list = S.jobs.filter((j) => !q || (j.name + ' ' + j.code + ' ' + j.client).toLowerCase().includes(q));
    const f = UI.jobsFilter;
    if (f === 'done') list = list.filter((j) => j.status === 'done');
    else if (f === 'hold') list = list.filter((j) => j.status === 'hold');
    else if (f === 'all') list = list.filter((j) => j.status !== 'done');
    else list = list.filter((j) => j.status === 'active' && M.JS.get(j.id).band === f);
    const by = {
      health: (a, b) => M.JS.get(a.id).health - M.JS.get(b.id).health,
      due: (a, b) => a.due - b.due,
      budget: (a, b) => b.budget - a.budget,
      progress: (a, b) => M.JS.get(b.id).progress - M.JS.get(a.id).progress,
    };
    return list.sort(by[UI.jobsSort] || by.health);
  }
  function jobCard(j) {
    const x = M.JS.get(j.id);
    const burn = j.budget ? j.spent / j.budget : 0;
    return '<button class="job-card" data-action="open-job" data-id="' + j.id + '">' +
      '<div class="job-top"><span class="job-code">' + esc(j.code) + '</span><span class="chip outline">' + esc((D.TEMPLATES[j.type] || { label: 'Custom' }).label) + '</span><span class="grow"></span>' + bandChip(x.band, x.health) + '</div>' +
      '<div><div class="job-name">' + esc(j.name) + '</div><div class="job-client">' + esc(j.client || 'No client') + '</div></div>' +
      '<div class="prog"><div class="prog-head"><span><b>' + pct(x.progress) + '</b> complete</span><span>plan ' + pct(x.plannedPct) + '</span></div>' +
      '<div class="prog-bar" data-tip="' + esc('<b>' + pct(x.progress) + '</b> of hours earned<br>Plan says ' + pct(x.plannedPct) + ' by today') + '"><span class="fill" style="width:' + (x.progress * 100).toFixed(1) + '%"></span><span class="plan" style="left:calc(' + (x.plannedPct * 100).toFixed(1) + '% - 1px)"></span></div></div>' +
      '<div class="job-stats">' +
      '<div class="stat"><div class="k">Due</div><div class="v">' + esc(fmtDate(j.due)) + '</div><div class="s muted">' + esc(j.status === 'done' ? 'closed ' + fmtDate(j.completedAt || j.due) : rel(j.due)) + '</div></div>' +
      '<div class="stat"><div class="k">Forecast</div><div class="v">' + esc(fmtDate(x.forecast)) + '</div><div class="s">' + slipText(x.slip) + '</div></div>' +
      '<div class="stat"><div class="k">Budget</div><div class="v">' + money(j.spent) + ' <span class="muted" style="font-weight:500">/ ' + money(j.budget) + '</span></div><div class="s ' + (x.cpi < 0.93 ? 'txt-crit' : 'muted') + '">' + pct(burn) + ' spent · CPI ' + x.cpi.toFixed(2) + '</div></div>' +
      '</div><div class="job-foot">' + avatar(j.lead) + '<span class="ink2" style="font-size:12.5px">' + esc(person(j.lead) ? person(j.lead).name : 'No lead') + '</span><span class="grow"></span>' +
      (x.blocked ? '<span class="chip crit">' + icon('block') + x.blocked + ' blocked</span>' : '') +
      (x.overdue ? '<span class="chip serious">' + icon('calendar') + x.overdue + ' late</span>' : '') +
      '<span class="chip">' + plural(x.open, 'open task') + '</span></div></button>';
  }
  function jobsGrid() {
    const list = jobsList();
    if (!list.length) {
      return S.jobs.length ? emptyState('search', 'No jobs match', 'Try a different filter or search.', '<button class="btn" data-action="clear-job-filters">Clear filters</button>')
        : emptyState('jobs', 'No jobs yet', 'Create a job from a template and Momentum lays out the tasks for you.', '<button class="btn primary" data-action="new-job">' + icon('plus') + 'New job</button>');
    }
    return '<div class="jobs-grid">' + list.map(jobCard).join('') + '</div>';
  }
  function viewJobs() {
    const cnt = (f) => {
      if (f === 'all') return S.jobs.filter((j) => j.status !== 'done').length;
      if (f === 'done' || f === 'hold') return S.jobs.filter((j) => j.status === f).length;
      return S.jobs.filter((j) => j.status === 'active' && M.JS.get(j.id).band === f).length;
    };
    const filters = [['all', 'Open'], ['crit', 'At risk'], ['warn', 'Watch'], ['good', 'On track'], ['hold', 'On hold'], ['done', 'Done']];
    return sampleBanner() + '<div class="toolbar"><input class="input" id="jobsQ" type="search" placeholder="Search by name, code or client" aria-label="Search jobs" value="' + esc(UI.jobsQuery) + '">' +
      '<div class="seg" role="group" aria-label="Filter jobs">' + filters.map(([k, l]) => '<button data-action="jobs-filter" data-v="' + k + '" aria-pressed="' + (UI.jobsFilter === k) + '">' + l + '<span class="n">' + cnt(k) + '</span></button>').join('') + '</div>' +
      '<span class="grow"></span><label class="check" for="jobsSort">Sort</label><select class="select sm" id="jobsSort">' +
      [['health', 'Health (worst first)'], ['due', 'Due date'], ['budget', 'Budget'], ['progress', 'Progress']].map(([k, l]) => '<option value="' + k + '"' + (UI.jobsSort === k ? ' selected' : '') + '>' + l + '</option>').join('') +
      '</select></div><div id="jobsGrid">' + jobsGrid() + '</div>';
  }

  /* ---------- Board ---------- */
  function viewBoard() {
    const activeJobs = S.jobs.filter((j) => j.status === 'active');
    let list = S.tasks.filter((t) => activeJobs.some((j) => j.id === t.jobId));
    if (UI.boardJob) list = list.filter((t) => t.jobId === UI.boardJob);
    if (UI.boardPerson) list = list.filter((t) => t.assignee === UI.boardPerson);
    if (UI.boardBlocked) list = list.filter((t) => t.blocked);
    const cols = STAGES.map((s) => {
      let items = list.filter((t) => t.status === s);
      if (s === 'done') items = items.filter((t) => t.completedAt >= Date.now() - 14 * DAY).sort((a, b) => b.completedAt - a.completedAt);
      else items.sort((a, b) => (b.blocked ? 1 : 0) - (a.blocked ? 1 : 0) || a.due - b.due);
      const f = M.flow[s];
      const allCount = f ? f.count : items.length;
      const limit = f ? f.limit : 0;
      const over = limit && allCount > limit;
      const near = limit && !over && allCount >= limit - 1;
      let note = '';
      if (f) {
        if (over) note = '<div class="col-note txt-serious">' + icon('alert') + 'Over limit: finish before starting more</div>';
        else if (f.daysToLimit && f.daysToLimit <= 10) note = '<div class="col-note txt-warn">' + icon('trend') + 'Hits limit in ~' + plural(f.daysToLimit, 'day') + '</div>';
        else if (near) note = '<div class="col-note txt-warn">' + icon('info') + 'Nearly full</div>';
      }
      const head = '<div class="col-head"><div class="col-title">' + STAGE_LABEL[s] + '<span class="grow"></span><span class="col-count' + (over ? ' over' : '') + '">' + (limit ? allCount + '/' + limit : items.length + (s === 'done' ? ' · 14d' : '')) + '</span></div>' +
        (limit ? '<div class="wip-bar"><span class="' + (over ? 'over' : near ? 'near' : '') + '" style="width:' + Math.min(100, (allCount / limit) * 100).toFixed(1) + '%"></span></div>' : '') + note + '</div>';
      const cap = s === 'backlog' && !UI.backlogAll ? 10 : Infinity;
      const more = items.length > cap ? '<button class="btn sm ghost" data-action="backlog-all">Show ' + (items.length - cap) + ' more</button>' : '';
      const body = items.length ? items.slice(0, cap).map(taskCard).join('') + more : '<div class="col-empty">' + (s === 'done' ? 'Finished work lands here' : 'Drop tasks here') + '</div>';
      return '<section class="col' + (over ? ' over' : '') + '" data-stage="' + s + '" aria-label="' + STAGE_LABEL[s] + '">' + head + '<div class="col-body">' + body + '</div></section>';
    }).join('');
    return '<div class="toolbar"><select class="select sm" id="boardJob" aria-label="Filter by job"><option value="">All jobs</option>' +
      activeJobs.map((j) => '<option value="' + j.id + '"' + (UI.boardJob === j.id ? ' selected' : '') + '>' + esc(j.code + ' · ' + j.name) + '</option>').join('') + '</select>' +
      '<select class="select sm" id="boardPerson" aria-label="Filter by person"><option value="">Everyone</option>' +
      S.people.map((p) => '<option value="' + p.id + '"' + (UI.boardPerson === p.id ? ' selected' : '') + '>' + esc(p.name) + '</option>').join('') + '</select>' +
      '<label class="check"><input type="checkbox" id="boardBlocked"' + (UI.boardBlocked ? ' checked' : '') + '>Blocked only</label><span class="grow"></span>' +
      '<span class="muted hide-sm" style="font-size:12px">Dots show days in stage</span><button class="btn sm" data-action="wip">' + icon('layers') + 'WIP limits</button>' +
      '<button class="btn sm primary" data-action="new-task">' + icon('plus') + 'Task</button></div>' +
      '<div class="board-wrap"><div class="board">' + cols + '</div></div>';
  }
  function taskCard(t) {
    const j = job(t.jobId);
    const ts = M.TS.get(t.id);
    const dots = Math.min(4, Math.floor(ts.age / 2) + (ts.age >= 1 ? 1 : 0));
    const late = ts.overdue;
    return '<button class="tcard' + (t.blocked ? ' blocked' : '') + '" draggable="true" data-id="' + t.id + '" data-action="open-task">' +
      '<div class="tcard-top"><span class="jtag">' + esc(j.code) + '</span><span class="muted" style="font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(t.phase || '') + '</span><span class="grow"></span>' + avatar(t.assignee) + '</div>' +
      '<div class="tcard-title">' + esc(t.title) + '</div>' +
      (t.blocked ? '<div class="blk">' + icon('block') + '<span>Waiting on ' + esc(BLOCK_LABEL[t.blocked.type] || 'something') + ' · ' + plural(Math.max(0, dd(TODAY, t.blocked.since)), 'day') + '</span></div>' : '') +
      '<div class="tcard-meta"><span class="' + (late ? 'txt-crit' : '') + '">' + icon('calendar').replace('<svg', '<svg width="12" height="12" style="vertical-align:-1px"') + ' ' + esc(t.status === 'done' ? 'done ' + fmtDate(t.completedAt) : fmtDate(t.due)) + '</span><span>' + t.est + 'h</span><span class="grow"></span>' +
      (t.status !== 'done' && t.status !== 'backlog' ? '<span class="age a' + dots + (ts.aging ? ' hot' : '') + '" data-tip="' + esc(plural(Math.round(ts.age * 10) / 10, 'day') + ' in ' + STAGE_LABEL[t.status] + (ts.aging ? ' · longer than usual' : '')) + '"><i></i><i></i><i></i><i></i></span>' : '') +
      '</div></button>';
  }

  /* ---------- Timeline ---------- */
  function viewTimeline() {
    const list = S.jobs.filter((j) => j.status === 'active' || j.status === 'hold' || (UI.tlDone && j.status === 'done')).sort((a, b) => a.start - b.start);
    const toolbar = '<div class="toolbar"><label class="check"><input type="checkbox" id="tlDone"' + (UI.tlDone ? ' checked' : '') + '>Show completed jobs</label><span class="grow"></span>' +
      '<div class="legend"><span><i class="box"></i>Earned</span><span><i class="box" style="background:var(--surface-3);border:1px solid var(--line-2)"></i>Remaining plan</span><span><i class="box" style="background:var(--crit-soft);border:1px dashed var(--crit)"></i>Forecast slip</span></div></div>';
    if (!list.length) return toolbar + '<div class="card">' + emptyState('timeline', 'No jobs on the timeline', 'Active jobs appear here with their plan and forecast finish.', '<button class="btn primary" data-action="new-job">' + icon('plus') + 'New job</button>') + '</div>';
    let t0 = Math.min(TODAY, ...list.map((j) => j.start)) - 4 * DAY;
    let t1 = Math.max(TODAY, ...list.map((j) => Math.max(j.due, M.JS.get(j.id).forecast))) + 6 * DAY;
    const span = t1 - t0;
    const P = (t) => (((t - t0) / span) * 100).toFixed(2) + '%';
    const step = span / DAY > 110 ? 14 : 7;
    const ticks = [];
    let tk = D.sod(t0);
    while (new Date(tk).getDay() !== 1) tk = D.addDays(tk, 1);
    for (; tk < t1; tk = D.addDays(tk, step)) ticks.push(tk);
    const grid = ticks.map((t) => '<span class="tl-gridline" style="left:' + P(t) + '"></span>').join('');
    const head = '<div class="tl-head"><div class="eyebrow" style="align-self:center">Job</div><div class="tl-axis">' + ticks.map((t) => '<span style="left:' + P(t) + '">' + esc(fmtDate(t)) + '</span>').join('') + '</div></div>';
    const rows = list.map((j) => {
      const x = M.JS.get(j.id);
      const left = P(j.start);
      const width = (((j.due - j.start) / span) * 100).toFixed(2) + '%';
      const tip = '<b>' + esc(j.name) + '</b><br>' + esc(fmtDate(j.start)) + ' → ' + esc(fmtDate(j.due)) + '<br>' + pct(x.progress) + ' complete · plan ' + pct(x.plannedPct) + '<br>Forecast ' + esc(fmtDate(x.forecast)) + (x.slip > 0 ? ' (' + x.slip + 'd late)' : x.slip < 0 ? ' (' + -x.slip + 'd early)' : '');
      let extra = '';
      if (x.slip > 0) {
        extra = '<span class="tl-slip" style="left:' + P(j.due) + ';width:' + (((x.forecast - j.due) / span) * 100).toFixed(2) + '%"></span>' +
          '<span class="tl-flag txt-crit" style="left:' + P(x.forecast) + ';transform:translateX(-100%)">+' + x.slip + 'd</span>';
      } else if (x.slip < 0 && j.status !== 'done') {
        extra = '<span class="tl-early" style="left:' + P(x.forecast) + '" data-tip="' + esc('Forecast ' + fmtDate(x.forecast)) + '"></span>';
      }
      return '<div class="tl-row"><button class="tl-label" data-action="open-job" data-id="' + j.id + '"><div class="hname">' + esc(j.name) + '</div><div class="hsub">' + esc(j.code) + ' · ' + (j.status === 'hold' ? 'on hold' : j.status === 'done' ? 'complete' : 'health ' + x.health) + '</div></button>' +
        '<div class="tl-track">' + grid + '<span class="tl-bar' + (j.status === 'done' ? ' done' : '') + '" data-action="open-job" data-id="' + j.id + '" style="left:' + left + ';width:' + width + '" data-tip="' + esc(tip) + '"><span class="fill" style="width:' + (x.progress * 100).toFixed(1) + '%"></span><span class="txt">' + pct(x.progress) + '</span></span>' + extra + '</div></div>';
    }).join('');
    const today = '<div style="position:absolute;left:220px;right:0;top:34px;bottom:0;pointer-events:none"><span class="tl-today" style="left:' + P(TODAY) + '"></span></div>';
    return toolbar + '<div class="card"><div class="tl-wrap"><div class="tl">' + head + rows + today + '</div></div></div>';
  }

  /* ---------- Radar ---------- */
  function viewRadar() {
    const f = M.flow;
    const flowCards = '<section class="flow">' + FLOW_STAGES.map((s) => {
      const x = f[s];
      const over = x.count > x.limit;
      let fc;
      if (over) fc = '<div class="forecast-line txt-serious">' + icon('alert') + 'Over limit now. ' + (x.oldest ? 'Oldest: “' + esc(x.oldest.title) + '”, ' + plural(Math.round(M.TS.get(x.oldest.id).age), 'day') + '.' : '') + '</div>';
      else if (x.daysToLimit) fc = '<div class="forecast-line ' + (x.daysToLimit <= 10 ? 'txt-warn' : 'ink2') + '">' + icon('trend') + 'At this rate it fills in ~' + plural(x.daysToLimit, 'day') + '.</div>';
      else fc = '<div class="forecast-line txt-good">' + icon('check') + (x.net < 0 ? 'Draining: more leaving than arriving.' : 'Steady: arrivals match departures.') + '</div>';
      return '<div class="card flow-card"><div class="card-head" style="margin:0"><div class="card-title">' + STAGE_LABEL[s] + '</div><span class="grow"></span>' + (s === M.bottleneck && x.count ? '<span class="chip serious">' + icon('alert') + 'Bottleneck</span>' : '') + '</div>' +
        '<div class="big num">' + x.count + '<small> / ' + x.limit + ' limit</small></div>' +
        '<div class="wip-bar"><span class="' + (over ? 'over' : x.count >= x.limit - 1 ? 'near' : '') + '" style="width:' + Math.min(100, (x.count / Math.max(1, x.limit)) * 100).toFixed(1) + '%"></span></div>' +
        '<div class="flow-io"><div><span class="muted">In, 14d</span><b class="num">' + x.arrivals + '</b></div><div><span class="muted">Out, 14d</span><b class="num">' + x.departures + '</b></div><div><span class="muted">Avg wait</span><b class="num">' + x.avgWait.toFixed(1) + 'd</b></div></div>' + fc + '</div>';
    }).join('') + '</section>';

    const groups = [['all', 'All'], ['schedule', 'Schedule'], ['cost', 'Cost'], ['blocked', 'Blocked'], ['flow', 'Flow'], ['people', 'People']];
    const list = M.warnings.filter((w) => UI.radarType === 'all' || w.group === UI.radarType);
    const counts = (g) => (g === 'all' ? M.warnings.length : M.warnings.filter((w) => w.group === g).length);
    const snoozedN = Object.values(S.snoozed).filter((v) => v > Date.now()).length;
    const warnCard = '<div class="card"><div class="card-head"><div class="card-title">Early warnings</div><span class="grow"></span>' +
      (snoozedN ? '<button class="btn sm ghost" data-action="unsnooze">' + plural(snoozedN, 'snoozed warning') + ' · show</button>' : '') + '</div>' +
      '<div class="toolbar" style="margin-bottom:12px"><div class="seg" role="group" aria-label="Warning type">' + groups.map(([k, l]) => '<button data-action="radar-filter" data-v="' + k + '" aria-pressed="' + (UI.radarType === k) + '">' + l + '<span class="n">' + counts(k) + '</span></button>').join('') + '</div></div>' +
      (list.length ? '<div class="alerts">' + list.map((w) => alertRow(w)).join('') + '</div>' : emptyState('radar', 'All clear', 'No warnings of this type. Momentum checks again every time something changes.')) + '</div>';

    const how = '<div class="card"><div class="card-head"><div class="card-title">What the radar watches</div></div><div class="keys" style="grid-template-columns:auto 1fr;font-size:13px">' +
      [['clock', 'Slip forecast', 'Earned schedule: compares where the work is against where the plan said it would be, projects the finish at that speed, and flags anything landing 3+ days late.'],
        ['money', 'Cost efficiency', 'CPI below 0.93 means spend is outrunning progress. Shows the estimate at completion.'],
        ['block', 'Blockers', 'Anything waiting on clients, permits, materials or inspections, ranked by age and by how much work queues behind it.'],
        ['layers', 'Queue growth', 'Compares arrivals and departures per stage to predict when a queue will hit its WIP limit, before it does.'],
        ['clock', 'Aging work', 'Tasks sitting in a stage much longer than your team’s typical time.'],
        ['user', 'Overload', 'People booked past 110% of capacity in the next 2 weeks, with a suggested reassignment.']]
        .map(([i, k, v]) => '<span class="chip brand">' + icon(i) + k + '</span><span class="ink2">' + v + '</span>').join('') + '</div></div>';

    return flowCards + warnCard + how;
  }

  /* ---------- Team ---------- */
  function viewTeam() {
    const over = M.warnings.filter((w) => w.type === 'overload');
    const cards = S.people.map((p) => {
      const x = M.PS.get(p.id);
      const u = x.util;
      const cls = u > 1.1 ? 'crit' : u > 0.9 ? 'warn' : '';
      const status = u > 1.1 ? '<span class="chip crit">' + icon('alert') + 'Overloaded</span>' : u > 0.9 ? '<span class="chip warn">' + icon('info') + 'Busy</span>' : '<span class="chip good">' + icon('check') + 'Has room</span>';
      const scale = Math.max(1.25, u);
      const tasks = x.open.slice().sort((a, b) => a.due - b.due).slice(0, 4);
      return '<div class="card person"><div class="person-top">' + avatar(p.id, 'lg') + '<div class="grow"><div class="person-name">' + esc(p.name) + '</div><div class="person-role">' + esc(p.role || '') + '</div></div>' + status + '</div>' +
        '<div class="load"><div class="prog-head"><span><b class="num">' + Math.round(x.load) + 'h</b> due in 14 days</span><span class="num">' + pct(u) + ' of ' + x.cap + 'h</span></div>' +
        '<div class="load-bar" data-tip="' + esc('<b>' + Math.round(x.load) + 'h</b> booked<br>' + x.cap + 'h capacity (' + p.capacity + 'h/week)') + '"><span class="' + cls + '" style="width:' + Math.min(100, (u / scale) * 100).toFixed(1) + '%"></span><span class="cap" style="left:' + ((1 / scale) * 100).toFixed(1) + '%"></span></div></div>' +
        '<div class="person-stats"><div class="stat"><div class="k">In flight</div><div class="v num">' + x.wip + '</div></div><div class="stat"><div class="k">Done 30d</div><div class="v num">' + x.done30 + '</div></div><div class="stat"><div class="k">On time</div><div class="v num">' + (x.ontime == null ? '—' : pct(x.ontime)) + '</div></div></div>' +
        (tasks.length ? '<div class="mini-list">' + tasks.map((t) => '<button class="mini-task" data-action="open-task" data-id="' + t.id + '"><span class="status-pill ' + t.status + '">' + STAGE_LABEL[t.status] + '</span><span class="t">' + esc(t.title) + '</span><span class="' + (M.TS.get(t.id).overdue ? 'txt-crit' : 'muted') + '" style="font-size:12px">' + esc(fmtDate(t.due)) + '</span></button>').join('') + '</div>' : '<p class="muted" style="font-size:13px">No open work on active jobs.</p>') +
        '<div style="display:flex;gap:6px"><button class="btn sm ghost" data-action="edit-person" data-id="' + p.id + '">' + icon('edit') + 'Edit</button><button class="btn sm ghost" data-action="board-person" data-id="' + p.id + '">' + icon('board') + 'Their board</button></div></div>';
    }).join('');
    return (over.length ? '<div class="card"><div class="card-head"><div class="card-title">Rebalance suggestions</div><div class="card-sub">Move work before it becomes a bottleneck</div></div><div class="alerts">' + over.map((w) => alertRow(w)).join('') + '</div></div>' : '') +
      '<div class="toolbar"><span class="grow"></span><button class="btn" data-action="add-person">' + icon('plus') + 'Add teammate</button></div>' +
      (S.people.length ? '<div class="team-grid">' + cards + '</div>' : '<div class="card">' + emptyState('team', 'No teammates yet', 'Add people to assign work and see who has room.', '<button class="btn primary" data-action="add-person">Add teammate</button>') + '</div>');
  }

  /* ---------- Drawer: job detail ---------- */
  function openJob(id) {
    UI.drawerJob = id;
    renderDrawer(true);
  }
  function closeDrawer() {
    UI.drawerJob = null;
    $('#drawerRoot').innerHTML = '';
  }
  function renderDrawer(fresh) {
    const j = job(UI.drawerJob);
    if (!j) { closeDrawer(); return; }
    const x = M.JS.get(j.id);
    const root = $('#drawerRoot');
    const prevScroll = $('.drawer-body', root) ? $('.drawer-body', root).scrollTop : 0;
    const warns = M.warnings.filter((w) => w.jobId === j.id);
    const phases = [];
    x.tasks.forEach((t) => { let p = phases.find((q) => q.name === (t.phase || 'Tasks')); if (!p) { p = { name: t.phase || 'Tasks', tasks: [] }; phases.push(p); } p.tasks.push(t); });
    const dk = (k, v, s, tip) => '<div class="dkpi"' + (tip ? ' data-tip="' + esc(tip) + '"' : '') + '><div class="k">' + k + '</div><div class="v num">' + v + '</div><div class="s">' + s + '</div></div>';
    const status = j.status;
    root.innerHTML = '<div class="scrim" data-action="close-drawer"></div><aside class="drawer" role="dialog" aria-modal="true" aria-label="' + esc(j.name) + '">' +
      '<div class="drawer-head"><div class="row"><span class="job-code">' + esc(j.code) + '</span>' + bandChip(x.band, x.health) + '<span class="chip outline">' + esc((D.TEMPLATES[j.type] || { label: 'Custom' }).label) + '</span><span class="grow"></span>' +
      '<button class="btn sm" data-action="edit-job" data-id="' + j.id + '">' + icon('edit') + 'Edit</button><button class="btn sm icon ghost" data-action="close-drawer" aria-label="Close">' + icon('x') + '</button></div>' +
      '<div class="drawer-title">' + esc(j.name) + '</div><div class="row ink2" style="font-size:13px">' + avatar(j.lead) + esc(person(j.lead) ? person(j.lead).name : 'No lead') + ' · ' + esc(j.client || 'No client') + ' · ' + esc(fmtDate(j.start)) + ' → ' + esc(fmtDate(j.due, { year: 'numeric' })) + '</div></div>' +
      '<div class="drawer-body">' +
      '<div class="dkpis">' +
      dk('Progress', pct(x.progress), 'plan ' + pct(x.plannedPct), 'Hours earned ÷ total estimated hours') +
      dk('SPI', x.spi.toFixed(2), x.spi >= 0.95 ? '<span class="txt-good">on pace</span>' : '<span class="txt-crit">behind plan</span>', 'Earned hours ÷ planned hours to date') +
      dk('CPI', x.cpi.toFixed(2), x.cpi >= 0.95 ? '<span class="txt-good">on budget</span>' : '<span class="txt-crit">cost overrun</span>', 'Earned value ÷ actual cost') +
      dk('Forecast', esc(fmtDate(x.forecast)), slipText(x.slip), 'Earned-schedule forecast: work is moving at ' + x.spiT.toFixed(2) + '\u00d7 the planned rate') +
      dk('Spent', money(j.spent), 'of ' + money(j.budget) + ' · EAC ' + money(x.eac), 'Estimate at completion = budget ÷ CPI') + '</div>' +
      (warns.length ? '<div class="alerts">' + warns.map((w) => alertRow(w, false, true)).join('') + '</div>' : '') +
      '<div class="card"><div class="card-head"><div class="card-title">Tasks</div><div class="card-sub grow">' + plural(x.open, 'open') + ' · ' + Math.round(x.remainingH) + 'h remaining</div><button class="btn sm primary" data-action="new-task" data-job="' + j.id + '">' + icon('plus') + 'Task</button></div>' +
      (phases.length ? phases.map((p) => {
        const tot = sum(p.tasks, (t) => t.est);
        const dn = sum(p.tasks.filter((t) => t.status === 'done'), (t) => t.est);
        return '<div class="phase"><div class="phase-head"><span class="phase-name">' + esc(p.name) + '</span><span class="grow"></span><span class="phase-pct">' + pct(tot ? dn / tot : 0) + '</span><span class="mini-prog"><span style="width:' + (tot ? (dn / tot) * 100 : 0).toFixed(1) + '%"></span></span></div>' +
          p.tasks.map((t) => {
            const ts = M.TS.get(t.id);
            return '<div class="trow' + (t.status === 'done' ? ' is-done' : '') + '">' + tickBox(t) + '<span class="tt" data-action="open-task" data-id="' + t.id + '" role="button" tabindex="0">' + esc(t.title) + (t.blocked ? ' <span class="chip crit" style="height:20px">' + icon('block') + esc(BLOCK_LABEL[t.blocked.type] || 'blocked') + '</span>' : '') + '</span>' +
              '<span class="status-pill ' + t.status + ' hide-xs">' + STAGE_LABEL[t.status] + '</span><span class="due hide-xs ' + (ts.overdue ? 'txt-crit' : 'muted') + '">' + esc(fmtDate(t.due)) + '</span>' + avatar(t.assignee) + '</div>';
          }).join('') + '</div>';
      }).join('') : emptyState('board', 'No tasks yet', 'Add the first task to start tracking progress.')) + '</div>' +
      '<div class="grid cols-2"><div class="card"><div class="card-head"><div class="card-title">Log a cost</div><div class="card-sub">Invoices, materials, labor</div></div>' +
      '<form class="inline-form" data-form="cost"><input class="input" id="costAmt" type="number" min="0" step="1" placeholder="Amount ($)" aria-label="Cost amount" required><input class="input" id="costNote" placeholder="What for?" aria-label="Cost note"><button class="btn primary" type="submit">Add</button></form>' +
      '<p class="card-sub" style="margin-top:8px">' + money(j.spent, true) + ' spent of ' + money(j.budget, true) + '</p></div>' +
      '<div class="card"><div class="card-head"><div class="card-title">Status</div></div><div class="seg" role="group" aria-label="Job status">' +
      [['active', 'Active'], ['hold', 'On hold'], ['done', 'Complete']].map(([k, l]) => '<button data-action="job-status" data-v="' + k + '" aria-pressed="' + (status === k) + '">' + l + '</button>').join('') + '</div>' +
      '<p class="card-sub" style="margin-top:10px">On-hold jobs leave the KPIs and warnings until you reactivate them.</p></div></div>' +
      '<div class="card"><div class="card-head"><div class="card-title">Job log</div></div><form class="inline-form" data-form="note" style="margin-bottom:12px"><input class="input" id="noteText" placeholder="Add a note: site visit, call, decision…" aria-label="Note" required><button class="btn" type="submit">Add note</button></form>' +
      '<div class="log">' + (j.log.length ? j.log.slice().sort((a, b) => b.t - a.t).map((l) => '<div class="log-row"><span class="when">' + esc(fmtDate(l.t)) + '</span><span>' + esc(l.text) + '</span></div>').join('') : '<p class="muted" style="font-size:13px">No notes yet.</p>') + '</div></div>' +
      '<div style="display:flex;justify-content:flex-end"><button class="btn sm danger" data-action="delete-job" data-id="' + j.id + '">' + icon('trash') + 'Delete job</button></div>' +
      '</div></aside>';
    const body = $('.drawer-body', root);
    if (!fresh && body) body.scrollTop = prevScroll;
    if (fresh) { const c = $('[data-action="close-drawer"].btn', root); if (c) c.focus(); }
  }

  /* ---------- Modals ---------- */
  function openModal(html, cls) {
    $('#modalRoot').innerHTML = '<div class="scrim" data-action="close-modal"></div><div class="modal-wrap" data-action="close-modal-bg"><div class="modal ' + (cls || '') + '" role="dialog" aria-modal="true">' + html + '</div></div>';
    const first = $('#modalRoot input:not([type=hidden]), #modalRoot select, #modalRoot textarea');
    if (first) first.focus();
  }
  function closeModal() { $('#modalRoot').innerHTML = ''; }
  const modalOpen = () => !!$('#modalRoot .modal');
  const opt = (v, l, sel) => '<option value="' + esc(v) + '"' + (sel ? ' selected' : '') + '>' + esc(l) + '</option>';

  function taskModal(id, jobId) {
    const t = id ? task(id) : null;
    const jid = t ? t.jobId : jobId || UI.drawerJob || UI.boardJob || (S.jobs.find((j) => j.status === 'active') || {}).id;
    const activeJobs = S.jobs.filter((j) => j.status !== 'done' || (t && j.id === t.jobId));
    if (!activeJobs.length) { toast('Create a job first, then add tasks to it.'); return; }
    const jx = job(jid);
    const phases = [...new Set(S.tasks.filter((x) => x.jobId === jid).map((x) => x.phase).filter(Boolean))];
    const b = t && t.blocked;
    const deps = t ? (t.deps || []).map(task).filter(Boolean) : [];
    openModal('<form data-form="task" data-id="' + (t ? t.id : '') + '" novalidate><div class="modal-head"><h2>' + (t ? 'Edit task' : 'New task') + '</h2><button type="button" class="btn sm icon ghost" data-action="close-modal" aria-label="Close">' + icon('x') + '</button></div>' +
      '<div class="modal-body"><div class="field"><label for="fTitle">Task</label><input class="input" id="fTitle" value="' + esc(t ? t.title : '') + '" placeholder="e.g. Rough electrical" required><span class="err" id="eTitle" hidden>Give the task a name.</span></div>' +
      '<div class="form-grid"><div class="field"><label for="fJob">Job</label><select class="select" id="fJob"' + (t ? ' disabled' : '') + '>' + activeJobs.map((j) => opt(j.id, j.code + ' · ' + j.name, j.id === jid)).join('') + '</select></div>' +
      '<div class="field"><label for="fPhase">Phase</label><input class="input" id="fPhase" list="phaseList" value="' + esc(t ? t.phase : (phases[phases.length - 1] || '')) + '" placeholder="e.g. Build-out"><datalist id="phaseList">' + phases.map((p) => '<option value="' + esc(p) + '">').join('') + '</datalist></div>' +
      '<div class="field"><label for="fAssignee">Owner</label><select class="select" id="fAssignee">' + opt('', 'Unassigned', !(t && t.assignee)) + S.people.map((p) => opt(p.id, p.name + ' · ' + Math.round(M.PS.get(p.id).util * 100) + '% booked', t ? t.assignee === p.id : jx && jx.lead === p.id)).join('') + '</select></div>' +
      '<div class="field"><label for="fStatus">Stage</label><select class="select" id="fStatus">' + STAGES.map((s) => opt(s, STAGE_LABEL[s], t ? t.status === s : s === 'ready')).join('') + '</select></div>' +
      '<div class="field"><label for="fEst">Estimated hours</label><input class="input" id="fEst" type="number" min="0.5" step="0.5" value="' + (t ? t.est : 4) + '"><span class="err" id="eEst" hidden>Enter hours greater than 0.</span></div>' +
      '<div class="field"><label for="fDue">Due date</label><input class="input" id="fDue" type="date" value="' + toISO(t ? t.due : D.addDays(TODAY, 7)) + '"><span class="err" id="eDue" hidden>Pick a due date.</span></div>' +
      '<div class="field span2"><label class="check"><input type="checkbox" id="fBlocked"' + (b ? ' checked' : '') + '>Blocked: waiting on someone outside the crew</label></div>' +
      '<div class="field" data-blk' + (b ? '' : ' hidden') + '><label for="fBType">Waiting on</label><select class="select" id="fBType">' + Object.keys(BLOCK_LABEL).map((k) => opt(k, BLOCK_LABEL[k][0].toUpperCase() + BLOCK_LABEL[k].slice(1), b ? b.type === k : k === 'client')).join('') + '</select></div>' +
      '<div class="field" data-blk' + (b ? '' : ' hidden') + '><label for="fBNote">Details</label><input class="input" id="fBNote" value="' + esc(b ? b.note : '') + '" placeholder="e.g. Permit in second review"></div>' +
      (deps.length ? '<div class="field span2"><span class="label">Waits on</span><div style="display:flex;gap:6px;flex-wrap:wrap">' + deps.map((d) => '<span class="chip ' + (d.status === 'done' ? 'good' : '') + '">' + icon(d.status === 'done' ? 'check' : 'clock') + esc(d.title) + '</span>').join('') + '</div></div>' : '') +
      '</div></div><div class="modal-foot">' + (t ? '<button type="button" class="btn danger" data-action="delete-task" data-id="' + t.id + '">' + icon('trash') + 'Delete</button>' : '') + '<span class="grow"></span><button type="button" class="btn" data-action="close-modal">Cancel</button><button type="submit" class="btn primary">' + (t ? 'Save task' : 'Add task') + '</button></div></form>', 'wide');
  }

  function nextCode() {
    const nums = S.jobs.map((j) => parseInt(String(j.code).replace(/\D/g, ''), 10)).filter((n) => !isNaN(n));
    return 'J-' + (nums.length ? Math.max(...nums) + 1 : 1001);
  }
  function jobModal(id) {
    const j = id ? job(id) : null;
    openModal('<form data-form="job" data-id="' + (j ? j.id : '') + '" novalidate><div class="modal-head"><h2>' + (j ? 'Edit job' : 'New job') + '</h2><button type="button" class="btn sm icon ghost" data-action="close-modal" aria-label="Close">' + icon('x') + '</button></div>' +
      '<div class="modal-body"><div class="form-grid"><div class="field span2"><label for="jName">Job name</label><input class="input" id="jName" value="' + esc(j ? j.name : '') + '" placeholder="e.g. 14 Birch Ln Kitchen" required><span class="err" id="eName" hidden>Give the job a name.</span></div>' +
      '<div class="field"><label for="jClient">Client</label><input class="input" id="jClient" value="' + esc(j ? j.client : '') + '" placeholder="Client or owner"></div>' +
      '<div class="field"><label for="jCode">Job number</label><input class="input mono" id="jCode" value="' + esc(j ? j.code : nextCode()) + '"></div>' +
      (j ? '' : '<div class="field span2"><label for="jType">Template</label><select class="select" id="jType">' + Object.keys(D.TEMPLATES).map((k) => {
        const tp = D.TEMPLATES[k];
        const n = sum(tp.phases, (p) => p[1].length);
        return opt(k, tp.label + ' · ' + tp.phases.length + ' phases, ' + n + ' tasks', k === 'remodel');
      }).join('') + opt('blank', 'Blank · add tasks yourself', false) + '</select><span class="card-sub">Tasks are spread across the dates below and assigned by role. You can change everything after.</span></div>') +
      '<div class="field"><label for="jLead">Lead</label><select class="select" id="jLead">' + opt('', 'No lead', !(j && j.lead)) + S.people.map((p) => opt(p.id, p.name, j ? j.lead === p.id : false)).join('') + '</select></div>' +
      '<div class="field"><label for="jPriority">Priority</label><select class="select" id="jPriority">' + [['high', 'High'], ['med', 'Medium'], ['low', 'Low']].map(([k, l]) => opt(k, l, (j ? j.priority : 'med') === k)).join('') + '</select></div>' +
      '<div class="field"><label for="jStart">Start</label><input class="input" id="jStart" type="date" value="' + toISO(j ? j.start : TODAY) + '"></div>' +
      '<div class="field"><label for="jDue">Due</label><input class="input" id="jDue" type="date" value="' + toISO(j ? j.due : D.addDays(TODAY, 45)) + '"><span class="err" id="eDue" hidden>Due date must be after the start.</span></div>' +
      '<div class="field"><label for="jBudget">Budget ($)</label><input class="input" id="jBudget" type="number" min="0" step="100" value="' + (j ? j.budget : 50000) + '"><span class="err" id="eBudget" hidden>Enter a budget of 0 or more.</span></div>' +
      (j ? '<div class="field"><label for="jSpent">Spent to date ($)</label><input class="input" id="jSpent" type="number" min="0" step="100" value="' + j.spent + '"></div>' : '') +
      '</div></div><div class="modal-foot"><span class="grow"></span><button type="button" class="btn" data-action="close-modal">Cancel</button><button type="submit" class="btn primary">' + (j ? 'Save job' : 'Create job') + '</button></div></form>');
  }

  function wipModal() {
    openModal('<form data-form="wip"><div class="modal-head"><h2>WIP limits</h2><button type="button" class="btn sm icon ghost" data-action="close-modal" aria-label="Close">' + icon('x') + '</button></div>' +
      '<div class="modal-body"><p class="ink2">Cap how many tasks can sit in each stage across all jobs. When a stage fills up, finish work before starting more. Momentum warns you before a stage hits its limit.</p><div class="form-grid">' +
      FLOW_STAGES.map((s) => '<div class="field"><label for="wip_' + s + '">' + STAGE_LABEL[s] + ' <span class="muted">(' + M.flow[s].count + ' now)</span></label><input class="input" id="wip_' + s + '" type="number" min="1" step="1" value="' + S.wip[s] + '"></div>').join('') +
      '</div></div><div class="modal-foot"><span class="grow"></span><button type="button" class="btn" data-action="close-modal">Cancel</button><button type="submit" class="btn primary">Save limits</button></div></form>');
  }

  function personModal(id) {
    const p = id ? person(id) : null;
    openModal('<form data-form="person" data-id="' + (p ? p.id : '') + '" novalidate><div class="modal-head"><h2>' + (p ? 'Edit teammate' : 'Add teammate') + '</h2><button type="button" class="btn sm icon ghost" data-action="close-modal" aria-label="Close">' + icon('x') + '</button></div>' +
      '<div class="modal-body"><div class="form-grid"><div class="field span2"><label for="pName">Name</label><input class="input" id="pName" value="' + esc(p ? p.name : '') + '" required><span class="err" id="ePName" hidden>Enter a name.</span></div>' +
      '<div class="field"><label for="pRole">Role</label><input class="input" id="pRole" value="' + esc(p ? p.role : '') + '" placeholder="e.g. Carpenter"></div>' +
      '<div class="field"><label for="pSkill">Takes template tasks for</label><select class="select" id="pSkill">' + opt('', 'None', !(p && p.roles && p.roles.length)) + Object.keys(D.ROLES).map((k) => opt(k, D.ROLES[k], p && (p.roles || []).map((r) => r.replace(/\d+$/, '')).includes(k))).join('') + '</select></div>' +
      '<div class="field"><label for="pCap">Hours per week</label><input class="input" id="pCap" type="number" min="0" step="1" value="' + (p ? p.capacity : 40) + '"></div>' +
      '<div class="field"><label for="pColor">Color</label><input class="input" id="pColor" type="color" value="' + esc(p ? p.color : '#2a6fc4') + '" style="padding:4px"></div>' +
      '</div></div><div class="modal-foot">' + (p ? '<button type="button" class="btn danger" data-action="delete-person" data-id="' + p.id + '">' + icon('trash') + 'Remove</button>' : '') + '<span class="grow"></span><button type="button" class="btn" data-action="close-modal">Cancel</button><button type="submit" class="btn primary">' + (p ? 'Save' : 'Add teammate') + '</button></div></form>');
  }

  function helpModal() {
    const keys = [['⌘K or /', 'Search jobs, tasks and actions'], ['1 – 6', 'Switch views'], ['N', 'New task'], ['J', 'New job'], ['T', 'Switch theme'], ['Esc', 'Close panel'], ['?', 'This help']];
    openModal('<div class="modal-head"><h2>Shortcuts & data</h2><button type="button" class="btn sm icon ghost" data-action="close-modal" aria-label="Close">' + icon('x') + '</button></div>' +
      '<div class="modal-body"><div class="keys">' + keys.map(([k, v]) => '<kbd>' + k + '</kbd><span>' + v + '</span>').join('') + '</div>' +
      '<div><div class="eyebrow" style="margin-bottom:8px">How you earn XP</div><p class="ink2" style="font-size:13px">Finish a task +10 · Clear a blocker +15 · Rebalance work +10 · Nudge +5 · Create a job +20. Do one of these each day to keep your streak. Levels go Pup → Runner → Crew Lead → Foreman → Top Dawg → Legend.</p></div>' +
      '<div><div class="eyebrow" style="margin-bottom:8px">Your data</div><p class="ink2" style="font-size:13px;margin-bottom:10px">Everything saves in this browser. Export a backup to move it to another device.</p><div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button class="btn sm" data-action="export">' + icon('download') + 'Export backup</button><button class="btn sm" data-action="import">' + icon('upload') + 'Import backup</button>' +
      '<button class="btn sm" data-action="load-sample">' + icon('refresh') + 'Load sample jobs</button><button class="btn sm danger" data-action="start-fresh">Start fresh</button></div></div></div>' +
      '<div class="modal-foot"><button class="btn primary" data-action="close-modal">Done</button></div>');
  }

  /* ---------- command palette ---------- */
  let palIndex = 0;
  let palItems = [];
  function paletteModal() {
    openModal('<div class="palette-input">' + icon('search') + '<input id="palQ" placeholder="Jump to a job or task, or type a command" aria-label="Search" autocomplete="off"><kbd>Esc</kbd></div><div class="palette-list" id="palList" role="listbox"></div>', 'palette');
    palIndex = 0;
    paletteResults('');
  }
  function paletteResults(q) {
    q = q.trim().toLowerCase();
    const m = (s) => !q || s.toLowerCase().includes(q);
    const items = [];
    const cmds = [
      ['New job', 'plus', () => jobModal()], ['New task', 'plus', () => taskModal()],
      ['Go to Pulse', 'pulse', () => go('pulse')], ['Go to Jobs', 'jobs', () => go('jobs')], ['Go to Board', 'board', () => go('board')],
      ['Go to Timeline', 'timeline', () => go('timeline')], ['Go to Radar', 'radar', () => go('radar')], ['Go to Team', 'team', () => go('team')],
      ['Show blocked tasks', 'block', () => { UI.boardBlocked = true; go('board'); }], ['Edit WIP limits', 'layers', () => wipModal()],
      ['Switch theme', 'moon', () => cycleTheme()], ['Export backup', 'download', () => exportData()], ['Shortcuts & data', 'info', () => helpModal()],
    ];
    cmds.filter((c) => m(c[0])).slice(0, q ? 6 : 13).forEach((c) => items.push({ group: 'Actions', label: c[0], icon: c[1], run: c[2] }));
    if (q) {
      S.jobs.filter((j) => m(j.name + ' ' + j.code + ' ' + j.client)).slice(0, 6).forEach((j) => items.push({ group: 'Jobs', label: j.name, hint: j.code, icon: 'jobs', run: () => { if (UI.view === 'pulse') go('jobs'); openJob(j.id); } }));
      S.tasks.filter((t) => m(t.title)).slice(0, 8).forEach((t) => items.push({ group: 'Tasks', label: t.title, hint: (job(t.jobId) || {}).code + ' · ' + STAGE_LABEL[t.status], icon: 'check', run: () => taskModal(t.id) }));
    }
    palItems = items;
    palIndex = clamp(palIndex, 0, Math.max(0, items.length - 1));
    let g = '';
    $('#palList').innerHTML = items.length ? items.map((it, i) => {
      const head = it.group !== g ? '<div class="pal-group">' + it.group + '</div>' : '';
      g = it.group;
      return head + '<button class="pal-item' + (i === palIndex ? ' active' : '') + '" role="option" aria-selected="' + (i === palIndex) + '" data-action="pal-run" data-i="' + i + '">' + icon(it.icon) + '<span class="t">' + esc(it.label) + '</span>' + (it.hint ? '<span class="h mono">' + esc(it.hint) + '</span>' : '') + '</button>';
    }).join('') : '<div class="empty" style="padding:24px"><p>No matches for “' + esc(q) + '”.</p></div>';
    const act = $('#palList .pal-item.active');
    if (act) act.scrollIntoView({ block: 'nearest' });
  }
  function palRun(i) {
    const it = palItems[i];
    if (!it) return;
    closeModal();
    it.run();
  }

  /* ---------- toasts, xp, confetti ---------- */
  function toast(text, opts) {
    opts = opts || {};
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = '<span>' + esc(text) + '</span>' + (opts.xp ? '<span class="xp">+' + opts.xp + ' XP</span>' : '') + (opts.undo ? '<button type="button">Undo</button>' : '');
    if (opts.undo) el.querySelector('button').addEventListener('click', () => { opts.undo(); el.remove(); });
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), opts.undo ? 6000 : 3400);
  }
  function award(n, why, undo) {
    const before = levelOf(S.xp);
    S.xp += n;
    const d = D.isoDay(Date.now());
    if (!S.doneDays.includes(d)) S.doneDays.push(d);
    S.doneDays = S.doneDays.slice(-120);
    const after = levelOf(S.xp);
    toast(why, { xp: n, undo });
    if (after.idx > before.idx) {
      setTimeout(() => { toast('Level up! You’re now ' + after.name + '.'); confetti(180); }, 400);
    }
  }
  function logEvent(text, jobId) {
    S.log.push({ t: Date.now(), text });
    S.log = S.log.slice(-200);
    const j = jobId && job(jobId);
    if (j) j.log.push({ t: Date.now(), text });
  }

  let confettiRaf = 0;
  function confetti(count) {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cv = $('#confetti');
    const ctx = cv.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    cv.width = innerWidth * dpr;
    cv.height = innerHeight * dpr;
    ctx.scale(dpr, dpr);
    const cs = getComputedStyle(document.documentElement);
    const colors = [cs.getPropertyValue('--hi'), cs.getPropertyValue('--brand'), '#2a78d6', '#eb6834', '#1baf7a', '#e87ba4'].map((c) => c.trim());
    const parts = [];
    const ox = innerWidth / 2, oy = innerHeight * 0.35;
    for (let i = 0; i < (count || 90); i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 4 + Math.random() * 8;
      parts.push({ x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 5, r: 4 + Math.random() * 5, c: colors[i % colors.length], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4 });
    }
    const t0 = performance.now();
    cancelAnimationFrame(confettiRaf);
    const frame = (now) => {
      const el = now - t0;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      parts.forEach((p) => {
        p.vy += 0.28; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.globalAlpha = Math.max(0, 1 - el / 1800);
        ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
        ctx.restore();
      });
      if (el < 1800) confettiRaf = requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, innerWidth, innerHeight);
    };
    confettiRaf = requestAnimationFrame(frame);
  }

  /* ---------- mutations ---------- */
  function setStatus(t, status, quiet) {
    if (!t || t.status === status) return;
    const snap = snapshot();
    t.status = status;
    t.history.push({ s: status, t: Date.now() });
    if (status === 'done') {
      t.completedAt = Date.now();
      t.blocked = null;
      if (!quiet) {
        confetti();
        award(10, 'Finished “' + t.title + '”', () => restore(snap));
      }
    } else {
      t.completedAt = null;
    }
    const j = job(t.jobId);
    if (j && status === 'done' && S.tasks.filter((x) => x.jobId === j.id).every((x) => x.status === 'done') && j.status === 'active') {
      setTimeout(() => toast('Every task on ' + j.code + ' is done. Mark the job complete from its panel.'), 700);
    }
    commit();
  }

  function runWarning(act, key) {
    const w = M.warnings.find((x) => x.key === key);
    if (!w) return;
    const t = w.taskId ? task(w.taskId) : null;
    const snooze = (days) => { S.snoozed[w.key] = Date.now() + days * DAY; };
    const first = (pid) => (person(pid) ? person(pid).name.split(' ')[0] : 'the owner');
    switch (act) {
      case 'open': if (w.jobId) openJob(w.jobId); break;
      case 'board': UI.boardJob = ''; UI.boardPerson = ''; UI.boardBlocked = false; go('board'); break;
      case 'team': go('team'); break;
      case 'snooze': snooze(2); commit(); toast('Snoozed for 2 days'); break;
      case 'nudge': {
        const target = t ? (t.blocked ? (BLOCK_LABEL[t.blocked.type] || 'them') : first(t.assignee)) : first(job(w.jobId).lead);
        logEvent('Nudged ' + target + ' about “' + (t ? t.title : job(w.jobId).name) + '”', w.jobId);
        snooze(2);
        award(5, 'Nudge logged. Radar will check back in 2 days');
        commit();
        break;
      }
      case 'unblock': {
        const snap = snapshot();
        logEvent('Cleared blocker on “' + t.title + '” (' + (BLOCK_LABEL[t.blocked.type] || '') + ')', t.jobId);
        t.blocked = null;
        if (t.status === 'backlog') { t.status = 'ready'; t.history.push({ s: 'ready', t: Date.now() }); }
        award(15, 'Unblocked “' + t.title + '”', () => restore(snap));
        commit();
        break;
      }
      case 'advance': {
        const next = STAGES[STAGES.indexOf(t.status) + 1];
        if (next) setStatus(t, next);
        if (next !== 'done') toast('Moved to ' + STAGE_LABEL[next]);
        break;
      }
      case 'start': setStatus(t, 'doing'); toast('Started “' + t.title + '”'); break;
      case 'reassign': {
        if (!w.move) return;
        const snap = snapshot();
        const mt = task(w.move.taskId);
        const to = person(w.move.to);
        mt.assignee = to.id;
        logEvent('Moved “' + mt.title + '” to ' + to.name + ' to balance load', mt.jobId);
        award(10, 'Reassigned to ' + to.name.split(' ')[0], () => restore(snap));
        commit();
        break;
      }
      default: break;
    }
  }

  function exportData() {
    try {
      const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'momentum-backup-' + D.isoDay(Date.now()) + '.json';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      toast('Backup exported');
    } catch (e) {
      toast('Export isn’t available here. Copy your data from the browser console instead.');
    }
  }
  function importData() {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'application/json,.json';
    inp.addEventListener('change', () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const data = JSON.parse(r.result);
          if (data.version !== 1 || !Array.isArray(data.jobs) || !Array.isArray(data.tasks)) throw new Error('bad');
          S = data;
          S.dirty = true;
          closeModal();
          commit();
          toast('Backup imported: ' + plural(S.jobs.length, 'job'));
        } catch (e) {
          toast('That file isn’t a Momentum backup. Choose a .json file exported from Momentum.');
        }
      };
      r.readAsText(f);
    });
    inp.click();
  }
  function cycleTheme() {
    const order = ['system', 'light', 'dark'];
    prefs.theme = order[(order.indexOf(prefs.theme || 'system') + 1) % 3];
    savePrefs();
    applyTheme();
    toast('Theme: ' + prefs.theme[0].toUpperCase() + prefs.theme.slice(1));
  }

  /* ---------- forms ---------- */
  function showErr(id, on) { const e = $('#' + id); if (e) e.hidden = !on; return on; }
  function submitForm(form) {
    const kind = form.getAttribute('data-form');
    const id = form.getAttribute('data-id');
    if (kind === 'task') {
      const title = $('#fTitle').value.trim();
      const est = parseFloat($('#fEst').value);
      const dueStr = $('#fDue').value;
      let bad = showErr('eTitle', !title);
      bad = showErr('eEst', !(est > 0)) || bad;
      bad = showErr('eDue', !dueStr) || bad;
      if (bad) return;
      const status = $('#fStatus').value;
      const blocked = $('#fBlocked').checked;
      const t = id ? task(id) : null;
      const base = {
        title,
        phase: $('#fPhase').value.trim() || 'Tasks',
        assignee: $('#fAssignee').value || null,
        est,
        due: fromISO(dueStr),
      };
      if (t) {
        Object.assign(t, base);
        if (blocked) t.blocked = { type: $('#fBType').value, note: $('#fBNote').value.trim(), since: t.blocked ? t.blocked.since : TODAY };
        else t.blocked = null;
        closeModal();
        if (t.status !== status) { setStatus(t, status); return; }
        commit();
        toast('Task saved');
      } else {
        const jid = $('#fJob').value;
        const nt = Object.assign({
          id: D.uid('t'), jobId: jid, role: null, plannedStart: TODAY, status, deps: [], completedAt: status === 'done' ? Date.now() : null,
          blocked: blocked ? { type: $('#fBType').value, note: $('#fBNote').value.trim(), since: TODAY } : null,
          history: [{ s: 'backlog', t: Date.now() }].concat(status !== 'backlog' ? [{ s: status, t: Date.now() }] : []),
        }, base);
        S.tasks.push(nt);
        closeModal();
        commit();
        toast('Added “' + title + '” to ' + job(jid).code);
      }
    } else if (kind === 'job') {
      const name = $('#jName').value.trim();
      const start = fromISO($('#jStart').value || toISO(TODAY));
      const due = fromISO($('#jDue').value || toISO(TODAY));
      const budget = parseFloat($('#jBudget').value);
      let bad = showErr('eName', !name);
      bad = showErr('eDue', !(due > start)) || bad;
      bad = showErr('eBudget', !(budget >= 0)) || bad;
      if (bad) return;
      const base = {
        name,
        client: $('#jClient').value.trim(),
        code: $('#jCode').value.trim() || nextCode(),
        lead: $('#jLead').value || null,
        priority: $('#jPriority').value,
        start,
        due,
        budget,
      };
      if (id) {
        const j = job(id);
        Object.assign(j, base);
        const sp = parseFloat($('#jSpent').value);
        if (sp >= 0) j.spent = sp;
        closeModal();
        commit();
        toast('Job saved');
      } else {
        const type = $('#jType').value;
        const j = Object.assign({ id: D.uid('j'), type: type === 'blank' ? 'custom' : type, spent: 0, status: 'active', completedAt: null, created: Date.now(), log: [{ t: Date.now(), text: 'Job created.' }] }, base);
        S.jobs.push(j);
        if (type !== 'blank') S.tasks.push(...D.buildTasks(j, type, S.people));
        closeModal();
        award(20, 'Created ' + j.code);
        commit();
        openJob(j.id);
      }
    } else if (kind === 'wip') {
      FLOW_STAGES.forEach((s) => { const v = parseInt($('#wip_' + s).value, 10); if (v > 0) S.wip[s] = v; });
      closeModal();
      commit();
      toast('WIP limits saved');
    } else if (kind === 'person') {
      const name = $('#pName').value.trim();
      if (showErr('ePName', !name)) return;
      const skill = $('#pSkill').value;
      const base = { name, role: $('#pRole').value.trim(), capacity: Math.max(0, parseFloat($('#pCap').value) || 0), color: $('#pColor').value, roles: skill ? [skill] : [] };
      if (id) Object.assign(person(id), base);
      else S.people.push(Object.assign({ id: D.uid('p') }, base));
      closeModal();
      commit();
      toast(id ? 'Teammate saved' : 'Added ' + name);
    } else if (kind === 'cost') {
      const j = job(UI.drawerJob);
      const amt = parseFloat($('#costAmt').value);
      if (!(amt > 0)) { $('#costAmt').focus(); return; }
      const noteTxt = $('#costNote').value.trim();
      j.spent += amt;
      j.log.push({ t: Date.now(), text: 'Logged ' + money(amt, true) + ' cost' + (noteTxt ? ': ' + noteTxt : '') + '.' });
      commit();
      toast('Logged ' + money(amt, true) + ' on ' + j.code);
    } else if (kind === 'note') {
      const j = job(UI.drawerJob);
      const txt = $('#noteText').value.trim();
      if (!txt) return;
      j.log.push({ t: Date.now(), text: txt });
      commit();
    }
  }

  // Two-step confirm for destructive buttons (the viewer can't show confirm()).
  function armed(btn) {
    if (btn.classList.contains('armed')) return true;
    btn.classList.add('armed');
    const old = btn.innerHTML;
    btn.innerHTML = 'Click again to confirm';
    setTimeout(() => { if (btn.isConnected) { btn.classList.remove('armed'); btn.innerHTML = old; } }, 3000);
    return false;
  }

  /* ---------- events ---------- */
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const a = el.getAttribute('data-action');
    const id = el.getAttribute('data-id');
    if (a === 'close-modal-bg') { if (e.target === el) closeModal(); return; }
    switch (a) {
      case 'nav': go(el.getAttribute('data-view')); break;
      case 'theme': cycleTheme(); break;
      case 'help': helpModal(); break;
      case 'palette': paletteModal(); break;
      case 'new-job': jobModal(); break;
      case 'new-task': taskModal(null, el.getAttribute('data-job')); break;
      case 'open-job': openJob(id); break;
      case 'close-drawer': closeDrawer(); break;
      case 'edit-job': jobModal(id); break;
      case 'open-task': taskModal(id); break;
      case 'toggle-done': {
        e.stopPropagation();
        const t = task(id);
        if (t.status === 'done') { setStatus(t, 'doing', true); toast('Reopened “' + t.title + '”'); } else setStatus(t, 'done');
        break;
      }
      case 'close-modal': closeModal(); break;
      case 'jobs-filter': UI.jobsFilter = el.getAttribute('data-v'); render(); break;
      case 'clear-job-filters': UI.jobsFilter = 'all'; UI.jobsQuery = ''; render(); break;
      case 'radar-filter': UI.radarType = el.getAttribute('data-v'); render(); break;
      case 'unsnooze': S.snoozed = {}; commit(); toast('Snoozed warnings are back'); break;
      case 'wip': wipModal(); break;
      case 'backlog-all': UI.backlogAll = true; render(); break;
      case 'add-person': personModal(); break;
      case 'edit-person': personModal(id); break;
      case 'delete-person':
        if (!armed(el)) return;
        S.tasks.forEach((t) => { if (t.assignee === id) t.assignee = null; });
        S.jobs.forEach((j) => { if (j.lead === id) j.lead = null; });
        S.people = S.people.filter((p) => p.id !== id);
        closeModal(); commit(); toast('Teammate removed. Their tasks are unassigned.');
        break;
      case 'board-person': UI.boardPerson = id; UI.boardJob = ''; go('board'); break;
      case 'delete-task': {
        if (!armed(el)) return;
        const snap = snapshot();
        S.tasks = S.tasks.filter((t) => t.id !== id);
        S.tasks.forEach((t) => { t.deps = (t.deps || []).filter((d) => d !== id); });
        closeModal(); commit(); toast('Task deleted', { undo: () => restore(snap) });
        break;
      }
      case 'delete-job': {
        if (!armed(el)) return;
        const snap = snapshot();
        S.jobs = S.jobs.filter((j) => j.id !== id);
        S.tasks = S.tasks.filter((t) => t.jobId !== id);
        closeDrawer(); commit(); toast('Job deleted', { undo: () => restore(snap) });
        break;
      }
      case 'job-status': {
        const j = job(UI.drawerJob);
        const v = el.getAttribute('data-v');
        if (j.status === v) return;
        j.status = v;
        j.completedAt = v === 'done' ? Date.now() : null;
        j.log.push({ t: Date.now(), text: 'Status changed to ' + { active: 'active', hold: 'on hold', done: 'complete' }[v] + '.' });
        if (v === 'done') { confetti(200); award(50, j.code + ' closed out. Big win.'); }
        commit();
        break;
      }
      case 'export': exportData(); break;
      case 'import': importData(); break;
      case 'load-sample':
        S = D.makeSample(); closeModal(); closeDrawer(); save(); M = compute(); render(); toast('Sample jobs loaded');
        break;
      case 'start-fresh': {
        if (el.closest('.modal') && !armed(el)) return;
        const people = S.people;
        S = { version: 1, sample: false, dirty: true, people, jobs: [], tasks: [], wip: { ready: 12, doing: 9, review: 5 }, snoozed: {}, xp: 0, doneDays: [], log: [] };
        closeModal(); closeDrawer(); commit(); toast('Fresh start. Your team is kept; add your first job.');
        break;
      }
      case 'pal-run': palRun(parseInt(el.getAttribute('data-i'), 10)); break;
      default:
        if (a.startsWith('w-')) runWarning(a.slice(2), el.getAttribute('data-key'));
    }
  });

  document.addEventListener('submit', (e) => {
    const form = e.target.closest('form[data-form]');
    if (!form) return;
    e.preventDefault();
    submitForm(form);
  });

  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.id === 'jobsQ') { UI.jobsQuery = t.value; $('#jobsGrid').innerHTML = jobsGrid(); }
    if (t.id === 'palQ') { palIndex = 0; paletteResults(t.value); }
  });
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.id === 'jobsSort') { UI.jobsSort = t.value; render(); }
    if (t.id === 'boardJob') { UI.boardJob = t.value; render(); }
    if (t.id === 'boardPerson') { UI.boardPerson = t.value; render(); }
    if (t.id === 'boardBlocked') { UI.boardBlocked = t.checked; render(); }
    if (t.id === 'tlDone') { UI.tlDone = t.checked; render(); }
    if (t.id === 'fBlocked') $$('[data-blk]').forEach((x) => { x.hidden = !t.checked; });
    if (t.id === 'fJob') {
      const phases = [...new Set(S.tasks.filter((x) => x.jobId === t.value).map((x) => x.phase).filter(Boolean))];
      $('#phaseList').innerHTML = phases.map((p) => '<option value="' + esc(p) + '">').join('');
    }
  });

  // Board drag and drop.
  let dragId = null;
  document.addEventListener('dragstart', (e) => {
    const c = e.target.closest && e.target.closest('.tcard');
    if (!c) return;
    dragId = c.getAttribute('data-id');
    c.classList.add('dragging');
    try { e.dataTransfer.setData('text/plain', dragId); e.dataTransfer.effectAllowed = 'move'; } catch (err) { /* ignore */ }
  });
  document.addEventListener('dragend', () => { dragId = null; $$('.tcard.dragging').forEach((c) => c.classList.remove('dragging')); $$('.col.drop').forEach((c) => c.classList.remove('drop')); });
  document.addEventListener('dragover', (e) => {
    const col = e.target.closest && e.target.closest('.col');
    if (!col || !dragId) return;
    e.preventDefault();
    $$('.col.drop').forEach((c) => { if (c !== col) c.classList.remove('drop'); });
    col.classList.add('drop');
  });
  document.addEventListener('drop', (e) => {
    const col = e.target.closest && e.target.closest('.col');
    if (!col || !dragId) return;
    e.preventDefault();
    const t = task(dragId);
    const s = col.getAttribute('data-stage');
    dragId = null;
    if (t && t.status !== s) {
      setStatus(t, s);
      const f = M.flow[s];
      if (f && f.count > f.limit) toast(STAGE_LABEL[s] + ' is now over its limit (' + f.count + '/' + f.limit + ')');
    } else render();
  });

  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName);
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); modalOpen() ? closeModal() : paletteModal(); return; }
    if (e.key === 'Escape') {
      if (modalOpen()) { closeModal(); return; }
      if (UI.drawerJob) { closeDrawer(); return; }
    }
    if ($('#palQ') && document.activeElement === $('#palQ')) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        palIndex = clamp(palIndex + (e.key === 'ArrowDown' ? 1 : -1), 0, palItems.length - 1);
        paletteResults($('#palQ').value);
      } else if (e.key === 'Enter') { e.preventDefault(); palRun(palIndex); }
      return;
    }
    if (e.key === 'Enter' && e.target.matches && e.target.matches('[role="button"][data-action]')) { e.target.click(); return; }
    if (typing || e.metaKey || e.ctrlKey || e.altKey || modalOpen()) return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= VIEW_KEYS.length) { closeDrawer(); go(VIEW_KEYS[n - 1]); return; }
    const k = e.key.toLowerCase();
    if (k === 'n') { e.preventDefault(); taskModal(); }
    else if (k === 'j') { e.preventDefault(); jobModal(); }
    else if (k === '/') { e.preventDefault(); paletteModal(); }
    else if (e.key === '?') { helpModal(); }
    else if (k === 't') { cycleTheme(); }
  });

  // Tooltips for anything with data-tip.
  const tip = $('#tip');
  let tipEl = null;
  document.addEventListener('pointerover', (e) => {
    const el = e.target.closest && e.target.closest('[data-tip]');
    if (!el || !el.getAttribute('data-tip')) { tip.hidden = true; tipEl = null; return; }
    tipEl = el;
    tip.innerHTML = el.getAttribute('data-tip');
    tip.hidden = false;
    placeTip(e);
  });
  document.addEventListener('pointermove', (e) => { if (tipEl) placeTip(e); });
  document.addEventListener('pointerout', (e) => { if (tipEl && !tipEl.contains(e.relatedTarget)) { tip.hidden = true; tipEl = null; } });
  document.addEventListener('scroll', () => { tip.hidden = true; tipEl = null; }, true);
  function placeTip(e) {
    const r = tip.getBoundingClientRect();
    let x = e.clientX + 14;
    let y = e.clientY + 14;
    if (x + r.width > innerWidth - 8) x = e.clientX - r.width - 14;
    if (y + r.height > innerHeight - 8) y = e.clientY - r.height - 14;
    tip.style.left = Math.max(8, x) + 'px';
    tip.style.top = Math.max(8, y) + 'px';
  }

  window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (VIEWS[h] && h !== UI.view) go(h); });
  window.addEventListener('storage', (e) => { if (e.key === STORE) { S = load(); M = compute(); render(); } });
  // Recompute at midnight-ish and every few minutes so ages and forecasts stay current.
  setInterval(() => { M = compute(); if (!modalOpen()) render(); }, 5 * 60000);

  /* ---------- boot ---------- */
  const overlay = $('#overlay');
  overlay.innerHTML = '<div id="drawerRoot"></div><div id="modalRoot"></div>';
  applyTheme();
  M = compute();
  const h = location.hash.slice(1);
  UI.view = VIEWS[h] ? h : 'pulse';
  render();
  if (!S.dirty) save();

  window.Momentum = { get state() { return S; }, get metrics() { return M; } };
})();
