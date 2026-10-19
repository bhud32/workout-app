/* Local-first store (localStorage is the source of truth) + optional sync to a remote JSON endpoint
   (Google Apps Script web app -> Google Sheet, or the bundled box server.js). */
(function (root) {
  const C = root.Calc, P = root.Prog;
  const LS = 'wk.data.v1', LSS = 'wk.settings.v1';
  const TYPES = ['sessions', 'bodycomp', 'profiles', 'mobility'];
  const PROFILE_COLUMNS = ['date', 'week', 'lift', 'load_lb', 'best_MV', 'slope', 'intercept', 'r2', 'load_at_1.00', 'load_at_0.85', 'load_at_0.70', 'load_at_0.60', 'load_at_0.50', 'record_id'];
  const MOB_COLUMNS = ['date', 'routine', 'minutes', 'steps_done', 'record_id'];
  const defaults = { startDate: '2026-10-19', theme: 'dark', syncUrl: '', syncToken: '', autoSync: true, lastPush: 0, lastSync: 0, lastSyncMsg: '', deviceId: '', activeSession: null, sound: true, vibrate: true };
  let data = { sessions: [], bodycomp: [], profiles: [], mobility: [] };
  let settings = Object.assign({}, defaults);
  let listeners = [];
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function load() {
    try { const d = JSON.parse(localStorage.getItem(LS) || 'null'); if (d) TYPES.forEach((t) => { data[t] = d[t] || []; }); } catch (e) { console.warn('data load failed', e); }
    try { const s = JSON.parse(localStorage.getItem(LSS) || 'null'); if (s) settings = Object.assign({}, defaults, s); } catch (e) { /* ignore */ }
    if (!settings.deviceId) { settings.deviceId = 'dev-' + uid(); saveSettings(); }
  }
  let persistT = null;
  function persistNow() { clearTimeout(persistT); persistT = null; try { localStorage.setItem(LS, JSON.stringify(data)); } catch (e) { alert('Storage full or blocked: export your data now!'); } }
  function persist() { if (!persistT) persistT = setTimeout(persistNow, 120); }
  function saveSettings() { localStorage.setItem(LSS, JSON.stringify(settings)); }
  root.addEventListener('pagehide', persistNow);
  document.addEventListener('visibilitychange', () => { if (document.hidden) persistNow(); });

  function touch(rec) { rec.updatedAt = Date.now(); persist(); scheduleSync(); return rec; }
  function add(type, rec) { rec.id = rec.id || uid(); data[type].push(touch(rec)); return rec; }
  function remove(type, id) { const r = data[type].find((x) => x.id === id); if (r) { r.deleted = true; touch(r); } }
  const live = (type) => data[type].filter((r) => !r.deleted);
  const all = () => TYPES.reduce((a, t) => a.concat(data[t].map((r) => Object.assign({ _t: t }, r))), []);

  // ---------- export / import ----------
  function exportJSON() { return JSON.stringify({ app: 'brandon-workout', version: 1, exportedAt: new Date().toISOString(), startDate: settings.startDate, data }, null, 1); }
  function importJSON(text) {
    const j = JSON.parse(text); const src = j.data || j; let n = 0;
    TYPES.forEach((t) => { if (Array.isArray(src[t])) { const m = C.mergeRecords(data[t], src[t]); data[t] = m.list; n += m.changed; } });
    if (j.startDate) { settings.startDate = j.startDate; saveSettings(); }
    persistNow(); emit(); return n;
  }
  function trainingCSV() {
    const rows = [];
    live('sessions').sort((a, b) => (a.date + a.startedAt) < (b.date + b.startedAt) ? -1 : 1).forEach((s) => C.sessionRows(s, P.resolve(s.week, s.day)).forEach((r) => rows.push(r)));
    return C.toCSV(C.COLUMNS, rows);
  }
  function bodyCSV() { return C.toCSV(C.BODY_COLUMNS, live('bodycomp').sort((a, b) => (a.date < b.date ? -1 : 1)).map(C.bodyRow)); }
  function prefilledCSV(week, day) { // blank per-set rows for fill-in-Excel fallback
    const r = P.resolve(week, day); const rows = [];
    r.exercises.forEach((ex) => { if (ex.kind === 'check') return; const n = ex.kind === 'ramp' ? 6 : ex.setSpecs.length;
      for (let i = 0; i < n; i++) { const row = C.COLUMNS.map(() => ''); row[1] = week; row[2] = day; row[11] = ex.name; row[13] = i + 1; row[14] = ex.setSpecs[i] ? ex.setSpecs[i].reps : ''; row[20] = ex.rest || ''; row[28] = ex.id; rows.push(row); } });
    return C.toCSV(C.COLUMNS, rows);
  }
  function importCSV(text) {
    const rows = C.parseCSV(text); if (rows.length < 2) return { sessions: 0, body: 0, skipped: 0 };
    const h = rows[0].map((x) => x.trim()); const ix = (n) => h.indexOf(n);
    const out = { sessions: 0, body: 0, skipped: 0 };
    if (ix('bodyweight_lb') >= 0) {
      rows.slice(1).forEach((r) => { const date = r[ix('date_measured')]; if (!date) return; const rid = (ix('record_id') >= 0 && r[ix('record_id')]) || 'csv-body-' + date;
        const prev = data.bodycomp.find((b) => b.id === rid);
        const rec = Object.assign(prev || { id: rid }, { deleted: false, date, weight: C.num(r[ix('bodyweight_lb')]), bf: C.num(r[ix('body_fat_pct')]), muscle: C.num(r[ix('muscle_mass_lb')]), waist: C.num(r[ix('waist_navel_in')]), notes: r[ix('notes')] || '' });
        if (!prev) data.bodycomp.push(rec); touch(rec); out.body++; });
      persistNow(); emit(); return out;
    }
    const groups = {};
    rows.slice(1).forEach((r) => { const g = (k) => r[ix(k)]; const date = g('date'); if (!date) { out.skipped++; return; }
      const sid = (ix('session_id') >= 0 && g('session_id')) || 'csv-' + date + '-' + g('week') + g('day'); (groups[sid] = groups[sid] || []).push(r); });
    Object.keys(groups).forEach((sid) => {
      const rs = groups[sid]; const g = (r, k) => (ix(k) >= 0 ? r[ix(k)] : ''); const f = rs[0]; const week = parseInt(g(f, 'week'), 10) || 1; const day = g(f, 'day') || 'A';
      const res = P.resolve(week, day);
      let s = data.sessions.find((x) => x.id === sid);
      if (!s) { s = { id: sid, date: g(f, 'date'), week, day, status: 'done', startedAt: Date.parse(g(f, 'date')) || Date.now(), ex: {}, hdr: {}, ready: {}, finish: {} }; data.sessions.push(s); }
      s.deleted = false; s.status = 'done';
      s.hdr = { sleep: C.num(g(f, 'sleep_h')), readiness: C.num(g(f, 'readiness_1to5')), soreness: C.num(g(f, 'soreness_0to10')), sorenessLoc: g(f, 'soreness_location') };
      s.finish = { minutes: C.num(g(f, 'session_min')), rpe: C.num(g(f, 'session_RPE')), srpe: C.num(g(f, 'sRPE_load')), pain: 0, painLoc: '', notes: '' };
      rs.forEach((r) => {
        let ex = res.exercises.find((e) => e.id === g(r, 'ex_id')) || res.exercises.find((e) => e.name === g(r, 'exercise'));
        if (!ex) { out.skipped++; return; }
        const d = (s.ex[ex.id] = s.ex[ex.id] || { sets: ex.setSpecs.map(() => ({})), ramp: [] }); const i = (parseInt(g(r, 'set'), 10) || 1) - 1;
        const vals = { load: C.num(g(r, 'load_lb')), reps: C.num(g(r, 'reps')), mv1: C.num(g(r, 'first_rep_MV')), mvl: C.num(g(r, 'last_rep_MV')), rir: g(r, 'RIR'), metric: C.num(g(r, 'power_metric(height/dist/watts)')), secs: C.num(g(r, 'secs')), dist: C.num(g(r, 'dist_m')) };
        if (g(r, 'notes') === 'ramp') d.ramp[i] = { load: vals.load, reps: vals.reps, mv: C.num(g(r, 'best_MV')) || vals.mv1 };
        else { d.sets[i] = Object.assign(d.sets[i] || {}, vals, { done: true }); }
      });
      touch(s); out.sessions++;
    });
    persistNow(); emit(); return out;
  }

  // ---------- sync ----------
  let syncT = null, syncing = false;
  function wrapItem(t, r) {
    const rec = Object.assign({}, r); delete rec._t; rec.type = t;
    const item = { record: rec };
    if (t === 'sessions') { item.sheet = 'log'; item.keyCol = 'session_id'; item.columns = C.COLUMNS; item.rows = r.deleted ? [] : C.sessionRows(r, P.resolve(r.week, r.day)); }
    else if (t === 'bodycomp') { item.sheet = 'bodycomp'; item.keyCol = 'record_id'; item.columns = C.BODY_COLUMNS; item.rows = r.deleted ? [] : [C.bodyRow(r)]; }
    else if (t === 'profiles') { item.sheet = 'profiles'; item.keyCol = 'record_id'; item.columns = PROFILE_COLUMNS; const f = r.fit || {}; const lt = C.loadsTable(f.slope != null ? f : null);
      item.rows = r.deleted ? [] : (r.points || []).map((p) => [r.date, r.week, r.lift, p.load, p.mv, C.r1(f.slope, 5), C.r1(f.intercept, 4), C.r1(f.r2, 3)].concat(lt.map((x) => (x.load != null ? Math.round(x.load) : ''))).concat([r.id])); }
    else if (t === 'mobility') { item.sheet = 'mobility'; item.keyCol = 'record_id'; item.columns = MOB_COLUMNS; item.rows = r.deleted ? [] : [[r.date, r.routine, r.minutes, r.stepsDone, r.id]]; }
    return item;
  }
  function scheduleSync() { if (!settings.syncUrl || !settings.autoSync) return; clearTimeout(syncT); syncT = setTimeout(() => { syncNow().catch(() => {}); }, 4000); }
  async function syncNow() {
    if (!settings.syncUrl) throw new Error('No sync URL set');
    if (syncing) return; syncing = true; setStatus('syncing');
    const t0 = Date.now();
    try {
      const sep = settings.syncUrl.includes('?') ? '&' : '?';
      const pr = await fetch(settings.syncUrl + sep + 'action=pull&token=' + encodeURIComponent(settings.syncToken), { redirect: 'follow' });
      const pj = await pr.json(); if (!pj.ok) throw new Error(pj.error || 'pull failed');
      const byType = {}; TYPES.forEach((t) => { byType[t] = []; });
      (pj.records || []).forEach((r) => { const t = r.type; if (byType[t]) byType[t].push(r); });
      let changed = 0; TYPES.forEach((t) => { const m = C.mergeRecords(data[t], byType[t]); data[t] = m.list; changed += m.changed; });
      const items = []; TYPES.forEach((t) => data[t].forEach((r) => { if ((r.updatedAt || 0) > settings.lastPush) items.push(wrapItem(t, r)); }));
      if (items.length) {
        const res = await fetch(settings.syncUrl, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'push', token: settings.syncToken, deviceId: settings.deviceId, items }) });
        const rj = await res.json(); if (!rj.ok) throw new Error(rj.error || 'push failed');
      }
      settings.lastPush = t0; settings.lastSync = Date.now(); settings.lastSyncMsg = 'OK: pulled ' + changed + ', pushed ' + items.length; saveSettings(); persistNow(); setStatus('ok'); if (changed) emit();
      return { pulled: changed, pushed: items.length };
    } catch (e) { settings.lastSyncMsg = 'Error: ' + e.message; saveSettings(); setStatus('err'); throw e; }
    finally { syncing = false; }
  }
  let status = 'idle'; function setStatus(s) { status = s; listeners.forEach((f) => f('status')); }
  function emit() { listeners.forEach((f) => f('data')); }
  function onChange(f) { listeners.push(f); }
  function resetAll() { TYPES.forEach((t) => { data[t] = []; }); settings.lastPush = 0; settings.activeSession = null; saveSettings(); persistNow(); emit(); }

  root.Store = { load, get data() { return data; }, get settings() { return settings; }, saveSettings, touch, add, remove, live, all, uid, persistNow, exportJSON, importJSON, trainingCSV, bodyCSV, prefilledCSV, importCSV, syncNow, scheduleSync, onChange, emit, get status() { return status; }, resetAll, PROFILE_COLUMNS };
})(typeof self !== 'undefined' ? self : this);
