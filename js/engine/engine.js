/*
  Two-stage decision engine.

  Stage 1  knockout filter: every listing ends up as excluded, insufficient (hard data) or passed.
  Stage 2  scoring: AHP weights x normalised utilities (SAW) -> score 0-100, rank and explanation.
           Passed listings with a missing active soft value are "incomplete" and are not scored.

  The engine is generic: it only works with the rule set (AW.criteria), the alternatives
  (adapted from the dataset format) and the preference profile. It has no DOM access.
  Rules: docs/data-model.md, Task 4 specification, Task 5 edge cases.
*/
(function (AW) {
  'use strict';

  const C = AW.criteria;
  const F = AW.fmt;
  const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

  /* ---------- Adapter: dataset listing -> validated alternative ---------- */

  function isValidDate(s) {
    if (typeof s !== 'string' || !ISO_DATE.test(s)) return false;
    const d = new Date(s + 'T00:00:00Z');
    return !isNaN(d) && d.toISOString().slice(0, 10) === s;
  }

  function isNum(v) { return typeof v === 'number' && isFinite(v); }

  /**
   * Validates the raw listing and derives the values the criteria need.
   * values[field] is the usable value or null. issues[field] is 'missing' or 'invalid'.
   * A missing value is never replaced by zero, full marks or an average.
   */
  function adapt(listing) {
    const values = {};
    const issues = {};
    const set = (field, raw, valid, transform) => {
      if (raw === null || raw === undefined || raw === '') { values[field] = null; issues[field] = 'missing'; return; }
      if (!valid(raw)) { values[field] = null; issues[field] = 'invalid'; return; }
      values[field] = transform ? transform(raw) : raw;
    };

    set('monthly_cost_eur', listing.monthly_cost_eur, v => isNum(v) && v > 0);
    set('deposit_eur', listing.deposit_eur, v => isNum(v) && v >= 0);
    set('available_from', listing.available_from, isValidDate);
    set('written_contract', listing.written_contract, v => typeof v === 'boolean');
    set('step_free_access', listing.step_free_access, v => typeof v === 'boolean');
    set('commute_min', listing.commute_min, v => isNum(v) && v >= 0);
    set('supermarket_distance_m', listing.supermarket_distance_m, v => isNum(v) && v >= 0);
    set('room_size_m2', listing.room_size_m2, v => isNum(v) && v > 0);
    set('furnishing', listing.furnishing, v => Object.prototype.hasOwnProperty.call(C.FURNISHING_LABELS, v));
    set('privacy_score', listing.privacy_score, v => Number.isInteger(v) && v >= 1 && v <= 5);

    // K04 rental period: unlimited if rental_type is "unlimited", otherwise max_rental_months.
    // null max_rental_months together with "unlimited" is not missing data (data model, section 3).
    const type = listing.rental_type;
    if (type === null || type === undefined || type === '') {
      values.rental_period = null; issues.rental_period = 'missing';
    } else if (type === 'unlimited') {
      values.rental_period = Infinity;
    } else if (type === 'limited') {
      set('rental_period', listing.max_rental_months, v => isNum(v) && v > 0);
    } else {
      values.rental_period = null; issues.rental_period = 'invalid';
    }

    return { id: listing.apartment_id, listing, values, issues };
  }

  // Privacy level derived from flatmates and bathroom (data model, section 6).
  // Returns null if it cannot be determined; nothing is guessed.
  function derivePrivacy(flatmates, privateBathroom) {
    if (!Number.isInteger(flatmates) || flatmates < 0) return null;
    const base = flatmates === 0 ? 5 : flatmates === 1 ? 3 : flatmates <= 3 ? 2 : 1;
    if (base === 5) return 5;
    if (typeof privateBathroom !== 'boolean') return null;
    return Math.min(5, base + (privateBathroom ? 1 : 0));
  }

  /* ---------- Preference profile ---------- */

  function activeSoftIds(profile) {
    return C.softIds.filter(id => !(id === 'E15' && profile.furnishing === 'neutral'));
  }

  function anchorError(c, a) {
    if (!a || !isNum(a.ideal) || !isNum(a.worst)) return 'Enter both values.';
    if (a.ideal < 0 || a.worst < 0) return 'Values cannot be negative.';
    if (a.ideal === a.worst) return 'Ideal and worst value must differ.';
    if (c.better === 'lower' && a.ideal > a.worst) return 'Lower is better here: the ideal must be below the worst value.';
    if (c.better === 'higher' && a.ideal < a.worst) return 'Larger is better here: the ideal must be above the worst value.';
    return null;
  }

  /**
   * Checks whether the profile is complete. Nothing has a default value.
   * Returns { complete, items, errors, activeSoft, answered, totalPairs }.
   */
  function checkProfile(profile) {
    const p = profile || {};
    const errors = {};
    if (!(isNum(p.budget) && p.budget > 0)) errors.budget = 'Enter a budget greater than 0.';
    if (!isValidDate(p.moveInBy)) errors.moveInBy = 'Enter a valid date.';
    if (!(Number.isInteger(p.minRentalMonths) && p.minRentalMonths >= 0)) errors.minRentalMonths = 'Enter whole months (0 or more).';
    const hardDone = !errors.budget && !errors.moveInBy && !errors.minRentalMonths;
    const stepFreeDone = typeof p.needStepFree === 'boolean';
    const furnishingDone = ['furnished', 'unfurnished', 'neutral'].includes(p.furnishing);

    const activeSoft = activeSoftIds(p);
    const anchorProblems = [];
    C.numericSoft.forEach(c => {
      const err = anchorError(c, (p.anchors || {})[c.id]);
      if (err) { errors['anchor_' + c.id] = err; anchorProblems.push(c.label.toLowerCase()); }
    });

    const totalPairs = activeSoft.length * (activeSoft.length - 1) / 2;
    const answered = furnishingDone ? AW.ahp.countAnswered(activeSoft, p.judgments || {}) : 0;

    const items = [
      { key: 'hard', label: 'Budget, move-in date and minimum rental period', done: hardDone,
        detail: hardDone ? '' : 'fill in all three' },
      { key: 'stepFree', label: 'Step-free access', done: stepFreeDone, detail: stepFreeDone ? '' : 'answer yes or no' },
      { key: 'furnishing', label: 'Furnishing preference', done: furnishingDone, detail: furnishingDone ? '' : 'choose one option' },
      { key: 'anchors', label: 'Reference values', done: anchorProblems.length === 0,
        detail: anchorProblems.length ? 'check ' + anchorProblems.join(', ') : '' },
      { key: 'pairwise', label: 'Pairwise comparisons', done: furnishingDone && answered === totalPairs,
        detail: !furnishingDone ? 'choose a furnishing preference first' : (answered === totalPairs ? '' : answered + ' of ' + totalPairs + ' answered') }
    ];

    return { complete: items.every(i => i.done), items, errors, activeSoft, answered, totalPairs };
  }

  /* ---------- Stage 1: knockout filter ---------- */

  function issueText(alt, field) { return alt.issues[field] === 'invalid' ? 'is invalid' : 'is not stated'; }

  function checkHard(alt, profile) {
    const v = alt.values;
    const out = [];

    // K01 budget (inclusive)
    if (v.monthly_cost_eur === null) {
      out.push({ id: 'K01', state: 'unknown', field: 'monthly_cost_eur', message: 'Monthly cost ' + issueText(alt, 'monthly_cost_eur') + '.' });
    } else if (v.monthly_cost_eur > profile.budget) {
      out.push({ id: 'K01', state: 'fail', actual: v.monthly_cost_eur, limit: profile.budget,
        message: 'Monthly housing cost is ' + F.euro(v.monthly_cost_eur) + ', which is ' + F.euro(v.monthly_cost_eur - profile.budget) +
          ' above your ' + F.euro(profile.budget) + ' budget.' });
    } else out.push({ id: 'K01', state: 'pass' });

    // K03 availability (inclusive)
    if (v.available_from === null) {
      out.push({ id: 'K03', state: 'unknown', field: 'available_from', message: 'Availability date ' + issueText(alt, 'available_from') + '.' });
    } else if (v.available_from > profile.moveInBy) {
      const days = F.daysBetween(profile.moveInBy, v.available_from);
      out.push({ id: 'K03', state: 'fail', actual: v.available_from, limit: profile.moveInBy,
        message: 'Available from ' + F.date(v.available_from) + ', which is ' + F.plural(days, 'day') +
          ' after your latest move-in date (' + F.date(profile.moveInBy) + ').' });
    } else out.push({ id: 'K03', state: 'pass' });

    // K04 rental period (inclusive, unlimited always passes)
    if (v.rental_period === null) {
      out.push({ id: 'K04', state: 'unknown', field: 'rental_period', message: 'Rental period ' + issueText(alt, 'rental_period') + '.' });
    } else if (v.rental_period < profile.minRentalMonths) {
      out.push({ id: 'K04', state: 'fail', actual: v.rental_period, limit: profile.minRentalMonths,
        message: 'Rental period is limited to ' + F.plural(v.rental_period, 'month') + ', which is ' +
          F.plural(profile.minRentalMonths - v.rental_period, 'month') + ' shorter than your required ' + F.plural(profile.minRentalMonths, 'month') + '.' });
    } else out.push({ id: 'K04', state: 'pass' });

    // K09 written contract
    if (v.written_contract === null) {
      out.push({ id: 'K09', state: 'unknown', field: 'written_contract', message: 'It is not stated whether a written contract is offered.' });
    } else if (v.written_contract !== true) {
      out.push({ id: 'K09', state: 'fail', actual: false, limit: true, message: 'No written contract is offered. A written contract is required.' });
    } else out.push({ id: 'K09', state: 'pass' });

    // K14 step-free access, only if the user needs it
    if (!profile.needStepFree) {
      out.push({ id: 'K14', state: 'inactive' });
    } else if (v.step_free_access === null) {
      out.push({ id: 'K14', state: 'unknown', field: 'step_free_access',
        message: 'Accessibility information is missing. Please provide it, because you need step-free access.' });
    } else if (v.step_free_access !== true) {
      out.push({ id: 'K14', state: 'fail', actual: false, limit: true, message: 'The apartment is not step-free accessible, but you need step-free access.' });
    } else out.push({ id: 'K14', state: 'pass' });

    return out.map(r => Object.assign({ label: C.hard(r.id).label }, r));
  }

  /* ---------- Stage 2: normalisation and SAW ---------- */

  function utility(c, value, profile) {
    if (value === null) return null;
    if (c.kind === 'numeric') {
      const a = profile.anchors[c.id];
      const u = (value - a.worst) / (a.ideal - a.worst);
      return Math.min(1, Math.max(0, u)); // capped beyond the reference values
    }
    if (c.kind === 'ordinal') return C.PRIVACY_UTILITY[value];
    if (c.kind === 'categorical') return C.FURNISHING_UTILITY[profile.furnishing][value];
    return null;
  }

  function valueText(c, value) {
    if (c.id === 'E15') return C.FURNISHING_LABELS[value];
    if (c.id === 'E14') return value + ' of 5';
    return F.withUnit(value, c.unit);
  }

  const STRENGTH = {
    E01: v => 'Low monthly cost (' + v + ') is a strength.',
    E02: v => 'Low deposit (' + v + ') is a strength.',
    E05: v => 'The short commute (' + v + ') is a strength.',
    E09: v => 'A supermarket is close by (' + v + ').',
    E12: v => 'The room is spacious (' + v + ').',
    E15: (v, p) => 'It is ' + v + ', as you prefer.',
    E14: v => 'High privacy (' + v + ').'
  };
  const WEAKNESS = {
    E01: v => 'Monthly cost (' + v + ') receives a low criterion score.',
    E02: v => 'The deposit (' + v + ') receives a low criterion score.',
    E05: v => 'The commute (' + v + ') receives a low criterion score.',
    E09: v => 'The supermarket is far away (' + v + ').',
    E12: v => 'Room size (' + v + ') receives a low criterion score.',
    E15: (v, p) => 'It is ' + v + ', but you prefer ' + (p.furnishing === 'furnished' ? 'furnished' : 'unfurnished') + '.',
    E14: v => 'Privacy is low (' + v + ').'
  };

  function explain(item, activeSoft, profile) {
    const S = C.SETTINGS;
    const rows = activeSoft.map(id => item.criteria[id]);
    const strengths = rows.filter(r => r.utility >= S.highUtility).sort((a, b) => b.points - a.points)
      .map(r => ({ id: r.id, text: STRENGTH[r.id](r.valueText, profile) }));
    const weaknesses = rows.filter(r => r.utility <= S.lowUtility).sort((a, b) => b.lost - a.lost)
      .map(r => ({ id: r.id, text: WEAKNESS[r.id](r.valueText, profile) }));
    const top = rows.slice().sort((a, b) => b.points - a.points).slice(0, 2).filter(r => r.points > 0);
    let topText = '';
    if (top.length) {
      const names = top.map(r => C.soft(r.id).label.toLowerCase());
      const pts = top.reduce((s, r) => s + r.points, 0);
      topText = names.join(' and ').replace(/^./, ch => ch.toUpperCase()) + (top.length > 1 ? ' bring' : ' brings') +
        ' the most points (' + F.number(pts, 2) + ' of ' + F.number(item.score, 2) + ').';
    }
    return { strengths, weaknesses, topContributors: top.map(r => r.id), topText };
  }

  /* ---------- Ranking ---------- */

  function assignRanks(scored) {
    const S = C.SETTINGS;
    scored.sort((a, b) => (b.score - a.score) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    scored.forEach((item, i) => {
      const prev = scored[i - 1];
      item.rank = prev && Math.abs(prev.score - item.score) <= S.tieTolerance ? prev.rank : i + 1;
      item.tied = false; item.closeTo = [];
    });
    
scored.forEach((item, i) => {
  for (let j = i + 1; j < scored.length; j++) {
    const other = scored[j];
    const diff = Math.abs(item.score - other.score);

    // Identical scores share the same rank.
    if (diff <= S.tieTolerance) {
      item.tied = true;
      other.tied = true;
    }

    // Nearly identical scores must be flagged for all
    // affected apartments, not only adjacent listings.
    else if (diff < S.closeScorePoints) {
      item.closeTo.push(other.id);
      other.closeTo.push(item.id);
    }

    // Scores are sorted descending, so later values
    // cannot be closer once the threshold is exceeded.
    else {
      break;
    }
  }
});

    // Distinct raw scores that round to the same display value get extra decimals (Task 4, 4.3).
    scored.forEach(item => {
      let d = 2;
      while (d < 6 && scored.some(o => Math.abs(o.score - item.score) > S.tieTolerance && o.score.toFixed(d) === item.score.toFixed(d))) d++;
      item.displayDecimals = d;
      item.displayScore = item.score.toFixed(d);
    });
    return scored;
  }

  /* ---------- Main entry ---------- */

  /**
   * Runs both stages for a list of listings (dataset format) and a complete profile.
   * Returns null if the profile is incomplete (check with checkProfile first).
   */
  function evaluate(listings, profile) {
    const check = checkProfile(profile);
    if (!check.complete) return { ready: false, check };

    const activeSoft = check.activeSoft;
    const ahp = AW.ahp.compute(activeSoft, profile.judgments);
    const items = listings.map(listing => {
      const alt = adapt(listing);
      const hard = checkHard(alt, profile);
      const fails = hard.filter(h => h.state === 'fail');
      const unknown = hard.filter(h => h.state === 'unknown');
      const softMissing = activeSoft
        .filter(id => alt.values[C.soft(id).field] === null)
        .map(id => ({ id, label: C.soft(id).label, field: C.soft(id).field, issue: alt.issues[C.soft(id).field] }));
      const item = { id: alt.id, listing, alt, hard, fails, unknown, softMissing, notes: [] };

      if (listing.min_commitment_months > 0) item.notes.push('Minimum commitment ' + F.plural(listing.min_commitment_months, 'month') + '.');

      if (fails.length) {
        item.status = 'excluded'; // a known failure takes precedence over unknown fields
      } else if (unknown.length) {
        item.status = 'insufficient';
      } else if (softMissing.length) {
        item.status = 'incomplete';
      } else {
        item.status = 'ranked';
        item.criteria = {};
        activeSoft.forEach(id => {
          const c = C.soft(id);
          const value = alt.values[c.field];
          const u = utility(c, value, profile);
          const w = ahp.weights[id];
          item.criteria[id] = { id, value, valueText: valueText(c, value), utility: u, weight: w,
            points: w * u * 100, maxPoints: w * 100, lost: w * (1 - u) * 100 };
        });
        item.score = activeSoft.reduce((s, id) => s + item.criteria[id].points, 0);
      }
      return item;
    });

    const groups = { ranked: [], excluded: [], insufficient: [], incomplete: [] };
    items.forEach(i => groups[i.status].push(i));
    assignRanks(groups.ranked);
    groups.ranked.forEach(i => { i.explanation = explain(i, activeSoft, profile); });

    return {
      ready: true,
      check,
      activeSoft,
      ahp,
      items,
      groups,
      // Inconsistent comparisons: answers are kept, but no final ranking is published.
      rankingWithheld: !ahp.consistent,
      hasCloseScores: groups.ranked.some(i => i.closeTo.length > 0),
      hasTies: groups.ranked.some(i => i.tied)
    };
  }

  AW.engine = { adapt, derivePrivacy, activeSoftIds, anchorError, checkProfile, checkHard, utility, evaluate, isValidDate };
})(window.AW = window.AW || {});
