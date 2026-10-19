/* Brandon Hudson 12-week Strength / Power / Mobility program data.
   Source: /workspace/brandon-strength-program/Brandon_Hudson_12wk_Strength_Power_Mobility.md (sections 2-5).
   Weeks 1-12 = 3 blocks x 4 weeks. Each exercise has wk:[4 specs] (null = not in that week of the block). */
(function (root) {
  const S = (sets, reps, o = {}) => Object.assign({ sets, reps }, o);
  const E = (id, name, o, b1, b2, b3) => Object.assign({ id, name, wk: [].concat(b1 || [null, null, null, null], b2 || [null, null, null, null], b3 || [null, null, null, null]) }, o);
  const N = null;
  const WU = (txt, min) => ({ kind: 'check', min, desc: txt });

  // ---------- RAMPS (load-velocity profiles) ----------
  const RAMPS = {
    trapbar: { name: 'Trap bar deadlift', lift: 'trapbar', start: 115, startReps: 3, stopMV: 0.55, unitLb: 5,
      next(mv) { return { add: mv > 0.9 ? 40 : mv > 0.7 ? 20 : 10, reps: mv > 1.0 ? 3 : mv >= 0.7 ? 2 : 1 }; },
      rest(mv) { return mv != null && mv < 0.7 ? 180 : 120; },
      rules: 'Start ~95-135 lb. 3 reps while MV > 1.0, 2 reps at 0.70-1.0, 1-2 reps below 0.70. Jump +40 lb while MV > 0.9, +20 lb from 0.9 to 0.7, +10 lb below. 1-s dead stop each rep, same handle height. Stop when first rep \u2264 0.55 m/s or RPE 8. No 1RM attempt.' },
    floorpress: { name: 'Floor press', lift: 'floorpress', start: 45, startReps: 8, stopMV: 0.45, unitLb: 5,
      next(mv) { return mv > 0.8 ? { add: 25, reps: 3 } : mv >= 0.6 ? { add: 15, reps: 2 } : { add: 10, reps: 1 }; },
      rest() { return 50; },
      rules: 'Empty bar x8 first, then loads chosen by velocity, best MV logged each. MV > 0.80: +20-30 lb, 3 reps. 0.60-0.80: +10-20 lb, 2 reps. Stop ramping at first-rep MV \u2264 0.45 m/s or RPE 8. ~45-60 s between ramp sets. Triceps pause 1 s on the floor.' }
  };
  const READINESS = { // load that moved ~this MV in Week 1 -> readiness load; used by the readiness-set check
    trapbar: { targetMV: 1.0, label: 'Trap bar' }, floorpress: { targetMV: 0.8, label: 'Floor press' } };

  // ---------- DAY A ----------
  const DAY_A = [
    E('a_wu', 'Warm-up', WU('Rower 2 min + hip/scap prep (90/90 switches, glute bridge, scap pull-ups)', 5), [S(1, 1), S(1, 1), S(1, 1), S(1, 1)]),
    E('a_wu2', 'Warm-up + readiness set', WU('Rower, hip/scap prep, then the fixed-load readiness set (2-3 reps) below', 6), [N, N, N, N], [S(1, 1), S(1, 1), S(1, 1), S(1, 1)], [S(1, 1), S(1, 1), S(1, 1), S(1, 1)]),
    E('tb_ramp', 'Trap bar deadlift: load-velocity profile', { kind: 'ramp', ramp: 'trapbar', vbt: true, lift: 'trapbar', cue: '1-s dead stop between reps, same handle height. Record the best MV per load (5-6 loads). After the profile: pull-up set + dead hang.' },
      [S(1, 1, { rest: 120 }), N, N, N], N, [N, N, N, S(1, 1, { stopMV: 0.50, note: 'Week-12 RETEST of the trap bar profile. Stop at first rep \u2264 0.50 m/s.' })]),
    E('tb', 'Trap bar deadlift (1-s dead stop)', { kind: 'reps', vbt: true, lift: 'trapbar', profile: 'trapbar', grp: 'A', rest: 20, restTxt: 'Round ~2-2.5 min (A1 \u2192 A2 20 s, then rest)', cue: 'Max intent up, 1-s dead stop, same handle height. End the set at the rep target or VL cutoff, whichever comes first. If you hit the VL cutoff on set 1 before the rep target, load is too heavy: drop 5-10%.' },
      [N, S(4, 5, { vel: [0.75, 0.85], vl: 20, rir: '' }), S(4, 5, { vel: [0.70, 0.80], vl: 20, note: 'heavier than Wk 2' }), S(2, 5, { vel: [0.85, N], vl: 10, note: 'Deload: first rep \u2265 0.85' })],
      [S(4, 4, { vel: [0.65, 0.72], vl: 15, rest: 20 }), S(5, 4, { vel: [0.62, 0.68], vl: 15 }), S(5, 3, { vel: [0.57, 0.63], vl: 15 }), S(2, 3, { vel: [0.75, N], vl: 10, note: 'Deload: first rep \u2265 0.75' })],
      [S(4, 5, { vel: [0.65, 0.70], vl: 15 }), S(5, 3, { vel: [0.55, 0.60], vl: [10, 15] }),
        { segs: [{ label: 'Top set', sets: 1, reps: '2-3', vel: [0.45, 0.50], vl: 10 }, { label: 'Back-off', sets: 3, reps: 3, vel: [0.58, 0.63], vl: 10 }] }, N]),
    E('pu', 'Pull-up / chin-up (or 3-5 s negatives / feet-assisted)', { kind: 'reps', lift: 'pullup', grp: 'A', bw: true, rest: 120, cue: 'Strict reps, 2-3 RIR. Full hang to chin over bar.' },
      [S(1, 'max-1', { rest: 90, note: 'After the profile: one set of max strict reps minus 1. Record it.' }), S(3, '5-8', { rir: '2-3' }), S(4, '5-8', { rir: '2-3' }), S(2, 5, { rir: '2-3' })],
      [S(4, '4-6', { rir: 2, rest: 145 }), S(4, '5-6', { rir: 2, rest: 145 }), S(5, '4-5', { rir: 2, rest: 145 }), S(2, 4, { rir: 2, rest: 145 })], N),
    E('wpu', 'Weighted pull-up (vest)', { kind: 'reps', lift: 'wpullup', grp: 'A', rest: 160, cue: '1-2 RIR. Vest load in the weight field.' }, N, N,
      [S(4, 5, { rir: '1-2' }), S(5, 3, { rir: '1-2' }), S(4, 3, { rir: '1-2', note: 'heavier' }), S(2, 3, { rir: '1-2' })]),
    E('gob', 'Goblet squat to 12" box (70-lb KB or DB), 3-s descent', { kind: 'reps', lift: 'goblet', grp: 'B', rest: 60, restTxt: '60 s', cue: '3-s descent to the box, 3 RIR.' },
      [S(2, 8, { rir: 3 }), S(3, 8, { rir: 3 }), S(3, 10, { rir: 3 }), S(2, 8, { rir: 3 })], N, N),
    E('carry', 'Suitcase carry (70-lb KB / DB)', { kind: 'carry', lift: 'carry', load0: 70, grp: 'B', rest: 30, per: '/side', cue: 'Tall, ribs down. Distance in meters per side.' },
      [S(2, 30), S(2, 40), S(3, 40), S(2, 30)], N, N),
    E('sp', 'Side plank (or hanging knee raise on alternate weeks)', { kind: 'timed', lift: 'sideplank', rest: 20, per: '/side', cue: 'Quality over time.' },
      [S(2, 20), S(2, 30), S(2, 30, { note: '+ reach' }), S(2, 20)], N, N),
    // Block 2
    E('bsq', 'Back squat (parallel, controlled)', { kind: 'reps', vbt: true, lift: 'squat', grp: 'B', rest: 20, cue: 'Parallel, controlled descent. Velocity bands interpolated from the doc: 0.65-0.75 \u2192 0.60-0.70.' }, N,
      [S(3, 6, { vel: [0.65, 0.75], vl: 20, rest: 20 }), S(3, 6, { vel: [0.62, 0.72], vl: 20 }), S(4, 5, { vel: [0.60, 0.70], vl: 20 }), S(2, 5, { vl: 10, note: 'Deload' })],
      [S(3, 5, { vel: [0.60, 0.70], vl: 15 }), S(4, 4, { vel: [0.55, 0.62], vl: 15 }), S(3, 3, { vel: [0.50, 0.58], vl: 15 }), S(2, 3, { vl: 10, note: 'Deload: light' })]),
    E('hkr', 'Hanging knee raise' , { kind: 'reps', lift: 'hkr', grp: 'B', bw: true, rest: 120, restTxt: 'Round ~2 min', cue: 'No swing.' }, N,
      [S(3, 8), S(3, 10), S(3, 10), S(2, 8)], [S(3, 10, { note: 'Progress toward partial toes-to-bar' }), S(3, 10), S(3, 10), S(2, 8)]),
    E('slrdl', 'DB single-leg RDL', { kind: 'reps', lift: 'slrdl', grp: 'C', rest: 20, per: '/side', cue: '2-3 RIR.' }, N,
      [S(2, 8, { rir: '2-3', rest: 45 }), S(3, 8, { rir: '2-3', rest: 45 }), S(3, 8, { rir: '2-3', rest: 45 }), S(2, 6, { rir: '2-3', rest: 45 })], N),
    E('rdl', 'Barbell RDL or DB single-leg RDL', { kind: 'reps', lift: 'rdl', rest: 60, cue: '2 RIR.' }, N, N,
      [S(3, '6-8', { rir: 2 }), S(3, 6, { rir: 2 }), S(3, 6, { rir: 2 }), S(2, 6, { rir: 2 })]),
    E('carry2', 'Suitcase carry (95 DB / 70 KB)', { kind: 'carry', lift: 'carry', load0: 70, grp: 'C', rest: 45, per: '/side', cue: 'Tall, ribs down.' }, N,
      [S(3, 40), S(3, 40), S(3, 40, { note: 'heavier' }), S(2, 30)], N),
    E('carry3', 'Heavy suitcase carry (95 DB)', { kind: 'carry', lift: 'carry', load0: 95, grp: 'C', rest: 60, per: '/side', cue: 'Heavy, tall, ribs down.' }, N, N,
      [S(3, 30), S(3, 30), S(3, 40), S(2, 30)]),
    E('sp2', 'Side plank', { kind: 'timed', lift: 'sideplank', rest: 20, per: '/side' }, N,
      [S(2, 30), S(2, 30), S(2, 30), S(2, 20)], N),
    E('sp3', 'Side plank variation', { kind: 'timed', lift: 'sideplank', rest: 20, per: '/side' }, N, N, [S(2, 30), S(2, 30), S(2, 30), S(2, 20)]),
    E('hang', 'Dead hang (grip / shoulder marker)', { kind: 'timed', lift: 'deadhang', rest: 30, cue: 'Record max time.' },
      [S(1, 'max', { note: 'End of session: 1 set. Log seconds.' }), N, N, N], N, [S(1, 'max'), S(1, 'max'), S(1, 'max'), S(1, 'max')])
  ];

  // ---------- DAY B ----------
  const DAY_B = [
    E('b_wu', 'Warm-up + prep circuit', WU('Rower 2 min easy (damper 4-5). Prep circuit x1: chin tucks 6 x 3 s (wall) \u2192 wall slides with lift-off x8 \u2192 scap push-ups x10 \u2192 quadruped T-spine rotation 5/side \u2192 scap pull-ups from hang x6. Smooth, no rest.', 5), [S(1, 1), S(1, 1), S(1, 1), S(1, 1)]),
    E('b_wu2', 'Warm-up + readiness set (floor press)', WU('Rower + scap/neck prep, then the fixed-load floor press readiness set (2-3 reps) below', 6), N, [S(1, 1), S(1, 1), S(1, 1), S(1, 1)], [S(1, 1), S(1, 1), S(1, 1), S(1, 1)]),
    E('fp_ramp', 'Floor press: load-velocity ramp', { kind: 'ramp', ramp: 'floorpress', vbt: true, lift: 'floorpress', cue: 'Lie under the bar in the rack, eyes under the bar, elbows ~45\u00B0, 1-s triceps pause on the floor, max intent, ribs down, chin slightly tucked. In the gaps do one light DB row x6/side.' },
      [S(1, 1), N, N, N], N, [N, N, N, S(1, 1, { stopMV: 0.45, note: 'Week-12 RETEST of the floor press ramp.' })]),
    E('epu', 'Explosive push-up or med ball chest pass (wall/ground)', { kind: 'power', lift: 'epu', metric: 'reps', rest: 45, cue: 'Max speed, full reset between reps.' }, N,
      [S(3, 5), S(3, 5), S(4, 4), S(2, 4)], [S(4, 4), S(4, 3), S(4, 3), S(2, 3)]),
    E('fp', 'Floor press (in rack, 1-s pause on triceps)', { kind: 'reps', vbt: true, lift: 'floorpress', profile: 'floorpress', grp: 'A', rest: 60, restTxt: '60 s \u2192 A2', cue: 'Stop the set at the rep target or when a rep is slower than the VL cutoff vs your fastest rep. Log first-rep and last-rep MV.' },
      [S(3, 5, { vl: 20, rir: 3, hintPct: [85, 90], note: 'Use ~85-90% of the heaviest ramp load (RIR 3).' }), S(3, 6, { vel: [0.50, 0.65], vl: 20, rir: 3 }), S(4, 5, { vel: [0.50, 0.65], vl: 20, rir: 3, note: 'heavier' }), S(2, 5, { vl: 10, note: 'Deload' })],
      [S(4, 5, { vl: [15, 20], velTxt: 'Heavier band from your profile' }), S(4, 4, { vl: [15, 20], velTxt: 'Heavier band from your profile' }), S(5, 3, { vl: [15, 20], velTxt: 'Heavier band from your profile' }), S(2, 3, { vl: 10, note: 'Deload' })],
      [S(4, 5, { vl: 15 }), S(5, 3, { vl: [10, 15] }),
        { segs: [{ label: 'Top set', sets: 1, reps: '2-3', vel: [0.30, 0.35], vl: 10 }, { label: 'Back-off', sets: 3, reps: 3, vl: 10 }] }, N]),
    E('row', 'One-arm DB row (hand on rack/box)', { kind: 'reps', lift: 'dbrow', grp: 'A', rest: 40, per: '/side', restTxt: '30-45 s', cue: 'Full reach and protraction; shoulder blade reaches forward at the bottom, pull elbow to hip, 1-s squeeze, no torso twist.' },
      [S(3, 8, { rir: 2 }), S(3, 10, { rir: 2 }), S(4, 8, { rir: 2, note: 'heavier' }), S(2, 8, { rir: 2 })],
      [S(4, '6-8', { rir: '1-2', rest: 45 }), S(4, '6-8', { rir: '1-2', rest: 45 }), S(4, 6, { rir: '1-2', rest: 45 }), S(2, 6, { rir: '1-2', rest: 45 })],
      [S(4, '6-8', { rir: '1-2', rest: 45 }), S(5, 5, { rir: '1-2', rest: 45 }), S(4, 6, { rir: '1-2', rest: 45 }), S(2, 6, { rir: '1-2', rest: 45 })]),
    E('hkp', 'Half-kneeling 1-arm DB press', { kind: 'reps', lift: 'hkpress', grp: 'B', rest: 30, per: '/side', restTxt: '20-30 s \u2192 B2', cue: 'Down-knee glute squeezed, ribs stacked, press slightly forward in the scapular plane, let the shoulder blade rotate up.' },
      [S(3, 8, { rir: '2-3' }), S(3, 10, { rir: '2-3' }), S(3, 8, { rir: '2-3', note: 'heavier' }), S(2, 8, { rir: '2-3' })], N, N),
    E('irow', 'Rack inverted row (chest to bar, 1-s squeeze)', { kind: 'reps', lift: 'invrow', grp: 'B', bw: true, rest: 30, cue: 'Body rigid, lead with the chest, neck long, bar to lower chest, 1-s hold. Harder: lower the bar or feet on box.' },
      [S(3, '8-12', { rir: 2 }), S(3, '10-12', { rir: 2 }), S(3, '10-12', { rir: 2, note: 'feet on box' }), S(2, 8, { rir: 2 })], N, N),
    E('hkp2', 'Half-kneeling or standing 1-arm DB press', { kind: 'reps', lift: 'hkpress', grp: 'C', rest: 20, per: '/side', cue: '2 RIR.' }, N,
      [S(3, '6-8', { rir: 2, rest: 30 }), S(3, '6-8', { rir: 2, rest: 30 }), S(3, 6, { rir: 2, rest: 30 }), S(2, 6, { rir: 2, rest: 30 })], N),
    E('hkp3', 'Standing 1-arm DB press', { kind: 'reps', lift: 'hkpress', grp: 'C', rest: 20, per: '/side', cue: '2 RIR.' }, N, N,
      [S(3, 6, { rir: 2, rest: 30 }), S(4, 5, { rir: 2, rest: 30 }), S(3, 5, { rir: 2, rest: 30 }), S(2, 5, { rir: 2, rest: 30 })]),
    E('chin', 'Chin-up (+ vest)', { kind: 'reps', lift: 'chinup', grp: 'C', rest: 60, cue: '2 RIR. Add vest when 8 strict reps are easy.' }, N,
      [S(3, '6-8', { rir: 2 }), S(3, '6-8', { rir: 2 }), S(3, '5-6', { rir: 2 }), S(2, 5, { rir: 2 })], N),
    E('wchin', 'Weighted chin-up', { kind: 'reps', lift: 'chinup', grp: 'C', rest: 60, cue: '1-2 RIR.' }, N, N,
      [S(3, '5-6', { rir: '1-2' }), S(3, 5, { rir: '1-2' }), S(3, 5, { rir: '1-2' }), S(2, 4, { rir: '1-2' })]),
    E('vpp', 'Vest push-up "plus"', { kind: 'reps', lift: 'pushupplus', grp: 'D', rest: 30, cue: 'Full protraction at the top. 2 RIR.' }, N,
      [S(2, '8-12', { rir: 2 }), S(2, '10-12', { rir: 2 }), S(3, 10, { rir: 2 }), S(2, 8, { rir: 2 })], N),
    E('vpp2', 'Vest push-up plus / rack inverted row', { kind: 'reps', lift: 'pushupplus', grp: 'D', rest: 30, cue: '2 RIR.' }, N, N,
      [S(2, '10-15', { rir: 2 }), S(2, 12, { rir: 2 }), S(2, 12, { rir: 2 }), S(1, 10, { rir: 2 })]),
    E('yt', 'Prone Y-T raise (floor, 0-5 lb) or band face pull', { kind: 'reps', lift: 'ytraise', grp: 'C', rest: 20, cue: 'Thumbs up, 2-s hold, easy. Reps = each of Y and T.' },
      [S(2, 8), S(2, 10), S(3, 10), S(2, 8)], N, N),
    E('face', 'Face pull / prone Y-T-W', { kind: 'reps', lift: 'ytraise', grp: 'D', rest: 0, cue: 'Easy, 2-s hold.' }, N,
      [S(3, '12-15'), S(3, 15), S(3, 15), S(2, 12)], [S(3, 15), S(3, 15), S(3, 15), S(2, 12)]),
    E('db', 'Dead bug, full exhale', { kind: 'reps', lift: 'deadbug', grp: 'C', bw: true, per: '/side', rest: 0, cue: 'Slow, low back flat.' },
      [S(2, 6), S(2, 8), S(2, 8, { note: '+ hollow hold 20 s' }), S(2, 6)], N, N),
    E('ct', 'Supine chin-tuck head lift (5-s holds)', { kind: 'reps', lift: 'chintuck', grp: 'C', bw: true, rest: 0, per: ' x 5 s', cue: 'Nod, then lift head 1 inch, no jaw clench. No strain.' },
      [S(1, 5), S(1, 6), S(1, 8), S(1, 5)], N, N),
    E('hollow', 'Hollow hold', { kind: 'timed', lift: 'hollow', rest: 20, cue: '' }, N,
      [S(3, 20), S(3, 25), S(3, 30), S(2, 20)], N),
    E('ct2', 'Chin-tuck head lifts (5-s holds)', { kind: 'reps', lift: 'chintuck', bw: true, rest: 0, per: ' x 5 s' }, N,
      [S(1, 6), S(1, 6), S(1, 6), S(1, 6)], N),
    E('arms', 'Optional arms: hammer curl + DB triceps extension', { kind: 'reps', lift: 'arms', rest: 45, optional: true, cue: 'Optional. 2 RIR.' }, N, N,
      [S(2, '10-12', { rir: 2 }), S(2, '10-12', { rir: 2 }), S(2, '10-12', { rir: 2 }), N]),
    E('bf', 'Hollow hold / dead bug + chin tucks', WU('Quality core + neck finisher (~4 min)', 4), N, N, [S(1, 1), S(1, 1), S(1, 1), S(1, 1)])
  ];

  // ---------- DAY C ----------
  const DAY_C = [
    E('c_wu', 'Warm-up', WU('Rower 2 min, leg swings, 2x10 low pogo hops, 3 practice jumps (build)', 5), [S(1, 1), S(1, 1), S(1, 1), S(1, 1)], [S(1, 1), S(1, 1), S(1, 1), S(1, 1)], [S(1, 1), S(1, 1), S(1, 1), S(1, 1)]),
    E('bj', 'Standing broad jump: test, best of 3', { kind: 'power', lift: 'broadjump', metric: 'in', rest: 45, cue: 'Log distance in inches each attempt.' },
      [S(3, 1), N, N, N], N, [N, N, N, S(3, 1, { note: 'RETEST, best of 3' })]),
    E('mbt', 'Med ball (20 lb) backward overhead throw: test, best of 3', { kind: 'power', lift: 'mbthrow', metric: 'ft', rest: 45, cue: 'Outdoors, skip if wet. Log distance in feet.' },
      [S(3, 1), N, N, N], N, [N, N, N, S(3, 1, { note: 'RETEST, best of 3' })]),
    E('tbj', 'Trap bar jump (light, ~20-30% of e1RM) or vest CMJ', { kind: 'power', lift: 'tbjump', metric: 'in', grp: 'A', rest: 20, cue: 'Max intent; stop the set if height drops >10%.' }, N,
      [S(4, 3), S(4, 3), S(5, 3), S(2, 3)], N),
    E('contrast', 'Contrast: trap bar x3 at ~0.75-0.85 m/s', { kind: 'reps', vbt: true, lift: 'trapbar_contrast', profile: 'trapbar', grp: 'A', rest: 90, restTxt: '90 s \u2192 A2', cue: 'Heavy-ish triple, then jump. VL \u2264 10%.' }, N, N,
      [S(4, 3, { vel: [0.75, 0.85], vl: 10 }), S(4, 3, { vel: [0.75, 0.85], vl: 10 }), S(5, 3, { vel: [0.75, 0.85], vl: 10 }), N]),
    E('box', 'Box jump (step down)', { kind: 'power', lift: 'boxjump', metric: 'box in', grp: 'A', rest: 60, cue: 'Max intent. Step down, do not jump down. Log box height in inches.' },
      [S(2, 3, { note: 'Use a 12" box (20" once new box arrives)' }), S(3, 3), S(4, 3), S(2, 3)],
      [S(3, 3, { note: '20-24"' }), S(4, 3), S(4, 3), S(2, 3)],
      [S(4, 3, { note: '24-30" contrast jump', rest: 90 }), S(4, 3, { rest: 90 }), S(5, 3, { rest: 90 }), N]),
    E('mb', 'Med ball (20 lb): slams / scoop toss', { kind: 'power', lift: 'mbslam', metric: 'reps', grp: 'A', rest: 60, cue: 'Max intent, judge by distance.' },
      [S(2, 5), S(3, 5), S(4, 5), S(2, 5)], N, N),
    E('mb2', 'Med ball rotational scoop toss', { kind: 'power', lift: 'mbscoop', metric: 'ft', grp: 'A', rest: 75, per: '/side', cue: 'Distance in feet.' }, N,
      [S(3, 5), S(3, 5), S(3, 5), S(2, 4)], N),
    E('mb3', 'Med ball throws (scoop / overhead / rotational)', { kind: 'power', lift: 'mbthrows', metric: 'ft', rest: 45, cue: 'Distance.' }, N, N,
      [S(4, 4), S(4, 4), S(4, 4), N]),
    E('kb', 'KB swing (70 lb), EMOM', { kind: 'interval', lift: 'kbswing', load0: 70, work: 60, rest0: 0, emom: true, cue: 'Crisp hip snap; stop if the bell floats low. Start each round on the minute.' },
      [S(5, 6), S(6, 8), S(8, 8), S(4, 6)], [S(8, 8), S(10, 8), S(10, 8, { note: '10x8 or 8x10' }), S(5, 6)],
      [S(10, 6), S(10, 5, { note: 'plus 1-arm swings below' }), S(10, 6), S(4, 5)]),
    E('kb1', '1-arm KB swing', { kind: 'reps', lift: 'kb1swing', load0: 70, per: '/side', rest: 45 }, N, N, [N, S(5, 5), N, N]),
    E('su', 'DB step-up (12-20" box)', { kind: 'reps', lift: 'stepup', grp: 'C', per: '/side', rest: 20, cue: '2-3 RIR. If short on time, cut the step-ups first.' },
      [S(2, 8, { rir: '2-3', rest: 30 }), S(3, 8, { rir: '2-3', rest: 30 }), S(3, 8, { rir: '2-3', rest: 30 }), S(2, 6, { rir: '2-3', rest: 30 })], N, N),
    E('su2', 'Vest step-up (20-24")', { kind: 'reps', lift: 'stepup', grp: 'C', per: '/side', rest: 20, cue: '2 RIR.' }, N,
      [S(3, 8, { rir: 2, rest: 30 }), S(3, 8, { rir: 2, rest: 30 }), S(3, 10, { rir: 2, rest: 30 }), S(2, 6, { rir: 2, rest: 30 })], N),
    E('su3', 'Vest step-up / reverse lunge', { kind: 'reps', lift: 'stepup', grp: 'D', per: '/side', rest: 20, cue: '2 RIR.' }, N, N,
      [S(3, 8, { rir: 2, rest: 30 }), S(3, 8, { rir: 2, rest: 30 }), S(3, 8, { rir: 2, rest: 30 }), S(2, 6, { rir: 2, rest: 30 })]),
    E('pal', 'Pallof press (band) or hollow hold', { kind: 'reps', lift: 'pallof', grp: 'C', per: '/side', rest: 0, cue: 'Anti-rotation.' },
      [S(2, 10), S(3, 10), S(3, 10), S(2, 8)], [S(3, 10), S(3, 12), S(3, 12), S(2, 8)], N),
    E('pal2', 'Pallof press / hollow hold', { kind: 'reps', lift: 'pallof', grp: 'D', per: '/side', rest: 0 }, N, N, [S(3, 12), S(3, 12), S(3, 12), S(2, 8)]),
    E('rpk', 'Concept2 15-s max effort (peak watts)', { kind: 'power', lift: 'rowpeak', metric: 'watts', rest: 120, cue: 'Damper 5-7, after the warm-up. Log peak watts.' },
      [S(1, 1), N, N, N], N, [N, N, N, S(1, 1, { note: 'RETEST' })]),
    E('ri', 'Rower intervals: 30 s hard / 90 s easy', { kind: 'interval', lift: 'rowint', work: 30, rest0: 90, metric: 'watts', cue: 'RPE 8 (deload RPE 6). Or vest hill hikes (weather permitting). Log avg watts if you like.' },
      [S(3, 1), S(5, 1), S(6, 1), S(3, 1, { note: 'Easy-moderate, RPE 6' })], N, N),
    E('ri2', 'Rower 30 s hard / 60 s easy (or vest hill hikes)', { kind: 'interval', lift: 'rowint', work: 30, rest0: 60, metric: 'watts', cue: 'RPE 8.' }, N,
      [S(6, 1), S(7, 1), S(8, 1), S(4, 1, { note: 'Easy, RPE 6' })], N),
    E('ri3', 'Rower sprints 15 s on / 45 s off (or vest hill sprints)', { kind: 'interval', lift: 'rowsprint', work: 15, rest0: 45, metric: 'watts', cue: 'All-out but smooth.' }, N, N,
      [S(8, 1), S(8, 1), S(10, 1), N]),
    E('easy', 'Easy row, 10 min', { kind: 'timed', lift: 'easyrow', rest: 0, cue: 'Retest week finisher: easy conversational row.' }, N, N, [N, N, N, S(1, 600)])
  ];

  const MOBILITY = {
    A: { name: 'Mobility A: Shoulders / T-spine / Neck', steps: [
      { n: 'Supine chin tucks (head on folded towel)', dose: '2 x 8 x 5-s holds', s: 90 },
      { n: 'Quadruped T-spine rotation (hand behind head)', dose: '6/side, 2-s pause at top', s: 90 },
      { n: 'Wall slides with lift-off (forearms on wall, ribs down)', dose: '2 x 8', s: 90 },
      { n: 'Doorway pec stretch (elbow at shoulder height, step through)', dose: '2 x 30 s/side', s: 90 },
      { n: 'Prone W \u2192 Y lifts', dose: '2 x 8', s: 90 },
      { n: 'Dead hang (passive 15 s \u2192 5 active scap pulls)', dose: '2 rounds', s: 90 },
      { n: 'Open-book or thread-the-needle', dose: '5/side', s: 60 }] },
    B: { name: 'Mobility B: Hips / Spine', steps: [
      { n: 'Cat-camel', dose: '8 slow', s: 60 },
      { n: 'Half-kneeling hip flexor stretch (squeeze down-side glute, tuck pelvis, reach overhead)', dose: '2 x 30-45 s/side', s: 120 },
      { n: '90/90 hip switches \u2192 hold front-leg lean', dose: '8 switches + 20 s/side', s: 90 },
      { n: 'Adductor rock-backs or Cossack squat to comfort', dose: '6-8/side', s: 90 },
      { n: 'Goblet squat hold (20-lb med ball), elbows push knees out', dose: '2 x 30 s', s: 60 },
      { n: 'Couch stretch (knee on a pad against the box)', dose: '30 s/side', s: 90 },
      { n: 'Wall angels + chin tuck (back to the wall)', dose: '2 x 8', s: 90 }] }
  };

  const BLOCKS = [
    { n: 1, name: 'Foundation / accumulation', weeks: '1-4', minutes: 30, reps: '5-6', vl: '20%', effort: '2-3 RIR, 8-12 reps' },
    { n: 2, name: 'Strength / intensification', weeks: '5-8', minutes: 40, reps: '3-5', vl: '15-20%', effort: '1-3 RIR, 6-10 reps' },
    { n: 3, name: 'Wave / realization', weeks: '9-12', minutes: 50, reps: '2-5', vl: '10-15%', effort: '1-2 RIR, 6-8 reps' }
  ];
  const DAYS = { A: { name: 'Lower / Pull', list: DAY_A, dow: 1 }, B: { name: 'Upper / Posture', list: DAY_B, dow: 3 }, C: { name: 'Power + Conditioning', list: DAY_C, dow: 5 } };

  function targetMinutes(week) { if (week % 4 === 0) return 30; return BLOCKS[Math.floor((week - 1) / 4)].minutes; }
  const isDeload = (w) => w % 4 === 0;

  // Resolve a (week, day) into ordered display blocks + a step queue.
  function resolve(week, day) {
    const wi = (week - 1) % 4, bi = Math.floor((week - 1) / 4);
    const out = [];
    for (const ex of DAYS[day].list) {
      const spec = ex.wk[bi * 4 + wi];
      if (!spec) continue;
      const kind = spec.kind || ex.kind;
      const segs = spec.segs || [{ sets: spec.sets, reps: spec.reps, vel: spec.vel, vl: spec.vl, label: spec.label }];
      const setSpecs = [];
      segs.forEach((g) => { for (let i = 0; i < g.sets; i++) setSpecs.push({ reps: g.reps, vel: g.vel || spec.vel || null, vl: g.vl != null ? g.vl : (spec.vl != null ? spec.vl : null), label: g.label || '' }); });
      out.push(Object.assign({}, ex, spec, { kind, wkSpec: spec, setSpecs, rest: spec.rest != null ? spec.rest : (ex.rest != null ? ex.rest : 0) }));
    }
    // group consecutive exercises sharing grp
    const blocks = [];
    for (const ex of out) {
      const last = blocks[blocks.length - 1];
      if (ex.grp && last && last.grp === ex.grp && last.members[0].grp === ex.grp && !['check', 'ramp', 'interval'].includes(ex.kind)) last.members.push(ex);
      else blocks.push({ grp: ex.grp || null, members: [ex] });
    }
    blocks.forEach((b) => { b.superset = b.members.length > 1; });
    // step queue
    const steps = [];
    for (const b of blocks) {
      if (b.members.length === 1) {
        const ex = b.members[0];
        if (['check', 'ramp'].includes(ex.kind)) { steps.push({ ex: ex.id, i: 0 }); continue; }
        for (let i = 0; i < ex.setSpecs.length; i++) steps.push({ ex: ex.id, i });
      } else {
        const rounds = Math.max(...b.members.map((m) => m.setSpecs.length));
        for (let r = 0; r < rounds; r++) for (const m of b.members) if (r < m.setSpecs.length) steps.push({ ex: m.id, i: r });
      }
    }
    return { week, day, blocks, steps, exercises: out, target: targetMinutes(week), deload: isDeload(week), block: bi + 1 };
  }

  const api = { PROGRAM: { DAYS, MOBILITY, BLOCKS, RAMPS, READINESS }, resolve, targetMinutes, isDeload };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Prog = api;
})(typeof self !== 'undefined' ? self : this);
