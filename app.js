/* Brandon's 12-week VBT workout runner. Vanilla JS, no build step. */
(function () {
'use strict';
const P = Prog.PROGRAM, C = Calc, St = Store;
St.load();
const S = St.settings;
const $ = (s, el) => (el || document).querySelector(s);
const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const parseYmd = (s) => { const a = s.split('-').map(Number); return new Date(a[0], a[1] - 1, a[2]); };
const todayStr = () => ymd(new Date());
const fmtDate = (s) => parseYmd(s).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const mmss = (sec) => { sec = Math.max(0, Math.round(sec)); return Math.floor(sec / 60) + ':' + pad(sec % 60); };
const view = $('#view');
const DAYN = { A: 'Mon', B: 'Wed', C: 'Fri' };
const LIFTNAMES = {};
Object.values(P.DAYS).forEach((d) => d.list.forEach((e) => { if (e.lift && !LIFTNAMES[e.lift]) LIFTNAMES[e.lift] = e.name.replace(/\s*\(.*$/, ''); }));
LIFTNAMES.trapbar = 'Trap bar deadlift'; LIFTNAMES.floorpress = 'Floor press'; LIFTNAMES.chinup = 'Chin-up'; LIFTNAMES.hkpress = '1-arm DB press'; LIFTNAMES.rowint = 'Rower intervals'; LIFTNAMES.stepup = 'Step-up'; LIFTNAMES.ytraise = 'Y-T raise / face pull'; LIFTNAMES.carry = 'Suitcase carry'; LIFTNAMES.sideplank = 'Side plank'; LIFTNAMES.pullup = 'Pull-up';

// ---------- toast / audio / vibration / wake lock ----------
let toastT = null;
function toast(msg, ms) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, ms || 2600); }
let actx = null;
function audio() { try { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (e) { /* none */ } return actx; }
function beep(freq, n, dur) {
  window.__beeps = (window.__beeps || 0) + (n || 1);
  if (!S.sound) return; const c = audio(); if (!c) return;
  for (let k = 0; k < (n || 1); k++) { const o = c.createOscillator(), g = c.createGain(); o.frequency.value = freq || 880; o.type = 'sine'; o.connect(g); g.connect(c.destination);
    const t0 = c.currentTime + k * 0.25; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + (dur || 0.18)); o.start(t0); o.stop(t0 + (dur || 0.18) + 0.02); }
}
function vib(p) { window.__vibes = (window.__vibes || 0) + 1; if (S.vibrate && navigator.vibrate) { try { navigator.vibrate(p); } catch (e) { /* ignore */ } } }
let wl = null, wakeWanted = false;
async function wake() { wakeWanted = true; try { if ('wakeLock' in navigator && !wl) { wl = await navigator.wakeLock.request('screen'); window.__wakeLock = true; wl.addEventListener('release', () => { wl = null; window.__wakeLock = false; }); } } catch (e) { window.__wakeLockErr = String(e); } }
function unwake() { wakeWanted = false; try { if (wl) wl.release(); } catch (e) { /* ignore */ } wl = null; window.__wakeLock = false; }
document.addEventListener('visibilitychange', () => { if (!document.hidden && wakeWanted) wake(); if (!document.hidden && S.syncUrl) St.syncNow().catch(() => {}); });
document.addEventListener('pointerdown', () => { audio(); }, { once: true });

// ---------- session helpers ----------
const sessions = () => St.live('sessions');
const getSession = (id) => St.data.sessions.find((s) => s.id === id && !s.deleted);
function startSession(week, day) {
  let s = sessions().find((x) => x.status === 'active' && x.week === week && x.day === day);
  if (!s) { s = St.add('sessions', { type: 'session', date: todayStr(), week, day, status: 'active', startedAt: Date.now(), hdr: {}, ready: {}, ex: {}, finish: {} }); }
  S.activeSession = s.id; St.saveSettings(); location.hash = '#/session/' + s.id;
}
function exData(s, ex) {
  let d = s.ex[ex.id];
  if (!d) d = s.ex[ex.id] = { sets: [], ramp: [] };
  const n = ex.kind === 'ramp' ? 0 : ex.setSpecs.length;
  while (d.sets.length < n) d.sets.push({});
  return d;
}
function isDone(s, ex, i) { const d = s.ex[ex.id]; if (!d) return false; if (ex.kind === 'ramp') return !!d.rampSaved; return !!(d.sets && d.sets[i] && d.sets[i].done); }
function sessStatus(s, R) {
  const exm = {}; R.exercises.forEach((e) => { exm[e.id] = e; });
  return R.steps.map((st) => ({ st, ex: exm[st.ex], done: isDone(s, exm[st.ex], st.i) }));
}
// history index: lift -> [{sid,date,ts,sets:[done sets], ramp:[]}] oldest -> newest
function buildHist() {
  const h = {};
  sessions().forEach((s) => { const R = Prog.resolve(s.week, s.day);
    R.exercises.forEach((ex) => { const d = s.ex[ex.id]; if (!d || !ex.lift) return; const sets = (d.sets || []).map((x, i) => Object.assign({ i }, x)).filter((x) => x.done);
      const ramp = (d.ramp || []).filter((r) => r.done && r.load != null);
      if (!sets.length && !ramp.length) return;
      const arr = (h[ex.lift] = h[ex.lift] || []); const ex0 = arr.find((x) => x.sid === s.id);
      if (ex0) { ex0.sets = ex0.sets.concat(sets); ex0.ramp = ex0.ramp.concat(ramp); if (ex.kind === 'reps' && ex0.ex.kind !== 'reps') { ex0.ex = ex; ex0.exid = ex.id; } }
      else arr.push({ sid: s.id, date: s.date, ts: s.startedAt || 0, sets, ramp, exid: ex.id, ex }); }); });
  Object.values(h).forEach((a) => a.sort((x, y) => (x.date + String(x.ts).padStart(15, '0')) < (y.date + String(y.ts).padStart(15, '0')) ? -1 : 1));
  return h;
}
function lastOf(hist, lift, sid) { const a = (hist[lift] || []).filter((x) => x.sid !== sid); return a.length ? a[a.length - 1] : null; }
function latestProfile(lift) { const a = St.live('profiles').filter((p) => p.lift === lift && p.fit).sort((x, y) => (x.date + x.updatedAt) < (y.date + y.updatedAt) ? -1 : 1); return a.length ? a[a.length - 1] : null; }
function firstProfile(lift) { const a = St.live('profiles').filter((p) => p.lift === lift && p.fit).sort((x, y) => (x.date + x.updatedAt) < (y.date + y.updatedAt) ? -1 : 1); return a.length ? a[0] : null; }
const unitOf = (ex) => ({ 'in': 'in', 'ft': 'ft', 'watts': 'W', 'box in': 'box in', 'reps': 'reps' }[ex.metric] || ex.metric || '');
function fieldsFor(ex) {
  switch (ex.kind) {
    case 'reps': return ex.vbt ? ['load', 'reps', 'rir'] : ['load', 'reps', 'rir'];
    case 'timed': return ['secs'];
    case 'carry': return ['load', 'dist'];
    case 'power': return ex.lift === 'tbjump' ? ['load', 'metric'] : (ex.metric === 'reps' ? ['reps'] : ['metric']);
    case 'interval': return ex.lift === 'kbswing' ? ['load', 'reps'] : ['metric'];
    default: return [];
  }
}
const FCAP = { load: 'lb', reps: 'reps', rir: 'RIR', secs: 'sec', dist: 'm', metric: '' };
function loadHint(ex, s, hist) { // numeric load suggestion text + {lo,hi}
  const spec = ex.setSpecs[0] || {};
  const ramp = s.ex[ex.lift === 'floorpress' ? 'fp_ramp' : 'tb_ramp'];
  if (ex.wkSpec && ex.wkSpec.hintPct && ramp) {
    const rows = (ramp.ramp || []).filter((r) => r.done && r.load); const mx = rows.length ? Math.max(...rows.map((r) => r.load)) : null;
    if (mx) return { lo: C.round5(mx * ex.wkSpec.hintPct[0] / 100), hi: C.round5(mx * ex.wkSpec.hintPct[1] / 100), txt: 'Heaviest ramp ' + mx + ' lb \u2192 ' + ex.wkSpec.hintPct.join('-') + '% = ' + C.round5(mx * ex.wkSpec.hintPct[0] / 100) + '-' + C.round5(mx * ex.wkSpec.hintPct[1] / 100) + ' lb' };
  }
  if (ex.profile && spec.vel) { const pr = latestProfile(ex.profile); if (pr) { const hi = spec.vel[1], lo = spec.vel[0]; const a = hi != null ? C.loadAtV(pr.fit, hi) : null, b = C.loadAtV(pr.fit, lo);
    if (b != null) { const A = a != null ? C.round5(a) : null, B = C.round5(b); return { lo: A != null ? A : B, hi: B, txt: 'Your profile: ' + (A != null ? A + '-' : '\u2265') + B + ' lb \u2248 ' + (hi != null ? lo.toFixed(2) + '-' + hi.toFixed(2) : lo.toFixed(2) + '+') + ' m/s' }; } } }
  if (ex.profile && ex.wkSpec && ex.wkSpec.segs) { /* top/back-off sets without numeric band for floor press: no hint */ }
  return null;
}
function prefill(s, ex, i, hist) {
  const out = {}; const d = s.ex[ex.id]; const f = fieldsFor(ex);
  const prev = d && d.sets ? d.sets.slice(0, i).reverse().find((x) => x && x.done) : null;
  const last = lastOf(hist, ex.lift, s.id); const ls = last ? (last.sets[i] || last.sets[last.sets.length - 1]) : null;
  const src = prev || ls;
  if (src) { ['load', 'metric', 'dist'].forEach((k) => { if (src[k] != null) out[k] = src[k]; }); if (ex.kind === 'timed' && src.secs != null && !prev) out.secs = src.secs; }
  if (out.load == null && f.includes('load') && ex.load0) out.load = ex.load0;
  if (out.load == null && f.includes('load')) { const lh = loadHint(ex, s, hist); if (lh) out.load = Math.round((lh.lo + lh.hi) / 2 / 5) * 5; }
  const sp = ex.setSpecs[i] || {};
  const top = C.topNum(sp.reps);
  if (f.includes('reps') && top != null) out.reps = prev && prev.reps != null && ex.kind === 'reps' && !/-/.test(String(sp.reps)) ? top : top;
  if (ex.kind === 'timed' && out.secs == null && top != null && sp.reps !== 'max') out.secs = top;
  if (ex.kind === 'carry' && out.dist == null && top != null) out.dist = top;
  return out;
}
function prCheck(hist, s, ex, set, i) {
  const prior = (hist[ex.lift] || []).filter((h) => h.sid !== s.id); if (!prior.length) return [];
  const out = []; const sets = prior.reduce((a, h) => a.concat(h.sets), []);
  const cur = (s.ex[ex.id] ? s.ex[ex.id].sets : []).filter((x, k) => x && x.done && k !== i);
  const pool = sets.concat(cur);
  if (ex.kind === 'reps' && set.load > 0 && set.reps > 0) { const e = C.e1rm(set.load, set.reps); const best = Math.max(0, ...pool.map((x) => C.e1rm(x.load, x.reps) || 0)); if (e > best + 0.4) out.push('PR: est. 1RM ' + Math.round(e) + ' lb (+' + Math.round(e - best) + ')'); }
  else if (ex.kind === 'reps' && !(set.load > 0) && set.reps > 0) { const best = Math.max(0, ...pool.filter((x) => !(x.load > 0)).map((x) => x.reps || 0)); if (set.reps > best && best > 0) out.push('PR: ' + set.reps + ' reps (prev ' + best + ')'); }
  if (ex.kind === 'timed' && set.secs > 0) { const best = Math.max(0, ...pool.map((x) => x.secs || 0)); if (best > 0 && set.secs > best) out.push('PR: ' + set.secs + ' s (prev ' + best + ')'); }
  if (ex.kind === 'power' && set.metric > 0) { const best = Math.max(0, ...pool.map((x) => x.metric || 0)); if (best > 0 && set.metric > best) out.push('PR: ' + set.metric + ' ' + unitOf(ex) + ' (prev ' + best + ')'); }
  if (ex.vbt && set.mv1 > 0 && set.load > 0) { const cand = pool.filter((x) => x.mv1 > 0 && x.load >= set.load - 2.5); const best = Math.max(0, ...cand.map((x) => x.mv1)); if (cand.length && set.mv1 > best + 0.01) out.push('Fastest yet at ' + set.load + '+ lb: ' + set.mv1.toFixed(2) + ' m/s'); }
  return out;
}
function sessionStreak() { // consecutive scheduled sessions completed, counting back from the most recent scheduled slot <= today
  const done = new Set(sessions().filter((s) => s.status === 'done').map((s) => s.week + s.day));
  const slots = []; for (let w = 1; w <= 12; w++) ['A', 'B', 'C'].forEach((d) => slots.push([w, d]));
  const start = parseYmd(S.startDate); const nowD = parseYmd(todayStr());
  const due = slots.filter(([w, d]) => { const dt = new Date(start.getTime() + ((w - 1) * 7 + (P.DAYS[d].dow - 1)) * 864e5); return dt <= nowD; });
  let n = 0; for (let k = due.length - 1; k >= 0; k--) { if (done.has(due[k][0] + due[k][1])) n++; else if (k === due.length - 1) continue; else break; }
  return n;
}

// ---------- timers (rest / hold / interval) ----------
let T = null;   // rest or hold timer {type, endAt, total, next, ...}
let IV = null;  // interval {sid, exId, startAt, work, period, rounds, marked}
let dockMode = '', lastSecTick = -1, nextUp = '';
try { T = JSON.parse(localStorage.getItem('wk.timer') || 'null'); if (T && (Date.now() - T.endAt) > 3600e3) T = null; } catch (e) { T = null; }
const saveT = () => { try { if (T) localStorage.setItem('wk.timer', JSON.stringify(T)); else localStorage.removeItem('wk.timer'); } catch (e) { /* ignore */ } };
function startRest(sec, label) { if (!sec || sec <= 0) { T = null; saveT(); return; } T = { type: 'rest', endAt: Date.now() + sec * 1000, total: sec, label: label || 'REST', fired: false }; saveT(); lastSecTick = -1; renderDock(); }
function startHold(sec, sid, exId, i) { T = { type: 'hold', endAt: Date.now() + sec * 1000, total: sec, label: 'HOLD', sid, exId, i, fired: false }; saveT(); lastSecTick = -1; renderDock(); }
function adjustT(ds) { if (!T) return; T.endAt += ds * 1000; T.total = Math.max(T.total, T.total + ds); T.fired = false; saveT(); }
function clearT() { T = null; saveT(); renderDock(); }
function startInterval(sid, exId) {
  const s = getSession(sid); const R = Prog.resolve(s.week, s.day); const ex = R.exercises.find((e) => e.id === exId);
  IV = { sid, exId, startAt: Date.now() + 5000, work: ex.work, period: ex.work + (ex.rest0 || 0), rounds: ex.setSpecs.length, marked: 0, last: '' };
  audio(); lastSecTick = -1; renderDock();
}
function stopInterval() { IV = null; renderDock(); }
function dockCurrent() { if (IV) return 'iv'; if (T) return T.type; return $('body').classList.contains('sess') ? 'next' : ''; }
function renderDock() {
  const el = $('#dock'); const mode = dockCurrent(); dockMode = mode;
  if (!mode) { el.hidden = true; el.className = ''; el.innerHTML = ''; return; }
  el.hidden = false;
  const nx = '<div class="nx" id="dk-nx"></div>';
  if (mode === 'next') el.innerHTML = '<div class="row sp"><div style="min-width:0;flex:1"><div class="small mut">NEXT UP</div><div id="dk-nx" class="nx" style="font-size:15px;color:var(--tx)"></div></div><div class="tools"><button class="sm" data-act="rest" data-s="60">60s</button><button class="sm" data-act="rest" data-s="90">90s</button><button class="sm" data-act="rest" data-s="120">2m</button></div></div>';
  else if (mode === 'iv') el.innerHTML = '<div class="row sp"><div><div class="small mut" id="dk-lbl"></div><div class="big" id="dk-big"></div></div><div class="tools"><button class="sm bad" data-act="ivstop">Stop</button></div></div>' + nx;
  else el.innerHTML = '<div class="row sp"><div><div class="small mut" id="dk-lbl"></div><div class="big" id="dk-big"></div></div><div class="tools"><button data-act="adj" data-s="-15">\u221215</button><button data-act="adj" data-s="15">+15s</button><button class="pri" data-act="skip">' + (mode === 'hold' ? 'Stop' : 'Skip') + '</button></div></div><div class="bar" style="margin-top:6px"><i id="dk-bar" style="width:0"></i></div>' + nx;
  updateDock();
}
function updateDock() {
  const el = $('#dock'); if (el.hidden) return; const now = Date.now();
  const nxEl = $('#dk-nx'); if (nxEl) nxEl.innerHTML = (dockMode === 'next' ? '' : '<span class="mut">Next:</span> ') + (nextUp || '<span class="mut">\u2014</span>');
  if (dockMode === 'rest' || dockMode === 'hold') {
    const rem = (T.endAt - now) / 1000; const big = $('#dk-big'), lbl = $('#dk-lbl'), bar = $('#dk-bar');
    if (rem > 0) { big.textContent = mmss(Math.ceil(rem)); lbl.textContent = T.label + ' \u00B7 ' + mmss(T.total); bar.style.width = Math.min(100, (1 - rem / T.total) * 100) + '%'; el.className = dockMode === 'hold' ? 'work' : '';
      const sec = Math.ceil(rem); if (sec <= 3 && sec !== lastSecTick) { lastSecTick = sec; beep(660, 1, 0.08); }
    } else {
      if (!T.fired) { T.fired = true; saveT(); beep(988, 3); vib([200, 100, 200, 100, 400]); if (T.type === 'hold') { const sid = T.sid, ex = T.exId, i = T.i; T = null; saveT(); logSet(sid, ex, i, { auto: true }); return; } }
      big.textContent = 'GO +' + mmss(-rem); lbl.textContent = T.type === 'rest' ? 'REST DONE' : 'DONE'; bar.style.width = '100%'; el.className = 'go';
    }
  } else if (dockMode === 'iv' && IV) {
    const big = $('#dk-big'), lbl = $('#dk-lbl'); const el0 = (now - IV.startAt) / 1000;
    if (el0 < 0) { big.textContent = Math.ceil(-el0); lbl.textContent = 'GET READY'; $('#dock').className = ''; const sec = Math.ceil(-el0); if (sec <= 3 && sec !== lastSecTick) { lastSecTick = sec; beep(660, 1, 0.08); } return; }
    const r = Math.floor(el0 / IV.period); const within = el0 - r * IV.period; const inWork = within < IV.work;
    const done = Math.min(IV.rounds, el0 >= IV.work ? Math.floor((el0 - IV.work) / IV.period) + 1 : 0);
    if (done > IV.marked) { const from = IV.marked; IV.marked = done; const sid0 = IV.sid, ex0 = IV.exId; for (let k = from; k < done; k++) logSet(sid0, ex0, k, { auto: true, quiet: true }); if (!IV) return; }
    if (r >= IV.rounds) { const sid = IV.sid; IV = null; beep(988, 3); vib([300, 100, 300]); toast('Intervals complete'); renderDock(); if (location.hash.indexOf('/session/' + sid) >= 0) renderSession(sid, true); return; }
    const ph = (inWork ? 'W' : 'R') + r; if (ph !== IV.last) { IV.last = ph; if (inWork) { beep(1100, 2); vib([150, 80, 150]); } else { beep(520, 1); vib(120); } }
    const rem = inWork ? IV.work - within : IV.period - within;
    big.textContent = mmss(Math.ceil(rem)); lbl.textContent = 'ROUND ' + (r + 1) + '/' + IV.rounds + ' \u00B7 ' + (inWork ? (IV.period === IV.work ? 'ON THE MINUTE' : 'WORK') : 'EASY');
    $('#dock').className = inWork ? 'work' : '';
  }
}
function tick() {
  if (dockMode !== dockCurrent()) renderDock(); else updateDock();
  updateSessHead(); mobTick();
}
setInterval(tick, 250);
$('#dock').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return; const a = b.dataset.act;
  if (a === 'adj') { adjustT(+b.dataset.s); updateDock(); }
  else if (a === 'skip') { if (T && T.type === 'hold') { T = null; saveT(); } else T = null; saveT(); renderDock(); }
  else if (a === 'rest') { startRest(+b.dataset.s, 'REST'); }
  else if (a === 'ivstop') stopInterval();
});

