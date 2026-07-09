/* ============================================================
   ServiceOS — application logic
   Local-state MVP: state persists to localStorage, timestamps
   are real so stage timers tick live.
   ============================================================ */

const STORE_KEY = 'serviceos-state-v1';
const SESSION_KEY = 'serviceos-session-v1';

let state = loadState();
let session = loadSession();

/* ---------------- persistence ---------------- */

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.vehicles)) return parsed;
    }
  } catch (e) { /* corrupted state falls through to reseed */ }
  const fresh = seedState();
  localStorage.setItem(STORE_KEY, JSON.stringify(fresh));
  return fresh;
}

function saveState() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

function loadSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (e) { return null; }
}

function resetDemo() {
  state = seedState();
  saveState();
  toast('Demo data reset — floor reloaded with a fresh day.');
  render();
}

/* ---------------- helpers ---------------- */

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function minutesIn(v) { return Math.max(0, Math.floor((Date.now() - v.statusSince) / 60000)); }

function fmtMin(m) {
  if (m == null || isNaN(m)) return '—';
  m = Math.round(m);
  if (m < 60) return m + 'm';
  return Math.floor(m / 60) + 'h ' + (m % 60) + 'm';
}

function fmtClock(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function severity(v) {
  const limit = SLA[v.status];
  if (!isFinite(limit)) return 'green';
  const m = minutesIn(v);
  if (m >= limit) return 'red';
  if (m >= limit * .7) return 'yellow';
  return 'green';
}

function techById(id) { return state.techs.find(t => t.id === id) || null; }
function techName(id) { const t = techById(id); return t ? t.name : 'Unassigned'; }
function vehicleById(id) { return state.vehicles.find(v => v.id === id) || null; }

function evAt(v, label) {
  const e = v.events.find(x => x.label === label);
  return e ? e.at : null;
}

function activeVehicles() { return state.vehicles.filter(v => v.status !== 'Delivered'); }

function techStatus(t) {
  const jobs = state.vehicles.filter(v => v.techId === t.id && v.status !== 'Delivered');
  if (jobs.some(v => ['Diagnosis', 'Repair', 'QC'].includes(v.status))) return 'Busy';
  if (jobs.some(v => v.status === 'Assigned')) return 'Assigned';
  if (jobs.some(v => v.status === 'Waiting Parts')) return 'Waiting Parts';
  if (jobs.some(v => v.status === 'Waiting Approval')) return 'Waiting Approval';
  return 'Available';
}

function techCurrentJob(t) {
  const order = ['Repair', 'Diagnosis', 'QC', 'Assigned', 'Waiting Parts', 'Waiting Approval'];
  const jobs = state.vehicles.filter(v => v.techId === t.id && v.status !== 'Delivered');
  jobs.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
  return jobs[0] || null;
}

function avgBetween(labelA, labelB, pool) {
  const diffs = (pool || state.vehicles)
    .map(v => {
      const a = evAt(v, labelA), b = evAt(v, labelB);
      return a != null && b != null ? (b - a) / 60000 : null;
    })
    .filter(x => x != null && x >= 0);
  if (!diffs.length) return null;
  return diffs.reduce((s, x) => s + x, 0) / diffs.length;
}

/* ---------------- workflow actions ---------------- */

function enterStage(v, stage, extraMilestones) {
  const now = Date.now();
  (extraMilestones || []).forEach(label => {
    if (!evAt(v, label)) v.events.push({ label, at: now });
  });
  (STAGE_MILESTONES[stage] || []).forEach(label => {
    if (!evAt(v, label)) v.events.push({ label, at: now });
  });
  v.status = stage;
  v.statusSince = now;
  saveState();
}

function advance(vehicleId, stage, extra) {
  const v = vehicleById(vehicleId);
  if (!v) return;
  const from = v.status;
  enterStage(v, stage, extra);
  if (stage === 'QC' && v.techId) {
    const t = techById(v.techId);
    if (t) t.jobsToday += 1;
    saveState();
  }
  toast(`${v.ro} moved: ${from} → ${stage}`);
  render();
}

function assignVehicle(vehicleId, techId) {
  const v = vehicleById(vehicleId);
  const t = techById(techId);
  if (!v || !t) return;
  v.techId = techId;
  enterStage(v, 'Assigned');
  toast(`${v.ro} assigned to ${t.name}`);
  render();
}

function setPartsStatus(vehicleId, status) {
  const v = vehicleById(vehicleId);
  if (!v) return;
  v.partsStatus = status;
  if (status === 'Ordered' && !evAt(v, 'Parts Ordered')) v.events.push({ label: 'Parts Ordered', at: Date.now() });
  if (status === 'Received' && !evAt(v, 'Parts Received')) v.events.push({ label: 'Parts Received', at: Date.now() });
  saveState();
  toast(`${v.ro} parts marked ${status.toLowerCase()}`);
  render();
}

function flagIssue(vehicleId) {
  const v = vehicleById(vehicleId);
  if (!v) return;
  const note = prompt('Describe the issue blocking ' + v.ro + ':', v.flag || '');
  if (note === null) return;
  v.flag = note.trim() || null;
  saveState();
  toast(v.flag ? `${v.ro} flagged: ${v.flag}` : `${v.ro} flag cleared`);
  render();
}

/* ---------------- alerts ---------------- */

function computeAlerts() {
  const red = [], warn = [];
  activeVehicles().forEach(v => {
    const limit = SLA[v.status];
    if (!isFinite(limit)) return;
    const m = minutesIn(v);
    const entry = {
      vehicle: v, minutes: m, limit,
      reason: ALERT_REASONS[v.status] || 'Stage is over its target time',
      owner: v.status === 'Assigned' || v.status === 'Diagnosis' || v.status === 'Repair' || v.status === 'QC'
        ? (techName(v.techId) !== 'Unassigned' ? techName(v.techId) : STAGE_OWNER[v.status])
        : (STAGE_OWNER[v.status] || 'Manager')
    };
    if (m >= limit) red.push(entry);
    else if (m >= limit * .7) warn.push(entry);
  });
  red.sort((a, b) => (b.minutes - b.limit) - (a.minutes - a.limit));
  warn.sort((a, b) => b.minutes - a.minutes);
  return { red, warn };
}

/* ---------------- routing ---------------- */

const PAGES = {
  dashboard: { title: 'Command Center', sub: 'Live view of every vehicle moving through the service department.' },
  intake:    { title: 'Service Drive Intake', sub: 'Create a vehicle card the moment it hits the drive.' },
  dispatch:  { title: 'Dispatch Board', sub: 'Match waiting vehicles to the right technician before the queue builds.' },
  tech:      { title: 'Technician View', sub: 'Tablet screen: current job, next action, and blockers.' },
  parts:     { title: 'Parts Board', sub: 'Every vehicle waiting on a part, and where that part is.' },
  alerts:    { title: 'Bottleneck Alerts', sub: 'ServiceOS finds delays before the customer calls.' },
  analytics: { title: 'Analytics', sub: 'Measure flow, not just hours sold.' },
  vehicle:   { title: 'Vehicle Detail', sub: 'Complete timeline from arrival to delivery.' }
};

function route() {
  const hash = location.hash.replace(/^#\/?/, '');
  const [page, param] = hash.split('/');
  if (!session) return { page: 'login' };
  if (!PAGES[page]) return { page: session.home || 'dashboard' };
  return { page, param };
}

function nav(to) { location.hash = '#/' + to; }

/* ---------------- rendering ---------------- */

const app = document.getElementById('app');

function render() {
  const r = route();
  if (r.page === 'login') { renderLogin(); return; }
  renderShell(r);
}

function renderLogin() {
  const roleBtns = ROLES.map(role => `
    <button type="button" class="role-btn" data-role="${role.id}">
      <strong>${role.name}</strong>
      <span class="role-desc">${role.desc}</span>
    </button>`).join('');

  app.innerHTML = `
    <div class="login-screen">
      <div class="login-card">
        <div class="login-logo">Service<span>OS</span></div>
        <div class="login-tagline">The live operating system for your service department.</div>
        <form id="loginForm">
          <label>Name</label>
          <input name="name" required placeholder="Your name" autocomplete="off">
          <label style="margin-top:16px">Role</label>
          <div class="role-grid">${roleBtns}</div>
          <input type="hidden" name="role" id="roleInput" required>
          <div class="btn-row"><button class="btn full" style="width:100%" type="submit">Sign In</button></div>
        </form>
        <div class="login-footnote">Demo build — any name works. Data lives in your browser.</div>
      </div>
    </div>`;

  app.querySelectorAll('.role-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      app.querySelectorAll('.role-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      document.getElementById('roleInput').value = btn.dataset.role;
    });
  });

  document.getElementById('loginForm').addEventListener('submit', e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    if (!data.role) { toast('Pick a role to continue.'); return; }
    const role = ROLES.find(r => r.id === data.role);
    session = { name: data.name.trim(), role: role.id, roleName: role.name, home: role.home };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    nav(role.home);
    render();
  });
}

