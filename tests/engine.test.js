/*
  Reference tests for the decision engine.
  Expected values come from the Task 4 specification (final, 7 criteria) and docs/data-model.md.
  Open tests/engine.test.html in a browser. No build step or test framework needed.
*/
(function () {
  'use strict';

  const results = [];
  let group = '';
  function describe(name, fn) { group = name; fn(); }
  function it(name, fn) {
    try { fn(); results.push({ group, name, ok: true }); }
    catch (e) { results.push({ group, name, ok: false, error: e.message }); }
  }
  function eq(actual, expected, msg) {
    if (actual !== expected) throw new Error((msg ? msg + ': ' : '') + 'expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
  }
  function near(actual, expected, tol, msg) {
    if (!(Math.abs(actual - expected) <= tol)) throw new Error((msg ? msg + ': ' : '') + 'expected ' + expected + ' ± ' + tol + ', got ' + actual);
  }
  function ok(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

  const data = AW.testDataset.listings;
  const run = (key, listings) => AW.engine.evaluate(listings || data, AW.testProfiles[key].make());
  const byId = (res, id) => res.items.find(i => i.id === id);
  const clone = o => JSON.parse(JSON.stringify(o));

  const P1 = run('P1');
  const P2 = run('P2');

  /* ---------------- AHP ---------------- */
  describe('AHP weights (Task 4, table 8)', () => {
    it('TC-01 matrix is reciprocal with diagonal 1 and 21 judgments', () => {
      [P1, P2].forEach(r => {
        const A = r.ahp.matrix;
        eq(r.ahp.n, 7);
        eq(Object.keys(AW.testProfiles.P1.make().judgments).length, 21);
        A.forEach((row, i) => row.forEach((v, j) => {
          ok(v > 0, 'positive');
          near(v * A[j][i], 1, 1e-12, 'reciprocal ' + i + ',' + j);
        }));
      });
    });
    it('TC-02 weights are positive and sum to 1', () => {
      [P1, P2].forEach(r => {
        const w = Object.values(r.ahp.weights);
        ok(w.every(x => x > 0));
        near(w.reduce((s, x) => s + x, 0), 1, 1e-12);
      });
    });
    it('Profile 1 RGMM weights', () => {
      const exp = { E01: 27.3015, E02: 9.4991, E05: 27.3015, E09: 6.7736, E12: 16.1183, E15: 5.2135, E14: 7.7925 };
      Object.keys(exp).forEach(id => near(P1.ahp.weights[id] * 100, exp[id], 0.00005, id));
    });
    it('Profile 2 RGMM weights', () => {
      const exp = { E01: 13.62, E02: 5.49, E05: 8.30, E09: 3.58, E12: 33.78, E15: 22.15, E14: 13.07 };
      Object.keys(exp).forEach(id => near(P2.ahp.weights[id] * 100, exp[id], 0.005, id));
    });
    it('TC-03 lambda_max and CR for both profiles (RI = 1.32)', () => {
      near(P1.ahp.lambdaMax, 7.106065, 5e-7, 'P1 lambda'); near(P1.ahp.cr, 0.013392, 5e-7, 'P1 CR');
      near(P2.ahp.lambdaMax, 7.108169, 5e-7, 'P2 lambda'); near(P2.ahp.cr, 0.013658, 5e-7, 'P2 CR');
      eq(P1.ahp.ri, 1.32); ok(P1.ahp.consistent && P2.ahp.consistent);
    });
    it('Data model profile A weights and CR', () => {
      const r = run('A');
      const exp = { E01: 27.14, E02: 9.44, E05: 27.14, E09: 6.10, E12: 16.03, E14: 9.44, E15: 4.69 };
      Object.keys(exp).forEach(id => near(r.ahp.weights[id] * 100, exp[id], 0.005, id));
      near(r.ahp.cr, 0.0097, 0.00005, 'CR');
    });
    it('Data model profile B weights and CR', () => {
      const r = run('B');
      const exp = { E01: 12.05, E02: 4.86, E05: 7.65, E09: 3.25, E12: 32.99, E14: 19.59, E15: 19.59 };
      Object.keys(exp).forEach(id => near(r.ahp.weights[id] * 100, exp[id], 0.005, id));
      near(r.ahp.cr, 0.0118, 0.00005, 'CR');
    });
    it('Perfectly consistent matrix has CR 0 and RGMM = exact ratios', () => {
      const ids = ['E01', 'E02', 'E05'];
      const r = AW.ahp.compute(ids, { 'E01|E02': 2, 'E01|E05': 4, 'E02|E05': 2 });
      near(r.cr, 0, 1e-12); near(r.weights.E01, 4 / 7, 1e-12); near(r.weights.E05, 1 / 7, 1e-12);
    });
    it('Inconsistent answers withhold the ranking and point to the most deviating pair', () => {
      const p = AW.testProfiles.P1.make();
      p.judgments['E01|E02'] = 1 / 9; p.judgments['E02|E09'] = 9; p.judgments['E01|E09'] = 1 / 9;
      const before = JSON.stringify(p.judgments);
      const r = AW.engine.evaluate(data, p);
      ok(r.ahp.cr > 0.10, 'CR above limit, got ' + r.ahp.cr);
      ok(r.rankingWithheld, 'withheld');
      ok(r.ahp.mostDeviating && r.ahp.mostDeviating.residual > 0, 'deviation hint');
      eq(JSON.stringify(p.judgments), before, 'answers unchanged');
    });
    it('Neutral furnishing switches E15 off: 15 comparisons, RI = 1.24', () => {
      const p = AW.testProfiles.P1.make();
      p.furnishing = 'neutral';
      const check = AW.engine.checkProfile(p);
      eq(check.totalPairs, 15); eq(check.activeSoft.indexOf('E15'), -1); ok(check.complete);
      const r = AW.engine.evaluate(data, p);
      eq(r.ahp.n, 6); eq(r.ahp.ri, 1.24); ok(!('E15' in r.ahp.weights));
    });
  });

  /* ---------------- Stage 1 ---------------- */
  describe('Stage 1 routing (Task 4, table 9)', () => {
    it('Outcome partition 30 / 2 / 4 / 14', () => {
      eq(P1.groups.excluded.length, 30, 'excluded'); eq(P1.groups.insufficient.length, 2, 'insufficient');
      eq(P1.groups.incomplete.length, 4, 'incomplete'); eq(P1.groups.ranked.length, 14, 'ranked');
    });
    it('Incomplete soft data: APT-018 (E12), APT-030 (E15), APT-034 (E14), APT-038 (E05)', () => {
      const exp = { 'APT-018': 'E12', 'APT-030': 'E15', 'APT-034': 'E14', 'APT-038': 'E05' };
      eq(P1.groups.incomplete.map(i => i.id).sort().join(), Object.keys(exp).join());
      Object.keys(exp).forEach(id => eq(byId(P1, id).softMissing.map(m => m.id).join(), exp[id], id));
    });
    it('TC-04 APT-034 missing privacy -> incomplete, no score', () => {
      const i = byId(P1, 'APT-034'); eq(i.status, 'incomplete'); eq(i.score, undefined);
    });
    it('TC-05 APT-015 K14 fails while K01 missing -> excluded', () => {
      const i = byId(P1, 'APT-015'); eq(i.status, 'excluded');
      eq(i.fails.map(f => f.id).join(), 'K14'); eq(i.unknown.map(f => f.id).join(), 'K01');
    });
    it('TC-06 APT-006 -> insufficient (K14); APT-047 -> insufficient (K09)', () => {
      eq(byId(P1, 'APT-006').status, 'insufficient'); eq(byId(P1, 'APT-006').unknown[0].id, 'K14');
      eq(byId(P1, 'APT-047').status, 'insufficient'); eq(byId(P1, 'APT-047').unknown[0].id, 'K09');
    });
    it('TC-07 APT-003 cost 650 passes K01 (inclusive)', () => {
      eq(byId(P1, 'APT-003').hard.find(h => h.id === 'K01').state, 'pass');
    });
    it('TC-08 APT-007 cost 651 fails K01 (and K14)', () => {
      const i = byId(P1, 'APT-007');
      eq(i.fails.map(f => f.id).join(), 'K01,K14');
      eq(i.fails[0].message, 'Monthly housing cost is 651 €, which is 1 € above your 650 € budget.');
    });
    it('Multiple knockouts: APT-042 lists every failure (K01, K03, K09)', () => {
      eq(byId(P1, 'APT-042').fails.map(f => f.id).join(), 'K01,K03,K09,K14');
    });
    it('K03 boundary: APT-019 available exactly on the move-in date passes (profile A)', () => {
      const r = run('A'); eq(byId(r, 'APT-019').hard.find(h => h.id === 'K03').state, 'pass');
      eq(byId(r, 'APT-023').hard.find(h => h.id === 'K03').state, 'fail');
    });
    it('K04: APT-031 (5 months) fails, APT-035 (exactly 12) passes (profile A)', () => {
      const r = run('A');
      eq(byId(r, 'APT-031').hard.find(h => h.id === 'K04').state, 'fail');
      eq(byId(r, 'APT-035').hard.find(h => h.id === 'K04').state, 'pass');
    });
    it('K14 is only checked when step-free access is required', () => {
      eq(byId(run('A'), 'APT-002').hard.find(h => h.id === 'K14').state, 'inactive');
      eq(byId(run('B'), 'APT-002').hard.find(h => h.id === 'K14').state, 'fail');
    });
    it('Unlimited rental with null max_rental_months is not missing data', () => {
      eq(AW.engine.adapt(byId(P1, 'APT-006').listing).values.rental_period, Infinity);
      eq(AW.engine.adapt(byId(P1, 'APT-039').listing).issues.rental_period, 'missing');
    });
    it('Invalid values are treated as unknown, never guessed', () => {
      const l = clone(data[0]); l.room_size_m2 = -5; l.available_from = '2027-02-30';
      const a = AW.engine.adapt(l);
      eq(a.issues.room_size_m2, 'invalid'); eq(a.issues.available_from, 'invalid'); eq(a.values.room_size_m2, null);
    });
  });

  /* ---------------- Stage 2 ---------------- */
  describe('Stage 2 scoring (Task 4, tables 11-13)', () => {
    it('Worked example utilities for APT-029, APT-016, APT-001', () => {
      const exp = {
        'APT-029': { E01: 0.828571, E02: 0.883333, E05: 1, E09: 0.238462, E12: 0.104, E15: 1, E14: 0.25 },
        'APT-016': { E01: 0.185714, E02: 0.61, E05: 0.84, E09: 0.6, E12: 0.804, E15: 1, E14: 1 },
        'APT-001': { E01: 0.957143, E02: 0.866667, E05: 0.64, E09: 0.169231, E12: 0.216, E15: 1, E14: 0 }
      };
      Object.keys(exp).forEach(id => Object.keys(exp[id]).forEach(c =>
        near(byId(P1, id).criteria[c].utility, exp[id][c], 5e-7, id + ' ' + c)));
    });
    it('Worked example points (profile 1)', () => {
      const exp = {
        'APT-029': { E01: 22.6212, E02: 8.3909, E05: 27.3015, E09: 1.6153, E12: 1.6763, E15: 5.2135, E14: 1.9481 },
        'APT-016': { E01: 5.0703, E02: 5.7945, E05: 22.9332, E09: 4.0642, E12: 12.9591, E15: 5.2135, E14: 7.7925 },
        'APT-001': { E01: 26.1314, E02: 8.2326, E05: 17.4729, E09: 1.1463, E12: 3.4816, E15: 5.2135, E14: 0 }
      };
      Object.keys(exp).forEach(id => Object.keys(exp[id]).forEach(c =>
        near(byId(P1, id).criteria[c].points, exp[id][c], 0.00005, id + ' ' + c)));
    });
    it('Total scores 68.766730 / 63.827248 / 61.678261', () => {
      near(byId(P1, 'APT-029').score, 68.766730, 5e-7);
      near(byId(P1, 'APT-016').score, 63.827248, 5e-7);
      near(byId(P1, 'APT-001').score, 61.678261, 5e-7);
    });
    it('Profile 1 top five', () => {
      const exp = [['APT-029', '68.77'], ['APT-016', '63.83'], ['APT-001', '61.68'], ['APT-044', '60.94'], ['APT-045', '60.68']];
      exp.forEach(([id, s], i) => { eq(P1.groups.ranked[i].id, id, 'rank ' + (i + 1)); eq(P1.groups.ranked[i].displayScore, s, id); });
    });
    it('Profile 2 top five', () => {
      const exp = [['APT-016', '77.38'], ['APT-019', '70.23'], ['APT-029', '54.23'], ['APT-001', '53.16'], ['APT-044', '51.62']];
      exp.forEach(([id, s], i) => { eq(P2.groups.ranked[i].id, id, 'rank ' + (i + 1)); eq(P2.groups.ranked[i].displayScore, s, id); });
    });
    it('TC-09 privacy endpoints: level 1 -> 0, level 5 -> 1', () => {
      eq(byId(P1, 'APT-001').criteria.E14.utility, 0); eq(byId(P1, 'APT-016').criteria.E14.utility, 1);
    });
    it('TC-10 all ranked scores lie in [0, 100], no null utilities', () => {
      P1.groups.ranked.concat(P2.groups.ranked).forEach(i => {
        ok(i.score >= 0 && i.score <= 100, i.id);
        Object.values(i.criteria).forEach(c => ok(c.utility !== null && c.utility >= 0 && c.utility <= 1, i.id + ' ' + c.id));
      });
    });
    it('TC-11 preference reranking: APT-029 #1 in P1, APT-016 #1 in P2', () => {
      eq(P1.groups.ranked[0].id, 'APT-029'); eq(P2.groups.ranked[0].id, 'APT-016');
    });
    it('TC-12 idempotent recomputation', () => {
      const again = run('P1');
      P1.groups.ranked.forEach((i, k) => { eq(again.groups.ranked[k].id, i.id); eq(again.groups.ranked[k].score, i.score); });
    });
    it('TC-13 adding a listing does not change other scores', () => {
      const extra = clone(byId(P1, 'APT-029').listing);
      extra.apartment_id = 'NEW-001'; extra.monthly_cost_eur = 100; extra.room_size_m2 = 80;
      const r = run('P1', data.concat([extra]));
      P1.groups.ranked.forEach(i => eq(byId(r, i.id).score, i.score, i.id));
      eq(r.groups.ranked[0].id, 'NEW-001');
    });
    it('TC-14 no eligible apartments -> empty ranking, no invented winners', () => {
      const p = AW.testProfiles.P1.make(); p.budget = 100;
      const r = AW.engine.evaluate(data, p);
      eq(r.groups.ranked.length, 0); ok(r.groups.excluded.length > 0);
    });
    it('Identical scores share a rank (APT-049 / APT-050, profile A)', () => {
      const r = run('A');
      const a = byId(r, 'APT-049'), b = byId(r, 'APT-050');
      eq(a.status, 'ranked'); eq(a.rank, b.rank); ok(a.tied && b.tied);
      const next = r.groups.ranked[r.groups.ranked.indexOf(b) + 1];
      if (next) eq(next.rank, r.groups.ranked.indexOf(b) + 2, 'competition ranking skips a place');
    });
    it('Nearly identical scores are flagged: APT-044 vs APT-045 in P1 (0.26 points)', () => {
      ok(byId(P1, 'APT-044').closeTo.includes('APT-045')); ok(P1.hasCloseScores);
      ok(byId(P1, 'APT-044').rank < byId(P1, 'APT-045').rank, 'calculated order kept');
    });
    it('Explanation tags for profile 1 (Task 4, table 14)', () => {
      const tags = id => {
        const i = byId(P1, id);
        return {
          high: i.explanation.strengths.map(s => s.id).sort().join(),
          low: i.explanation.weaknesses.map(s => s.id).sort().join(),
          top: i.explanation.topContributors.join()
        };
      };
      const t029 = tags('APT-029'); eq(t029.high, 'E01,E02,E05,E15'); eq(t029.low, 'E09,E12,E14'); eq(t029.top, 'E05,E01');
      const t016 = tags('APT-016'); eq(t016.high, 'E05,E12,E14,E15'); eq(t016.low, 'E01'); eq(t016.top, 'E05,E12');
      const t001 = tags('APT-001'); eq(t001.high, 'E01,E02,E15'); eq(t001.low, 'E09,E12,E14'); eq(t001.top, 'E01,E05');
    });
  });

  /* ---------------- Profile ---------------- */
  describe('Profile and adapter', () => {
    it('Empty profile is incomplete and lists every missing input', () => {
      const c = AW.engine.checkProfile({});
      ok(!c.complete); eq(c.items.filter(i => !i.done).length, 5);
      eq(AW.engine.evaluate(data, {}).ready, false);
    });
    it('Reference values must point in the right direction', () => {
      const c = AW.criteria;
      ok(AW.engine.anchorError(c.soft('E12'), { ideal: 10, worst: 12 }));
      ok(AW.engine.anchorError(c.soft('E01'), { ideal: 700, worst: 650 }));
      ok(AW.engine.anchorError(c.soft('E01'), { ideal: 650, worst: 650 }));
      eq(AW.engine.anchorError(c.soft('E01'), { ideal: 300, worst: 650 }), null);
    });
    it('Privacy derived from flatmates and bathroom matches the dataset', () => {
      data.filter(l => l.flatmates !== null && l.privacy_score !== null).forEach(l =>
        eq(AW.engine.derivePrivacy(l.flatmates, l.private_bathroom), l.privacy_score, l.apartment_id));
      eq(AW.engine.derivePrivacy(null, true), null);
      eq(AW.engine.derivePrivacy(2, null), null);
    });
  });

  /* ---------------- Report ---------------- */
  const failed = results.filter(r => !r.ok);
  window.AW_TEST_RESULTS = { total: results.length, failed: failed.length, results };
  const out = document.getElementById('report');
  if (!out) return;
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  let html = '<p class="summary ' + (failed.length ? 'bad' : 'good') + '">' + (results.length - failed.length) + ' of ' + results.length + ' tests passed</p>';
  let last = '';
  results.forEach(r => {
    if (r.group !== last) { html += (last ? '</ul>' : '') + '<h2>' + esc(r.group) + '</h2><ul>'; last = r.group; }
    html += '<li class="' + (r.ok ? 'pass' : 'fail') + '">' + (r.ok ? '✓ ' : '✕ ') + esc(r.name) + (r.ok ? '' : '<br><code>' + esc(r.error) + '</code>') + '</li>';
  });
  out.innerHTML = html + '</ul>';
})();

it('I-01: all tied apartments are flagged as close to APT-014', () => {
  const r = run('A');

  const a = byId(r, 'APT-014');
  const b = byId(r, 'APT-049');
  const c = byId(r, 'APT-050');

  eq(b.rank, c.rank, 'identical scores share rank');

  ok(a.closeTo.includes(b.id));
  ok(a.closeTo.includes(c.id));

  ok(b.closeTo.includes(a.id));
  ok(c.closeTo.includes(a.id));

  ok(b.tied && c.tied, 'tie flags remain intact');
});
