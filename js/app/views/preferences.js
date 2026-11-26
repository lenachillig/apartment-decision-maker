/*
  Step 2: preference profile.
  Order: hard limits -> furnishing -> reference values -> pairwise comparisons (AHP) -> checklist.
  Furnishing comes before the comparisons because "neutral" switches E15 off (21 -> 15 questions).
  There are no default values. Weights are calculated from the answers and never typed in.
*/
(function (AW) {
  'use strict';

  const C = AW.criteria;
  const F = AW.fmt;
  const U = AW.ui;
  const S = AW.store;

  const SIMPLE = [
    { v: 5, label: a => a + ': much more' },
    { v: 3, label: a => a + ': more' },
    { v: 1, label: () => 'Equal' },
    { v: 1 / 3, label: (a, b) => b + ': more' },
    { v: 1 / 5, label: (a, b) => b + ': much more' }
  ];
  const VERBAL = { 1: 'equally important', 2: 'equally to moderately more important', 3: 'moderately more important',
    4: 'moderately to strongly more important', 5: 'strongly more important', 6: 'strongly to very strongly more important',
    7: 'very strongly more important', 8: 'very to extremely more important', 9: 'extremely more important' };

  const touched = {};

  function profile() { return S.state.profile; }
  function check() { return AW.engine.checkProfile(profile()); }
  function same(a, b) { return Math.abs(a - b) < 1e-9; }
  function label(id) { return C.soft(id).label.toLowerCase(); }

  /* ---------- Cards ---------- */

  function fieldError(key, msg) {
    return '<span class="field-error" id="e-' + key + '"' + (msg ? '' : ' hidden') + '>' + U.esc(msg || '') + '</span>';
  }

  function visibleError(key, errors) {
    return touched[key] ? errors[key] : '';
  }

  function hardCard(errors) {
    const p = profile();
    const num = (key, lbl, code, unit, hint) => {
      const err = visibleError(key, errors);
      return '<div class="field' + (err ? ' is-invalid' : '') + '" data-field="' + key + '"><label for="p-' + key + '">' + lbl +
        ' <span class="field-code">' + code + '</span></label><div class="input-unit"><input class="input" id="p-' + key + '" name="' + key +
        '" inputmode="' + (key === 'minRentalMonths' ? 'numeric' : 'decimal') + '" value="' + U.esc(U.inputValue(p[key])) + '" aria-describedby="e-' + key + '"><span>' + unit +
        '</span></div>' + (hint ? '<span class="field-hint">' + hint + '</span>' : '') + fieldError(key, err) + '</div>';
    };
    const dErr = visibleError('moveInBy', errors);
    return '<form class="card" id="hard-card" novalidate><h2 class="card-title">Hard limits</h2>' +
      '<p class="card-intro">Apartments that fail any of these are excluded, however well they score elsewhere.</p>' +
      '<div class="form-grid">' +
        num('budget', 'Maximum monthly cost', 'K01', '€', 'An apartment at exactly this price still passes.') +
        '<div class="field' + (dErr ? ' is-invalid' : '') + '" data-field="moveInBy"><label for="p-moveInBy">Latest move-in date <span class="field-code">K03</span></label>' +
          '<input class="input" id="p-moveInBy" name="moveInBy" type="date" value="' + U.esc(p.moveInBy || '') + '" aria-describedby="e-moveInBy">' +
          '<span class="field-hint">Available on this day still passes.</span>' + fieldError('moveInBy', dErr) + '</div>' +
        num('minRentalMonths', 'Minimum rental period', 'K04', 'months', 'Unlimited contracts always pass.') +
      '</div>' +
      '<div class="field" role="radiogroup" aria-labelledby="l-need-stepfree" style="margin-top:18px;max-width:420px">' +
        '<span class="field-label" id="l-need-stepfree">Do you need step-free access? <span class="field-code">K14</span></span>' +
        '<div class="choice-group">' +
          '<label class="choice"><input type="radio" name="needStepFree" value="true"' + (p.needStepFree === true ? ' checked' : '') + '><span>Yes</span></label>' +
          '<label class="choice"><input type="radio" name="needStepFree" value="false"' + (p.needStepFree === false ? ' checked' : '') + '><span>No</span></label>' +
        '</div><span class="field-hint">Required. Nothing is preselected. If yes, apartments without confirmed step-free access cannot be ranked.</span></div>' +
      '</form>';
  }

  function furnishingCard() {
    const p = profile();
    const opt = (v, t, s) => '<label class="choice"><input type="radio" name="furnishing" value="' + v + '"' + (p.furnishing === v ? ' checked' : '') +
      '><span>' + t + '<small>' + s + '</small></span></label>';
    return '<div class="card" role="radiogroup" aria-labelledby="l-furnish"><h2 class="card-title" id="l-furnish">Furnishing preference</h2>' +
      '<p class="card-intro">Asked before the comparisons. If you are neutral, furnishing is not scored and you answer 15 instead of 21 questions.</p>' +
      '<div class="choice-group is-cards">' +
        opt('furnished', 'Prefer furnished', 'Furnished 100 %, partly 50 %, unfurnished 0 %') +
        opt('unfurnished', 'Prefer unfurnished', 'Unfurnished 100 %, partly 50 %, furnished 0 %') +
        opt('neutral', 'Neutral', 'Furnishing is not scored') +
      '</div></div>';
  }

  
function anchorsCard(errors) {
  const p = profile();

  // Examples only – these values are never applied automatically.
  const examples = {
    E01: { ideal: 300, worst: 650, help: 'Monthly rent: lower is better.' },
    E02: { ideal: 0, worst: 3000, help: 'Deposit: lower is better.' },
    E05: { ideal: 10, worst: 60, help: 'Commute time: lower is better.' },
    E09: { ideal: 200, worst: 1500, help: 'Distance to supermarket: lower is better.' },
    E12: { ideal: 35, worst: 10, help: 'Room size: larger is better.' }
  };

  const rows = C.numericSoft.map(c => {
    const a = p.anchors[c.id] || {};
    const example = examples[c.id];
    const key = 'anchor_' + c.id;

    const err =
      (touched[key + '_ideal'] && touched[key + '_worst']) ||
      (a.ideal !== null && a.worst !== null)
        ? errors[key]
        : '';

    const input = which =>
      '<div class="input-unit">' +
      '<input class="input" name="anchor.' + c.id + '.' + which +
      '" inputmode="decimal" aria-label="' + c.label + ' ' + which +
      '" placeholder="e.g. ' + example[which] +
      '" value="' + U.esc(U.inputValue(a[which])) +
      '" aria-describedby="e-' + key + '">' +
      '<span>' + c.unit + '</span></div>';

    return '<tr data-anchor="' + c.id +
      '" class="' + (err ? 'is-invalid' : '') + '">' +
      '<td>' + c.label +
      ' <span class="field-code">' + c.id + '</span>' +
      '<div class="field-hint">' + example.help + '</div>' +
      '<div class="field-hint">Example: ideal ' +
      example.ideal + ' ' + c.unit +
      ', worst ' + example.worst + ' ' + c.unit +
      '</div></td>' +
      '<td>' + input('ideal') + '</td>' +
      '<td>' + input('worst') + '</td>' +
      '</tr>' +
      '<tr class="ref-error-row"><td></td><td colspan="2">' +
      fieldError(key, err) + '</td></tr>';
  }).join('');

  return '<form class="card" id="anchor-card" novalidate>' +
    '<h2 class="card-title">Reference values</h2>' +

    '<p class="card-intro">' +
    'Choose how each criterion is scored. ' +
    'The ideal value gives full points (100%), while the worst ' +
    'reference value gives zero points (0%). ' +
    'Values in between receive points proportionally. ' +
    'The numbers shown below are examples only. ' +
    'You can enter your own values.' +
    '</p>' +

    '<div class="alert alert-info" style="margin-bottom:18px">' +
    '<span class="alert-icon" aria-hidden="true">i</span>' +
    '<div><strong>Scoring values are not mandatory limits.</strong>' +
    '<p>For example, your maximum monthly budget decides whether ' +
    'an apartment is excluded. These reference values only ' +
    'determine how many points an eligible apartment receives.</p>' +
    '</div></div>' +

    '<div class="table-wrap" style="border:0">' +
    '<table class="ref-table">' +
    '<thead><tr>' +
    '<th scope="col">Criterion</th>' +
    '<th scope="col">Ideal (100% points)</th>' +
    '<th scope="col">Worst reference (0% points)</th>' +
    '</tr></thead><tbody>' +
    rows +
    '</tbody></table></div>' +

    '<p class="field-note">' +
    'Privacy (E14) uses a fixed 1–5 scale and needs no input. ' +
    'Furnishing (E15) is set by your preference above. ' +
    'Reference values stay fixed during evaluation.' +
    '</p></form>';
}


  function sliderPos(v) {
    if (v === null) return 0;
    return v >= 1 ? -Math.round(v - 1) : Math.round(1 / v - 1);
  }
  function posValue(pos) { return pos <= 0 ? 1 - pos : 1 / (1 + pos); }

  function describeAnswer(a, b, v) {
    if (v === null) return 'Not answered yet';
    if (same(v, 1)) return C.soft(a).label + ' and ' + label(b) + ' are equally important';
    const winner = v > 1 ? a : b;
    const loser = v > 1 ? b : a;
    const r = v > 1 ? v : 1 / v;
    const rr = Math.round(r);
    return C.soft(winner).label + ' is ' + (VERBAL[rr] || 'more important') + ' than ' + label(loser) + ' (' + F.ratio(r) + ')';
  }

  function pairwiseCard() {
    const p = profile();
    const chk = check();
    if (!['furnished', 'unfurnished', 'neutral'].includes(p.furnishing)) {
      return '<div class="card" id="pairwise-card"><h2 class="card-title">Pairwise comparisons</h2>' +
        '<p class="card-intro">Choose a furnishing preference first. It decides whether furnishing is part of the comparisons.</p></div>';
    }
    const ids = chk.activeSoft;
    const list = AW.ahp.pairs(ids);
    const st = S.state.ui;
    st.pairIndex = Math.min(Math.max(0, st.pairIndex || 0), list.length - 1);
    const [a, b] = list[st.pairIndex];
    const v = AW.ahp.judgment(p.judgments, a, b);
    const shortA = C.soft(a).short, shortB = C.soft(b).short;
    const answered = chk.answered, total = chk.totalPairs;

    let control;
    if (p.advanced) {
      const pos = sliderPos(v);
      control = '<div class="slider-wrap"><div class="pairwise-pair" aria-hidden="true"><span>← ' + C.soft(a).label + '</span><span>' + C.soft(b).label + ' →</span></div>' +
        '<input type="range" class="ahp-slider' + (v === null ? ' is-unset' : '') + '" id="ahp-slider" min="-8" max="8" step="1" value="' + pos + '" aria-label="Importance of ' +
        label(a) + ' versus ' + label(b) + '" aria-valuetext="' + U.esc(describeAnswer(a, b, v)) + '">' +
        '<div class="slider-scale" aria-hidden="true"><span>9</span><span>7</span><span>5</span><span>3</span><span>1</span><span>3</span><span>5</span><span>7</span><span>9</span></div>' +
        '<p class="slider-value" id="slider-value">' + U.esc(describeAnswer(a, b, v)) + '</p>' +
        (v === null ? '<button class="btn btn-outline btn-small" type="button" data-action="confirm-equal">Set as equally important</button>' : '') + '</div>';
    } else {
      const offScale = v !== null && !SIMPLE.some(o => same(o.v, v));
      control = '<div class="pairwise-pair" aria-hidden="true"><span>← ' + C.soft(a).label + '</span><span>' + C.soft(b).label + ' →</span></div>' +
        '<div class="choice-group">' + SIMPLE.map(o => '<label class="choice"><input type="radio" name="pw" value="' + o.v + '"' +
          (v !== null && same(o.v, v) ? ' checked' : '') + '><span>' + U.esc(o.label(shortA, shortB)) + '</span></label>').join('') + '</div>' +
        (offScale ? '<p class="field-note">Current answer from the 1–9 scale: ' + U.esc(describeAnswer(a, b, v)) + '. Switch to the 1–9 scale to change it precisely.</p>' : '');
    }

    const overview = list.map(([x, y], i) => {
      const jv = AW.ahp.judgment(p.judgments, x, y);
      return '<li class="' + (i === st.pairIndex ? 'is-current' : '') + '"><button type="button" class="pair-link" data-action="goto-pair" data-index="' + i + '">' +
        '<span class="pair-state ' + (jv === null ? 'is-open' : 'is-done') + '" aria-hidden="true">' + (jv === null ? '•' : '✓') + '</span>' +
        C.soft(x).short + ' vs. ' + C.soft(y).short + '<span class="pair-answer">' + (jv === null ? 'open' : (jv >= 1 ? C.soft(x).short + ' ' + F.ratio(jv) : C.soft(y).short + ' ' + F.ratio(1 / jv))) +
        '</span></button></li>';
    }).join('');

    const isLast = st.pairIndex === list.length - 1;
    return '<form class="card" id="pairwise-card" novalidate>' +
      '<div class="card-head"><h2 class="card-title">Pairwise comparisons</h2><span class="card-badge">' + answered + ' / ' + total + ' answered</span></div>' +
      
'<p class="card-intro">For each pair, choose which criterion matters more to you. ' +
'There are no right or wrong preferences. Choose "Equal" only when both criteria ' +
'are genuinely equally important to you. Your answers determine the weights ' +
'used for the apartment ranking.</p>' +
'<div class="alert alert-info" style="margin-bottom:18px">' +
'<span class="alert-icon" aria-hidden="true">i</span>' +
'<div><strong>Take your time – you can review your answers.</strong>' +
'<p>Use Previous to go back or open "All comparisons" to jump to any question. ' +
'You do not need to restart if you want to change an answer.</p>' +
'</div></div>' +

      '<div class="progress"><span id="pw-progress-label">Question ' + (st.pairIndex + 1) + ' of ' + total + '</span><div class="progress-track" role="progressbar" aria-label="Pairwise comparisons answered" aria-valuemin="0" aria-valuemax="' +
        total + '" aria-valuenow="' + answered + '"><div class="progress-fill" style="width:' + (answered / total * 100).toFixed(1) + '%"></div></div></div>' +
      '<fieldset class="pairwise" style="border:0;padding:0;margin-top:18px"><legend class="pairwise-question">Which is more important to you: <b>' +
        label(a) + '</b> or <b>' + label(b) + '</b>?</legend>' + control + '</fieldset>' +
      '<div class="pairwise-nav"><button class="btn btn-outline btn-small" type="button" data-action="prev-pair"' + (st.pairIndex === 0 ? ' disabled' : '') + '>← Previous</button>' +
        '<button class="btn-text" type="button" data-action="toggle-advanced">' + (p.advanced ? 'Use the simple 5-option scale' : 'Advanced: use the 1–9 scale') + '</button>' +
        '<button class="btn btn-primary btn-small" type="button" data-action="next-pair">' + (isLast ? 'Done' : 'Next →') + '</button></div>' +
      '<details class="pair-overview"' + (S.state.ui.overviewOpen ? ' open' : '') + '><summary>All comparisons (' + answered + ' of ' + total + ' answered)</summary><ol>' + overview + '</ol></details>' +
      '</form>';
  }

  function weightsCard() {
    const chk = check();
    if (!['furnished', 'unfurnished', 'neutral'].includes(profile().furnishing) || chk.answered < chk.totalPairs) return '<div id="weights-card"></div>';
    const r = AW.ahp.compute(chk.activeSoft, profile().judgments);
    const sorted = chk.activeSoft.slice().sort((x, y) => r.weights[y] - r.weights[x]);
    const max = r.weights[sorted[0]];
    
const status = r.consistent
  ? '<div class="alert alert-info">' +
    '<span class="alert-icon" aria-hidden="true">✓</span>' +
    '<div><strong>Your answers are consistent (CR ' +
    F.number(r.cr, 4) + ', limit ' +
    F.number(r.crLimit, 2) + ').</strong>' +
    '<p>Your comparisons are consistent enough to calculate a ranking.</p>' +
    '</div></div>'
  : '<div class="alert alert-warning" role="alert">' +
    '<span class="alert-icon" aria-hidden="true">!</span>' +
    '<div><strong>Some of your preferences contradict each other.</strong>' +
    '<p>Your consistency ratio (CR ' + F.number(r.cr, 2) +
    ') is above the allowed limit of ' +
    F.number(r.crLimit, 2) + '.</p>' +
    '<p>For example, if cost is more important than commute, and ' +
    'commute is more important than room size, it may be ' +
    'contradictory to rate room size as much more important than cost.</p>' +
    '<p><strong>What can you do?</strong> Review the comparison ' +
    'between <b>' + label(r.mostDeviating.a) +
    ' and ' + label(r.mostDeviating.b) +
    '</b>. Check whether your answer reflects your actual preferences. ' +
    'You can also review other answers if needed.</p>' +
    '<p>You do not need to choose "Equal" for every question. ' +
    'Your answers are never changed automatically. ' +
    'The final ranking remains unavailable until the comparisons ' +
    'are sufficiently consistent.</p>' +
    '<div class="btn-row"><button class="btn btn-primary btn-small" ' +
    'type="button" data-action="review" data-a="' +
    r.mostDeviating.a + '" data-b="' +
    r.mostDeviating.b + '">Review this comparison</button>' +
    '</div></div></div>';

    const matrix = '<div class="table-wrap"><table class="data-table matrix-table"><caption class="visually-hidden">Pairwise comparison matrix</caption><thead><tr><th scope="col"></th>' +
      r.ids.map(id => '<th scope="col" class="num">' + id + '</th>').join('') + '</tr></thead><tbody>' +
      r.matrix.map((row, i) => '<tr><th scope="row">' + r.ids[i] + '</th>' + row.map(v => '<td class="num">' + F.ratio(v) + '</td>').join('') + '</tr>').join('') +
      '</tbody></table></div><p class="field-note">λ<sub>max</sub> = ' + F.number(r.lambdaMax, 6) + ' · CI = ' + F.number(r.ci, 6) + ' · RI = ' + F.number(r.ri, 2) +
      ' · CR = ' + F.number(r.cr, 6) + ' (row geometric mean method)</p>';
    return '<div class="card" id="weights-card"><h2 class="card-title">Your weights</h2>' +
      '<p class="card-intro">Calculated from your ' + chk.totalPairs + ' answers. Each weight is the most points a criterion can contribute to the 0–100 score.</p>' +
      status +
      '<ul class="weight-list">' + sorted.map(id => '<li><span>' + C.soft(id).label + ' <span class="field-code">' + id + '</span></span><span class="weight-bar"><span style="width:' +
        (r.weights[id] / max * 100).toFixed(1) + '%"></span></span><span class="weight-value">' + F.percent(r.weights[id]) + '</span></li>').join('') + '</ul>' +
      '<details class="matrix-details"><summary>Show comparison matrix</summary>' + matrix + '</details></div>';
  }

  function checklistCard() {
    const chk = check();
    const n = S.state.apartments.length;
    let consistency = '';
    if (chk.complete) {
      const r = AW.ahp.compute(chk.activeSoft, profile().judgments);
      consistency = '<li class="' + (r.consistent ? 'is-done' : 'is-missing') + '">Consistent answers' + (r.consistent ? ' <span>· CR ' + F.number(r.cr, 4) + '</span>' :
        ' <span>· CR ' + F.number(r.cr, 2) + ' is above 0.10, the ranking will be withheld</span>') + '</li>';
    }
    const ready = chk.complete && n > 0;
    return '<div class="card" id="checklist-card"><h2 class="card-title">Ready to evaluate?</h2><p class="card-intro">The evaluation starts once every input is complete.</p>' +
      '<ul class="checklist" id="missing-inputs">' +
        '<li class="' + (n ? 'is-done' : 'is-missing') + '">Apartments' + (n ? ' <span>· ' + F.plural(n, 'apartment') + '</span>' : ' <span>· add at least one in step 1</span>') + '</li>' +
        chk.items.map(i => '<li class="' + (i.done ? 'is-done' : 'is-missing') + '">' + i.label + (i.detail ? ' <span>· ' + U.esc(i.detail) + '</span>' : '') + '</li>').join('') +
        consistency + '</ul>' +
      '<div class="btn-row"><a class="btn btn-primary' + (ready ? '' : ' is-disabled') + '" href="#decision/results"' + (ready ? '' : ' aria-disabled="true"') +
        ' aria-describedby="missing-inputs">Show results <span aria-hidden="true">→</span></a></div></div>';
  }

  function fixtureBox() {
    const opts = Object.keys(AW.testProfiles).map(k => '<option value="' + k + '">' + U.esc(AW.testProfiles[k].name) + '</option>').join('');
    return '<details class="fixture-box"><summary>For testing: load a reference profile</summary>' +
      '<p>Loads a complete test profile from the specification, including all pairwise answers. It replaces your current preferences. Test profiles are never applied automatically.</p>' +
      '<div class="btn-row"><label class="visually-hidden" for="fixture-select">Test profile</label><select class="select" id="fixture-select">' + opts + '</select>' +
      '<button class="btn btn-outline btn-small" type="button" data-action="load-fixture">Load profile</button>' +
      '<button class="btn-text btn-danger-text" type="button" data-action="reset-profile">Clear all preferences</button></div></details>';
  }

  /* ---------- Render and partial refresh ---------- */

  function render(el) {
    const errors = check().errors;
    el.innerHTML = U.pageHeader('STEP 2 OF 3', 'Preferences', 'Tell us what you need and what matters most. Nothing is preselected.') +
      U.stepper('preferences') + fixtureBox() +
      '<div class="pref-stack">' + hardCard(errors) + furnishingCard() + anchorsCard(errors) + pairwiseCard() + weightsCard() + checklistCard() + '</div>' +
      '<div class="step-nav"><a class="btn btn-outline" href="#decision/apartments"><span aria-hidden="true">←</span> Apartments</a></div>';
    // Coming from "Review this comparison" on the results page.
    if (S.state.ui.scrollTo) {
      const id = S.state.ui.scrollTo;
      S.state.ui.scrollTo = null;
      setTimeout(() => {
        const card = el.querySelector('#' + id);
        if (!card) return;
        card.scrollIntoView({ block: 'start' });
        const target = card.querySelector('input[name="pw"]:checked, input[name="pw"], #ahp-slider');
        if (target) target.focus({ preventScroll: true });
      }, 0);
    }
  }

  function replace(el, id, html) {
    const node = el.querySelector('#' + id);
    if (node) node.outerHTML = html;
  }

  function refreshSummary(el) {
    replace(el, 'checklist-card', checklistCard());
    const stepper = el.querySelector('.stepper');
    if (stepper) stepper.outerHTML = U.stepper('preferences');
  }

  function refreshPairwise(el, focusSelector) {
    replace(el, 'pairwise-card', pairwiseCard());
    replace(el, 'weights-card', weightsCard());
    refreshSummary(el);
    if (focusSelector) {
      const f = el.querySelector(focusSelector);
      if (f) f.focus();
    }
  }

  function showFieldError(el, key, msg) {
    const span = el.querySelector('#e-' + key);
    if (!span) return;
    span.textContent = msg || '';
    span.hidden = !msg;
    const box = span.closest('.field') || el.querySelector('[data-anchor="' + key.replace('anchor_', '') + '"]');
    if (box) box.classList.toggle('is-invalid', Boolean(msg));
    const field = el.querySelector('[data-field="' + key + '"] .input');
    if (field) { if (msg) field.setAttribute('aria-invalid', 'true'); else field.removeAttribute('aria-invalid'); }
  }

  function updateFromInput(target, el, final) {
    const p = profile();
    const name = target.name;
    if (!name) return;
    if (name === 'budget' || name === 'minRentalMonths') {
      const v = U.parseNumber(target.value);
      p[name] = v === null || isNaN(v) ? null : v;
      if (final || target.value.trim() !== '') touched[name] = true;
      const err = isNaN(v) ? 'Enter a number.' : (touched[name] ? check().errors[name] : '');
      showFieldError(el, name, err);
    } else if (name === 'moveInBy') {
      p.moveInBy = target.value || null;
      touched.moveInBy = true;
      showFieldError(el, 'moveInBy', check().errors.moveInBy && target.value ? check().errors.moveInBy : '');
    } else if (name.indexOf('anchor.') === 0) {
      const [, id, which] = name.split('.');
      const v = U.parseNumber(target.value);
      p.anchors[id] = p.anchors[id] || { ideal: null, worst: null };
      p.anchors[id][which] = v === null || isNaN(v) ? null : v;
      touched['anchor_' + id + '_' + which] = true;
      const a = p.anchors[id];
      const err = isNaN(v) ? 'Enter a number.' : (a.ideal !== null && a.worst !== null ? AW.engine.anchorError(C.soft(id), a) : '');
      showFieldError(el, 'anchor_' + id, err);
    } else return;
    S.save();
    refreshSummary(el);
  }

  function onInput(e, el) {
    if (e.target.id === 'ahp-slider') {
      setSlider(e.target, el, false);
      return;
    }
    updateFromInput(e.target, el, false);
  }

  function setSlider(slider, el, final) {
    const p = profile();
    const chk = check();
    const [a, b] = AW.ahp.pairs(chk.activeSoft)[S.state.ui.pairIndex];
    const v = posValue(Number(slider.value));
    delete p.judgments[AW.ahp.pairKey(b, a)];
    p.judgments[AW.ahp.pairKey(a, b)] = v;
    S.save();
    const text = describeAnswer(a, b, v);
    slider.setAttribute('aria-valuetext', text);
    slider.classList.remove('is-unset');
    el.querySelector('#slider-value').textContent = text;
    if (final) refreshPairwise(el, '#ahp-slider');
  }

  function onChange(e, el) {
    const t = e.target;
    const p = profile();
    if (t.id === 'ahp-slider') { setSlider(t, el, true); return; }
    if (t.name === 'needStepFree') { p.needStepFree = t.value === 'true'; S.save(); refreshSummary(el); return; }
    if (t.name === 'furnishing') {
      p.furnishing = t.value; S.save();
      S.state.ui.pairIndex = 0;
      refreshPairwise(el, 'input[name="furnishing"][value="' + t.value + '"]');
      return;
    }
    if (t.name === 'pw') {
      const chk = check();
      const [a, b] = AW.ahp.pairs(chk.activeSoft)[S.state.ui.pairIndex];
      delete p.judgments[AW.ahp.pairKey(b, a)];
      p.judgments[AW.ahp.pairKey(a, b)] = Number(t.value);
      S.save();
      refreshPairwise(el, 'input[name="pw"]:checked');
      return;
    }
    updateFromInput(t, el, true);
  }

  function gotoPair(el, index, focus) {
    S.state.ui.pairIndex = index;
    S.save();
    refreshPairwise(el);
    const card = el.querySelector('#pairwise-card');
    if (focus) {
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const target = card.querySelector('input[name="pw"]:checked, input[name="pw"], #ahp-slider');
      if (target) target.focus({ preventScroll: true });
    }
  }

  function onClick(e, el) {
    const t = e.target.closest('[data-action], a.is-disabled');
    if (!t) return;
    if (t.matches('a.is-disabled')) { e.preventDefault(); U.toast('Complete the missing inputs first.'); return; }
    const p = profile();
    const chk = check();
    const total = chk.totalPairs;
    switch (t.dataset.action) {
      case 'prev-pair': {
        gotoPair(el, Math.max(0, S.state.ui.pairIndex - 1));
        const prev = el.querySelector('[data-action="prev-pair"]');
        (prev.disabled ? el.querySelector('[data-action="next-pair"]') : prev).focus();
        break;
      }
      case 'next-pair': {
        if (S.state.ui.pairIndex < total - 1) { gotoPair(el, S.state.ui.pairIndex + 1); el.querySelector('[data-action="next-pair"]').focus(); break; }
        // Last question: jump to the first open one, or to the weights.
        const list = AW.ahp.pairs(chk.activeSoft);
        const open = list.findIndex(([a, b]) => AW.ahp.judgment(p.judgments, a, b) === null);
        if (open >= 0) { gotoPair(el, open, true); U.toast('Some comparisons are still open.'); }
        else { const w = el.querySelector('#weights-card'); w.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
        break;
      }
      case 'goto-pair': S.state.ui.overviewOpen = true; gotoPair(el, Number(t.dataset.index), true); break;
      case 'toggle-advanced': p.advanced = !p.advanced; S.save(); refreshPairwise(el, '[data-action="toggle-advanced"]'); break;
      case 'confirm-equal': {
        const [a, b] = AW.ahp.pairs(chk.activeSoft)[S.state.ui.pairIndex];
        p.judgments[AW.ahp.pairKey(a, b)] = 1; S.save(); refreshPairwise(el, '#ahp-slider'); break;
      }
      case 'review': {
        const list = AW.ahp.pairs(chk.activeSoft);
        const i = list.findIndex(([a, b]) => a === t.dataset.a && b === t.dataset.b);
        if (i >= 0) gotoPair(el, i, true);
        break;
      }
      case 'load-fixture': {
        const key = el.querySelector('#fixture-select').value;
        const hasData = p.budget !== null || p.furnishing !== null || Object.keys(p.judgments).length;
        if (hasData && !confirm('Replace your current preferences with "' + AW.testProfiles[key].name + '"?')) return;
        S.setProfile(AW.testProfiles[key].make());
        Object.keys(touched).forEach(k => delete touched[k]);
        U.toast(AW.testProfiles[key].name + ' loaded');
        render(el);
        break;
      }
      case 'reset-profile':
        if (!confirm('Clear all preferences, including your pairwise answers?')) return;
        S.resetProfile();
        Object.keys(touched).forEach(k => delete touched[k]);
        render(el);
        break;
    }
  }

  function onToggle(e) { if (e.target.classList && e.target.classList.contains('pair-overview')) S.state.ui.overviewOpen = e.target.open; }
  document.addEventListener('toggle', onToggle, true);

  function onSubmit(e) { e.preventDefault(); }

  AW.views = AW.views || {};
  AW.views.preferences = { render, onInput, onChange, onClick, onSubmit, gotoPairFor: (a, b) => {
    const chk = check();
    const i = AW.ahp.pairs(chk.activeSoft).findIndex(([x, y]) => x === a && y === b);
    if (i >= 0) { S.state.ui.pairIndex = i; S.save(); }
  } };
})(window.AW = window.AW || {});