function logout() {
  session = null;
  localStorage.removeItem(SESSION_KEY);
  location.hash = '';
  render();
}

function renderShell(r) {
  const alerts = computeAlerts();
  const navItems = [
    { group: 'Operations', items: [
      ['dashboard', 'Command Center'],
      ['intake', 'Intake'],
      ['dispatch', 'Dispatch'],
      ['parts', 'Parts']
    ]},
    { group: 'Shop Floor', items: [['tech', 'Technician View']] },
    { group: 'Insights', items: [
      ['alerts', 'Alerts', alerts.red.length],
      ['analytics', 'Analytics']
    ]}
  ];

  const navHTML = navItems.map(g => `
    <div class="nav-group">
      <div class="nav-label">${g.group}</div>
      ${g.items.map(([id, label, count]) => `
        <button data-nav="${id}" class="${r.page === id ? 'active' : ''}">
          <span>${label}</span>${count ? `<span class="nav-count">${count}</span>` : ''}
        </button>`).join('')}
    </div>`).join('');

  const initials = session.name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';

  app.innerHTML = `
    <div class="app">
      <aside>
        <div class="logo">Service<span>OS</span></div>
        <div class="tagline">Dealership service command center</div>
        <div class="nav">${navHTML}</div>
        <div class="sidebar-footer">
          <div class="user-card">
            <div class="avatar">${esc(initials)}</div>
            <div>
              <div class="user-name">${esc(session.name)}</div>
              <div class="user-role">${esc(session.roleName)}</div>
            </div>
          </div>
          <div class="sidebar-actions">
            <button id="resetBtn">Reset Demo</button>
            <button id="logoutBtn">Sign Out</button>
          </div>
        </div>
      </aside>
      <main id="main"></main>
    </div>`;

  app.querySelectorAll('[data-nav]').forEach(b =>
    b.addEventListener('click', () => { nav(b.dataset.nav); }));
  document.getElementById('logoutBtn').addEventListener('click', logout);
  document.getElementById('resetBtn').addEventListener('click', () => {
    if (confirm('Reset all demo data back to the seeded floor?')) resetDemo();
  });

  const main = document.getElementById('main');
  const renderers = {
    dashboard: renderDashboard, intake: renderIntake, dispatch: renderDispatch,
    tech: renderTech, parts: renderParts, alerts: renderAlerts,
    analytics: renderAnalytics, vehicle: renderVehicleDetail
  };
  (renderers[r.page] || renderDashboard)(main, r.param);
}

