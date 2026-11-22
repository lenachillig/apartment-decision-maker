/*
  AHP weight estimation (Task 4, section 3).
  - Weights: row geometric mean method (RGMM), normalised to sum 1.
  - Consistency: lambda_max estimated from the RGMM weights, CI = (lambda_max - n) / (n - 1), CR = CI / RI.
  - Review hint: the comparison with the largest log-ratio residual |ln(a_jk * w_k / w_j)|.
    It is only a hint. Answers are never changed automatically.

  Judgments are stored as a map "A|B" -> a, where A comes before B in the criterion order
  and a is the importance of A relative to B (5 = A much more important, 1/5 = B much more important).
*/
(function (AW) {
  'use strict';

  function pairKey(a, b) { return a + '|' + b; }

  // All pairs (i < j) of the given criteria, in order.
  function pairs(ids) {
    const out = [];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) out.push([ids[i], ids[j]]);
    }
    return out;
  }

  // Reads the judgment for any direction. Returns null if not answered.
  function judgment(judgments, a, b) {
    if (a === b) return 1;
    const direct = judgments[pairKey(a, b)];
    if (isValidRatio(direct)) return direct;
    const reverse = judgments[pairKey(b, a)];
    if (isValidRatio(reverse)) return 1 / reverse;
    return null;
  }

  function isValidRatio(v) { return typeof v === 'number' && isFinite(v) && v > 0; }

  function countAnswered(ids, judgments) {
    return pairs(ids).filter(([a, b]) => judgment(judgments, a, b) !== null).length;
  }

  // Builds the positive reciprocal matrix. Throws if a comparison is missing.
  function buildMatrix(ids, judgments) {
    return ids.map(a => ids.map(b => {
      const v = judgment(judgments, a, b);
      if (v === null) throw new Error('Missing comparison ' + a + ' vs ' + b);
      return v;
    }));
  }

  function compute(ids, judgments) {
    const n = ids.length;
    const RI = AW.criteria.RANDOM_INDEX;
    const limit = AW.criteria.SETTINGS.crLimit;
    if (n === 0) return null;

    const A = buildMatrix(ids, judgments);
    // Geometric mean via logs: numerically stable and exact enough for n <= 10.
    const g = A.map(row => Math.exp(row.reduce((s, v) => s + Math.log(v), 0) / n));
    const sum = g.reduce((s, v) => s + v, 0);
    const w = g.map(v => v / sum);

    let lambdaMax = n;
    if (n > 1) {
      lambdaMax = A.reduce((s, row, i) => s + row.reduce((t, v, j) => t + v * w[j], 0) / w[i], 0) / n;
    }
    const ci = n > 2 ? (lambdaMax - n) / (n - 1) : 0;
    const ri = RI[n] !== undefined ? RI[n] : 1.49;
    const cr = n > 2 && ri > 0 ? ci / ri : 0;

    // Residual of every entered comparison against the ratio implied by the weights.
    const deviations = pairs(ids).map(([a, b]) => {
      const i = ids.indexOf(a), j = ids.indexOf(b);
      const entered = A[i][j];
      const implied = w[i] / w[j];
      return { a, b, entered, implied, residual: Math.abs(Math.log(entered / implied)) };
    }).sort((x, y) => y.residual - x.residual);

    const weights = {};
    ids.forEach((id, i) => { weights[id] = w[i]; });

    return {
      ids: ids.slice(), n, matrix: A, weights, lambdaMax, ci, ri, cr,
      consistent: cr <= limit + 1e-12,
      crLimit: limit,
      deviations,
      mostDeviating: deviations[0] || null
    };
  }

  // Converts a full matrix (rows in the given order) to the judgment map. Used for test fixtures.
  function matrixToJudgments(ids, rows) {
    const out = {};
    pairs(ids).forEach(([a, b]) => {
      out[pairKey(a, b)] = rows[ids.indexOf(a)][ids.indexOf(b)];
    });
    return out;
  }

  AW.ahp = { pairKey, pairs, judgment, countAnswered, buildMatrix, compute, matrixToJudgments, isValidRatio };
})(window.AW = window.AW || {});
