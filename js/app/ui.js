/*
  Shared UI helpers: escaping, small render functions, toast and the decision stepper.
*/
(function (AW) {
  'use strict';

  const F = AW.fmt;

  function esc(v) {
    return String(v === null || v === undefined ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Parses a number typed by the user. Accepts "12,5". Empty -> null, garbage -> NaN.
  function parseNumber(s) {
    const t = String(s === null || s === undefined ? '' : s).trim().replace(/\s/g, '').replace(',', '.');
    if (t === '') return null;
    if (!/^-?\d+(\.\d+)?$/.test(t)) return NaN;
    return Number(t);
  }

  function inputValue(v) { return v === null || v === undefined || (typeof v === 'number' && !isFinite(v)) ? '' : String(v); }

  let toastTimer = null;
  function toast(message) {
    const el = document.getElementById('toast');
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
  }

  const STATUS = {
    ranked: { cls: 'badge-ranked', label: 'Ranked' },
    excluded: { cls: 'badge-excluded', label: 'Excluded' },
    insufficient: { cls: 'badge-insufficient', label: 'Insufficient data' },
    incomplete: { cls: 'badge-incomplete', label: 'Incomplete soft data' }
  };

  function badge(status) {
    const s = STATUS[status];
    return s ? '<span class="badge ' + s.cls + '">' + s.label + '</span>' : '';
  }

  function rentalText(l) {
    if (l.rental_type === 'unlimited') return 'unlimited';
    if (l.rental_type === 'limited') return l.max_rental_months ? F.plural(l.max_rental_months, 'month') : 'limited, length unknown';
    return '–';
  }

  // Fields a criterion needs. Display-only fields are never flagged as missing.
  function missingFields(listing) {
    const a = AW.engine.adapt(listing);
    const labels = {
      monthly_cost_eur: 'monthly cost', deposit_eur: 'deposit', available_from: 'available from', rental_period: 'rental period',
      written_contract: 'written contract', step_free_access: 'step-free access', commute_min: 'commute',
      supermarket_distance_m: 'supermarket', room_size_m2: 'room size', furnishing: 'furnishing', privacy_score: 'privacy'
    };
    return Object.keys(labels).filter(f => a.issues[f]).map(f => ({ field: f, label: labels[f], issue: a.issues[f] }));
  }

  function missingCell(listing) {
    const m = missingFields(listing);
    if (!m.length) return '–';
    return m.map(x => '<span class="missing">' + esc(x.label) + (x.issue === 'invalid' ? ' (invalid)' : '') + '</span>').join(', ');
  }

  function title(l) { return l.listing_title || 'Untitled apartment'; }

  function meta(l) {
    const parts = [esc(l.apartment_id)];
    if (l.district) parts.push(esc(l.district));
    if (l.monthly_cost_eur !== null) parts.push(F.euro(l.monthly_cost_eur));
    if (l.room_size_m2 !== null) parts.push(F.number(l.room_size_m2, 1) + ' m²');
    if (l.commute_min !== null) parts.push(F.number(l.commute_min) + ' min commute');
    return parts.join(' · ');
  }

  function favButton(id) {
    const on = AW.store.isFavorite(id);
    return '<button class="fav-btn' + (on ? ' is-on' : '') + '" type="button" data-action="fav" data-id="' + esc(id) + '" aria-pressed="' + on +
      '" title="' + (on ? 'Remove from favorites' : 'Add to favorites') + '"><span aria-hidden="true">' + (on ? '♥' : '♡') +
      '</span><span class="visually-hidden">Favorite ' + esc(id) + '</span></button>';
  }

  function pageHeader(eyebrow, heading, description, actions) {
    return '<div class="page-head"><div><span class="section-eyebrow">' + esc(eyebrow) + '</span><h1 id="page-title">' + esc(heading) +
      '</h1>' + (description ? '<p class="page-description">' + description + '</p>' : '') + '</div>' + (actions || '') + '</div>';
  }

  // Stepper: Apartments -> Preferences -> Results. Each step is a link.
  function stepper(current) {
    const st = AW.store.state;
    const check = AW.engine.checkProfile(st.profile);
    const n = st.apartments.length;
    const missing = check.items.filter(i => !i.done).length;
    const steps = [
      { key: 'apartments', label: 'Apartments', small: n ? F.plural(n, 'apartment') + ' added' : 'Nothing added yet', done: n > 0 },
      { key: 'preferences', label: 'Preferences', small: missing ? F.plural(missing, 'input') + ' missing' : 'Profile complete', done: check.complete },
      { key: 'results', label: 'Results', small: check.complete && n ? 'Ready' : 'Available when the profile is complete', done: false }
    ];
    return '<ol class="stepper" aria-label="Decision steps">' + steps.map(s => {
      const cls = s.key === current ? 'is-current' : (s.done ? 'is-done' : '');
      return '<li class="step ' + cls + '"' + (s.key === current ? ' aria-current="step"' : '') + '><a href="#decision/' + s.key + '">' +
        s.label + '<small>' + esc(s.small) + '</small></a></li>';
    }).join('') + '</ol>';
  }

  function downloadJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function updateFavCount() {
    const el = document.getElementById('fav-count');
    const n = AW.store.state.favorites.length;
    el.hidden = n === 0;
    el.textContent = n;
  }

  AW.ui = { esc, parseNumber, inputValue, toast, badge, rentalText, missingFields, missingCell, title, meta, favButton,
    pageHeader, stepper, downloadJson, updateFavCount, STATUS };
})(window.AW = window.AW || {});