function topbarHTML(page, extraPill) {
  const p = PAGES[page];
  return `
    <div class="topbar">
      <div><h1>${p.title}</h1><div class="sub">${p.sub}</div></div>
      <div class="topbar-right">
        ${extraPill || ''}
        <span class="pill live">Live · ${fmtClock(Date.now())}</span>
      </div>
    </div>`;
}

/* ---------------- vehicle card ---------------- */

function vehicleCardHTML(v, opts) {
  opts = opts || {};
  const sev = severity(v);
  const pColor = PRIORITY_COLOR[v.priority] || '';
  return `
    <div class="vehicle sev-${sev}" data-open="${v.id}">
      <h3>${esc(v.ro)}</h3>
      <div class="vname">${esc(v.year)} ${esc(v.make)} ${esc(v.model)} · ${esc(v.customer)}</div>
      <div class="meta">${esc(v.concern)}</div>
      <div class="meta" style="margin-top:5px">
        Advisor: ${esc(v.advisor.split(' ')[0])} · Tech: ${esc(techName(v.techId).split(' ')[0])}
        ${v.flag ? `<br><span class="badge red" style="margin-top:4px;display:inline-block">⚑ ${esc(v.flag)}</span>` : ''}
      </div>
      <div class="status-row">
        <span class="badge ${sev}">${fmtMin(minutesIn(v))} in ${esc(v.status)}</span>
        <span class="badge ${pColor}">${esc(v.priority)}</span>
      </div>
      ${opts.actions || ''}
    </div>`;
}

function bindVehicleCards(root) {
  root.querySelectorAll('[data-open]').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.closest('button')) return;
      nav('vehicle/' + el.dataset.open);
    });
  });
}

/* ---------------- pages ---------------- */

function renderDashboard(main) {
  const vs = state.vehicles;
  const count = s => vs.filter(v => v.status === s).length;
  const overSla = activeVehicles().filter(v => severity(v) === 'red').length;
  const avgToTech = avgBetween('Arrival', 'Technician Assigned');
  const avgCycle = avgBetween('Arrival', 'Delivered', vs.filter(v => v.status === 'Delivered'));

  const tiles = [
    ['Vehicles Today', vs.length, 'Across all advisors'],
    ['Waiting Dispatch', count('Waiting Dispatch'), `SLA ${SLA['Waiting Dispatch']}m`],
    ['Assigned to Tech', count('Assigned'), 'Not yet started'],
    ['Waiting Approval', count('Waiting Approval'), `SLA ${SLA['Waiting Approval']}m`],
    ['Waiting Parts', count('Waiting Parts'), `SLA ${SLA['Waiting Parts']}m`],
    ['In Repair', count('Repair'), 'Wrenches turning'],
    ['In QC', count('QC'), `SLA ${SLA['QC']}m`],
    ['Ready', count('Ready'), 'Awaiting pickup'],
    ['Over SLA', overSla, overSla ? 'Action needed now' : 'Flow is clean', overSla ? 'red' : 'green', overSla > 0],
    ['Avg Time to Tech', fmtMin(avgToTech), 'Target: 15m', avgToTech > 15 ? 'red' : 'green'],
    ['Avg Cycle Time', fmtMin(avgCycle), 'Arrival → delivered', '']
  ];

  const tilesHTML = tiles.map(([label, value, note, noteColor, accent]) => `
    <div class="metric ${accent ? 'accent' : ''}">
      <div class="label">${label}</div>
      <div class="value">${value}</div>
      <div class="note ${noteColor || ''}">${note}</div>
    </div>`).join('');

  const columns = STAGES.map(col => {
    const items = vs.filter(v => v.status === col);
    return `
      <div class="column">
        <div class="col-title"><span>${col}</span><span class="col-count">${items.length}</span></div>
        ${items.map(v => vehicleCardHTML(v)).join('') || '<div class="col-empty">Empty</div>'}
      </div>`;
  }).join('');

  main.innerHTML = `
    ${topbarHTML('dashboard', '<span class="pill">Goal: arrival → tech in under 15 min</span>')}
    <div class="stat-strip">${tilesHTML}</div>
    <div class="board-wrap"><div class="board">${columns}</div></div>`;
  bindVehicleCards(main);
}