// ---------- SESSION VIEW ----------
let curSid = null, curDone = 0, curTotal = 1, curTarget = 30;
const numOrNull = (v) => C.num(v);
function metaOf(ex) {
  const sp = ex.setSpecs; const parts = [];
  const per = ex.per || '';
  const unit = ex.kind === 'timed' ? ' s' : ex.kind === 'carry' ? ' m' : '';
  if (ex.kind === 'ramp') parts.push('load-velocity ramp');
  else if (ex.kind === 'interval') parts.push(sp.length + (ex.emom ? ' rounds, EMOM (every 60 s)' : ' rounds, ' + ex.work + ' s on / ' + (ex.rest0 || 0) + ' s off'));
  else if (ex.kind === 'check') parts.push((ex.min || '') + ' min');
  else if (ex.wkSpec && ex.wkSpec.segs) parts.push(ex.wkSpec.segs.map((g) => g.label + ' ' + g.sets + '\u00D7' + g.reps).join(' \u00B7 '));
  else if (sp.length) parts.push(sp.length + ' \u00D7 ' + sp[0].reps + unit + per);
  const s0 = sp[0] || {};
  if (s0.vel) parts.push('target 1st rep ' + (s0.vel[1] != null ? s0.vel[0].toFixed(2) + '\u2013' + s0.vel[1].toFixed(2) : '\u2265' + s0.vel[0].toFixed(2)) + ' m/s');
  else if (ex.wkSpec && ex.wkSpec.velTxt) parts.push(ex.wkSpec.velTxt);
  if (s0.vl != null) parts.push('stop at VL ' + (Array.isArray(s0.vl) ? s0.vl.join('\u2013') : s0.vl) + '%');
  if (ex.wkSpec && ex.wkSpec.rir !== undefined && ex.wkSpec.rir !== '') parts.push('RIR ' + ex.wkSpec.rir);
  if (ex.restTxt) parts.push('rest ' + ex.restTxt); else if (ex.rest) parts.push('rest ' + (ex.rest >= 90 ? (ex.rest / 60).toFixed(ex.rest % 60 ? 1 : 0).replace('.0', '') + ' min' : ex.rest + ' s'));
  return parts.join(' \u00B7 ');
}
function inputHTML(k, val, ph, cut) { return '<input inputmode="decimal" data-k="' + k + '" value="' + (val != null && val !== '' ? esc(val) : '') + '" placeholder="' + esc(ph) + '"' + (cut != null ? ' data-cut="' + cut + '"' : '') + ' autocomplete="off">'; }
function vlClass(vl, cut) { return vl == null ? '' : vl > cut ? 'pill-bad' : vl > cut * 0.75 ? 'pill-warn' : 'pill-ok'; }
function setRowHTML(s, ex, i, hist, showHd) {
  const d = exData(s, ex); const set = d.sets[i]; const f = fieldsFor(ex); const spec = ex.setSpecs[i] || {}; const pf = prefill(s, ex, i, hist);
  const val = (k) => (set[k] != null && set[k] !== '' ? set[k] : (set.done ? '' : (pf[k] != null ? pf[k] : '')));
  const caps = f.map((k) => (k === 'metric' ? unitOf(ex) : k === 'load' && ex.bw ? '+lb' : FCAP[k])).map((c) => '<span>' + esc(c) + '</span>').join('');
  let h = '';
  if (spec.label && (i === 0 || (ex.setSpecs[i - 1] || {}).label !== spec.label)) h += '<div class="round">' + esc(spec.label) + (spec.vel ? ' \u00B7 target ' + (spec.vel[1] != null ? spec.vel[0].toFixed(2) + '\u2013' + spec.vel[1].toFixed(2) : '\u2265' + spec.vel[0].toFixed(2)) + ' m/s' : '') + '</div>';
  const hasHold = ex.kind === 'timed';
  const cols = '30px repeat(' + f.length + ',1fr)' + (hasHold ? ' 46px' : '') + ' 56px';
  if (showHd) h += '<div class="setrow hd" style="grid-template-columns:' + cols + '"><span></span>' + f.map((k) => '<span style="text-align:center">' + esc(k === 'metric' ? unitOf(ex) : k === 'load' && ex.bw ? '+lb' : FCAP[k]) + '</span>').join('') + (hasHold ? '<span></span>' : '') + '<span></span></div>';
  const ph = (k) => (k === 'reps' ? String(C.topNum(spec.reps) != null ? spec.reps : 'reps') : k === 'rir' ? String((ex.wkSpec && ex.wkSpec.rir) || 'RIR') : k === 'load' ? (ex.bw ? 'BW' : 'lb') : k === 'secs' ? (spec.reps || 'sec') : k === 'metric' ? unitOf(ex) : FCAP[k]);
  h += '<div class="setrow' + (set.done ? ' done' : '') + '" data-ex="' + ex.id + '" data-i="' + i + '" style="grid-template-columns:' + cols + '"><div class="no">' + (i + 1) + '</div>' + f.map((k) => inputHTML(k, val(k), ph(k))).join('') + (hasHold ? '<button class="sm" data-act="hold" aria-label="Start hold timer">\u23F1</button>' : '') + '<button class="ok" data-act="log" aria-label="' + (set.done ? 'Undo set' : 'Log set') + '">' + (set.done ? '\u2713' : '\u25CB') + '</button></div>';
  if (ex.vbt && ex.kind === 'reps') {
    const cut = Array.isArray(spec.vl) ? spec.vl[spec.vl.length - 1] : (spec.vl != null ? spec.vl : 20);
    const vl = set.mv1 != null && set.mvl != null ? C.vlPct(set.mv1, set.mvl) : null;
    h += '<div class="vrow' + (set.done ? ' done' : '') + '" data-ex="' + ex.id + '" data-i="' + i + '" data-cut="' + cut + '"><span class="tiny mut" style="text-align:center">m/s</span>' + inputHTML('mv1', set.mv1 != null ? set.mv1 : '', '1st rep MV') + inputHTML('mvl', set.mvl != null ? set.mvl : '', 'last rep MV') + '<div class="vl ' + vlClass(vl, cut) + '" data-vl>' + (vl != null ? 'VL ' + vl.toFixed(0) + '%' : 'VL \u2014') + '</div></div>';
  }
  if (set.pr && set.pr.length) h += '<div class="small pill-ok" style="margin:-2px 0 4px 36px">\uD83C\uDFC6 ' + esc(set.pr.join(' \u00B7 ')) + '</div>';
  return h;
}
function exInfoHTML(ex, label, s, hist) {
  const lh = ex.kind === 'reps' || ex.kind === 'power' || ex.kind === 'carry' ? loadHint(ex, s, hist) : null;
  const last = lastOf(hist, ex.lift, s.id); let lastTxt = '';
  if (last && last.sets.length) { const top = last.sets.slice().sort((a, b) => (b.load || 0) - (a.load || 0) || (b.reps || 0) - (a.reps || 0))[0];
    const bits = []; if (top.load) bits.push(top.load + (ex.bw ? ' lb added' : ' lb')); if (top.reps != null && ex.kind !== 'timed') bits.push('\u00D7' + top.reps); if (top.secs) bits.push(top.secs + ' s'); if (top.metric) bits.push(top.metric + ' ' + unitOf(ex)); if (top.dist) bits.push(top.dist + ' m'); if (top.mv1) bits.push('@' + top.mv1.toFixed(2) + ' m/s');
    lastTxt = 'Last (' + fmtDate(last.date) + '): ' + bits.join(' '); }
  const sp = ex.setSpecs[0] || {}; const notes = [ex.wkSpec && ex.wkSpec.note].filter(Boolean);
  return '<h3>' + (label ? '<span class="badge i">' + label + '</span> ' : '') + esc(ex.name) + (ex.optional ? ' <span class="badge">optional</span>' : '') + '</h3><div class="meta">' + esc(metaOf(ex)) + '</div>' + (lastTxt ? '<div class="hint" style="color:var(--mut)">' + esc(lastTxt) + '</div>' : '') + (lh ? '<div class="hint">' + esc(lh.txt) + '</div>' : '') + (notes.length ? '<div class="hint">' + esc(notes.join(' ')) + '</div>' : '') + (ex.cue ? '<details class="cue"><summary>Cues</summary>' + esc(ex.cue) + '</details>' : '');
}
function checkHTML(s, ex) {
  const d = exData(s, ex); const done = d.sets[0].done;
  return '<div class="ex' + (done ? ' alldone' : '') + '" data-exid="' + ex.id + '"><div class="row sp"><div style="flex:1"><h3>' + esc(ex.name) + '</h3><div class="meta">' + esc(ex.desc || '') + ' (' + ex.min + ' min)</div></div><div class="setrow' + (done ? ' done' : '') + '" style="grid-template-columns:70px;margin:0" data-ex="' + ex.id + '" data-i="0"><button class="ok" data-act="log" style="min-height:52px;font-size:16px">' + (done ? '\u2713 Done' : 'Done') + '</button></div></div></div>';
}
function rampHTML(s, ex) {
  const rd = P.RAMPS[ex.ramp]; const d = exData(s, ex);
  if (!d.ramp.length) d.ramp.push({ load: rd.start, reps: rd.startReps });
  const stop = ex.wkSpec.stopMV || rd.stopMV; const pts = d.ramp.filter((r) => r.done && r.mv != null && r.load != null).map((r) => ({ x: r.load, y: r.mv }));
  const fit = C.linreg(pts); const last = d.ramp.filter((r) => r.done).slice(-1)[0];
  const stopped = last && last.mv != null && last.mv <= stop;
  let h = '<div class="ex" data-exid="' + ex.id + '"><h3>' + esc(ex.name) + '</h3><div class="meta">' + esc(ex.wkSpec.note || '') + ' Stop at first rep \u2264 ' + stop.toFixed(2) + ' m/s or RPE 8.</div><details><summary class="small mut">Ramp rules</summary><div class="cue">' + esc(rd.rules) + '</div></details>' + (ex.cue ? '<div class="cue">' + esc(ex.cue) + '</div>' : '');
  h += '<div class="setrow hd" style="grid-template-columns:30px 1fr 1fr 1fr 56px"><span></span><span style="text-align:center">lb</span><span style="text-align:center">reps</span><span style="text-align:center">best MV m/s</span><span></span></div>';
  d.ramp.forEach((r, i) => { h += '<div class="setrow' + (r.done ? ' done' : '') + '" data-ramp="' + ex.id + '" data-i="' + i + '" style="grid-template-columns:30px 1fr 1fr 1fr 56px"><div class="no">' + (i + 1) + '</div>' + inputHTML('load', r.load, 'lb') + inputHTML('reps', r.reps, 'reps') + inputHTML('mv', r.mv, i === 0 && ex.ramp === 'floorpress' ? 'optional' : 'm/s') + '<button class="ok" data-act="rlog" aria-label="Log ramp set">' + (r.done ? '\u2713' : '\u25CB') + '</button></div>'; });
  if (stopped) h += '<div class="card" style="border-color:var(--warn);margin:8px 0 0"><b class="pill-warn">Stop ramping:</b> first-rep MV \u2264 ' + stop.toFixed(2) + ' m/s. Save the profile.</div>';
  h += '<div class="row" style="margin-top:8px"><button class="sm" data-act="radd" data-ex="' + ex.id + '">+ Add set</button><button class="sm" data-act="rdel" data-ex="' + ex.id + '">Remove last</button></div>';
  if (fit) {
    h += '<table class="t ramp-fit" style="margin-top:10px"><tr><th>MV (m/s)</th><th>Load (lb)</th></tr>' + C.loadsTable(fit).map((r) => '<tr><td>' + r.v.toFixed(2) + '</td><td>' + (r.load != null ? Math.round(r.load) + (r.extrap ? ' <span class="pill-warn small">(extrapolated)</span>' : '') : '\u2014') + '</td></tr>').join('') + '</table>';
    h += '<div class="small mut" style="margin-top:4px">Fit: MV = ' + fit.intercept.toFixed(3) + ' ' + (fit.slope < 0 ? '\u2212' : '+') + ' ' + Math.abs(fit.slope).toFixed(5) + ' \u00D7 load \u00B7 R\u00B2 ' + fit.r2.toFixed(3) + ' \u00B7 n=' + fit.n + (ex.ramp === 'trapbar' && fit.slope < 0 ? ' \u00B7 rough e1RM @0.29 m/s \u2248 ' + Math.round(C.loadAtV(fit, 0.29)) + ' lb (ballpark only)' : '') + '</div>';
  } else h += '<div class="small mut" style="margin-top:8px">Log \u2265 2 sets with best MV to see slope, intercept and training loads for 1.00 / 0.85 / 0.70 / 0.60 / 0.50 m/s.</div>';
  h += '<button class="pri block" style="margin-top:10px" data-act="rsave" data-ex="' + ex.id + '"' + (fit ? '' : ' disabled') + '>' + (d.rampSaved ? '\u2713 Profile saved (tap to update)' : 'Save profile') + '</button></div>';
  return h;
}
function intervalHTML(s, ex, hist) {
  const d = exData(s, ex); const running = IV && IV.sid === s.id && IV.exId === ex.id;
  let h = '<div class="ex" data-exid="' + ex.id + '">' + exInfoHTML(ex, '', s, hist);
  h += '<div class="row" style="margin:6px 0"><button class="pri" data-act="ivstart" data-ex="' + ex.id + '"' + (running ? ' disabled' : '') + '>\u25B6 Start ' + (ex.emom ? 'EMOM clock' : 'interval timer') + '</button><span class="small mut">beeps at each phase; marks rounds done</span></div>';
  d.sets.forEach((_, i) => { h += setRowHTML(s, ex, i, hist, i === 0); });
  return h + '</div>';
}
function blockHTML(s, b, hist, nextKey) {
  const letters = (i) => (b.grp || '') + (i + 1);
  if (!b.superset) {
    const ex = b.members[0];
    if (ex.kind === 'check') return checkHTML(s, ex);
    if (ex.kind === 'ramp') return rampHTML(s, ex);
    if (ex.kind === 'interval') return intervalHTML(s, ex, hist);
    const d = exData(s, ex); const all = d.sets.every((x) => x.done);
    return '<div class="ex' + (all ? ' alldone' : '') + '" data-exid="' + ex.id + '">' + exInfoHTML(ex, '', s, hist) + d.sets.map((_, i) => setRowHTML(s, ex, i, hist, i === 0)).join('') + '</div>';
  }
  const rounds = Math.max(...b.members.map((m) => m.setSpecs.length));
  let h = '<div class="ss"><div class="sstag">SUPERSET ' + b.grp + ' \u00B7 ' + rounds + ' rounds' + (b.members.some((m) => m.rest === 0) ? ' (circuit, minimal rest)' : '') + '</div>';
  b.members.forEach((m, k) => { h += '<div style="margin-bottom:6px">' + exInfoHTML(m, letters(k), s, hist) + '</div>'; });
  for (let r = 0; r < rounds; r++) {
    h += '<div class="round"><b>Round ' + (r + 1) + '</b></div>';
    b.members.forEach((m, k) => { if (r < m.setSpecs.length) { exData(s, m); h += '<div class="small mut" style="margin-top:4px"><b>' + letters(k) + '</b> ' + esc(m.name.replace(/\s*\(.*$/, '')) + '</div>' + setRowHTML(s, m, r, hist, true); } });
  }
  return h + '</div>';
}
function readinessHTML(s, R, hist) {
  const key = s.day === 'A' ? 'trapbar' : s.day === 'B' ? 'floorpress' : null; if (!key || s.week < 2) return '';
  const has = R.exercises.some((e) => e.id === (key === 'trapbar' ? 'tb' : 'fp')); if (!has) return '';
  const pr = firstProfile(key); const rd = P.READINESS[key];
  if (!pr) return '<div class="card"><h3>Readiness set</h3><div class="small mut">Complete the Week-1 ' + rd.label.toLowerCase() + ' profile first (Day ' + (key === 'trapbar' ? 'A' : 'B') + ' Week 1) to unlock the daily readiness check.</div></div>';
  const base = pr.readinessLoad || C.round5(C.loadAtV(pr.fit, rd.targetMV));
  const cur = s.ready[key] || {}; const load = cur.load != null ? cur.load : base;
  const bmv = C.mvAtLoad(pr.fit, load);
  return '<div class="card" data-ready="' + key + '"><h3>Readiness set \u00B7 ' + rd.label + '</h3><div class="small mut">Last warm-up set at a fixed load (~' + rd.targetMV.toFixed(1) + ' m/s in Week 1). 2-3 reps, enter the best MV.</div><div class="grid3"><div><label>Load (lb)</label><input inputmode="decimal" data-r="load" value="' + esc(load) + '"></div><div><label>Best MV (m/s)</label><input inputmode="decimal" data-r="mv" value="' + esc(cur.mv != null ? cur.mv : '') + '" placeholder="m/s"></div><div><label>Baseline MV</label><div style="min-height:48px;display:flex;align-items:center;font-weight:700" data-r-base>' + (bmv != null ? bmv.toFixed(2) : '\u2014') + '</div></div></div><div class="small" style="margin-top:6px" data-r-out></div></div>';
}
function updateReadiness(card) {
  const key = card.dataset.ready; const s = getSession(curSid); const pr = firstProfile(key); if (!pr) return;
  const load = numOrNull($('[data-r=load]', card).value), mv = numOrNull($('[data-r=mv]', card).value);
  const base = load != null ? C.mvAtLoad(pr.fit, load) : null; $('[data-r-base]', card).textContent = base != null ? base.toFixed(2) : '\u2014';
  const hdr = s.hdr || {}; const v = mv != null && base != null ? C.readiness(mv, base, hdr.sleep, hdr.soreness, hdr.readiness) : null;
  const out = $('[data-r-out]', card);
  if (v) { out.className = 'small ' + ({ ok: 'pill-ok', good: 'pill-ok', warn: 'pill-warn', bad: 'pill-bad' }[v.level]); out.innerHTML = '<b>' + (v.diff > 0 ? '\u2212' : '+') + Math.abs(v.diff).toFixed(2) + ' m/s vs baseline.</b> ' + esc(v.text); } else { out.textContent = ''; }
  s.ready[key] = { load, mv, baseline: base, diff: v ? v.diff : null, level: v ? v.level : null }; St.touch(s);
}
function sessionHeaderHTML(s) {
  const h = s.hdr || {};
  return '<details class="card" ' + (h.readiness == null && h.sleep == null ? 'open' : '') + ' id="hdrcard"><summary><b>Session info</b> <span class="small mut" id="hdrsum"></span></summary>' +
    '<div class="grid2"><div><label>Date</label><input type="date" data-h="date" value="' + esc(s.date) + '"></div><div><label>Sleep (hours)</label><input inputmode="decimal" data-h="sleep" value="' + esc(h.sleep != null ? h.sleep : '') + '" placeholder="7.5"></div></div>' +
    '<label>Readiness (1 = wrecked, 5 = great)</label><div class="chips" data-chips="readiness">' + [1, 2, 3, 4, 5].map((n) => '<button class="chip' + (h.readiness === n ? ' on' : '') + '" data-act="chip" data-n="' + n + '">' + n + '</button>').join('') + '</div>' +
    '<div class="grid2"><div><label>Worst soreness (0-10)</label><input inputmode="decimal" data-h="soreness" value="' + esc(h.soreness != null ? h.soreness : '') + '" placeholder="0-10"></div><div><label>Where</label><input data-h="sorenessLoc" value="' + esc(h.sorenessLoc || '') + '" placeholder="legs, back..."></div></div></details>';
}
function nextUpText(s, R, stat, hist) {
  const n = stat.find((x) => !x.done); if (!n) return '<b>All sets done.</b> Finish the session below.';
  const ex = n.ex; const b = R.blocks.find((bb) => bb.members.includes(ex)); const idx = b ? b.members.indexOf(ex) : 0; const label = b && b.superset ? b.grp + (idx + 1) + ' ' : '';
  if (ex.kind === 'check') return '<b>' + esc(ex.name) + '</b>'; if (ex.kind === 'ramp') return '<b>' + esc(ex.name) + '</b>';
  const pf = prefill(s, ex, n.st.i, hist); const sp = ex.setSpecs[n.st.i] || {}; const bits = [];
  if (pf.load != null) bits.push(pf.load + ' lb'); if (sp.reps != null && ex.kind !== 'interval') bits.push('\u00D7 ' + sp.reps + (ex.kind === 'timed' ? ' s' : ex.kind === 'carry' ? ' m' : '') + (ex.per || ''));
  return '<b>' + esc(label + ex.name.replace(/\s*\(.*$/, '')) + '</b> \u00B7 set ' + (n.st.i + 1) + '/' + ex.setSpecs.length + (bits.length ? ' \u00B7 ' + esc(bits.join(' ')) : '');
}
function renderSession(id, keep) {
  const s = getSession(id); if (!s) { location.hash = '#/today'; return; }
  curSid = id; document.body.classList.add('sess'); $('#title').textContent = 'Week ' + s.week + ' \u00B7 Day ' + s.day;
  const y = window.scrollY; const R = Prog.resolve(s.week, s.day); const hist = buildHist(); const stat = sessStatus(s, R);
  curDone = stat.filter((x) => x.done).length; curTotal = stat.length || 1; curTarget = R.target;
  nextUp = nextUpText(s, R, stat, hist);
  const B = P.BLOCKS[R.block - 1];
  let h = '<div class="shead"><a class="btn sm" href="#/today" aria-label="Back">\u2190</a><div class="ring"><svg width="64" height="64"><circle cx="32" cy="32" r="27" fill="none" stroke="var(--card2)" stroke-width="7"/><circle id="ring-arc" cx="32" cy="32" r="27" fill="none" stroke="var(--acc)" stroke-width="7" stroke-linecap="round" stroke-dasharray="169.6" stroke-dashoffset="169.6"/></svg><div class="t" id="ring-txt"></div></div><div style="flex:1;min-width:0"><div style="font-weight:700">' + esc(P.DAYS[s.day].name) + ' <span class="badge ' + (R.deload ? 'w' : 'i') + '">' + (R.deload ? 'DELOAD' : 'Block ' + R.block) + '</span></div><div class="small mut" id="el-txt"></div><div class="bar" id="el-barwrap"><i id="el-bar" style="width:0"></i></div></div></div>';
  h += '<div class="row small" style="margin-bottom:8px"><span class="badge g" id="chip-sets"></span><span class="badge" id="chip-streak"></span><span class="badge" id="chip-wl"></span></div>';
  if (R.deload) h += '<div class="card" style="border-color:var(--warn)"><b class="pill-warn">Deload week.</b> ~50% of sets, loads ~10% lighter (or ~0.05-0.10 m/s faster), VL \u2264 10%, no hard intervals. Mobility as usual.</div>';
  h += sessionHeaderHTML(s) + readinessHTML(s, R, hist);
  R.blocks.forEach((b) => { h += blockHTML(s, b, hist); });
  h += '<div class="card"><button class="pri block" data-act="finish">Finish session</button><div class="small mut" style="margin-top:6px">Progress saves automatically on every tap. Stopping early? Finish anyway to log RPE and minutes.</div></div>';
  view.innerHTML = h;
  $$('#view [data-ready]').forEach(updateReadiness);
  updateHdrSummary(s); renderDock(); updateSessHead(true);
  if (keep) window.scrollTo(0, y); else window.scrollTo(0, 0);
  wake();
}
function updateHdrSummary(s) { const e = $('#hdrsum'); if (!e) return; const h = s.hdr || {}; e.textContent = [h.sleep != null ? h.sleep + ' h sleep' : '', h.readiness != null ? 'ready ' + h.readiness + '/5' : '', h.soreness != null ? 'sore ' + h.soreness : ''].filter(Boolean).join(' \u00B7 '); }
function updateSessHead(force) {
  if (!curSid || !document.body.classList.contains('sess')) return; const s = getSession(curSid); if (!s || !$('#ring-arc')) return;
  const end = s.status === 'done' && s.endedAt ? s.endedAt : Date.now(); const el = Math.max(0, (end - s.startedAt) / 60000);
  $('#ring-arc').style.strokeDashoffset = 169.6 * (1 - Math.min(1, curDone / curTotal)); $('#ring-txt').textContent = curDone + '/' + curTotal;
  $('#el-txt').textContent = Math.floor(el) + ' min of ' + curTarget + ' min target' + (el > curTarget ? ' (over)' : '');
  $('#el-bar').style.width = Math.min(100, el / curTarget * 100) + '%'; $('#el-barwrap').className = 'bar' + (el > curTarget ? ' over' : '');
  $('#chip-sets').textContent = curDone + ' sets done'; $('#chip-streak').textContent = 'Streak ' + sessionStreak() + ' sessions'; $('#chip-wl').textContent = wl ? 'Screen awake' : 'Screen may sleep';
}
function logSet(sid, exId, i, opts) {
  opts = opts || {}; const s = getSession(sid); if (!s) return; const R = Prog.resolve(s.week, s.day); const ex = R.exercises.find((e) => e.id === exId); if (!ex) return;
  const d = exData(s, ex); const set = d.sets[i]; const hist = buildHist();
  if (set.done && !opts.auto) { set.done = false; set.pr = null; St.touch(s); renderSession(sid, true); return; }
  const sel = '[data-ex="' + exId + '"][data-i="' + i + '"] input[data-k]';
  $$(sel, view).forEach((inp) => { const k = inp.dataset.k; if (inp.value !== '') set[k] = k === 'rir' ? inp.value : numOrNull(inp.value); });
  const pf = prefill(s, ex, i, hist); fieldsFor(ex).forEach((k) => { if (set[k] == null && pf[k] != null) set[k] = pf[k]; });
  if (ex.kind === 'timed' && set.secs == null && ex.setSpecs[i]) set.secs = C.topNum(ex.setSpecs[i].reps);
  if (set.mv1 != null && set.mvl != null) set.vl = C.r1(C.vlPct(set.mv1, set.mvl), 1);
  set.done = true; set.ts = Date.now(); set.rest = ex.rest || 0; const prs = ex.kind === 'check' ? [] : prCheck(hist, s, ex, set, i); set.pr = prs;
  St.touch(s);
  const stat = sessStatus(s, R); const allDone = stat.every((x) => x.done); const spec = ex.setSpecs[i] || {};
  let msg = ex.kind === 'check' ? '\u2713 ' + ex.name : '\u2713 ' + ex.name.replace(/\s*\(.*$/, '') + ' ' + (i + 1) + '/' + ex.setSpecs.length;
  if (set.vl != null) { const cut = Array.isArray(spec.vl) ? spec.vl[spec.vl.length - 1] : spec.vl; msg += ' \u00B7 VL ' + set.vl.toFixed(0) + '%' + (cut != null && set.vl > cut ? ' (over ' + cut + '% cutoff: stop/lighten)' : ''); }
  if (prs.length) { msg += ' \u00B7 \uD83C\uDFC6 ' + prs[0]; vib([60, 40, 60]); }
  if (!opts.quiet && ex.kind !== 'interval') {
    if (allDone) { T = null; saveT(); msg += ' \u00B7 all sets done!'; }
    else if (ex.rest > 0 && ex.kind !== 'check') { startRest(ex.rest, 'REST'); msg += ' \u00B7 rest ' + (ex.rest >= 90 ? (ex.rest / 60).toFixed(1).replace('.0', '') + ' min' : ex.rest + ' s'); }
    else if (T && T.type === 'rest' && ex.kind !== 'check') { T = null; saveT(); }
  }
  if (!opts.quiet || !IV) toast(msg, 3200);
  if (location.hash.indexOf('/session/' + sid) >= 0) { renderSession(sid, true); if (!opts.auto && !allDone) scrollToNext(); }
}
function scrollToNext() { const r = view.querySelector('.setrow:not(.done):not(.hd)'); if (r) { const y = r.getBoundingClientRect(); if (y.top < 140 || y.bottom > window.innerHeight - 220) window.scrollBy(0, y.top - window.innerHeight * 0.38); } }
function logRamp(sid, exId, i) {
  const s = getSession(sid); const R = Prog.resolve(s.week, s.day); const ex = R.exercises.find((e) => e.id === exId); const rd = P.RAMPS[ex.ramp]; const d = exData(s, ex); const r = d.ramp[i];
  if (r.done) { r.done = false; St.touch(s); renderSession(sid, true); return; }
  $$('[data-ramp="' + exId + '"][data-i="' + i + '"] input', view).forEach((inp) => { r[inp.dataset.k] = numOrNull(inp.value); });
  if (r.load == null) { toast('Enter the load first'); return; }
  r.done = true; r.ts = Date.now(); const stop = ex.wkSpec.stopMV || rd.stopMV; const stopped = r.mv != null && r.mv <= stop;
  if (i === d.ramp.length - 1 && !stopped) { const nx = r.mv != null ? rd.next(r.mv) : { add: ex.ramp === 'floorpress' ? 50 : 20, reps: 3 }; d.ramp.push({ load: r.load + nx.add, reps: nx.reps }); }
  St.touch(s); const rest = rd.rest(r.mv); if (!stopped) startRest(rest, 'RAMP REST'); else { T = null; saveT(); }
  toast(stopped ? 'MV \u2264 ' + stop.toFixed(2) + ': stop ramping and save the profile' : '\u2713 ' + r.load + ' lb' + (r.mv != null ? ' @ ' + r.mv.toFixed(2) + ' m/s' : '') + ' \u00B7 next ' + d.ramp[d.ramp.length - 1].load + ' lb \u00D7 ' + d.ramp[d.ramp.length - 1].reps, 3200);
  renderSession(sid, true);
}
function saveProfile(sid, exId) {
  const s = getSession(sid); const R = Prog.resolve(s.week, s.day); const ex = R.exercises.find((e) => e.id === exId); const d = exData(s, ex);
  $$('[data-ramp="' + exId + '"] input', view).forEach((inp) => { const r = d.ramp[+inp.closest('[data-i]').dataset.i]; if (r && !r.done) r[inp.dataset.k] = numOrNull(inp.value); });
  const pts = d.ramp.filter((r) => r.done && r.mv != null && r.load != null).map((r) => ({ load: r.load, mv: r.mv }));
  const fit = C.linreg(pts.map((p) => ({ x: p.load, y: p.mv }))); if (!fit) { toast('Need at least 2 loads with different MVs'); return; }
  const id = 'prof-' + s.id + '-' + exId; let rec = St.data.profiles.find((p) => p.id === id);
  const rdKey = ex.ramp; const rl = C.round5(C.loadAtV(fit, P.READINESS[rdKey].targetMV));
  const body = { type: 'profile', lift: ex.ramp, date: s.date, week: s.week, points: pts, fit: { slope: fit.slope, intercept: fit.intercept, r2: fit.r2, n: fit.n, minX: fit.minX, maxX: fit.maxX }, readinessLoad: rl, deleted: false };
  if (rec) { Object.assign(rec, body); St.touch(rec); } else St.add('profiles', Object.assign({ id }, body));
  d.rampSaved = true; St.touch(s); toast('Profile saved. Readiness load ' + rl + ' lb (' + P.READINESS[rdKey].targetMV.toFixed(1) + ' m/s)', 3500); renderSession(sid, true);
}
function finishModal() {
  const s = getSession(curSid); const el = Math.round((Date.now() - s.startedAt) / 60000); const f = s.finish || {};
  const m = document.createElement('div'); m.className = 'modal'; m.id = 'finmodal';
  m.innerHTML = '<div><h2>Finish session</h2><label>Session RPE (1-10)</label><div class="chips" id="rpechips">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => '<button class="chip' + (f.rpe === n ? ' on' : '') + '" data-act="rpe" data-n="' + n + '">' + n + '</button>').join('') + '</div><div class="grid2"><div><label>Total minutes</label><input inputmode="decimal" id="f-min" value="' + (f.minutes != null ? f.minutes : el) + '"></div><div><label>sRPE load (RPE \u00D7 min)</label><div id="f-srpe" style="min-height:48px;display:flex;align-items:center;font-weight:800;font-size:20px">\u2014</div></div></div><div class="grid2"><div><label>Pain (0-10, not normal discomfort)</label><input inputmode="decimal" id="f-pain" value="' + esc(f.pain || '') + '" placeholder="0"></div><div><label>Pain location</label><input id="f-painloc" value="' + esc(f.painLoc || '') + '"></div></div><label>Notes</label><textarea id="f-notes">' + esc(f.notes || '') + '</textarea><div class="grid2" style="margin-top:12px"><button data-act="fincancel">Back</button><button class="pri" data-act="finsave">Save session</button></div></div>';
  document.body.appendChild(m); window.__rpe = f.rpe || null; calcSrpe();
}
function calcSrpe() { const m = $('#f-min'); if (!m) return; const v = (window.__rpe || 0) * (numOrNull(m.value) || 0); $('#f-srpe').textContent = v ? Math.round(v) : '\u2014'; }
function finishSave() {
  const s = getSession(curSid); const rpe = window.__rpe; const min = numOrNull($('#f-min').value);
  s.finish = { rpe, minutes: min, srpe: rpe && min ? Math.round(rpe * min) : null, pain: numOrNull($('#f-pain').value) || 0, painLoc: $('#f-painloc').value, notes: $('#f-notes').value };
  s.status = 'done'; s.endedAt = Date.now(); St.touch(s); if (S.activeSession === s.id) { S.activeSession = null; St.saveSettings(); }
  $('#finmodal').remove(); T = null; saveT(); IV = null; unwake();
  const R = Prog.resolve(s.week, s.day); const stat = sessStatus(s, R); const done = stat.filter((x) => x.done).length;
  const prs = Object.values(s.ex).reduce((n, d) => n + (d.sets || []).filter((x) => x.pr && x.pr.length).length, 0);
  const m = document.createElement('div'); m.className = 'modal'; m.id = 'sum';
  m.innerHTML = '<div><h2>Session saved \u2713</h2><div class="grid2"><div class="card"><div class="mut small">Sets</div><b style="font-size:24px">' + done + '/' + stat.length + '</b></div><div class="card"><div class="mut small">Time</div><b style="font-size:24px">' + (min || '\u2014') + ' / ' + R.target + ' min</b></div><div class="card"><div class="mut small">PR flags</div><b style="font-size:24px">' + prs + '</b></div><div class="card"><div class="mut small">sRPE load</div><b style="font-size:24px">' + (s.finish.srpe || '\u2014') + '</b></div></div><div class="small mut">Streak: ' + sessionStreak() + ' sessions in a row. ' + (S.syncUrl ? 'Syncing to your store\u2026' : 'Tip: export a backup from Data (\u2699).') + '</div><button class="pri block" style="margin-top:12px" data-act="sumok">Done</button></div>';
  document.body.appendChild(m); if (S.syncUrl) St.syncNow().catch(() => {});
}

// delegated events for the session view
view.addEventListener('input', (e) => {
  const inp = e.target; if (!(inp instanceof HTMLInputElement) && !(inp instanceof HTMLTextAreaElement)) return;
  if (inp.dataset.h) { const s = getSession(curSid); if (!s) return; if (inp.dataset.h === 'date') s.date = inp.value; else { s.hdr = s.hdr || {}; s.hdr[inp.dataset.h] = inp.dataset.h === 'sorenessLoc' ? inp.value : numOrNull(inp.value); } St.touch(s); updateHdrSummary(s); $$('[data-ready]').forEach(updateReadiness); return; }
  if (inp.dataset.r) { updateReadiness(inp.closest('[data-ready]')); return; }
  const k = inp.dataset.k; if (!k) return;
  const rampRow = inp.closest('[data-ramp]'); const s = getSession(curSid); if (!s) return;
  if (rampRow) { const R = Prog.resolve(s.week, s.day); const ex = R.exercises.find((x) => x.id === rampRow.dataset.ramp); const r = exData(s, ex).ramp[+rampRow.dataset.i]; r[k] = numOrNull(inp.value); St.touch(s); return; }
  const row = inp.closest('[data-ex]'); if (!row) return; const R = Prog.resolve(s.week, s.day); const ex = R.exercises.find((x) => x.id === row.dataset.ex); const set = exData(s, ex).sets[+row.dataset.i];
  set[k] = k === 'rir' ? inp.value : numOrNull(inp.value); St.touch(s);
  if (k === 'mv1' || k === 'mvl') { const vr = inp.closest('.vrow'); const a = numOrNull($('[data-k=mv1]', vr).value), b = numOrNull($('[data-k=mvl]', vr).value); const vl = a != null && b != null ? C.vlPct(a, b) : null; const cut = +vr.dataset.cut; const el = $('[data-vl]', vr); el.textContent = vl != null ? 'VL ' + vl.toFixed(0) + '%' : 'VL \u2014'; el.className = 'vl ' + vlClass(vl, cut); }
});
document.body.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]'); if (!b || b.closest('#dock')) return; const a = b.dataset.act;
  if (a === 'log') { const row = b.closest('[data-ex]'); logSet(curSid, row.dataset.ex, +row.dataset.i); }
  else if (a === 'rlog') { const row = b.closest('[data-ramp]'); logRamp(curSid, row.dataset.ramp, +row.dataset.i); }
  else if (a === 'radd') { const s = getSession(curSid); const R = Prog.resolve(s.week, s.day); const ex = R.exercises.find((x) => x.id === b.dataset.ex); const d = exData(s, ex); const l = d.ramp[d.ramp.length - 1]; d.ramp.push({ load: l ? (l.load || 0) + 10 : 100, reps: l ? l.reps : 2 }); St.touch(s); renderSession(curSid, true); }
  else if (a === 'rdel') { const s = getSession(curSid); const R = Prog.resolve(s.week, s.day); const ex = R.exercises.find((x) => x.id === b.dataset.ex); const d = exData(s, ex); if (d.ramp.length > 1) d.ramp.pop(); St.touch(s); renderSession(curSid, true); }
  else if (a === 'rsave') saveProfile(curSid, b.dataset.ex);
  else if (a === 'hold') { const row = b.closest('[data-ex]'); const inp = $('[data-k=secs]', row); const sec = numOrNull(inp.value) || 30; audio(); startHold(sec, curSid, row.dataset.ex, +row.dataset.i); }
  else if (a === 'ivstart') startInterval(curSid, b.dataset.ex);
  else if (a === 'chip') { const s = getSession(curSid); s.hdr = s.hdr || {}; s.hdr.readiness = +b.dataset.n; St.touch(s); $$('[data-chips=readiness] .chip').forEach((c) => c.classList.toggle('on', c === b)); updateHdrSummary(s); $$('[data-ready]').forEach(updateReadiness); }
  else if (a === 'finish') finishModal();
  else if (a === 'rpe') { window.__rpe = +b.dataset.n; $$('#rpechips .chip').forEach((c) => c.classList.toggle('on', c === b)); calcSrpe(); }
  else if (a === 'fincancel') $('#finmodal').remove();
  else if (a === 'finsave') finishSave();
  else if (a === 'sumok') { $('#sum').remove(); location.hash = '#/today'; }
});
document.body.addEventListener('input', (e) => { if (e.target.id === 'f-min') calcSrpe(); });

