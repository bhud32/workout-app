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
  const api = { num, r1, round5, linreg, loadAtV, mvAtLoad, VELS, loadsTable, vlPct, e1rm, firstNum, topNum, readiness, COLUMNS, BODY_COLUMNS, toCSV, parseCSV, sessionRows, bodyRow, mergeRecords };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Calc = api;
})(typeof self !== 'undefined' ? self : this);
