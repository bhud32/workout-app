/* node tests/suggest-load.test.js */
const assert = require('assert');
const C = require('../calc.js');
const P = require('../program.js');

function sets(load, reps, n, extra) {
  return Array.from({ length: n }, () => Object.assign({ load, reps, done: true }, extra));
}
function sess(date, setList, extra) {
  return Object.assign({ date, ts: Date.parse(date + 'T12:00:00Z'), sets: setList }, extra);
}

function suggest(sessions, scheme, opts) {
  return C.suggestLoad(sessions, scheme, opts);
}

// Exact scheme: repeat the load. No Epley, no rounding drift.
{
  const r = suggest([sess('2026-10-21', sets(185, 8, 3))], { sets: 3, reps: 8 });
  assert.strictEqual(r.load, 185);
  assert.strictEqual(r.basis, '3x8 at 185 on Oct 21');
  assert.strictEqual(r.confidence, 'high');
  assert.strictEqual(r.rough, false);
}

// 3x5 at 205 inverted at 8 reps. e1RM = 205 * (1 + 5/30) = 239.166..., / (1 + 8/30) = 188.816 → 190.
// 8 is not "above 8", so the high-rep discount does not apply.
{
  const raw = 205 * (1 + 5 / 30) / (1 + 8 / 30);
  assert.ok(Math.abs(raw - 188.815789) < 1e-4);
  const r = suggest([sess('2026-10-14', sets(205, 5, 3))], { sets: 3, reps: 8 });
  assert.strictEqual(r.load, 190);
  assert.strictEqual(r.basis, '3x5 at 205 on Oct 14, adjusted for 3x8');
  assert.strictEqual(r.confidence, 'medium');
  assert.strictEqual(r.rough, false);
}

// Above 8 reps: 1.5% per extra rep. 205x5 → 12: 170.833 * 0.94 = 160.583 → 160, and it is a rough estimate.
{
  const raw = 205 * (1 + 5 / 30) / (1 + 12 / 30);
  const discounted = raw * (1 - 0.015 * 4);
  assert.strictEqual(C.round5(discounted), 160);
  assert.ok(discounted < raw);
  const r = suggest([sess('2026-10-14', sets(205, 5, 3))], { sets: 3, reps: 12 });
  assert.strictEqual(r.load, 160);
  assert.strictEqual(r.basis, '3x5 at 205 on Oct 14, adjusted for 3x12');
  assert.strictEqual(r.rough, true);
  assert.strictEqual(r.confidence, 'low');
}

// An exact 3x12 is repeated, not discounted.
{
  const r = suggest([sess('2026-10-21', sets(100, 12, 3))], { sets: 3, reps: 12 });
  assert.strictEqual(r.load, 100);
  assert.strictEqual(r.rough, false);
  assert.strictEqual(r.confidence, 'high');
}

// Range prescriptions use the top of the range for the conversion, and name the range in the basis.
{
  const at8 = suggest([sess('2026-10-14', sets(205, 5, 3))], { sets: 3, reps: 8 });
  const atRange = suggest([sess('2026-10-14', sets(205, 5, 3))], { sets: 3, reps: '6-8' });
  assert.strictEqual(atRange.load, at8.load);
  assert.strictEqual(atRange.basis, '3x5 at 205 on Oct 14, adjusted for 3x6-8');
}

// Newer exact session wins over an older exact session. Not averaged down.
{
  const r = suggest([
    sess('2026-09-01', sets(175, 8, 3)),
    sess('2026-10-21', sets(185, 8, 3))
  ], { sets: 3, reps: 8 });
  assert.strictEqual(r.load, 185);
  assert.strictEqual(r.basis, '3x8 at 185 on Oct 21');
  assert.strictEqual(r.confidence, 'high');
}

// A closer rep scheme beats a newer session whose reps are far from the target.
{
  const r = suggest([
    sess('2026-10-07', sets(185, 8, 3)),
    sess('2026-10-21', sets(245, 3, 3))
  ], { sets: 3, reps: 8 });
  assert.strictEqual(r.load, 185);
  assert.strictEqual(r.basis, '3x8 at 185 on Oct 7');
  assert.ok(!/adjusted/.test(r.basis));
}

// No exact match: recency decay 0.5 and rep penalty 0.55. Newer 3x5 at 185 plus older 3x5 at 225, target 3x8.
// Converted loads 170.39 and 207.24; weighted mean ≈ 182.7 → 185, closer to the newer session than an even blend (190).
{
  const r = suggest([
    sess('2026-10-01', sets(225, 5, 3)),
    sess('2026-10-21', sets(185, 5, 3))
  ], { sets: 3, reps: 8 });
  assert.strictEqual(r.load, 185);
  assert.ok(r.basis.indexOf('on Oct 21') > 0);
  assert.ok(/adjusted for 3x8/.test(r.basis));
  assert.ok(/blended/.test(r.basis));
}

// Closer reps outrank recency when neither session is an exact match.
{
  const r = suggest([
    sess('2026-10-01', sets(200, 6, 3)),
    sess('2026-10-21', sets(245, 3, 3))
  ], { sets: 3, reps: 8 });
  assert.strictEqual(r.load, 195);
  assert.ok(r.basis.indexOf('on Oct 1') > 0, r.basis);
  assert.ok(/3x6 at 200/.test(r.basis), r.basis);
}