function renderIntake(main) {
  const advisorOpts = ADVISORS.map(a => `<option>${a}</option>`).join('');
  main.innerHTML = `
    ${topbarHTML('intake')}
    <div class="split">
      <div class="panel section">
        <h2>New Vehicle</h2>
        <form class="intake" id="intakeForm">
          <div><label>Customer Name *</label><input name="customer" required placeholder="Marcus Johnson"></div>
          <div><label>Phone</label><input name="phone" placeholder="(555) 123-4567"></div>
          <div><label>RO Number *</label><input name="ro" required value="RO-${state.nextRo}"></div>
          <div><label>VIN</label><input name="vin" placeholder="Last 8 or full VIN"></div>
          <div><label>Year</label><input name="year" placeholder="2021"></div>
          <div><label>Make</label><input name="make" placeholder="Dodge"></div>
          <div><label>Model</label><input name="model" placeholder="Charger"></div>
          <div><label>Mileage</label><input name="mileage" placeholder="62,400"></div>
          <div><label>Visit Type</label><select name="visitType"><option>Appointment</option><option>Walk-in</option></select></div>
          <div><label>Customer Status</label><select name="custStatus"><option>Waiting</option><option>Drop-off</option></select></div>
          <div><label>Priority</label><select name="priority">${PRIORITIES.map(p => `<option>${p}</option>`).join('')}</select></div>
          <div><label>Advisor</label><select name="advisor">${advisorOpts}</select></div>
          <div class="full"><label>Customer Concern *</label>
            <textarea name="concern" required placeholder="Customer states vehicle has rough idle and check engine light."></textarea></div>
          <div><label>Create In Status</label>
            <select name="startStatus"><option>Checked In</option><option>Arrived</option></select></div>
          <div style="display:flex;align-items:flex-end"><button class="btn" style="width:100%" type="submit">Create Vehicle Card</button></div>
        </form>
      </div>
      <div>
        <div class="panel section">
          <h2>Intake Rule</h2>
          <p class="meta" style="font-size:13px">Capture the essentials only. The goal is not a perfect
          write-up — it's starting the workflow fast and getting the vehicle moving toward a technician.</p>
          <br>
          <div class="metric">
            <div class="label">Target Check-In Time</div>
            <div class="value">5m</div>
            <div class="note">Anything longer creates the first bottleneck of the day.</div>
          </div>
        </div>
        <br>
        <div class="panel section">
          <h2>Just Arrived</h2>
          <div id="recentIntake">
            ${state.vehicles.filter(v => ['Arrived', 'Checked In'].includes(v.status))
              .map(v => vehicleCardHTML(v)).join('') || '<p class="meta">Drive is clear.</p>'}
          </div>
        </div>
      </div>
    </div>`;

  bindVehicleCards(main);

  document.getElementById('intakeForm').addEventListener('submit', e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target).entries());
    const now = Date.now();
    const v = {
      id: 'v' + now,
      ro: d.ro.trim(), customer: d.customer.trim(), phone: d.phone, vin: d.vin,
      year: d.year, make: d.make, model: d.model, mileage: d.mileage,
      concern: d.concern.trim(), visitType: d.visitType, custStatus: d.custStatus,
      priority: d.priority, advisor: d.advisor, techId: null,
      partsStatus: null, partsNote: '', flag: null,
      status: 'Arrived', statusSince: now,
      events: [{ label: 'Arrival', at: now }]
    };
    if (d.startStatus === 'Checked In') {
      v.events.push({ label: 'Check-In Complete', at: now });
      v.status = 'Checked In';
    }
    state.vehicles.unshift(v);
    state.nextRo += 1;
    saveState();
    toast(`${v.ro} created — ${v.status}. Send it to dispatch when the write-up is done.`);
    render();
  });
}

function renderDispatch(main) {
  const waiting = state.vehicles.filter(v => ['Waiting Dispatch', 'Checked In', 'Arrived'].includes(v.status));
  waiting.sort((a, b) => a.statusSince - b.statusSince);

  const techOpts = t => state.techs.map(x =>
    `<option value="${x.id}" ${x.id === t ? 'selected' : ''}>${x.name} — ${techStatus(x)}</option>`).join('');

  const waitingHTML = waiting.map(v => {
    const ready = v.status === 'Waiting Dispatch';
    return vehicleCardHTML(v, {
      actions: ready ? `
        <div class="btn-row" style="margin-top:10px">
          <select data-tech-for="${v.id}" style="flex:1;min-width:0">${techOpts()}</select>
          <button class="btn sm" data-assign="${v.id}">Assign</button>
        </div>` : `
        <div class="btn-row" style="margin-top:10px">
          <span class="badge">Still in ${v.status} — advisor owns it</span>
        </div>`
    });
  }).join('') || '<p class="meta">No vehicles waiting. Flow is clean. ✨</p>';

  const statusColor = s => s === 'Available' ? 'green' : s === 'Waiting Parts' ? 'yellow' : 'blue';
  const techHTML = state.techs.map(t => {
    const job = techCurrentJob(t);
    const st = techStatus(t);
    return `
      <div class="tech-card">
        <div>
          <strong>${t.name}</strong>
          <div class="meta">${t.skill}<br>
            ${job ? `Current: ${esc(job.ro)} · ${esc(job.status)}` : 'No active job'} · ${t.jobsToday} jobs today</div>
        </div>
        <span class="badge ${statusColor(st)}">${st}</span>
      </div>`;
  }).join('');

  main.innerHTML = `
    ${topbarHTML('dispatch', `<span class="pill">${waiting.filter(v => v.status === 'Waiting Dispatch').length} waiting for a tech</span>`)}
    <div class="split">
      <div class="panel section">
        <h2>Waiting for Technician</h2>
        <div class="section-note">Oldest first — the top card is your biggest fire.</div>
        ${waitingHTML}
      </div>
      <div class="panel section">
        <h2>Technicians</h2>
        ${techHTML}
      </div>
    </div>`;

  bindVehicleCards(main);
  main.querySelectorAll('[data-assign]').forEach(b => b.addEventListener('click', () => {
    const sel = main.querySelector(`[data-tech-for="${b.dataset.assign}"]`);
    assignVehicle(b.dataset.assign, sel.value);
  }));
}

