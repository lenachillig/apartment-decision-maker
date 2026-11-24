/*
  Step 3: results. Three areas (Task 5): Ranking, Excluded, Incomplete.
  Incomplete holds both "insufficient hard data" and "incomplete soft data" (Task 4 states), each with its own badge.
  Scores are a preference score under the declared profile, not a probability of satisfaction.
*/
(function (AW) {
  'use strict';

  const C = AW.criteria;
  const F = AW.fmt;
  const U = AW.ui;
  const S = AW.store;

  const TABS = [
    { key: 'ranked', label: 'Ranking' },
    { key: 'excluded', label: 'Excluded' },
    { key: 'incomplete', label: 'Incomplete' }
  ];

  function label(id) { return C.soft(id).label.toLowerCase(); }

  function summary(p, ev) {
    const furn = { furnished: 'prefer furnished', unfurnished: 'prefer unfurnished', neutral: 'neutral (not scored)' }[p.furnishing];
    return '<div class="profile-summary" aria-label="Profile used">' +
      '<span>Budget <b>' + F.euro(p.budget) + '</b></span><span>Move-in by <b>' + F.date(p.moveInBy) + '</b></span>' +
      '<span>Min. <b>' + F.plural(p.minRentalMonths, 'month') + '</b></span><span>Step-free <b>' + (p.needStepFree ? 'required' : 'not required') + '</b></span>' +
      '<span>Furnishing <b>' + furn + '</b></span>' +
      '<span>Consistency <b>CR ' + F.number(ev.ahp.cr, 4) + (ev.ahp.consistent ? ' ✓' : ' ✕') + '</b></span>' +
      '<a class="btn-text" href="#decision/preferences">Change</a></div>';
  }

  function weightsDetails(ev) {
    const ids = ev.activeSoft.slice().sort((a, b) => ev.ahp.weights[b] - ev.ahp.weights[a]);
    const max = ev.ahp.weights[ids[0]];
    return '<details class="card weights-details"><summary>Your weights <span class="field-hint">(' + ids.length + ' criteria, AHP)</span></summary>' +
      '<ul class="weight-list">' + ids.map(id => '<li><span>' + C.soft(id).label + '</span><span class="weight-bar"><span style="width:' +
        (ev.ahp.weights[id] / max * 100).toFixed(1) + '%"></span></span><span class="weight-value">' + F.percent(ev.ahp.weights[id]) + '</span></li>').join('') +
      '</ul></details>';
  }

  function contribList(item, ev) {
    const rows = ev.activeSoft.map(id => item.criteria[id]).sort((a, b) => b.points - a.points);
    const maxW = Math.max.apply(null, ev.activeSoft.map(id => ev.ahp.weights[id]));
    return '<ul class="contrib">' + rows.map(r => {
      const track = r.weight / maxW * 100;
      const fill = r.points / (maxW * 100) * 100;
      return '<li><span>' + C.soft(r.id).label + '</span><span class="contrib-bar" aria-hidden="true"><span class="contrib-track" style="width:' + track.toFixed(2) +
        '%"></span><span class="contrib-fill" style="width:' + fill.toFixed(2) + '%"></span></span><span class="contrib-value"><b>' + F.number(r.points, 2) +
        '</b> / ' + F.number(r.maxPoints, 2) + '</span></li>';
    }).join('') + '</ul>';
  }

  function calcTable(item, ev) {
    return '<details class="calc-details"><summary>Show calculation</summary><div class="table-wrap"><table class="data-table"><caption class="visually-hidden">Calculation for ' +
      U.esc(item.id) + '</caption><thead><tr><th scope="col">Criterion</th><th scope="col">Value</th><th scope="col" class="num">Criterion score</th><th scope="col" class="num">Weight</th><th scope="col" class="num">Points</th></tr></thead><tbody>' +
      ev.activeSoft.map(id => {
        const r = item.criteria[id];
        return '<tr><td>' + C.soft(id).label + ' <span class="field-code">' + id + '</span></td><td>' + U.esc(r.valueText) + '</td><td class="num">' +
          F.number(r.utility * 100, 1) + ' %</td><td class="num">' + F.percent(r.weight) + '</td><td class="num">' + F.number(r.points, 2) + '</td></tr>';
      }).join('') + '<tr class="total-row"><td colspan="4">Total score</td><td class="num">' + F.number(item.score, 4) + '</td></tr></tbody></table></div>' +
      '<p class="field-note">Criterion score: how well the value meets your reference values (0–100 %). Points = weight × criterion score × 100. A high criterion score is not necessarily a large contribution: that also depends on the weight.</p></details>';
  }

  function rankedCard(item, ev, expanded) {
    const l = item.listing;
    const ex = item.explanation;
    const notes = [];
    if (item.tied) notes.push('<p class="close-note">Same score as another apartment, so they share rank ' + item.rank + '.</p>');
    if (item.closeTo.length) {
      const others = item.closeTo.map(id => {
        const o = ev.groups.ranked.find(x => x.id === id);
        return U.esc(id) + ' (' + F.number(Math.abs(o.score - item.score), 2) + ' points apart)';
      });
      notes.push('<p class="close-note">Very close to ' + others.join(' and ') + '. Compare their features and make your own choice.</p>');
    }
    const body = expanded ? '<div class="result-body"><div><h4>Points per criterion</h4>' + contribList(item, ev) +
      '<p class="field-note">Grey track = the most points a criterion can give (its weight). Green = points this apartment earned.</p>' + calcTable(item, ev) + '</div>' +
      '<div><h4>Why this rank</h4><ul class="explain is-strengths">' + (ex.topText ? '<li>' + U.esc(ex.topText) + '</li>' : '') +
        ex.strengths.map(s => '<li>' + U.esc(s.text) + '</li>').join('') + '</ul>' +
        (ex.weaknesses.length ? '<ul class="explain is-weaknesses">' + ex.weaknesses.map(s => '<li>' + U.esc(s.text) + '</li>').join('') + '</ul>' : '<p class="field-note">No criterion scores low.</p>') +
        '<p class="result-note">All hard criteria passed.' + (item.notes.length ? ' ' + U.esc(item.notes.join(' ')) : '') + '</p></div></div>' : '';
    return '<article class="result-card' + (item.closeTo.length || item.tied ? ' is-close' : '') + '" id="card-' + U.esc(item.id) + '">' +
      '<div class="result-head"><div class="result-rank" aria-label="Rank ' + item.rank + '">' + item.rank + '</div>' +
      '<div class="result-title"><h3>' + U.esc(U.title(l)) + '</h3><div class="result-meta">' + U.meta(l) + '</div></div>' +
      '<div class="result-score"><strong>' + item.displayScore + '</strong><span>of 100 points</span></div>' +
      '<div class="result-actions">' + U.favButton(item.id) + '<button class="btn-text" type="button" data-action="toggle" data-id="' + U.esc(item.id) + '" aria-expanded="' + expanded +
        '" aria-controls="card-' + U.esc(item.id) + '">' + (expanded ? 'Hide' : 'Details') + '</button></div></div>' +
      (notes.length ? '<div class="result-flags">' + notes.join('') + '</div>' : '') + body + '</article>';
  }

  function statusCard(item, kind) {
    const l = item.listing;
    let heading, reasons, note, action = '';
    if (kind === 'excluded') {
      heading = 'Failed hard criteria';
      reasons = item.fails.map(f => '<li><b>' + f.id + ' ' + U.esc(f.label) + ':</b> ' + U.esc(f.message) + '</li>');
      // K01 and E01 share a field, so list every missing field only once.
      const unknown = Array.from(new Set(item.unknown.map(u => u.label.toLowerCase()).concat(item.softMissing.map(m => m.label.toLowerCase()))));
      note = unknown.length ? 'Not provided: ' + unknown.join(', ') + '. This would not change the result.' : '';
    } else if (kind === 'insufficient') {
      heading = 'Cannot be checked yet';
      reasons = item.unknown.map(u => '<li><b>' + u.id + ' ' + U.esc(u.label) + ':</b> ' + U.esc(u.message) + '</li>');
      note = 'No hard criterion fails. Add the missing ' + (item.unknown.length > 1 ? 'values' : 'value') + ' to evaluate this apartment.';
      action = 'Add missing data';
    } else {
      heading = 'Not scored yet';
      reasons = item.softMissing.map(m => '<li><b>' + m.id + ' ' + U.esc(m.label) + ':</b> ' + (m.issue === 'invalid' ? 'invalid value.' : 'unknown.') + '</li>');
      note = 'All hard criteria passed. It will appear in the ranking once ' + item.softMissing.map(m => 'the ' + m.label.toLowerCase()).join(' and ') +
        (item.softMissing.length > 1 ? ' are' : ' is') + ' known. Missing values are never filled in with a guess.';
      action = 'Add missing data';
    }
    const statusKey = kind === 'excluded' ? 'excluded' : kind;
    return '<article class="result-card"><div class="result-head"><div class="result-title"><h3>' + U.esc(U.title(l)) + '</h3><div class="result-meta">' + U.meta(l) + '</div></div>' +
      U.badge(statusKey) + '<div class="result-actions">' + U.favButton(item.id) + '</div></div>' +
      '<div class="result-body is-single"><div><h4>' + heading + '</h4><ul class="result-reasons">' + reasons.join('') + '</ul>' +
      (note ? '<p class="result-note">' + U.esc(note) + '</p>' : '') +
      (item.notes.length && kind !== 'excluded' ? '<p class="result-note">' + U.esc(item.notes.join(' ')) + '</p>' : '') +
      (action ? '<div class="btn-row" style="margin-top:12px"><button class="btn btn-outline btn-small" type="button" data-action="edit" data-id="' + U.esc(item.id) + '">' + action + '</button></div>' : '') +
      '</div></div></article>';
  }

  function rankingPanel(ev) {
    const ui = S.state.ui;
    if (ev.rankingWithheld) {
      const d = ev.ahp.mostDeviating;
      return '<div class="alert alert-warning" role="alert"><span class="alert-icon" aria-hidden="true">!</span><div><strong>Ranking withheld: your pairwise answers contradict each other too much (CR ' +
        F.number(ev.ahp.cr, 2) + ', limit ' + F.number(ev.ahp.crLimit, 2) + ').</strong><p>' + F.plural(ev.groups.ranked.length, 'apartment') +
        ' passed all hard criteria, but no final ranking is shown until you review your answers. The comparison that deviates most is <b>' + label(d.a) + ' vs. ' + label(d.b) +
        '</b>. Your answers are never changed automatically.</p><div class="btn-row"><button class="btn btn-primary btn-small" type="button" data-action="review" data-a="' + d.a +
        '" data-b="' + d.b + '">Review this comparison</button></div></div></div>';
    }
    const ranked = ev.groups.ranked;
    if (!ranked.length) {
      const waiting = ev.groups.insufficient.length + ev.groups.incomplete.length;
      return '<div class="alert alert-info"><span class="alert-icon" aria-hidden="true">i</span><div><strong>No apartments currently meet all mandatory requirements.</strong>' +
        '<p>Review your criteria or add more offers. Limits are never relaxed automatically.' + (waiting ? ' ' + F.plural(waiting, 'apartment') + ' could not be fully checked, see the Incomplete tab.' : '') + '</p>' +
        '<div class="btn-row"><a class="btn btn-primary btn-small" href="#decision/preferences">Review requirements</a><a class="btn btn-outline btn-small" href="#decision/apartments">Add apartments</a></div></div></div>';
    }
    let alerts = '';
    if (ev.hasCloseScores) {
      const pairs = [];
      ranked.forEach((it, i) => { const nx = ranked[i + 1]; if (nx && it.closeTo.includes(nx.id)) pairs.push([it, nx]); });
      alerts += '<div class="alert alert-info"><span class="alert-icon" aria-hidden="true">≈</span><div><strong>Some listings have very similar scores.</strong><p>' +
        pairs.slice(0, 3).map(([x, y]) => U.esc(x.id) + ' and ' + U.esc(y.id) + ' (' + F.number(x.score - y.score, 2) + ' points)').join(', ') + (pairs.length > 3 ? ' and ' + (pairs.length - 3) + ' more' : '') +
        '. The calculated order is kept, but differences below ' + F.number(C.SETTINGS.closeScorePoints, 1) + ' points are small. Compare their features and make your own choice.</p>' +
        '<div class="btn-row"><button class="btn btn-outline btn-small" type="button" data-action="compare" data-ids="' + U.esc(pairs[0].map(i => i.id).join(',')) + '">Compare ' +
        U.esc(pairs[0][0].id) + ' and ' + U.esc(pairs[0][1].id) + '</button></div></div></div>';
    }
    const cards = ranked.map((item, i) => {
      const expanded = ui.expanded[item.id] !== undefined ? ui.expanded[item.id] : i === 0;
      return rankedCard(item, ev, expanded);
    }).join('');
    return alerts + '<p class="ranking-note">' + F.plural(ranked.length, 'apartment') + ' ranked. The score shows how well an apartment matches your preferences (0–100). It is not a probability of being satisfied.</p>' + cards;
  }

  function excludedPanel(ev) {
    const list = ev.groups.excluded;
    if (!list.length) return '<p class="empty-note">No apartment fails a hard criterion.</p>';
    return '<p class="ranking-note">These apartments fail at least one of your hard limits. Every confirmed violation is listed. Soft criteria never make up for a failed hard criterion.</p>' +
      list.map(i => statusCard(i, 'excluded')).join('');
  }

  function incompletePanel(ev) {
    const ins = ev.groups.insufficient, inc = ev.groups.incomplete;
    if (!ins.length && !inc.length) return '<p class="empty-note">Every apartment has all the information needed.</p>';
    return (ins.length ? '<h3 class="panel-heading">' + U.badge('insufficient') + ' Hard criteria cannot be checked (' + ins.length + ')</h3>' + ins.map(i => statusCard(i, 'insufficient')).join('') : '') +
      (inc.length ? '<h3 class="panel-heading">' + U.badge('incomplete') + ' Passed, but a soft value is missing (' + inc.length + ')</h3>' + inc.map(i => statusCard(i, 'incomplete')).join('') : '');
  }

  function render(el) {
    const st = S.state;
    const ev = S.evaluation();
    const head = U.pageHeader('STEP 3 OF 3', 'Results', 'Your ranking, the apartments that were excluded, and what is still missing.');
    if (!st.apartments.length || !ev.ready) {
      const missing = !st.apartments.length ? 'Add at least one apartment.' : 'Your preference profile is not complete yet.';
      el.innerHTML = head + U.stepper('results') + '<div class="empty-state"><div class="empty-icon" aria-hidden="true">◈</div><h2>Results are not available yet</h2><p>' + missing + '</p>' +
        '<div class="btn-row" style="justify-content:center;margin-top:18px"><a class="btn btn-primary btn-small" href="#decision/' + (!st.apartments.length ? 'apartments' : 'preferences') + '">Go to ' +
        (!st.apartments.length ? 'apartments' : 'preferences') + '</a></div></div>';
      return;
    }
    const counts = {
      ranked: ev.rankingWithheld ? 0 : ev.groups.ranked.length,
      excluded: ev.groups.excluded.length,
      incomplete: ev.groups.insufficient.length + ev.groups.incomplete.length
    };
    const tab = TABS.some(t => t.key === st.ui.resultsTab) ? st.ui.resultsTab : 'ranked';
    const panel = tab === 'ranked' ? rankingPanel(ev) : tab === 'excluded' ? excludedPanel(ev) : incompletePanel(ev);
    el.innerHTML = head + U.stepper('results') + summary(st.profile, ev) + weightsDetails(ev) +
      '<div class="tabs" role="tablist" aria-label="Result groups">' + TABS.map(t => '<button class="tab" role="tab" id="tab-' + t.key + '" aria-controls="panel" aria-selected="' + (t.key === tab) +
        '" tabindex="' + (t.key === tab ? 0 : -1) + '" data-action="tab" data-tab="' + t.key + '">' + t.label + ' <span class="tab-count">' + counts[t.key] + '</span></button>').join('') + '</div>' +
      '<div id="panel" role="tabpanel" aria-labelledby="tab-' + tab + '">' + panel + '</div>' +
      '<div class="step-nav"><a class="btn btn-outline" href="#decision/preferences"><span aria-hidden="true">←</span> Preferences</a>' +
      '<button class="btn-text" type="button" data-action="export-results">Download results (JSON)</button></div>';
  }

  function exportResults(ev) {
    const p = S.state.profile;
    U.downloadJson('apartmentwise-results.json', {
      generated: new Date().toISOString(),
      profile: p,
      activeCriteria: ev.activeSoft,
      ahp: { weights: ev.ahp.weights, lambdaMax: ev.ahp.lambdaMax, ci: ev.ahp.ci, ri: ev.ahp.ri, cr: ev.ahp.cr, consistent: ev.ahp.consistent },
      rankingWithheld: ev.rankingWithheld,
      ranking: ev.rankingWithheld ? [] : ev.groups.ranked.map(i => ({
        id: i.id, rank: i.rank, score: i.score,
        criteria: Object.fromEntries(ev.activeSoft.map(id => [id, { value: i.criteria[id].value, utility: i.criteria[id].utility, points: i.criteria[id].points }])),
        strengths: i.explanation.strengths.map(s => s.id), weaknesses: i.explanation.weaknesses.map(s => s.id)
      })),
      excluded: ev.groups.excluded.map(i => ({ id: i.id, failed: i.fails.map(f => ({ code: f.id, message: f.message })), notProvided: i.unknown.map(u => u.id) })),
      insufficientHardData: ev.groups.insufficient.map(i => ({ id: i.id, unknown: i.unknown.map(u => u.id) })),
      incompleteSoftData: ev.groups.incomplete.map(i => ({ id: i.id, missing: i.softMissing.map(m => m.id) }))
    });
  }

  function onClick(e, el) {
    const t = e.target.closest('[data-action]');
    if (!t) return;
    const st = S.state;
    switch (t.dataset.action) {
      case 'tab': st.ui.resultsTab = t.dataset.tab; S.save(); render(el); el.querySelector('#tab-' + t.dataset.tab).focus(); break;
      case 'toggle': {
        const card = el.querySelector('#card-' + CSS.escape(t.dataset.id));
        const open = t.getAttribute('aria-expanded') !== 'true';
        st.ui.expanded[t.dataset.id] = open;
        const ev = S.evaluation();
        const item = ev.groups.ranked.find(i => i.id === t.dataset.id);
        card.outerHTML = rankedCard(item, ev, open);
        el.querySelector('#card-' + CSS.escape(t.dataset.id) + ' [data-action="toggle"]').focus();
        break;
      }
      case 'edit': st.ui.editId = t.dataset.id; AW.app.go('#decision/apartments'); setTimeout(() => {
        const f = document.getElementById('apt-form'); if (f) { f.scrollIntoView({ block: 'start' }); f.querySelector('input').focus({ preventScroll: true }); }
      }, 0); break;
      case 'review': AW.views.preferences.gotoPairFor(t.dataset.a, t.dataset.b); st.ui.scrollTo = 'pairwise-card'; AW.app.go('#decision/preferences'); break;
      case 'compare': t.dataset.ids.split(',').forEach(id => { if (!S.isFavorite(id)) S.toggleFavorite(id); }); AW.app.go('#favorites'); break;
      case 'export-results': exportResults(S.evaluation()); break;
    }
  }

  // Arrow keys move between tabs (WAI-ARIA tabs pattern).
  function onKeydown(e, el) {
    if (!e.target.matches('.tab')) return;
    const keys = TABS.map(t => t.key);
    let i = keys.indexOf(e.target.dataset.tab);
    if (e.key === 'ArrowRight') i = (i + 1) % keys.length;
    else if (e.key === 'ArrowLeft') i = (i - 1 + keys.length) % keys.length;
    else if (e.key === 'Home') i = 0;
    else if (e.key === 'End') i = keys.length - 1;
    else return;
    e.preventDefault();
    S.state.ui.resultsTab = keys[i]; S.save(); render(el);
    el.querySelector('#tab-' + keys[i]).focus();
  }

  AW.views = AW.views || {};
  AW.views.results = { render, onClick, onKeydown };
})(window.AW = window.AW || {});