// ---------- TODAY / PLAN ----------
function dayInfo(dateStr) {
  const idx = Math.round((parseYmd(dateStr) - parseYmd(S.startDate)) / 864e5); const dow = parseYmd(dateStr).getDay();
  return { idx, week: Math.floor(idx / 7) + 1, day: { 1: 'A', 3: 'B', 5: 'C' }[dow] || null, dow };
}
const isLogged = (w, d) => sessions().some((s) => s.status === 'done' && s.week === w && s.day === d);
function nextScheduled(fromStr) {
  let d = parseYmd(fromStr); const start = parseYmd(S.startDate); if (d < start) d = start;
  for (let k = 0; k < 120; k++) { const ds = ymd(d); const di = dayInfo(ds); if (di.day && di.week >= 1 && di.week <= 12 && !isLogged(di.week, di.day)) return Object.assign({ date: ds }, di); d = new Date(d.getTime() + 864e5); }
  return null;
}
function exPreview(R) { return '<table class="t">' + R.exercises.map((ex) => '<tr><td><b>' + esc(ex.name.replace(/\s*\(.*$/, '')) + '</b><div class="small mut">' + esc(metaOf(ex)) + '</div>' + (ex.wkSpec && ex.wkSpec.note ? '<div class="small" style="color:var(--info)">' + esc(ex.wkSpec.note) + '</div>' : '') + '</td></tr>').join('') + '</table>'; }
function weekDots(week) { return ['A', 'B', 'C'].map((d) => '<span class="chip ' + (isLogged(week, d) ? 'done' : '') + '" style="min-height:40px">' + (isLogged(week, d) ? '\u2713 ' : '') + d + ' <span class="small mut">' + DAYN[d] + '</span></span>').join(''); }
function mobCount(days) { const cut = ymd(new Date(Date.now() - (days - 1) * 864e5)); return St.live('mobility').filter((m) => m.date >= cut).length; }
function viewToday() {
  $('#title').textContent = 'Today'; const t = todayStr(); const di = dayInfo(t); const active = sessions().find((s) => s.status === 'active');
  const nxt = nextScheduled(t); const todaySched = di.day && di.week >= 1 && di.week <= 12;
  let h = '<div class="card"><div class="small mut">' + fmtDate(t) + '</div>';
  if (di.idx < 0) h += '<h2>Program starts ' + fmtDate(S.startDate) + '</h2><div class="small mut">' + (-di.idx) + ' day(s) to go. Do mobility until then.</div>';
  else if (di.week > 12) h += '<h2>12-week program complete</h2><div class="small mut">Compare Week 1 vs Week 12 profiles in History.</div>';
  else h += '<h2>Week ' + di.week + ' of 12 \u00B7 Block ' + (Math.floor((di.week - 1) / 4) + 1) + (Prog.isDeload(di.week) ? ' (deload)' : '') + '</h2><div class="row" style="margin-top:6px">' + weekDots(di.week) + '</div>';
  h += '</div>';
  if (active) { const R = Prog.resolve(active.week, active.day); h += '<div class="card" style="border-color:var(--info)"><h3>Session in progress</h3><div class="small mut">Week ' + active.week + ' Day ' + active.day + ' \u00B7 ' + sessStatus(active, R).filter((x) => x.done).length + '/' + R.steps.length + ' sets \u00B7 started ' + new Date(active.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + '</div><a class="btn pri block" style="margin-top:8px" href="#/session/' + active.id + '">Resume</a></div>'; }
  if (nxt) { const R = Prog.resolve(nxt.week, nxt.day); const isToday = nxt.date === t;
    h += '<div class="card"><div class="row sp"><h3>' + (isToday ? 'Today: ' : 'Next: ' + fmtDate(nxt.date) + ' \u00B7 ') + 'Week ' + nxt.week + ' Day ' + nxt.day + '</h3><span class="badge">' + R.target + ' min</span></div><div class="small mut">' + esc(P.DAYS[nxt.day].name) + ' \u00B7 ' + R.steps.length + ' steps</div><details style="margin:8px 0"><summary class="small">Preview exercises</summary>' + exPreview(R) + '</details><button class="pri block" data-go="start" data-w="' + nxt.week + '" data-d="' + nxt.day + '">' + (active && active.week === nxt.week && active.day === nxt.day ? 'Resume workout' : 'Start workout') + '</button></div>'; }
  else if (di.week > 12 || di.idx >= 0) h += '<div class="card">No upcoming scheduled sessions.</div>';
  const lastMob = St.live('mobility').sort((a, b) => (a.date < b.date ? 1 : -1))[0]; const nextRoutine = lastMob && lastMob.routine === 'A' ? 'B' : 'A';
  h += '<div class="card"><div class="row sp"><h3>10-min mobility</h3><span class="badge ' + (mobCount(7) >= 5 ? 'g' : '') + '">' + mobCount(7) + ' / 5-7 this week</span></div><div class="small mut">Suggested today: Mobility ' + nextRoutine + '</div><div class="grid2" style="margin-top:8px"><a class="btn pri" href="#/mob/' + nextRoutine + '">Start ' + nextRoutine + '</a><a class="btn" href="#/mob/' + (nextRoutine === 'A' ? 'B' : 'A') + '">Start ' + (nextRoutine === 'A' ? 'B' : 'A') + '</a></div></div>';
  const wkStart = di.idx >= 0 && di.week <= 12 ? ymd(new Date(parseYmd(S.startDate).getTime() + (di.week - 1) * 7 * 864e5)) : null;
  if (wkStart && !St.live('bodycomp').some((b) => b.date >= wkStart)) h += '<div class="card"><h3>Weekly weigh-in</h3><div class="small mut">Same morning each week, after the bathroom, before food/water.</div><a class="btn block" style="margin-top:8px" href="#/body">Log body comp</a></div>';
  const done = sessions().filter((s) => s.status === 'done').length;
  h += '<div class="card small mut">' + done + ' session' + (done === 1 ? '' : 's') + ' logged \u00B7 streak ' + sessionStreak() + ' \u00B7 ' + (S.syncUrl ? 'sync on (' + esc(S.lastSyncMsg || 'not yet') + ')' : 'saved on this device only. Set up sync or export a backup in \u2699') + '</div>';
  view.innerHTML = h;
}
let planSel = null;
function viewPlan() {
  $('#title').textContent = 'Plan'; if (!planSel) { const n = nextScheduled(todayStr()); planSel = { week: n ? n.week : 1, day: n ? n.day : 'A' }; }
  const { week, day } = planSel; const R = Prog.resolve(week, day); const B = P.BLOCKS[R.block - 1]; const cur = dayInfo(todayStr()).week;
  let h = '<div class="card"><label>Week</label><div class="chips">' + Array.from({ length: 12 }, (_, i) => i + 1).map((w) => '<button class="chip' + (w === week ? ' on' : '') + (w === cur ? ' cur' : '') + (['A', 'B', 'C'].every((d) => isLogged(w, d)) ? ' done' : '') + '" data-plan="w" data-v="' + w + '">' + w + (Prog.isDeload(w) ? '\u2193' : '') + '</button>').join('') + '</div><div class="small mut">\u2193 = deload week \u00B7 blue outline = current week</div><label style="margin-top:10px">Day</label><div class="chips">' + ['A', 'B', 'C'].map((d) => '<button class="chip' + (d === day ? ' on' : '') + (isLogged(week, d) ? ' done' : '') + '" style="min-width:90px" data-plan="d" data-v="' + d + '">' + d + ' \u00B7 ' + DAYN[d] + '</button>').join('') + '</div></div>';
  h += '<div class="card"><div class="row sp"><h3>Week ' + week + ' Day ' + day + ' \u00B7 ' + esc(P.DAYS[day].name) + '</h3><span class="badge ' + (R.deload ? 'w' : 'i') + '">' + (R.deload ? 'Deload' : 'Block ' + R.block) + '</span></div><div class="small mut">Block ' + B.n + ': ' + B.name + ' \u00B7 target ' + R.target + ' min \u00B7 main-lift reps ' + B.reps + ' \u00B7 VL cutoff ' + B.vl + '</div>' + exPreview(R) + '<div class="grid2" style="margin-top:10px"><button class="pri" data-go="start" data-w="' + week + '" data-d="' + day + '">Start workout</button><a class="btn" href="#/sheet/' + week + '/' + day + '">Print / log sheet</a></div></div>';
  view.innerHTML = h;
}
view.addEventListener('click', (e) => {
  const b = e.target.closest('[data-plan]'); if (b) { if (b.dataset.plan === 'w') planSel.week = +b.dataset.v; else planSel.day = b.dataset.v; viewPlan(); return; }
  const g = e.target.closest('[data-go="start"]'); if (g) { audio(); startSession(+g.dataset.w, g.dataset.d); }
});

// ---------- MOBILITY ----------
let mob = null;
function viewMobility() {
  $('#title').textContent = 'Mobility'; const recent = St.live('mobility').sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 8);
  let h = '<div class="card"><div class="small mut">Aim for 5-7 sessions a week. Alternate A and B.</div><div class="row" style="margin-top:6px"><span class="badge ' + (mobCount(7) >= 5 ? 'g' : '') + '">' + mobCount(7) + ' in the last 7 days</span></div></div>';
  ['A', 'B'].forEach((k) => { const r = P.MOBILITY[k]; h += '<div class="card"><h3>' + esc(r.name) + '</h3><table class="t">' + r.steps.map((s, i) => '<tr><td>' + (i + 1) + '</td><td>' + esc(s.n) + '<div class="small mut">' + esc(s.dose) + '</div></td><td class="small mut">' + mmss(s.s) + '</td></tr>').join('') + '</table><a class="btn pri block" style="margin-top:8px" href="#/mob/' + k + '">\u25B6 Start step-through (10 min)</a></div>'; });
  if (recent.length) h += '<div class="card"><h3>Recent</h3>' + recent.map((m) => '<div class="row sp small"><span>' + fmtDate(m.date) + ' \u00B7 Mobility ' + m.routine + ' \u00B7 ' + m.minutes + ' min</span><button class="sm bad" data-delmob="' + m.id + '">\u00D7</button></div>').join('') + '</div>';
  view.innerHTML = h;
}
function viewMobRun(k) {
  $('#title').textContent = P.MOBILITY[k].name.split(':')[0]; const r = P.MOBILITY[k];
  if (!mob || mob.k !== k) { mob = { k, i: 0, paused: false, endAt: Date.now() + r.steps[0].s * 1000, rem: 0, started: Date.now(), fin: false, lastTick: -1 }; audio(); wake(); }
  renderMob();
}
function renderMob() {
  const r = P.MOBILITY[mob.k]; const st = r.steps[mob.i];
  if (mob.fin) { view.innerHTML = '<div class="card"><h2>Mobility ' + mob.k + ' complete \u2713</h2><div class="small mut">Logged ' + mob.logged + ' min.</div><a class="btn pri block" style="margin-top:10px" href="#/today">Done</a></div>'; unwake(); return; }
  view.innerHTML = '<div class="card" style="text-align:center"><div class="small mut">Step ' + (mob.i + 1) + ' of ' + r.steps.length + '</div><div class="big-step">' + esc(st.n) + '</div><div class="mut">' + esc(st.dose) + '</div><div style="font-size:64px;font-weight:800;font-variant-numeric:tabular-nums;margin:12px 0" id="mob-t"></div><div class="bar"><i id="mob-bar" style="width:0"></i></div><div class="grid3" style="margin-top:14px"><button data-mob="back">\u23EE Back</button><button class="pri" data-mob="pause" id="mob-pause">' + (mob.paused ? 'Resume' : 'Pause') + '</button><button data-mob="next">Skip \u23ED</button></div><button class="block bad" style="margin-top:10px" data-mob="quit">Quit</button></div><div class="card small mut">Up next: ' + (r.steps[mob.i + 1] ? esc(r.steps[mob.i + 1].n) : 'finish') + '</div>';
  mobTick();
}
function mobGo(i) { const r = P.MOBILITY[mob.k]; if (i >= r.steps.length) { mobFinish(); return; } mob.i = Math.max(0, i); mob.endAt = Date.now() + r.steps[mob.i].s * 1000; mob.paused = false; mob.lastTick = -1; renderMob(); }
function mobFinish() {
  const mins = Math.max(1, Math.round((Date.now() - mob.started) / 60000)); const rec = St.add('mobility', { type: 'mobility', date: todayStr(), routine: mob.k, minutes: mins, stepsDone: mob.i + 1 });
  beep(988, 3); vib([300, 100, 300]); mob.fin = true; mob.logged = mins; window.__mobRec = rec.id; renderMob(); setTimeout(() => { mob = null; }, 0);
}
function mobTick() {
  if (!mob || mob.fin || !$('#mob-t')) return; const st = P.MOBILITY[mob.k].steps[mob.i];
  const rem = mob.paused ? mob.rem : (mob.endAt - Date.now()) / 1000;
  if (!mob.paused && rem <= 0) { beep(880, 2); vib([200, 100, 200]); mobGo(mob.i + 1); return; }
  $('#mob-t').textContent = mmss(Math.ceil(rem)); $('#mob-bar').style.width = Math.min(100, (1 - rem / st.s) * 100) + '%';
  const sec = Math.ceil(rem); if (!mob.paused && sec <= 3 && sec !== mob.lastTick) { mob.lastTick = sec; beep(660, 1, 0.08); }
}
view.addEventListener('click', (e) => {
  const b = e.target.closest('[data-mob]'); if (b && mob) { const a = b.dataset.mob;
    if (a === 'pause') { if (mob.paused) { mob.endAt = Date.now() + mob.rem * 1000; mob.paused = false; } else { mob.rem = (mob.endAt - Date.now()) / 1000; mob.paused = true; } $('#mob-pause').textContent = mob.paused ? 'Resume' : 'Pause'; }
    else if (a === 'next') mobGo(mob.i + 1); else if (a === 'back') mobGo(mob.i - 1); else if (a === 'quit') { mob = null; unwake(); location.hash = '#/mobility'; } return; }
  const d = e.target.closest('[data-delmob]'); if (d && confirm('Delete this mobility entry?')) { St.remove('mobility', d.dataset.delmob); viewMobility(); }
});

// ---------- BODY ----------
function viewBody() {
  $('#title').textContent = 'Body comp'; const list = St.live('bodycomp').sort((a, b) => (a.date < b.date ? 1 : -1)); const t = todayStr();
  const chart = (k, label, unit) => { const pts = list.slice().reverse().filter((b) => b[k] != null).map((b) => ({ x: parseYmd(b.date).getTime(), y: b[k] })); return pts.length >= 2 ? '<div class="small mut" style="margin-top:8px">' + label + '</div>' + lineChart([{ pts, color: 'var(--acc)' }], { date: true }) : ''; };
  let h = '<div class="card"><h3>Weekly body comp</h3><div class="small mut">Same morning each week, after the bathroom, before food/water. Waist at the navel (tape) is the most reliable trend.</div><div class="grid2"><div><label>Date</label><input type="date" id="b-date" value="' + t + '"></div><div><label>Weight (lb)</label><input inputmode="decimal" id="b-w" placeholder="188"></div><div><label>Body fat %</label><input inputmode="decimal" id="b-bf"></div><div><label>Muscle mass (lb)</label><input inputmode="decimal" id="b-mm"></div><div><label>Waist at navel (in)</label><input inputmode="decimal" id="b-waist"></div><div><label>Notes</label><input id="b-notes"></div></div><button class="pri block" style="margin-top:10px" data-body="add">Save entry</button></div>';
  if (list.length >= 2) { const a = list[0]; const cut = ymd(new Date(parseYmd(a.date).getTime() - 28 * 864e5)); const b = list.find((x) => x.date <= cut) || list[list.length - 1]; const dl = (k, u, d) => (a[k] != null && b[k] != null ? (a[k] - b[k] >= 0 ? '+' : '') + (a[k] - b[k]).toFixed(d || 1) + u : '\u2014');
    h += '<div class="card"><h3>Trend (' + fmtDate(b.date) + ' \u2192 ' + fmtDate(a.date) + ')</h3><div class="grid2 small"><div>Weight ' + dl('weight', ' lb') + '</div><div>Body fat ' + dl('bf', '%') + '</div><div>Muscle ' + dl('muscle', ' lb') + '</div><div>Waist ' + dl('waist', ' in') + '</div></div><div class="small mut">Look at 4-week trends. Creatine can add 1-2 kg of water that shows up as \u201Cmuscle\u201D.</div>' + chart('weight', 'Weight (lb)') + chart('bf', 'Body fat %') + chart('muscle', 'Muscle mass (lb)') + chart('waist', 'Waist (in)') + '</div>'; }
  if (list.length) h += '<div class="card"><table class="t"><tr><th>Date</th><th>Wt</th><th>BF%</th><th>Musc</th><th>Waist</th><th></th></tr>' + list.map((b) => '<tr><td>' + esc(b.date.slice(5)) + '</td><td>' + (b.weight != null ? b.weight : '') + '</td><td>' + (b.bf != null ? b.bf : '') + '</td><td>' + (b.muscle != null ? b.muscle : '') + '</td><td>' + (b.waist != null ? b.waist : '') + '</td><td><button class="sm bad" data-body="del" data-id="' + b.id + '">\u00D7</button></td></tr>').join('') + '</table></div>';
  view.innerHTML = h;
}
view.addEventListener('click', (e) => {
  const b = e.target.closest('[data-body]'); if (!b) return;
  if (b.dataset.body === 'add') { const v = (id) => C.num($('#' + id).value); const date = $('#b-date').value; if (!v('b-w') && !v('b-bf') && !v('b-mm') && !v('b-waist')) { toast('Enter at least one value'); return; }
    const wkS = (() => { const d = parseYmd(date); const dow = (d.getDay() + 6) % 7; return ymd(new Date(d.getTime() - dow * 864e5)); })();
    St.add('bodycomp', { type: 'bodycomp', date, weekStart: wkS, weight: v('b-w'), bf: v('b-bf'), muscle: v('b-mm'), waist: v('b-waist'), notes: $('#b-notes').value }); toast('Saved'); viewBody(); }
  else if (b.dataset.body === 'del' && confirm('Delete this entry?')) { St.remove('bodycomp', b.dataset.id); viewBody(); }
});

// ---------- charts ----------
function lineChart(series, opt) {
  opt = opt || {}; const w = 340, h = 150, L = 40, Rr = 10, Tt = 10, Bb = 22;
  const all = series.reduce((a, s) => a.concat(s.pts), []); if (!all.length) return '<div class="small mut">No data yet.</div>';
  let x0 = Math.min(...all.map((p) => p.x)), x1 = Math.max(...all.map((p) => p.x)), y0 = Math.min(...all.map((p) => p.y)), y1 = Math.max(...all.map((p) => p.y));
  if (x0 === x1) { x0 -= 1; x1 += 1; } const yp = (y1 - y0) * 0.12 || Math.abs(y1) * 0.1 || 1; y0 -= yp; y1 += yp;
  const X = (x) => L + (x - x0) / (x1 - x0) * (w - L - Rr), Y = (y) => Tt + (1 - (y - y0) / (y1 - y0)) * (h - Tt - Bb);
  const fy = (v) => (Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2));
  const fx = (v) => (opt.date ? new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : v.toFixed(0));
  let g = '<svg class="chart" viewBox="0 0 ' + w + ' ' + h + '" role="img">';
  [0, 0.5, 1].forEach((f) => { const y = Tt + f * (h - Tt - Bb); g += '<line x1="' + L + '" x2="' + (w - Rr) + '" y1="' + y + '" y2="' + y + '" stroke="var(--line)" stroke-width="1"/><text x="' + (L - 4) + '" y="' + (y + 4) + '" text-anchor="end" font-size="10" fill="var(--mut)">' + fy(y1 - f * (y1 - y0)) + '</text>'; });
  g += '<text x="' + L + '" y="' + (h - 6) + '" font-size="10" fill="var(--mut)">' + fx(x0) + '</text><text x="' + (w - Rr) + '" y="' + (h - 6) + '" text-anchor="end" font-size="10" fill="var(--mut)">' + fx(x1) + '</text>';
  series.forEach((s) => { const pts = s.pts.slice().sort((a, b) => a.x - b.x); if (s.line !== false && pts.length > 1) g += '<polyline fill="none" stroke="' + s.color + '" stroke-width="2" points="' + pts.map((p) => X(p.x).toFixed(1) + ',' + Y(p.y).toFixed(1)).join(' ') + '"/>';
    if (s.fit) g += '<line x1="' + X(s.fit[0].x).toFixed(1) + '" y1="' + Y(s.fit[0].y).toFixed(1) + '" x2="' + X(s.fit[1].x).toFixed(1) + '" y2="' + Y(s.fit[1].y).toFixed(1) + '" stroke="' + s.color + '" stroke-dasharray="4 3" stroke-width="1.5"/>';
    pts.forEach((p) => { g += '<circle cx="' + X(p.x).toFixed(1) + '" cy="' + Y(p.y).toFixed(1) + '" r="3.5" fill="' + s.color + '"/>'; }); });
  return g + '</svg>';
}