function renderTech(main) {
  const selectedId = (session.techId && techById(session.techId)) ? session.techId : state.techs[0].id;
  const tech = techById(selectedId);
  const job = techCurrentJob(tech);

  const options = state.techs.map(t =>
    `<option value="${t.id}" ${t.id === selectedId ? 'selected' : ''}>${t.name} — ${t.skill}</option>`).join('');

  let jobHTML;
  if (!job) {
    jobHTML = `<div class="panel section"><h2>Current Job</h2>
      <p class="meta">No active job. Check the dispatch board — you're up next.</p></div>`;
  } else {
    const actions = [];
    if (job.status === 'Assigned') actions.push(`<button class="btn success big-action" data-act="diag-start">▶ Start Diagnosis</button>`);
    if (job.status === 'Diagnosis') actions.push(`<button class="btn big-action" data-act="diag-done">✓ Complete Diagnosis — Send Estimate</button>`);
    if (job.status === 'Waiting Approval') actions.push(`<span class="badge yellow">Waiting on customer approval — advisor owns this step</span>`);
    if (job.status === 'Waiting Parts') {
      actions.push(job.partsStatus === 'Received' || job.partsStatus === 'Ready'
        ? `<button class="btn success big-action" data-act="repair-start">▶ Parts In Hand — Start Repair</button>`
        : `<span class="badge yellow">Waiting on parts (${esc(job.partsStatus || 'Ordered')})</span>`);
    }
    if (job.status === 'Repair') actions.push(`<button class="btn big-action" data-act="repair-done">✓ Complete Repair — Send to QC</button>`);
    if (job.status === 'QC') actions.push(`<button class="btn big-action" data-act="qc-done">✓ QC Passed — Send to Wash</button>`);

    jobHTML = `
      <div class="panel section">
        <h2>Current Job</h2>
        <div class="vehicle sev-${severity(job)}">
          <h3>${esc(job.ro)} · ${esc(job.year)} ${esc(job.make)} ${esc(job.model)}</h3>
          <div class="meta">
            Customer: ${esc(job.customer)} (${esc(job.custStatus)})<br>
            Mileage: ${esc(job.mileage)} · VIN: ${esc(job.vin)}<br>
            Advisor: ${esc(job.advisor)}
          </div>
          <div class="meta" style="margin-top:8px;padding:10px;background:rgba(90,167,255,.06);border-radius:10px;border:1px solid rgba(90,167,255,.18)">
            <strong style="color:var(--text)">Concern:</strong> ${esc(job.concern)}
          </div>
          <div class="status-row">
            <span class="badge ${severity(job)}">${fmtMin(minutesIn(job))} in ${esc(job.status)}</span>
            <span class="badge ${PRIORITY_COLOR[job.priority] || ''}">${esc(job.priority)}</span>
          </div>
        </div>
        <div class="btn-row">${actions.join('')}</div>
        <div class="btn-row">
          <button class="btn danger" data-act="flag">⚑ ${job.flag ? 'Update Flag' : 'Flag Issue'}</button>
          <button class="btn secondary" data-act="detail">Full Timeline</button>
        </div>
      </div>`;
  }

  const upNext = state.vehicles.filter(v => v.techId === selectedId && v.status !== 'Delivered' && v !== job);

  main.innerHTML = `
    ${topbarHTML('tech')}
    <div class="tablet">
      <div class="tech-select-row">
        <label style="margin:0">Signed in bay:</label>
        <select id="techSelect">${options}</select>
        <span class="badge ${techStatus(tech) === 'Available' ? 'green' : 'blue'}">${techStatus(tech)}</span>
        <span class="badge">${tech.jobsToday} jobs today</span>
      </div>
      ${jobHTML}
      <br>
      <div class="panel section">
        <h2>My Queue</h2>
        ${upNext.map(v => vehicleCardHTML(v)).join('') || '<p class="meta">Nothing else assigned.</p>'}
      </div>
    </div>`;

  bindVehicleCards(main);
  document.getElementById('techSelect').addEventListener('change', e => {
    session.techId = e.target.value;
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    render();
  });

  if (job) {
    const acts = {
      'diag-start': () => advance(job.id, 'Diagnosis'),
      'diag-done': () => advance(job.id, 'Waiting Approval'),
      'repair-start': () => advance(job.id, 'Repair', ['Parts Received']),
      'repair-done': () => advance(job.id, 'QC'),
      'qc-done': () => advance(job.id, 'Wash'),
      'flag': () => flagIssue(job.id),
      'detail': () => nav('vehicle/' + job.id)
    };
    main.querySelectorAll('[data-act]').forEach(b =>
      b.addEventListener('click', () => acts[b.dataset.act] && acts[b.dataset.act]()));
  }
}