// Partly completed session: only the sets that were done. An undone heavier set is ignored.
{
  const r = suggest([sess('2026-10-21', [
    { load: 185, reps: 8, done: true },
    { load: 185, reps: 8, done: true },
    { load: 225, reps: 8, done: false }
  ])], { sets: 3, reps: 8 });
  assert.strictEqual(r.load, 185);
  assert.strictEqual(r.basis, '2x8 at 185 on Oct 21');
  assert.strictEqual(r.confidence, 'high');
}

// Sets with no `done` flag still count (history is pre-filtered to finished sets).
{
  const r = suggest([sess('2026-10-21', [{ load: 135, reps: 5 }, { load: 135, reps: 5 }, { load: 135, reps: 5 }])], { sets: 3, reps: 5 });
  assert.strictEqual(r.load, 135);
}

// A failed extra rep does not change the working cluster: two 8s and a 7 still read as 2x8.
{
  const r = suggest([sess('2026-10-21', [
    { load: 185, reps: 8, done: true },
    { load: 185, reps: 8, done: true },
    { load: 185, reps: 7, done: true }
  ])], { sets: 3, reps: 8 });
  assert.strictEqual(r.load, 185);
  assert.strictEqual(r.basis, '2x8 at 185 on Oct 21');
}

// One wild session cannot drag a consistent history. 300 is clamped to 12% above the other 185s (207.2 → 205).
{
  const r = suggest([
    sess('2026-09-01', sets(185, 8, 3)),
    sess('2026-09-15', sets(185, 8, 3)),
    sess('2026-10-01', sets(185, 8, 3)),
    sess('2026-10-21', sets(300, 8, 3))
  ], { sets: 3, reps: 8 });
  assert.strictEqual(r.load, 205);
  assert.ok(/capped/.test(r.basis), r.basis);
  assert.ok(/300/.test(r.basis), r.basis);
  assert.strictEqual(r.confidence, 'low');
}

// Two points are not enough to call either one an outlier: the newer exact load is repeated.
{
  const r = suggest([
    sess('2026-10-01', sets(185, 8, 3)),
    sess('2026-10-21', sets(300, 8, 3))
  ], { sets: 3, reps: 8 });
  assert.strictEqual(r.load, 300);
  assert.ok(!/capped/.test(r.basis));
}

// Deload weeks are not data points. A lighter week-4 session must not pull 185 down.
{
  assert.strictEqual(P.isDeload(4), true);
  assert.strictEqual(P.isDeload(8), true);
  assert.strictEqual(P.isDeload(3), false);
  const history = [
    sess('2026-10-21', sets(185, 8, 3), { week: 2 }),
    sess('2026-11-04', sets(155, 8, 3), { week: 4 })
  ];
  const r = suggest(history, { sets: 3, reps: 8 }, { isDeload: (s) => P.isDeload(s.week) });
  assert.strictEqual(r.load, 185);
  assert.strictEqual(r.basis, '3x8 at 185 on Oct 21');
  const byFlag = suggest(history, { sets: 3, reps: 8 });
  assert.strictEqual(byFlag.load, 185);
  assert.strictEqual(suggest([sess('2026-11-04', sets(155, 8, 3), { week: 4 })], { sets: 3, reps: 8 }), null);
  assert.strictEqual(suggest([sess('2026-11-04', sets(155, 8, 3), { deload: true })], { sets: 3, reps: 8 }), null);
}

// Bodyweight exercises never get a number. Neither does an empty history.
{
  assert.strictEqual(suggest([sess('2026-10-21', sets(25, 5, 3))], { sets: 3, reps: 5 }, { bw: true }), null);
  assert.strictEqual(suggest([], { sets: 3, reps: 8 }), null);
  assert.strictEqual(suggest([sess('2026-10-21', [{ load: 0, reps: 8, done: true }])], { sets: 3, reps: 8 }), null);
  assert.strictEqual(suggest(null, { sets: 3, reps: 8 }), null);
}

// Load-only history (no reps — a carry) repeats the recent load and can cite distance.
{
  const r = suggest([
    sess('2026-10-07', [{ load: 70, dist: 40, done: true }, { load: 70, dist: 40, done: true }]),
    sess('2026-10-21', [{ load: 95, dist: 30, done: true }, { load: 95, dist: 30, done: true }, { load: 95, dist: 30, done: true }])
  ], { sets: 3, reps: null });
  assert.strictEqual(r.load, 95);
  assert.strictEqual(r.basis, '3x30 m at 95 on Oct 21');
  assert.strictEqual(r.confidence, 'high');
}

// Mixed loads in one session: median, then nearest 5 when they disagree.
{
  const r = suggest([sess('2026-10-21', [
    { load: 180, reps: 8, done: true },
    { load: 190, reps: 8, done: true }
  ])], { sets: 2, reps: 8 });
  assert.strictEqual(r.load, 185);
}

// A 1-of-4 session is not an "exact scheme" (set count differs by more than 1) but the load is still used.
{
  const r = suggest([sess('2026-10-21', sets(185, 8, 1))], { sets: 4, reps: 8 });
  assert.strictEqual(r.load, 185);
  assert.strictEqual(r.basis, '1x8 at 185 on Oct 21');
  assert.strictEqual(r.confidence, 'medium');
  assert.strictEqual(r.rough, false);
}

console.log('suggest-load: ' + 'ok');
