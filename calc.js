/* Pure helpers: regression, VBT math, readiness check, CSV, flattening, merge. Works in browser and node. */
(function (root) {
  const num = (v) => { if (v === '' || v == null) return null; const n = parseFloat(v); return isNaN(n) ? null : n; };
  const r1 = (x, d = 1) => (x == null || isNaN(x) ? null : Math.round(x * Math.pow(10, d)) / Math.pow(10, d));
  const round5 = (x) => Math.round(x / 5) * 5;

  function linreg(pts) { // pts: [{x,y}]
    const p = pts.filter((q) => q.x != null && q.y != null && !isNaN(q.x) && !isNaN(q.y));
    const n = p.length; if (n < 2) return null;
    const mx = p.reduce((a, q) => a + q.x, 0) / n, my = p.reduce((a, q) => a + q.y, 0) / n;
    let sxx = 0, sxy = 0, syy = 0;
    p.forEach((q) => { sxx += (q.x - mx) ** 2; sxy += (q.x - mx) * (q.y - my); syy += (q.y - my) ** 2; });
    if (sxx === 0) return null;
    const slope = sxy / sxx, intercept = my - slope * mx;
    const r2 = syy === 0 ? 1 : (sxy * sxy) / (sxx * syy);
    return { slope, intercept, r2, n, minX: Math.min(...p.map((q) => q.x)), maxX: Math.max(...p.map((q) => q.x)) };
  }
  const loadAtV = (fit, v) => (fit && fit.slope < 0 ? (v - fit.intercept) / fit.slope : null);
  const mvAtLoad = (fit, load) => (fit ? fit.intercept + fit.slope * load : null);
  const VELS = [1.0, 0.85, 0.70, 0.60, 0.50];
  function loadsTable(fit) { return VELS.map((v) => { const l = loadAtV(fit, v); return { v, load: l, extrap: l != null && (l > fit.maxX + 1 || l < fit.minX - 1) }; }); }
  const vlPct = (mv1, mvl) => (mv1 > 0 && mvl != null ? ((mv1 - mvl) / mv1) * 100 : null);
  const e1rm = (load, reps) => (load > 0 && reps > 0 ? load * (1 + reps / 30) : null);
  const firstNum = (v) => { const m = String(v == null ? '' : v).match(/\d+(\.\d+)?/); return m ? parseFloat(m[0]) : null; };
  const topNum = (v) => { const m = String(v == null ? '' : v).match(/(\d+)(?:\s*-\s*(\d+))?/); return m ? parseInt(m[2] || m[1], 10) : null; };

  // Readiness rules (program section 3): diff = baseline - measured (positive => slower than baseline)
  function readiness(measured, baseline, sleep, soreness, readinessScore) {
    if (measured == null || baseline == null) return null;
    const diff = Math.round((baseline - measured) * 1000) / 1000;
    const poor = (sleep != null && sleep < 6) || (readinessScore != null && readinessScore <= 2);
    let level, text;
    if (diff > 0.10 || (poor && soreness != null && soreness >= 7)) { level = 'bad'; text = 'Cut working loads ~10%, drop one set, skip hard intervals, add extra mobility.'; }
    else if (diff > 0.05) { level = 'warn'; text = 'Cut working loads ~5% and tighten VL cutoff by 5 points.'; }
    else if (diff < -0.05) { level = 'good'; text = 'Faster than baseline: you may add ~5% to working loads.'; }
    else { level = 'ok'; text = 'Within \u00B10.05 m/s of baseline: train as written.'; }
    return { diff, level, text };
  }

  // ---------- CSV ----------
  const COLUMNS = ['date', 'week', 'day', 'sleep_h', 'readiness_1to5', 'soreness_0to10', 'soreness_location', 'readiness_load_lb', 'readiness_best_MV', 'baseline_MV', 'MV_diff', 'exercise', 'load_lb', 'set', 'reps', 'first_rep_MV', 'best_MV', 'last_rep_MV', 'VL_pct', 'RIR', 'rest_s', 'power_metric(height/dist/watts)', 'pain_0to10_location', 'session_min', 'session_RPE', 'sRPE_load', 'notes', 'session_id', 'ex_id', 'lift', 'secs', 'dist_m', 'metric_unit', 'set_done'];
  const BODY_COLUMNS = ['week_start', 'date_measured', 'bodyweight_lb', 'body_fat_pct', 'muscle_mass_lb', 'waist_navel_in', 'avg_sleep_h', 'weekly_sRPE_total', 'mobility_sessions', 'notes', 'record_id'];
  function esc(v) { if (v == null) return ''; const s = String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  const toCSV = (cols, rows) => [cols.join(',')].concat(rows.map((r) => r.map(esc).join(','))).join('\n') + '\n';
  function parseCSV(text) {
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
      else cur += c;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows.filter((r) => r.some((x) => x !== ''));
  }

  // session -> flat rows (one per logged set). resolved = Prog.resolve(week, day)
  function sessionRows(s, resolved) {
    const h = s.hdr || {}, f = s.finish || {}, rd = s.ready || {};
    const rkey = Object.keys(rd).find((k) => rd[k] && rd[k].mv != null);
    const R = rkey ? rd[rkey] : {};
    const out = [];
    const base = (ex, i, set, extra) => {
      const spec = ex && ex.setSpecs ? ex.setSpecs[i] : null;
      return [s.date, s.week, s.day, h.sleep, h.readiness, h.soreness, h.sorenessLoc, R.load, R.mv, R.baseline != null ? r1(R.baseline, 3) : '', R.diff != null ? r1(R.diff, 3) : '',
        ex ? ex.name : '', set.load, i + 1, set.reps, set.mv1, set.mvb != null ? set.mvb : (set.mv1 != null ? set.mv1 : ''), set.mvl, set.mv1 != null && set.mvl != null ? r1(vlPct(set.mv1, set.mvl), 1) : '', set.rir, extra.rest != null ? extra.rest : '',
        set.metric, f.pain ? f.pain + (f.painLoc ? ' ' + f.painLoc : '') : '', f.minutes, f.rpe, f.srpe, set.note || '', s.id, ex ? ex.id : '', ex ? ex.lift || '' : '', set.secs, set.dist, set.unit || '', set.done ? 1 : 0];
    };
    const exMap = {}; (resolved ? resolved.exercises : []).forEach((e) => { exMap[e.id] = e; });
    Object.keys(s.ex || {}).forEach((id) => {
      const ex = exMap[id]; const d = s.ex[id];
      if (ex && ex.kind === 'check') return;
      (d.ramp || []).forEach((r, i) => { if (r.load == null && r.mv == null) return; out.push(base(ex, i, { load: r.load, reps: r.reps, mv1: r.mv, mvb: r.mv, done: true, note: 'ramp' }, { rest: '' })); });
      (d.sets || []).forEach((set, i) => { if (!set || !set.done) return; set = Object.assign({}, set, { unit: ex && ex.metric ? ex.metric : '' }); out.push(base(ex, i, set, { rest: ex ? ex.rest : '' })); });
    });
    return out;
  }
  function bodyRow(b) { return [b.weekStart || '', b.date, b.weight, b.bf, b.muscle, b.waist, b.sleep || '', b.srpeTotal || '', b.mobility || '', b.notes || '', b.id]; }

  // last-write-wins merge by id
  function mergeRecords(local, remote) {
    const m = new Map(); local.forEach((r) => m.set(r.id, r));
    let changed = 0;
    // last-write-wins by updatedAt, except a delete (tombstone) always wins over a live copy so deletes never resurrect (guards against clock skew)
    remote.forEach((r) => { const l = m.get(r.id); if (!l) { m.set(r.id, r); changed++; return; }
      const take = l.deleted && !r.deleted ? false : r.deleted && !l.deleted ? true : (r.updatedAt || 0) > (l.updatedAt || 0);
      if (take) { m.set(r.id, r); changed++; } });
    return { list: Array.from(m.values()), changed };
  }
  // Suggest a working load from prior sessions of one lift.
  // sessions: [{ date, ts?, week?, deload?, sets: [{ load, reps?, dist?, done? }] }] (done sets; undone ignored)
  // scheme:   { sets, reps }  reps may be a number or a range like "6-8" (the top of the range is the target)
  // opts:     { bw, isDeload(session) }
  // Returns { load, basis, confidence, rough } or null. confidence is "high" | "medium" | "low".
  //
  // Rules:
  // - Bodyweight exercises and sessions with no positive load return null.
  // - Deload sessions (session.deload, opts.isDeload, or week % 4 === 0) are dropped so a light week cannot pull the suggestion down.
  // - Exact scheme (same reps, set count within 1) repeats that session's load. The winning session is the best score, not an average.
  // - A different rep count is converted with Epley — e1RM = load * (1 + reps/30) — inverted at the target reps, then rounded to the nearest 5 lb.
  // - Targets above 8 reps are discounted 1.5% per extra rep (cap 10%) because rep-max formulas run hot there. Exact repeats are not discounted.
  // - Score = 0.5^age * 0.55^|rep difference| * 0.6^|set difference| (age 0 = newest usable session). Closer reps can outrank a newer but dissimilar session.
  // - When no exact scheme exists, scored sessions are combined as a weighted average of their converted loads.
  // - A single outlier (one session more than 12% and at least 15 lb from the median, with two or more sessions that agree) is clamped to that band so it cannot swing the result.
  const SUGGEST_RECENCY = 0.5, SUGGEST_REP = 0.55, SUGGEST_SET = 0.6;
  const SUGGEST_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function suggestMedian(nums) {
    const a = nums.slice().sort((x, y) => x - y); if (!a.length) return null;
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }
  function suggestFmtLoad(n) {
    if (n == null || isNaN(n)) return '';
    if (Math.abs(n - Math.round(n)) < 1e-6) return String(Math.round(n));
    return String(Math.round(n * 10) / 10);
  }
  function suggestShortDate(date) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(date || ''));
    if (!m) return '';
    return SUGGEST_MONTHS[+m[2] - 1] + ' ' + (+m[3]);
  }
  function suggestIsDeload(s, opts) {
    if (!s) return false;
    if (s.deload) return true;
    if (opts && typeof opts.isDeload === 'function') return !!opts.isDeload(s);
    return s.week != null && s.week % 4 === 0;
  }
  function suggestReps(v) {
    if (v == null || v === '') return null;
    const n = typeof v === 'number' ? v : parseFloat(v);
    return n > 0 && !isNaN(n) ? Math.round(n) : null;
  }
  function suggestSummarize(sets, targetReps) {
    const usable = (sets || []).filter((s) => s && s.done !== false && typeof s.load === 'number' && s.load > 0 && !isNaN(s.load));
    if (!usable.length) return null;
    const parsed = usable.map((s) => ({ load: s.load, reps: suggestReps(s.reps), dist: (typeof s.dist === 'number' && s.dist > 0 ? s.dist : null) }));
    const withReps = parsed.filter((s) => s.reps != null);
    let cluster;
    if (targetReps != null && withReps.length) {
      let bestD = Infinity;
      withReps.forEach((s) => { const d = Math.abs(s.reps - targetReps); if (d < bestD) bestD = d; });
      const counts = new Map();
      withReps.forEach((s) => { if (Math.abs(s.reps - targetReps) === bestD) counts.set(s.reps, (counts.get(s.reps) || 0) + 1); });
      let pick = null, pickN = -1;
      counts.forEach((n, r) => { if (n > pickN || (n === pickN && r < pick)) { pick = r; pickN = n; } });
      cluster = withReps.filter((s) => s.reps === pick);
    } else cluster = parsed;
    const loads = cluster.map((s) => s.load);
    const dists = cluster.map((s) => s.dist).filter((d) => d != null);
    const reps = cluster[0].reps != null && cluster.every((s) => s.reps === cluster[0].reps) ? cluster[0].reps : null;
    return { load: suggestMedian(loads), uniform: loads.every((l) => l === loads[0]), rawLoad: loads[0], reps, nSets: cluster.length, dist: dists.length ? suggestMedian(dists) : null };
  }
  // Epley invert. Discount only when the TARGET is above 8 and the reps actually changed.
  function suggestEq(sum, targetReps) {
    if (sum.reps == null || targetReps == null || sum.reps === targetReps) return sum.load;
    const e = e1rm(sum.load, sum.reps); if (e == null) return sum.load;
    let out = e / (1 + targetReps / 30);
    if (targetReps > 8) out *= 1 - Math.min(0.10, 0.015 * (targetReps - 8));
    return out;
  }
  function suggestScore(sum, age, targetReps, targetSets) {
    let w = Math.pow(SUGGEST_RECENCY, age);
    if (targetReps != null && sum.reps != null) w *= Math.pow(SUGGEST_REP, Math.abs(sum.reps - targetReps));
    if (targetSets != null) w *= Math.pow(SUGGEST_SET, Math.abs(sum.nSets - targetSets));
    return w;
  }
  function suggestCap(items) {
    const out = items.map((it) => Object.assign({}, it, { eqUse: it.eq, capped: false }));
    if (out.length < 3) return out;
    const med = suggestMedian(out.map((it) => it.eq));
    const band = Math.max(15, Math.abs(med) * 0.12);
    const idx = [];
    out.forEach((it, i) => { if (Math.abs(it.eq - med) > band) idx.push(i); });
    if (idx.length !== 1 || out.length - idx.length < 2) return out;
    const rest = out.filter((_, i) => i !== idx[0]);
    let tw = 0, s = 0; rest.forEach((it) => { tw += it.w; s += it.w * it.eq; });
    const avg = tw ? s / tw : med;
    const b2 = Math.max(15, Math.abs(avg) * 0.12);
    const it = out[idx[0]];
    const clamped = Math.min(avg + b2, Math.max(avg - b2, it.eq));
    if (Math.abs(clamped - it.eq) > 0.01) { it.eqUse = clamped; it.capped = true; }
    return out;
  }
  function suggestWeighted(items) {
    let tw = 0, s = 0;
    items.forEach((it) => { tw += it.w; s += it.w * it.eqUse; });
    return tw ? s / tw : null;
  }
  function suggestLoad(sessions, scheme, opts) {
    opts = opts || {}; scheme = scheme || {};
    if (opts.bw) return null;
    if (!Array.isArray(sessions) || !sessions.length) return null;
    const targetReps = (scheme.reps == null || scheme.reps === '' || /max/i.test(String(scheme.reps))) ? null : topNum(scheme.reps);
    const rawReps = scheme.reps == null ? '' : String(scheme.reps).replace(/\s+/g, '');
    const repsLabel = targetReps != null && rawReps && rawReps !== String(targetReps) ? rawReps : (targetReps != null ? String(targetReps) : null);
    const targetSets = scheme.sets != null && scheme.sets !== '' ? Number(scheme.sets) : null;
    const rows = sessions.filter((s) => s && !suggestIsDeload(s, opts));
    if (!rows.length) return null;
    rows.sort((a, b) => {
      const ka = String(a.date || '') + String(a.ts || 0).padStart(15, '0');
      const kb = String(b.date || '') + String(b.ts || 0).padStart(15, '0');
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
    const prepared = [];
    rows.forEach((s) => {
      const sum = suggestSummarize(s.sets, targetReps);
      // A rep target needs logged reps. Load-only history (carries, missed reps) cannot drive an e1RM conversion.
      if (!sum) return;
      if (targetReps != null && sum.reps == null) return;
      prepared.push({ s, sum });
    });
    const n = prepared.length; if (!n) return null;
    prepared.forEach((it, i) => {
      const age = n - 1 - i;
      it.eq = suggestEq(it.sum, targetReps);
      it.w = suggestScore(it.sum, age, targetReps, targetSets);
      it.idx = i;
    });
    const loadOnly = targetReps == null;
    const exact = prepared.filter((it) => (loadOnly || it.sum.reps === targetReps) && (targetSets == null || Math.abs(it.sum.nSets - targetSets) <= 1));
    const useExact = exact.length > 0 && (loadOnly || exact.some((it) => it.sum.reps === targetReps));
    const pool = suggestCap(useExact ? exact : prepared);
    let best = pool[0];
    pool.forEach((it) => { if (it.w > best.w + 1e-12 || (Math.abs(it.w - best.w) <= 1e-12 && it.idx > best.idx)) best = it; });
    let load, blended = false;
    if (useExact) {
      if (best.capped) load = round5(best.eqUse);
      else if (best.sum.uniform) load = best.sum.rawLoad;
      else load = round5(best.sum.load);
    } else {
      const mean = suggestWeighted(pool);
      load = round5(mean);
      const anchor = round5(best.capped ? best.eqUse : best.eq);
      blended = anchor != null && load != null && load !== anchor;
    }
    if (load == null || isNaN(load) || load <= 0) return null;
    const dRep = (best.sum.reps == null || targetReps == null) ? 0 : Math.abs(best.sum.reps - targetReps);
    const dSet = targetSets == null ? 0 : Math.abs(best.sum.nSets - targetSets);
    const cited = best.sum.uniform ? best.sum.rawLoad : best.sum.load;
    const when = suggestShortDate(best.s.date);
    let basis;
    if (best.sum.reps != null) basis = best.sum.nSets + 'x' + best.sum.reps + ' at ' + suggestFmtLoad(cited) + (when ? ' on ' + when : '');
    else if (best.sum.dist) basis = best.sum.nSets + 'x' + suggestFmtLoad(best.sum.dist) + ' m at ' + suggestFmtLoad(cited) + (when ? ' on ' + when : '');
    else basis = best.sum.nSets + (best.sum.nSets === 1 ? ' set' : ' sets') + ' at ' + suggestFmtLoad(cited) + ' lb' + (when ? ' on ' + when : '');
    if (dRep > 0) basis += ', adjusted for ' + (targetSets != null ? targetSets : best.sum.nSets) + 'x' + repsLabel;
    if (best.capped) basis += ' \u00B7 capped';
    else if (blended) basis += ' \u00B7 blended';
    const rough = dRep >= 4;
    let confidence = 'medium';
    if (best.capped || rough) confidence = 'low';
    else if (dRep === 0 && dSet <= 1) confidence = 'high';
    return { load, basis, confidence, rough };
  }

  const api = { num, r1, round5, linreg, loadAtV, mvAtLoad, VELS, loadsTable, vlPct, e1rm, firstNum, topNum, readiness, COLUMNS, BODY_COLUMNS, toCSV, parseCSV, sessionRows, bodyRow, mergeRecords, suggestLoad };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Calc = api;
})(typeof self !== 'undefined' ? self : this);