function renderParts(main) {
  const waiting = state.vehicles.filter(v => v.status === 'Waiting Parts');
  waiting.sort((a, b) => a.statusSince - b.statusSince);

  const statusColor = s =>
    s === 'Delayed' ? 'red' : s === 'Ordered' || s === 'Needed' ? 'yellow' : 'green';

  const rows = waiting.map(v => `
    <div class="tech-card" style="align-items:flex-start">
      <div style="flex:1;min-width:0">
        <strong style="cursor:pointer" data-open-link="${v.id}">${esc(v.ro)} · ${esc(v.year)} ${esc(v.make)} ${esc(v.model)}</strong>
        <div class="meta">
          ${esc(v.customer)} · Tech: ${esc(techName(v.techId))} · Advisor: ${esc(v.advisor)}<br>
          ${esc(v.concern)}
          ${v.partsNote ? `<br><em>${esc(v.partsNote)}</em>` : ''}
        </div>
        <div class="btn-row" style="margin-top:10px">
          <button class="btn sm secondary" data-parts="Ordered" data-v="${v.id}">Ordered</button>
          <button class="btn sm warn" data-parts="Delayed" data-v="${v.id}">Delayed</button>
          <button class="btn sm secondary" data-parts="Received" data-v="${v.id}">Received</button>
          <button class="btn sm success" data-parts="Ready" data-v="${v.id}">Ready for Tech</button>
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <span class="badge ${statusColor(v.partsStatus || 'Ordered')}">${esc(v.partsStatus || 'Ordered')}</span>
        <div class="meta" style="margin-top:8px">${fmtMin(minutesIn(v))} waiting</div>
      </div>
    </div>`).join('') || '<p class="meta">No vehicles waiting on parts. 🎉</p>';

  const delayed = waiting.filter(v => v.partsStatus === 'Delayed').length;
  const readyCount = waiting.filter(v => ['Received', 'Ready'].includes(v.partsStatus)).length;

  main.innerHTML = `
    ${topbarHTML('parts')}
    <div class="stat-strip">
      <div class="metric"><div class="label">Waiting on Parts</div><div class="value">${waiting.length}</div><div class="note">SLA: ${SLA['Waiting Parts']}m</div></div>
      <div class="metric"><div class="label">Delayed / Backorder</div><div class="value">${delayed}</div><div class="note ${delayed ? 'red' : 'green'}">${delayed ? 'Escalate to manager' : 'None delayed'}</div></div>
      <div class="metric"><div class="label">Staged for Tech</div><div class="value">${readyCount}</div><div class="note green">Notify the tech</div></div>
      <div class="metric"><div class="label">Avg Parts Wait</div><div class="value">${fmtMin(avgBetween('Parts Ordered', 'Parts Received'))}</div><div class="note">Ordered → received</div></div>
    </div>
    <div class="panel section">
      <h2>Parts Queue</h2>
      <div class="section-note">Oldest wait first. "Ready for Tech" tells the technician parts are staged.</div>
      ${rows}
    </div>`;

  main.querySelectorAll('[data-parts]').forEach(b =>
    b.addEventListener('click', () => setPartsStatus(b.dataset.v, b.dataset.parts)));
  main.querySelectorAll('[data-open-link]').forEach(el =>
    el.addEventListener('click', () => nav('vehicle/' + el.dataset.openLink)));
}

function renderAlerts(main) {
  const { red, warn } = computeAlerts();

  const alertHTML = (a, level) => `
    <div class="alert ${level === 'warn' ? 'warn-level' : ''}" data-open-link="${a.vehicle.id}">
      <div>
        <strong>${esc(a.vehicle.ro)} — ${esc(a.reason)}</strong>
        <div class="meta">
          ${esc(a.vehicle.year)} ${esc(a.vehicle.make)} ${esc(a.vehicle.model)} · ${esc(a.vehicle.customer)}<br>
          ${fmtMin(a.minutes)} in ${esc(a.vehicle.status)} (limit ${a.limit}m) · Owner: <strong>${esc(a.owner)}</strong>
        </div>
      </div>
      <span class="badge ${level === 'warn' ? 'yellow' : 'red'}">+${fmtMin(Math.max(0, a.minutes - a.limit)) === '—' ? '' : ''}${a.minutes >= a.limit ? fmtMin(a.minutes - a.limit) + ' over' : fmtMin(a.limit - a.minutes) + ' left'}</span>
    </div>`;

  main.innerHTML = `
    ${topbarHTML('alerts', `<span class="pill" style="${red.length ? 'background:rgba(255,95,87,.12);border-color:rgba(255,95,87,.3);color:#ffb4af' : ''}">${red.length} active · ${warn.length} approaching</span>`)}
    <div class="grid-2">
      <div class="panel section">
        <h2>🔴 Over SLA — act now</h2>
        ${red.map(a => alertHTML(a, 'red')).join('') || '<p class="meta">Nothing over SLA. The floor is flowing.</p>'}
      </div>
      <div class="panel section">
        <h2>🟡 Approaching SLA — watchlist</h2>
        ${warn.map(a => alertHTML(a, 'warn')).join('') || '<p class="meta">No vehicles approaching their limit.</p>'}
      </div>
    </div>
    <br>
    <div class="panel section">
      <h2>Alert Rules</h2>
      <table class="data">
        <tr><th>Stage</th><th>Alert fires after</th><th>Who owns it</th></tr>
        ${['Waiting Dispatch', 'Assigned', 'Waiting Approval', 'Waiting Parts', 'QC', 'Wash'].map(s => `
          <tr><td>${s}</td><td>${SLA[s]} minutes</td><td>${STAGE_OWNER[s]}</td></tr>`).join('')}
      </table>
    </div>`;

  main.querySelectorAll('[data-open-link]').forEach(el =>
    el.addEventListener('click', () => nav('vehicle/' + el.dataset.openLink)));
}