// ---------- HISTORY ----------
let histLift = null;
function setSummary(ex, set) {
  const bits = []; if (set.load) bits.push(set.load + (ex && ex.bw ? '+' : '') + ' lb'); if (set.reps != null && !(ex && ex.kind === 'timed')) bits.push('\u00D7' + set.reps); if (set.secs) bits.push(set.secs + ' s'); if (set.dist) bits.push(set.dist + ' m'); if (set.metric != null && set.metric !== '') bits.push(set.metric + ' ' + (ex ? unitOf(ex) : ''));
  if (set.rir) bits.push('RIR ' + set.rir); if (set.mv1 != null) bits.push(set.mv1.toFixed(2) + (set.mvl != null ? '\u2192' + set.mvl.toFixed(2) : '') + ' m/s'); if (set.vl != null) bits.push('VL ' + Math.round(set.vl) + '%'); return bits.join(' ');
}
function viewHistory() {
  $('#title').textContent = 'History'; const hist = buildHist(); const lifts = Object.keys(hist).filter((k) => hist[k].some((x) => x.sets.length || x.ramp.length)).sort((a, b) => (LIFTNAMES[a] || a).localeCompare(LIFTNAMES[b] || b));
  if (!histLift || !lifts.includes(histLift)) histLift = lifts.includes('floorpress') ? 'floorpress' : lifts[0] || null;
  let h = '';
  if (!sessions().length) h += '<div class="card"><h3>No sessions yet</h3><div class="small mut">Charts appear after your first logged session.</div></div>';
  if (histLift) {
    const rows = hist[histLift]; const first = rows[0].ex; const unit = unitOf(first);
    const top = rows.map((r) => { const sets = r.sets.length ? r.sets : []; const loads = sets.filter((x) => x.load > 0); const tl = loads.length ? loads.slice().sort((a, b) => b.load - a.load || (b.reps || 0) - (a.reps || 0))[0] : null; return { x: parseYmd(r.date).getTime(), sets, tl, ramp: r.ramp }; });
    const hasLoad = top.some((t) => t.tl); const hasMV = top.some((t) => t.tl && t.tl.mv1) ;
    h += '<div class="card"><label>Lift</label><select id="h-lift">' + lifts.map((k) => '<option value="' + k + '"' + (k === histLift ? ' selected' : '') + '>' + esc(LIFTNAMES[k] || k) + '</option>').join('') + '</select>';
    if (hasLoad) {
      h += '<div class="small mut" style="margin-top:10px">Top-set load (lb)</div>' + lineChart([{ pts: top.filter((t) => t.tl).map((t) => ({ x: t.x, y: t.tl.load })), color: 'var(--acc)' }], { date: true });
      if (first.kind === 'reps') h += '<div class="small mut" style="margin-top:10px">Estimated 1RM, best set (Epley, lb)</div>' + lineChart([{ pts: top.map((t) => ({ x: t.x, y: Math.max(0, ...t.sets.map((s) => C.e1rm(s.load, s.reps) || 0)) })).filter((p) => p.y > 0), color: 'var(--info)' }], { date: true });
      if (hasMV) h += '<div class="small mut" style="margin-top:10px">First-rep MV at the top set (m/s)</div>' + lineChart([{ pts: top.filter((t) => t.tl && t.tl.mv1).map((t) => ({ x: t.x, y: t.tl.mv1 })), color: 'var(--warn)' }], { date: true });
    } else {
      const key = first.kind === 'timed' ? 'secs' : first.kind === 'carry' ? 'dist' : first.kind === 'power' && first.metric !== 'reps' ? 'metric' : 'reps';
      const pts = top.map((t) => ({ x: t.x, y: Math.max(0, ...t.sets.map((s) => s[key] || 0)) })).filter((p) => p.y > 0);
      h += '<div class="small mut" style="margin-top:10px">Best ' + (key === 'metric' ? unit : key) + ' per session</div>' + lineChart([{ pts, color: 'var(--acc)' }], { date: true });
    }
    h += '<table class="t" style="margin-top:10px"><tr><th>Date</th><th>Sets</th></tr>' + rows.slice().reverse().slice(0, 8).map((r) => '<tr><td>' + esc(r.date.slice(5)) + '</td><td class="small">' + esc(r.sets.map((s) => setSummary(r.ex, s)).join(' | ')) + '</td></tr>').join('') + '</table></div>';
  }
  // profiles
  const profs = St.live('profiles').filter((p) => p.fit).sort((a, b) => (a.date < b.date ? -1 : 1)); const pl = Array.from(new Set(profs.map((p) => p.lift)));
  pl.forEach((l) => { const ps = profs.filter((p) => p.lift === l); const f = ps[0], la = ps[ps.length - 1]; const cols = ['var(--warn)', 'var(--acc)', 'var(--info)'];
    h += '<div class="card"><h3>Load-velocity profile: ' + esc(LIFTNAMES[l] || l) + '</h3>' + lineChart(ps.slice(-3).map((p, k) => ({ pts: p.points.map((q) => ({ x: q.load, y: q.mv })), color: cols[k % 3], line: false, fit: [{ x: p.fit.minX, y: C.mvAtLoad(p.fit, p.fit.minX) }, { x: p.fit.maxX, y: C.mvAtLoad(p.fit, p.fit.maxX) }] })));
    h += '<table class="t"><tr><th>MV</th><th>Wk ' + f.week + ' (' + f.date.slice(5) + ')</th>' + (ps.length > 1 ? '<th>Wk ' + la.week + ' (' + la.date.slice(5) + ')</th><th>\u0394</th>' : '') + '</tr>' + C.VELS.map((v) => { const a = C.loadAtV(f.fit, v), b = C.loadAtV(la.fit, v); return '<tr><td>' + v.toFixed(2) + '</td><td>' + Math.round(a) + '</td>' + (ps.length > 1 ? '<td>' + Math.round(b) + '</td><td class="' + (b - a >= 0 ? 'pill-ok' : 'pill-bad') + '">' + (b - a >= 0 ? '+' : '') + Math.round(b - a) + '</td>' : '') + '</tr>'; }).join('') + '</table><div class="small mut">Load at 0.70 and 0.50 m/s is the cleanest strength metric across the 12 weeks.</div></div>'; });
  // weekly load
  const byW = {}; sessions().filter((s) => s.status === 'done').forEach((s) => { const o = (byW[s.week] = byW[s.week] || { n: 0, srpe: 0, min: 0 }); o.n++; o.srpe += (s.finish && s.finish.srpe) || 0; o.min += (s.finish && s.finish.minutes) || 0; });
  const ws = Object.keys(byW).map(Number).sort((a, b) => a - b);
  if (ws.length) h += '<div class="card"><h3>Weekly load</h3><table class="t"><tr><th>Week</th><th>Sessions</th><th>Minutes</th><th>sRPE</th></tr>' + ws.map((w) => '<tr><td>' + w + '</td><td>' + byW[w].n + '/3</td><td>' + Math.round(byW[w].min) + '</td><td>' + byW[w].srpe + '</td></tr>').join('') + '</table></div>';
  const ss = sessions().sort((a, b) => ((a.date + a.startedAt) < (b.date + b.startedAt) ? 1 : -1));
  if (ss.length) h += '<div class="card"><h3>Sessions</h3>' + ss.map((s) => { const R = Prog.resolve(s.week, s.day); const f = s.finish || {};
    return '<details style="margin:6px 0"><summary><b>' + fmtDate(s.date) + '</b> \u00B7 W' + s.week + ' ' + s.day + ' \u00B7 ' + (s.status === 'done' ? (f.minutes || '?') + ' min, RPE ' + (f.rpe || '?') : '<span class="pill-warn">in progress</span>') + '</summary>' +
      '<table class="t">' + R.exercises.filter((x) => x.kind !== 'check' && s.ex[x.id]).map((x) => { const d = s.ex[x.id]; const sets = (d.sets || []).filter((q) => q.done).map((q) => setSummary(x, q)); const rp = (d.ramp || []).filter((q) => q.done).map((q) => q.load + (q.mv != null ? '@' + q.mv : '')); return (sets.length || rp.length) ? '<tr><td><b>' + esc(x.name.replace(/\s*\(.*$/, '')) + '</b><div class="small mut">' + esc(sets.concat(rp).join(' | ')) + '</div></td></tr>' : ''; }).join('') + '</table>' +
      '<div class="small mut">' + esc(s.hdr && s.hdr.sleep != null ? 'sleep ' + s.hdr.sleep + ' h, ' : '') + (f.srpe ? 'sRPE ' + f.srpe : '') + (f.notes ? ' \u00B7 ' + esc(f.notes) : '') + '</div><div class="row" style="margin-top:6px">' + (s.status === 'active' ? '<a class="btn sm" href="#/session/' + s.id + '">Open</a>' : '<a class="btn sm" href="#/session/' + s.id + '">View / edit</a>') + '<button class="sm bad" data-delsess="' + s.id + '">Delete</button></div></details>'; }).join('') + '</div>';
  view.innerHTML = h || '';
}
view.addEventListener('change', (e) => { if (e.target.id === 'h-lift') { histLift = e.target.value; viewHistory(); } });
view.addEventListener('click', (e) => { const d = e.target.closest('[data-delsess]'); if (d && confirm('Delete this session and its data?')) { St.remove('sessions', d.dataset.delsess); viewHistory(); } });

// ---------- PRINT SHEET ----------
function viewSheet(w, d) {
  $('#title').textContent = 'Log sheet'; w = +w; const R = Prog.resolve(w, d);
  let h = '<div class="card noprint"><div class="row sp"><b>Printable / fillable log sheet</b><span class="row"><button class="pri" onclick="window.print()">Print / Save PDF</button><a class="btn" href="#/plan">Back</a></span></div><div class="small mut">Fill on screen or on paper. For a spreadsheet version download the pre-filled CSV in \u2699 Data. Paper entries can be typed into the app later.</div></div><div class="sheet card"><h2>Brandon \u2014 Week ' + w + ' Day ' + d + ' \u00B7 ' + esc(P.DAYS[d].name) + ' \u00B7 target ' + R.target + ' min' + (R.deload ? ' (DELOAD)' : '') + '</h2><div class="row small">Date <input style="width:110px"> Sleep h <input style="width:50px"> Readiness 1-5 <input style="width:40px"> Soreness 0-10 <input style="width:40px"> where <input style="width:90px"></div>';
  if (['A', 'B'].includes(d) && w > 1) h += '<div class="small" style="margin:6px 0">Readiness set: load <input style="width:60px"> best MV <input style="width:60px"> baseline <input style="width:60px"> diff <input style="width:60px"></div>';
  h += '<table><tr><th style="width:34%">Exercise / prescription</th><th>Set 1</th><th>Set 2</th><th>Set 3</th><th>Set 4</th><th>Set 5</th></tr>';
  R.exercises.forEach((ex) => {
    if (ex.kind === 'check') { h += '<tr><td colspan="6">\u2610 <b>' + esc(ex.name) + '</b> \u2014 ' + esc(ex.desc) + '</td></tr>'; return; }
    const n = ex.kind === 'ramp' ? 6 : ex.setSpecs.length; const vb = ex.vbt ? 'lb / reps / MV1 / MVlast / RIR' : ex.kind === 'timed' ? 'seconds' : ex.kind === 'carry' ? 'lb / m' : ex.kind === 'power' ? unitOf(ex) : 'lb / reps / RIR';
    h += '<tr><td><b>' + esc(ex.name) + '</b><div class="small">' + esc(metaOf(ex)) + '</div><div class="small">' + vb + '</div></td>';
    for (let i = 0; i < 5; i++) h += '<td>' + (i < n ? '<input style="width:100%"><br><input style="width:100%">' : '') + '</td>';
    h += '</tr>';
  });
  h += '</table><div class="small" style="margin-top:8px">Total min <input style="width:50px"> Session RPE (1-10) <input style="width:40px"> sRPE = RPE \u00D7 min <input style="width:60px"> Pain 0-10 / where <input style="width:120px"><br>Notes <input style="width:80%"></div></div>';
  view.innerHTML = h;
}

// ---------- DATA / SETTINGS ----------
function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/plain' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
function viewData() {
  $('#title').textContent = 'Data & settings';
  const ds = St.data; const counts = St.live('sessions').length + ' sessions, ' + St.live('bodycomp').length + ' body entries, ' + St.live('profiles').length + ' profiles, ' + St.live('mobility').length + ' mobility';
  const nx = nextScheduled(todayStr()) || { week: 1, day: 'A' };
  view.innerHTML = '<div class="card"><h3>Backup / export</h3><div class="small mut">' + counts + '. Everything is stored on this device first. Export regularly if you do not use sync.</div><div class="grid2" style="margin-top:8px"><button class="pri" data-d="json">Export JSON (full)</button><button data-d="csv">Export training CSV</button><button data-d="bcsv">Export body CSV</button><button data-d="impbtn">Import JSON / CSV\u2026</button></div><input type="file" id="d-file" accept=".json,.csv,text/csv,application/json" hidden></div>' +
    '<div class="card"><h3>Fallback log sheet</h3><div class="small mut">Pre-filled sheet for one session (print it, or open the CSV in Excel/Sheets).</div><div class="grid3" style="margin-top:8px"><div><label>Week</label><select id="s-w">' + Array.from({ length: 12 }, (_, i) => '<option' + (i + 1 === nx.week ? ' selected' : '') + '>' + (i + 1) + '</option>').join('') + '</select></div><div><label>Day</label><select id="s-d">' + ['A', 'B', 'C'].map((d) => '<option' + (d === nx.day ? ' selected' : '') + '>' + d + '</option>').join('') + '</select></div><div><label>&nbsp;</label><button class="block" data-d="sheet">Open sheet</button></div></div><button class="block" style="margin-top:8px" data-d="prefcsv">Download pre-filled CSV</button></div>' +
    '<div class="card"><h3>Sync (optional)</h3><div class="small mut">Pushes your data to your private Google Sheet (or the box server) so your assistant can read it. Local data stays the source of truth.</div><label>Sync URL</label><input id="y-url" value="' + esc(S.syncUrl) + '" placeholder="https://script.google.com/macros/s/.../exec"><label>Secret token</label><input id="y-tok" type="password" value="' + esc(S.syncToken) + '" autocomplete="off"><div class="row" style="margin-top:8px"><label style="display:flex;align-items:center;gap:8px;margin:0"><input type="checkbox" id="y-auto" style="width:24px;min-height:24px" ' + (S.autoSync ? 'checked' : '') + '> auto-sync after changes</label></div><div class="grid2" style="margin-top:8px"><button data-d="savesync">Save</button><button class="pri" data-d="syncnow">Sync now</button></div><div class="small" id="y-msg" style="margin-top:6px">' + esc(S.lastSyncMsg || 'Not synced yet') + (S.lastSync ? ' \u00B7 ' + new Date(S.lastSync).toLocaleString() : '') + '</div></div>' +
    '<div class="card"><h3>Settings</h3><div class="grid2"><div><label>Program start (Monday)</label><input type="date" id="x-start" value="' + esc(S.startDate) + '"></div><div><label>Theme</label><select id="x-theme">' + ['auto', 'dark', 'light'].map((t) => '<option' + (S.theme === t ? ' selected' : '') + '>' + t + '</option>').join('') + '</select></div></div><div class="row" style="margin-top:8px"><label style="display:flex;align-items:center;gap:8px;margin:0"><input type="checkbox" id="x-sound" style="width:24px;min-height:24px" ' + (S.sound ? 'checked' : '') + '> beep</label><label style="display:flex;align-items:center;gap:8px;margin:0"><input type="checkbox" id="x-vib" style="width:24px;min-height:24px" ' + (S.vibrate ? 'checked' : '') + '> vibrate</label><button class="sm" data-d="beeptest">Test beep</button></div><button class="block" style="margin-top:8px" data-d="savesettings">Save settings</button></div>' +
    '<div class="card"><h3>Danger zone</h3><button class="bad block" data-d="reset">Erase all data on this device</button><div class="small mut" style="margin-top:6px">Device id ' + esc(S.deviceId) + '</div></div>';
}
view.addEventListener('click', (e) => {
  const b = e.target.closest('[data-d]'); if (!b) return; const a = b.dataset.d; const stamp = todayStr();
  if (a === 'json') download('workout-backup-' + stamp + '.json', St.exportJSON(), 'application/json');
  else if (a === 'csv') download('training_log-' + stamp + '.csv', St.trainingCSV(), 'text/csv');
  else if (a === 'bcsv') download('weekly_bodycomp-' + stamp + '.csv', St.bodyCSV(), 'text/csv');
  else if (a === 'impbtn') $('#d-file').click();
  else if (a === 'sheet') location.hash = '#/sheet/' + $('#s-w').value + '/' + $('#s-d').value;
  else if (a === 'prefcsv') download('log_W' + $('#s-w').value + $('#s-d').value + '_prefilled.csv', St.prefilledCSV(+$('#s-w').value, $('#s-d').value), 'text/csv');
  else if (a === 'savesync' || a === 'syncnow') { S.syncUrl = $('#y-url').value.trim(); S.syncToken = $('#y-tok').value.trim(); S.autoSync = $('#y-auto').checked; St.saveSettings();
    if (a === 'syncnow') { $('#y-msg').textContent = 'Syncing\u2026'; St.syncNow().then((r) => { $('#y-msg').textContent = 'Synced \u2713 pulled ' + r.pulled + ', pushed ' + r.pushed; }).catch((er) => { $('#y-msg').textContent = 'Error: ' + er.message; }); } else toast('Saved'); }
  else if (a === 'savesettings') { S.startDate = $('#x-start').value || S.startDate; S.theme = $('#x-theme').value; S.sound = $('#x-sound').checked; S.vibrate = $('#x-vib').checked; St.saveSettings(); applyTheme(); toast('Saved'); }
  else if (a === 'beeptest') { audio(); beep(880, 2); vib(200); }
  else if (a === 'reset') { if (confirm('Erase ALL local workout data? Export first!') && confirm('Really erase everything?')) { St.resetAll(); toast('Erased'); viewData(); } }
});
view.addEventListener('change', (e) => {
  if (e.target.id !== 'd-file') return; const f = e.target.files[0]; if (!f) return; const rd = new FileReader();
  rd.onload = () => { try { if (/\.csv$/i.test(f.name)) { const r = St.importCSV(rd.result); toast('Imported ' + r.sessions + ' sessions, ' + r.body + ' body rows' + (r.skipped ? ' (' + r.skipped + ' skipped)' : '')); } else { const n = St.importJSON(rd.result); toast('Imported/merged ' + n + ' records'); } viewData(); } catch (er) { toast('Import failed: ' + er.message, 5000); } e.target.value = ''; };
  rd.readAsText(f);
});

// ---------- router / init ----------
function applyTheme() { document.documentElement.dataset.theme = S.theme || 'auto'; }
function route() {
  const h = location.hash || '#/today'; const p = h.slice(2).split('/'); const k = p[0];
  document.body.classList.toggle('sess', k === 'session');
  if (k !== 'session') { curSid = null; if (!(k === 'mob' && mob)) unwake(); }
  if (k !== 'mob' && mob && !mob.fin) { /* keep running in background */ }
  $$('#nav a').forEach((a) => a.classList.toggle('on', a.dataset.tab === (k === 'mob' ? 'mobility' : k === 'sheet' ? 'plan' : k)));
  window.scrollTo(0, 0);
  if (k === 'session') renderSession(p[1]);
  else if (k === 'plan') viewPlan(); else if (k === 'mobility') viewMobility(); else if (k === 'mob') viewMobRun(p[1] === 'B' ? 'B' : 'A');
  else if (k === 'body') viewBody(); else if (k === 'history') viewHistory(); else if (k === 'data') viewData(); else if (k === 'sheet') viewSheet(p[1], p[2]);
  else viewToday();
  renderDock();
}
window.addEventListener('hashchange', route);
$('#gear').addEventListener('click', () => { location.hash = '#/data'; });
St.onChange((what) => { const dot = $('#syncdot'); if (what === 'status') { dot.className = 'dot ' + St.status; } else if (what === 'data') route(); });
if (S.syncUrl) { $('#syncdot').className = 'dot' + (S.lastSyncMsg.startsWith('OK') ? ' ok' : S.lastSyncMsg.startsWith('Error') ? ' err' : ''); }
applyTheme();
// One-tap setup link: <app-url>#sync=<base64url({"u":"<apps-script /exec url>","t":"<token>"})>  (fragment never leaves the device)
let justConfigured = false;
if (location.hash.indexOf('#sync=') === 0) {
  try {
    const b64 = location.hash.slice(6).replace(/-/g, '+').replace(/_/g, '/'); const j = JSON.parse(decodeURIComponent(escape(atob(b64 + '==='.slice((b64.length + 3) % 4)))));
    if (j.u && j.t && /^(https:\/\/|http:\/\/(127\.0\.0\.1|localhost))/.test(j.u)) { S.syncUrl = j.u; S.syncToken = j.t; S.autoSync = true; S.lastPush = 0; St.saveSettings(); justConfigured = true; }
  } catch (e) { /* ignore bad link */ }
  history.replaceState(null, '', location.pathname + location.search + '#/data');
}
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
route();
if (justConfigured) { toast('Sync configured. Syncing\u2026', 3500); St.syncNow().then((r) => { toast('Synced \u2713 pulled ' + r.pulled + ', pushed ' + r.pushed, 4000); if (location.hash === '#/data') viewData(); }).catch((e) => toast('Sync failed: ' + e.message, 6000)); }
else if (S.syncUrl && S.autoSync) St.syncNow().catch(() => {});
window.__app = { route, startSession, Store: St, Prog, Calc: C };
})();
