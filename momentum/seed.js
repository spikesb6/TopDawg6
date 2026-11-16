/* Momentum: job templates and the sample portfolio.
   Sample dates are generated relative to today so the demo always looks live. */
(function () {
  'use strict';
  const DAY = 86400000;
  const sod = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const addDays = (t, n) => { const d = new Date(t); d.setDate(d.getDate() + Math.round(n)); return sod(d.getTime()); };

  const ROLES = {
    lead: 'Site lead',
    carp: 'Carpentry',
    buy: 'Purchasing',
    elec: 'Electrical',
    design: 'Design',
    coord: 'Coordination',
  };

  // [phase, [[task, estimated hours, role], ...]]
  const TEMPLATES = {
    remodel: {
      label: 'Remodel',
      phases: [
        ['Preconstruction', [['Site walk & measure', 4, 'lead'], ['Scope & estimate', 8, 'buy'], ['Design selections', 8, 'design'], ['Client sign-off', 2, 'coord']]],
        ['Permits & materials', [['Submit permit', 3, 'coord'], ['Order cabinets & fixtures', 4, 'buy'], ['Permit approval', 2, 'coord']]],
        ['Demo & rough-in', [['Demo & haul-off', 16, 'carp'], ['Rough plumbing', 12, 'lead'], ['Rough electrical', 12, 'elec'], ['Rough-in inspection', 2, 'coord']]],
        ['Build-out', [['Drywall & finish', 16, 'carp'], ['Cabinet install', 14, 'carp'], ['Tile & backsplash', 18, 'lead'], ['Trim & paint', 12, 'carp']]],
        ['Closeout', [['Punch list', 6, 'lead'], ['Final inspection', 2, 'coord'], ['Client walkthrough', 2, 'lead'], ['Final invoice', 2, 'coord']]],
      ],
    },
    flip: {
      label: 'Fix & flip',
      phases: [
        ['Acquisition', [['Inspection report review', 3, 'buy'], ['Scope & rehab budget', 6, 'buy'], ['Close & secure property', 2, 'coord']]],
        ['Demo', [['Cleanout & demo', 16, 'carp'], ['Dumpster & haul-off', 4, 'coord']]],
        ['Systems', [['Roof repair', 16, 'lead'], ['HVAC replacement', 12, 'elec'], ['Electrical panel upgrade', 10, 'elec'], ['Plumbing repairs', 10, 'lead'], ['Systems inspection', 2, 'coord']]],
        ['Finishes', [['Flooring', 20, 'carp'], ['Kitchen install', 18, 'carp'], ['Bath refresh', 14, 'lead'], ['Interior paint', 16, 'carp'], ['Exterior & landscaping', 12, 'carp']]],
        ['Listing', [['Punch & clean', 6, 'lead'], ['Staging', 6, 'design'], ['Photos & listing', 3, 'coord']]],
      ],
    },
    newbuild: {
      label: 'New build',
      phases: [
        ['Site prep', [['Survey & staking', 4, 'lead'], ['Building permit', 6, 'coord'], ['Clear & grade', 16, 'carp']]],
        ['Foundation', [['Footings', 16, 'lead'], ['Foundation inspection', 2, 'coord'], ['Slab pour', 12, 'lead']]],
        ['Framing', [['Wall framing', 32, 'carp'], ['Roof framing', 24, 'carp'], ['Sheathing & wrap', 16, 'carp'], ['Framing inspection', 2, 'coord']]],
        ['MEP rough-in', [['Plumbing rough-in', 20, 'lead'], ['Electrical rough-in', 20, 'elec'], ['HVAC rough-in', 18, 'elec'], ['MEP inspection', 2, 'coord']]],
        ['Exterior', [['Roofing', 20, 'carp'], ['Windows & doors', 14, 'carp'], ['Siding', 24, 'carp']]],
        ['Interior', [['Insulation', 10, 'carp'], ['Drywall', 30, 'carp'], ['Cabinets & counters', 20, 'carp'], ['Flooring', 24, 'carp'], ['Paint', 20, 'carp']]],
        ['Closeout', [['Final punch', 10, 'lead'], ['Certificate of occupancy', 2, 'coord'], ['Owner handover', 3, 'lead']]],
      ],
    },
    commercial: {
      label: 'Commercial fit-out',
      phases: [
        ['Pre-construction', [['Landlord & tenant scope', 6, 'coord'], ['Design development', 14, 'design'], ['Bid & award subs', 8, 'buy']]],
        ['Permits', [['Permit submission', 4, 'coord'], ['Long-lead equipment order', 4, 'buy'], ['Permit approval', 2, 'coord']]],
        ['Construction', [['Demo', 12, 'carp'], ['Framing & ceilings', 24, 'carp'], ['Electrical & data', 22, 'elec'], ['Plumbing', 18, 'lead'], ['Rough inspections', 3, 'coord']]],
        ['Finishes', [['Millwork install', 18, 'carp'], ['Flooring', 16, 'carp'], ['Paint & wallcovering', 14, 'carp'], ['Fixtures & equipment', 12, 'elec']]],
        ['Turnover', [['Punch list', 8, 'lead'], ['Final inspection', 2, 'coord'], ['Owner training', 3, 'lead'], ['Closeout docs', 4, 'coord']]],
      ],
    },
    general: {
      label: 'General project',
      phases: [
        ['Kickoff', [['Kickoff meeting', 2, 'coord'], ['Requirements & scope', 8, 'design'], ['Plan & schedule', 6, 'coord']]],
        ['Execution', [['Work package 1', 24, 'lead'], ['Work package 2', 24, 'lead'], ['Mid-point review', 3, 'coord']]],
        ['Quality', [['Testing & QA', 12, 'lead'], ['Fixes', 10, 'lead']]],
        ['Delivery', [['Client review', 3, 'coord'], ['Handover', 3, 'lead'], ['Invoice & close', 2, 'coord']]],
      ],
    },
  };

  let seq = 0;
  const uid = (p) => p + Date.now().toString(36) + (seq++).toString(36) + Math.random().toString(36).slice(2, 6);

  function personForRole(people, role, fallbackId) {
    const p = people.find((x) => (x.roles || []).includes(role));
    return p ? p.id : (fallbackId || null);
  }

  /* Lay a template's tasks across the job window in proportion to their hours.
     Each task waits on the one before it, so a blocker shows what queues behind it. */
  function buildTasks(job, tplKey, people) {
    const tpl = TEMPLATES[tplKey] || TEMPLATES.general;
    const flat = [];
    tpl.phases.forEach(([phase, list]) => list.forEach(([title, est, role]) => flat.push({ phase, title, est, role })));
    const total = flat.reduce((s, t) => s + t.est, 0);
    const span = Math.max(1, Math.round((job.due - job.start) / DAY));
    let cum = 0;
    const out = [];
    flat.forEach((f) => {
      const s = Math.floor((cum / total) * span);
      cum += f.est;
      const e = Math.max(s + 1, Math.round((cum / total) * span));
      const prev = out[out.length - 1];
      const deps = prev ? [prev.id] : [];
      const t = {
        id: uid('t'),
        jobId: job.id,
        title: f.title,
        phase: f.phase,
        role: f.role,
        assignee: personForRole(people, f.role, job.lead),
        est: f.est,
        plannedStart: addDays(job.start, s),
        due: addDays(job.start, e),
        status: 'backlog',
        deps,
        blocked: null,
        completedAt: null,
        history: [{ s: 'backlog', t: job.created || job.start }],
      };
      out.push(t);
    });
    if (out[0]) { out[0].status = 'ready'; out[0].history.push({ s: 'ready', t: job.created || job.start }); }
    return out;
  }

  // Small deterministic random so the sample looks the same on every load.
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Play a job forward to today at a given pace (1 = on plan, 0.75 = 25% slow). */
  function simulate(job, tasks, pace, today, rand) {
    const HOUR = DAY / 24;
    const at = (days) => Math.round((job.start + days * DAY) / HOUR) * HOUR;
    const vnow = ((today - job.start) / DAY) * pace;
    let readySlots = 2;
    tasks.forEach((t) => {
      const ps = (t.plannedStart - job.start) / DAY;
      const pd = (t.due - job.start) / DAY;
      const aStart = ps / pace;
      const aEnd = pd / pace;
      const created = job.start - 3 * DAY;
      t.history = [{ s: 'backlog', t: created }];
      if (pd <= vnow) {
        const reviewDur = Math.min(0.6 + rand() * 1.8, (aEnd - aStart) * 0.45);
        t.history.push({ s: 'ready', t: Math.max(created + HOUR, at(aStart - 1 - rand() * 2)) });
        t.history.push({ s: 'doing', t: at(aStart) });
        t.history.push({ s: 'review', t: at(aEnd - reviewDur) });
        t.history.push({ s: 'done', t: Math.min(at(aEnd), today + 17 * HOUR) });
        t.status = 'done';
        t.completedAt = t.history[t.history.length - 1].t;
      } else if (ps <= vnow) {
        const frac = (vnow - ps) / Math.max(0.01, pd - ps);
        t.history.push({ s: 'ready', t: Math.max(created + HOUR, at(aStart - 1.5)) });
        t.history.push({ s: 'doing', t: Math.min(at(aStart), today) });
        t.status = 'doing';
        if (frac > 0.7) {
          t.history.push({ s: 'review', t: today - Math.round((4 + rand() * 20)) * HOUR });
          t.status = 'review';
        }
      } else if (readySlots > 0) {
        readySlots--;
        t.history.push({ s: 'ready', t: today - Math.round(1 + rand() * 3) * DAY });
        t.status = 'ready';
      } else {
        t.status = 'backlog';
      }
    });
  }

  // Move a task into a status as of `daysAgo`, rewriting the tail of its history.
  function force(t, status, daysAgo, today) {
    const since = today - daysAgo * DAY + 10 * 3600000;
    const order = ['backlog', 'ready', 'doing', 'review', 'done'];
    const idx = order.indexOf(status);
    t.history = t.history.filter((h) => order.indexOf(h.s) < idx && h.t < since);
    if (!t.history.length) t.history = [{ s: 'backlog', t: since - 6 * DAY }];
    if (idx >= 2 && !t.history.some((h) => h.s === 'doing')) t.history.push({ s: 'doing', t: since - 3 * DAY });
    t.history.push({ s: status, t: since });
    t.status = status;
    t.completedAt = status === 'done' ? since : null;
  }

  function makeSample(now) {
    const today = sod(now || Date.now());
    const rand = rng(2417);
    const people = [
      { id: 'p1', name: 'Dana Ruiz', role: 'Site lead', roles: ['lead'], capacity: 40, color: '#2a6fc4' },
      { id: 'p2', name: 'Marcus Bell', role: 'Carpentry lead', roles: ['carp'], capacity: 32, color: '#c4501f' },
      { id: 'p3', name: 'Priya Shah', role: 'Estimating & purchasing', roles: ['buy'], capacity: 32, color: '#13805a' },
      { id: 'p4', name: 'Tom Okafor', role: 'Electrical', roles: ['elec'], capacity: 40, color: '#5a48c8' },
      { id: 'p5', name: 'Lena Park', role: 'Design', roles: ['design'], capacity: 36, color: '#b0406b' },
      { id: 'p6', name: 'Jay Whitfield', role: 'Project coordinator', roles: ['coord'], capacity: 40, color: '#4a6272' },
      { id: 'p7', name: 'Rosa Diaz', role: 'Carpenter', roles: ['carp2'], capacity: 40, color: '#8a6200' },
    ];

    const specs = [
      { code: 'J-2412', name: 'Maple St Kitchen Remodel', client: 'The Hendersons', type: 'remodel', lead: 'p1', start: -40, due: 18, budget: 68000, pace: 1.0, spend: 0.99, priority: 'high' },
      { code: 'J-2409', name: 'Lakeview Fix & Flip', client: 'Journey Investments', type: 'flip', lead: 'p1', start: -55, due: 10, budget: 92000, pace: 0.84, spend: 1.12, priority: 'high' },
      { code: 'J-2405', name: 'Oak Ridge New Build', client: 'Patel Family', type: 'newbuild', lead: 'p1', start: -70, due: 82, budget: 410000, pace: 0.97, spend: 1.02, priority: 'med' },
      { code: 'J-2414', name: 'Harbor Dental Fit-out', client: 'Harbor Dental Group', type: 'commercial', lead: 'p6', start: -30, due: 35, budget: 145000, pace: 1.02, spend: 1.19, priority: 'high' },
      { code: 'J-2418', name: 'Pine Ct Primary Bath', client: 'M. Alvarez', type: 'remodel', lead: 'p1', start: -12, due: 30, budget: 34000, pace: 1.12, spend: 0.95, priority: 'med' },
      { code: 'J-2421', name: 'Westside Retail Refresh', client: 'Westside Commons LLC', type: 'commercial', lead: 'p6', start: -4, due: 62, budget: 118000, pace: 1.0, spend: 1.0, priority: 'low' },
      { code: 'J-2398', name: 'Elm Ave Basement Finish', client: 'R. Chen', type: 'remodel', lead: 'p1', start: -64, due: -20, budget: 41000, pace: 1.05, spend: 0.97, priority: 'med' },
      { code: 'J-2395', name: 'Cedar Loft Conversion', client: 'Cedar Lofts HOA', type: 'remodel', lead: 'p6', start: -80, due: -16, budget: 57000, pace: 0.89, spend: 1.08, priority: 'med' },
    ];

    const jobs = [];
    const tasks = [];
    specs.forEach((s, i) => {
      const job = {
        id: 'j' + (i + 1),
        code: s.code,
        name: s.name,
        client: s.client,
        type: s.type,
        lead: s.lead,
        priority: s.priority,
        start: addDays(today, s.start),
        due: addDays(today, s.due),
        created: addDays(today, s.start - 7),
        budget: s.budget,
        spent: 0,
        status: 'active',
        completedAt: null,
        log: [],
      };
      const jt = buildTasks(job, s.type, people);
      simulate(job, jt, s.pace, today, rand);
      if (jt.every((t) => t.status === 'done')) {
        job.status = 'done';
        job.completedAt = Math.max(...jt.map((t) => t.completedAt));
      }
      job._spend = s.spend;
      jobs.push(job);
      tasks.push(...jt);
    });

    const J = (code) => jobs.find((j) => j.code === code);
    const T = (code, title) => tasks.find((t) => t.jobId === J(code).id && t.title === title);
    const note = (code, daysAgo, text) => J(code).log.push({ t: today - daysAgo * DAY + 9 * 3600000, text });

    // Maple: tile is waiting on the client, which will hold up everything after it.
    const tile = T('J-2412', 'Tile & backsplash');
    if (tile && tile.status !== 'done') {
      force(tile, 'ready', 4, today);
      tile.blocked = { type: 'client', note: 'Client hasn’t picked backsplash tile; 3 samples sent', since: today - 3 * DAY };
    }
    note('J-2412', 6, 'Cabinets delivered and staged in garage.');
    note('J-2412', 3, 'Sent tile samples to the Hendersons, asked for a pick by Friday.');

    // Lakeview: slow crew, countertops backordered, flooring stuck waiting for sign-off.
    const kit = T('J-2409', 'Kitchen install');
    if (kit) {
      force(kit, 'doing', 8, today);
      kit.blocked = { type: 'materials', note: 'Quartz slab backordered at fabricator, new ETA unconfirmed', since: today - 6 * DAY };
    }
    const floor = T('J-2409', 'Flooring');
    if (floor) force(floor, 'review', 7, today);
    note('J-2409', 9, 'Roof repair took 4 extra days after finding rotted decking.');
    note('J-2409', 6, 'Fabricator says slab is backordered. Asked Priya to price an alternate.');

    // Harbor: landlord approval needed before electrical can finish; costs running hot.
    const elec = T('J-2414', 'Electrical & data');
    if (elec && elec.status !== 'done') {
      force(elec, 'doing', 6, today);
      elec.blocked = { type: 'client', note: 'Landlord sign-off needed for panel upgrade', since: today - 4 * DAY };
    }
    const framing = T('J-2414', 'Framing & ceilings');
    if (framing) force(framing, 'review', 5, today);
    note('J-2414', 12, 'Change order #3 approved: added two operatories.');
    note('J-2414', 4, 'Overtime on framing to hold the schedule. Watch labor costs.');

    // Review is piling up across jobs (one reviewer for everything).
    const oakCur = tasks.find((t) => t.jobId === J('J-2405').id && t.status === 'doing');
    if (oakCur) force(oakCur, 'review', 3, today);
    const pineScope = T('J-2418', 'Design selections');
    if (pineScope) force(pineScope, 'review', 4, today);

    // Westside: a due-soon task nobody has started.
    const wsScope = T('J-2421', 'Landlord & tenant scope');
    if (wsScope) { force(wsScope, 'ready', 3, today); wsScope.due = addDays(today, 2); }

    // Give Rosa a light load so there is someone to rebalance onto.
    const oakSiding = T('J-2405', 'Insulation');
    if (oakSiding) oakSiding.assignee = 'p7';

    // Spend tracks earned work (half credit in progress, most of it in review) times each job's cost efficiency.
    const credit = { done: 1, review: 0.9, doing: 0.5 };
    jobs.forEach((job) => {
      const jt = tasks.filter((t) => t.jobId === job.id);
      const total = jt.reduce((a, t) => a + t.est, 0);
      const earned = jt.reduce((a, t) => a + t.est * (credit[t.status] || 0), 0);
      job.spent = Math.round((job.budget * (earned / total) * job._spend * (0.98 + rand() * 0.04)) / 100) * 100;
      delete job._spend;
    });

    const doneDays = [];
    for (let i = 1; i <= 5; i++) doneDays.push(isoDay(addDays(today, -i)));

    return {
      version: 1,
      sample: true,
      dirty: false,
      seededFor: today,
      people,
      jobs,
      tasks,
      wip: { ready: 14, doing: 9, review: 5 },
      snoozed: {},
      xp: 340,
      doneDays,
      log: [],
    };
  }

  function isoDay(t) {
    const d = new Date(t);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  window.MomentumData = { TEMPLATES, ROLES, buildTasks, makeSample, uid, isoDay, sod, addDays, DAY };
})();