function renderAnalytics(main) {
  const delivered = state.vehicles.filter(v => v.status === 'Delivered');

  const kpis = [
    ['Avg Check-In Time', avgBetween('Arrival', 'Check-In Complete'), 5],
    ['Avg Time to Tech', avgBetween('Arrival', 'Technician Assigned'), 15],
    ['Avg Approval Time', avgBetween('Estimate Sent', 'Customer Approved'), 30],
    ['Avg Parts Wait', avgBetween('Parts Ordered', 'Parts Received'), 30],
    ['Avg Repair Time', avgBetween('Repair Started', 'Repair Completed'), 120],
    ['Avg Total Cycle', avgBetween('Arrival', 'Delivered', delivered), 240]
  ];

  const kpiHTML = kpis.map(([label, val, target]) => {
    const color = val == null ? '' : val <= target ? 'green' : val <= target * 1.4 ? 'yellow' : 'red';
    return `
      <div class="metric">
        <div class="label">${label}</div>
        <div class="value">${fmtMin(val)}</div>
        <div class="note ${color}">Target: ${fmtMin(target)}</div>
      </div>`;
  }).join('');

  // Bottlenecks by department: average current wait of active vehicles in each
  // gate stage, shown as % of that stage's SLA.
  const deptStages = {
    'Dispatch': ['Waiting Dispatch'],
    'Tech Start': ['Assigned'],
    'Approval': ['Waiting Approval'],
    'Parts': ['Waiting Parts'],
    'QC / Wash': ['QC', 'Wash']
  };

  const deptRows = Object.entries(deptStages).map(([dept, stages]) => {
    const pool = activeVehicles().filter(v => stages.includes(v.status));
    const avg = pool.length ? pool.reduce((s, v) => s + minutesIn(v), 0) / pool.length : 0;
    const sla = SLA[stages[0]];
    const pct = Math.min(135, Math.round((avg / sla) * 100));
    const cls = pct >= 100 ? 'over' : pct >= 70 ? 'near' : 'ok';
    return `
      <div class="hbar-row">
        <div class="hbar-label">${dept} <span style="color:var(--faint)">(${pool.length})</span></div>
        <div class="bar"><div class="fill ${cls}" style="width:${Math.max(3, pct)}%"></div></div>
        <div class="hbar-value">${fmtMin(avg)}</div>
      </div>`;
  }).join('');

  const utilRows = state.techs.map(t => {
    const st = techStatus(t);
    const target = 6; // jobs/day benchmark for the utilization meter
    const pct = Math.min(100, Math.round((t.jobsToday / target) * 100));
    return `
      <div class="hbar-row">
        <div class="hbar-label">${t.name.split(' ')[0]} <span style="color:var(--faint)">· ${st}</span></div>
        <div class="bar"><div class="fill" style="width:${Math.max(3, pct)}%"></div></div>
        <div class="hbar-value">${t.jobsToday}/${target}</div>
      </div>`;
  }).join('');

  const totalJobs = state.techs.reduce((s, t) => s + t.jobsToday, 0);
  const busy = state.techs.filter(t => techStatus(t) !== 'Available').length;

  main.innerHTML = `
    ${topbarHTML('analytics')}
    <div class="stat-strip">${kpiHTML}</div>
    <div class="stat-strip">
      <div class="metric"><div class="label">Completed Today</div><div class="value">${delivered.length}</div><div class="note green">Delivered to customer</div></div>
      <div class="metric"><div class="label">Tech Utilization</div><div class="value">${Math.round((busy / state.techs.length) * 100)}%</div><div class="note">${busy} of ${state.techs.length} techs on a job</div></div>
      <div class="metric"><div class="label">Jobs Completed (Techs)</div><div class="value">${totalJobs}</div><div class="note">Across all technicians</div></div>
      <div class="metric"><div class="label">Active Vehicles</div><div class="value">${activeVehicles().length}</div><div class="note">On the floor right now</div></div>
    </div>
    <div class="grid-2">
      <div class="panel section">
        <h2>Bottlenecks by Department</h2>
        <div class="section-note">Average time vehicles are currently waiting in each gate, vs. that gate's SLA. Red = over SLA.</div>
        ${deptRows}
      </div>
      <div class="panel section">
        <h2>Technician Throughput</h2>
        <div class="section-note">Jobs completed today against a 6-job benchmark.</div>
        ${utilRows}
      </div>
    </div>`;
}

/* ---------------- vehicle detail ---------------- */

const FULL_TIMELINE = [
  'Arrival', 'Check-In Complete', 'Sent to Dispatch', 'Technician Assigned',
  'Diagnosis Started', 'Diagnosis Completed', 'Estimate Sent', 'Customer Approved',
  'Parts Ordered', 'Parts Received', 'Repair Started', 'Repair Completed',
  'QC Started', 'QC Passed', 'Wash Started', 'Ready for Delivery', 'Delivered'
];

function nextActionsHTML(v) {
  const A = (label, stage, cls, extra) =>
    `<button class="btn ${cls || ''}" data-advance="${stage}" ${extra ? `data-extra="${extra}"` : ''}>${label}</button>`;
  switch (v.status) {
    case 'Arrived': return A('Complete Check-In', 'Checked In');
    case 'Checked In': return A('Send to Dispatch', 'Waiting Dispatch');
    case 'Waiting Dispatch': return `<button class="btn" data-goto="dispatch">Open Dispatch Board to Assign</button>`;
    case 'Assigned': return A('Start Diagnosis', 'Diagnosis', 'success');
    case 'Diagnosis': return A('Complete Diagnosis — Send Estimate', 'Waiting Approval');
    case 'Waiting Approval':
      return A('Customer Approved — Order Parts', 'Waiting Parts') +
             A('Customer Approved — Straight to Repair', 'Repair', 'secondary');
    case 'Waiting Parts': return A('Parts Received — Start Repair', 'Repair', 'success', 'Parts Received');
    case 'Repair': return A('Complete Repair — Send to QC', 'QC');
    case 'QC': return A('QC Passed — Send to Wash', 'Wash');
    case 'Wash': return A('Wash Done — Mark Ready', 'Ready');
    case 'Ready': return A('Customer Picked Up — Delivered', 'Delivered', 'success');
    default: return '<span class="badge green">✓ Delivered — job complete</span>';
  }
}

function renderVehicleDetail(main, id) {
  const v = vehicleById(id);
  if (!v) {
    main.innerHTML = `${topbarHTML('vehicle')}<div class="panel section"><p class="meta">Vehicle not found. <a href="#/dashboard">Back to Command Center</a></p></div>`;
    return;
  }

  const recorded = [...v.events].sort((a, b) => a.at - b.at);
  const lastRecordedAt = recorded.length ? recorded[recorded.length - 1].at : null;

  const steps = FULL_TIMELINE.map(label => {
    const at = evAt(v, label);
    if (at != null) {
      const later = recorded.filter(e => e.at > at);
      const isCurrent = at === lastRecordedAt && v.status !== 'Delivered';
      const dur = later.length ? (later[0].at - at) / 60000 : (Date.now() - at) / 60000;
      return `
        <div class="timeline-step ${isCurrent ? 'current' : 'done'}">
          <div class="step-head">
            <strong>${label}</strong>
            <span class="step-time">${fmtClock(at)} · ${isCurrent ? fmtMin(dur) + ' and counting' : fmtMin(dur) + ' in step'}</span>
          </div>
          ${isCurrent ? `<div class="meta" style="margin-top:4px">Current stage: <span class="badge ${severity(v)}">${esc(v.status)}</span></div>` : ''}
        </div>`;
    }
    // Not recorded: skipped if a later milestone already happened, else pending.
    const idx = FULL_TIMELINE.indexOf(label);
    const laterDone = FULL_TIMELINE.slice(idx + 1).some(l => evAt(v, l) != null);
    return `
      <div class="timeline-step pending">
        <div class="step-head">
          <strong>${label}</strong>
          <span class="step-time">${laterDone ? 'Skipped' : 'Pending'}</span>
        </div>
      </div>`;
  }).join('');

  const sev = severity(v);
  main.innerHTML = `
    <div class="topbar">
      <div>
        <h1>${esc(v.ro)} · ${esc(v.year)} ${esc(v.make)} ${esc(v.model)}</h1>
        <div class="sub">${[esc(v.customer), esc(v.phone), v.vin ? 'VIN ' + esc(v.vin) : '', v.mileage ? esc(v.mileage) + ' mi' : ''].filter(Boolean).join(' · ')}</div>
      </div>
      <div class="topbar-right">
        <span class="badge ${PRIORITY_COLOR[v.priority] || ''}" style="font-size:13px">${esc(v.priority)}</span>
        <span class="badge ${sev}" style="font-size:13px">${fmtMin(minutesIn(v))} in ${esc(v.status)}</span>
        <button class="btn secondary sm" onclick="history.back()">← Back</button>
      </div>
    </div>
    <div class="split">
      <div class="panel section">
        <h2>Timeline — Arrival to Delivery</h2>
        <div class="timeline">${steps}</div>
      </div>
      <div>
        <div class="panel section">
          <h2>Job Details</h2>
          <table class="data">
            <tr><td class="meta">Concern</td><td>${esc(v.concern)}</td></tr>
            <tr><td class="meta">Advisor</td><td>${esc(v.advisor)}</td></tr>
            <tr><td class="meta">Technician</td><td>${esc(techName(v.techId))}</td></tr>
            <tr><td class="meta">Visit</td><td>${esc(v.visitType)} · Customer ${esc(v.custStatus)}</td></tr>
            <tr><td class="meta">Parts</td><td>${esc(v.partsStatus || 'None needed yet')}${v.partsNote ? ' — ' + esc(v.partsNote) : ''}</td></tr>
            <tr><td class="meta">Total time in shop</td><td>${fmtMin((Date.now() - (evAt(v, 'Arrival') || v.statusSince)) / 60000)}</td></tr>
            ${v.flag ? `<tr><td class="meta">⚑ Flag</td><td style="color:var(--red)">${esc(v.flag)}</td></tr>` : ''}
          </table>
        </div>
        <br>
        <div class="panel section">
          <h2>Next Action</h2>
          <div class="btn-row" style="margin-top:0">${nextActionsHTML(v)}</div>
          <div class="btn-row">
            <button class="btn danger sm" id="flagBtn">⚑ ${v.flag ? 'Update Flag' : 'Flag Issue'}</button>
          </div>
        </div>
      </div>
    </div>`;

  main.querySelectorAll('[data-advance]').forEach(b => b.addEventListener('click', () => {
    const extra = b.dataset.extra ? [b.dataset.extra] : undefined;
    advance(v.id, b.dataset.advance, extra);
  }));
  const gotoBtn = main.querySelector('[data-goto]');
  if (gotoBtn) gotoBtn.addEventListener('click', () => nav(gotoBtn.dataset.goto));
  document.getElementById('flagBtn').addEventListener('click', () => flagIssue(v.id));
}

/* ---------------- toast ---------------- */

function toast(msg) {
  let holder = document.getElementById('toast');
  if (!holder) {
    holder = document.createElement('div');
    holder.id = 'toast';
    document.body.appendChild(holder);
  }
  const el = document.createElement('div');
  el.className = 'toast-msg';
  el.textContent = msg;
  holder.appendChild(el);
  setTimeout(() => el.remove(), 3800);
}

/* ---------------- boot ---------------- */

window.addEventListener('hashchange', render);

// Live tick: stage timers, severities, and alerts refresh every 30s.
setInterval(() => {
  const r = route();
  // Don't clobber half-filled forms.
  if (['intake', 'login'].includes(r.page)) return;
  render();
}, 30000);

render();
