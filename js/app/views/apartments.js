/*
  Step 1: apartments. Load the test dataset, import a JSON file, or add and edit listings by hand.
  Empty fields are stored as null (unknown) and are never guessed.
*/
(function (AW) {
  'use strict';

  const F = AW.fmt;
  const U = AW.ui;
  const S = AW.store;

  const TRI = [['true', 'Yes'], ['false', 'No'], ['', 'Unknown']];

  // Form layout. kind: text | number | date | select | tri (yes / no / unknown)
  const FORM = [
    { legend: 'Listing', fields: [
      { name: 'listing_title', label: 'Listing title', kind: 'text', placeholder: 'e.g. Bright room near campus' },
      { name: 'district', label: 'District', code: 'display only', kind: 'text', placeholder: 'e.g. Neustadt' },
      { name: 'housing_type', label: 'Housing type', code: 'display only', kind: 'select',
        options: [['', 'Unknown'], ['shared_flat', 'Shared flat (WG)'], ['dormitory', 'Student dormitory'], ['studio', 'Studio'], ['apartment', 'Apartment']] }
    ] },
    { legend: 'Costs', fields: [
      { name: 'monthly_cost_eur', label: 'Monthly cost', code: 'K01 · E01', kind: 'number', unit: '€', positive: true, hint: 'Total rent incl. utilities (warm rent)' },
      { name: 'deposit_eur', label: 'Deposit', code: 'E02', kind: 'number', unit: '€', min: 0 }
    ] },
    { legend: 'Availability and contract', fields: [
      { name: 'available_from', label: 'Available from', code: 'K03', kind: 'date' },
      { name: 'rental_type', label: 'Rental type', code: 'K04', kind: 'select', options: [['', 'Unknown'], ['unlimited', 'Unlimited'], ['limited', 'Limited']] },
      { name: 'max_rental_months', label: 'Max. rental period', code: 'K04', kind: 'number', unit: 'months', integer: true, positive: true, placeholder: 'Only if limited' },
      { name: 'min_commitment_months', label: 'Min. commitment', code: 'note only', kind: 'number', unit: 'months', integer: true, min: 0, placeholder: 'optional' }
    ], wide: [
      { name: 'written_contract', label: 'Written contract', code: 'K09', kind: 'tri' },
      { name: 'step_free_access', label: 'Step-free access', code: 'K14', kind: 'tri', hint: 'Covers entrance, floor and elevator together.' }
    ] },
    { legend: 'Location', fields: [
      { name: 'commute_min', label: 'Commute', code: 'E05', kind: 'number', unit: 'min', min: 0, hint: 'To the university, one way' },
      { name: 'supermarket_distance_m', label: 'Nearest supermarket', code: 'E09', kind: 'number', unit: 'm', min: 0, hint: 'Walking distance' },
      { name: 'floor', label: 'Floor', code: 'display only', kind: 'number', integer: true },
      { name: 'elevator', label: 'Elevator', code: 'display only', kind: 'select', options: [['', 'Unknown'], ['true', 'Yes'], ['false', 'No']] }
    ] },
    { legend: 'Room', fields: [
      { name: 'room_size_m2', label: 'Room size', code: 'E12', kind: 'number', unit: 'm²', positive: true, hint: 'Private usable area, not the whole flat' },
      { name: 'flatmates', label: 'Flatmates', code: 'E14', kind: 'number', integer: true, min: 0 },
      { name: 'private_bathroom', label: 'Private bathroom', code: 'E14', kind: 'select', options: [['', 'Unknown'], ['true', 'Yes'], ['false', 'No']] },
      { name: 'furnishing', label: 'Furnishing', code: 'E15', kind: 'select',
        options: [['', 'Unknown'], ['furnished', 'Furnished'], ['partly_furnished', 'Partly furnished'], ['unfurnished', 'Unfurnished']] }
    ] }
  ];

  const ALL_FIELDS = FORM.reduce((a, g) => a.concat(g.fields, g.wide || []), []);
  let errors = {};

  /* ---------- Rendering ---------- */

  function fieldValue(listing, f) {
    const v = listing ? listing[f.name] : null;
    if (v === null || v === undefined) return '';
    if (typeof v === 'boolean') return String(v);
    return String(v);
  }

  function renderField(f, listing) {
    const id = 'f-' + f.name;
    const val = fieldValue(listing, f);
    const err = errors[f.name];
    const code = f.code ? ' <span class="field-code">' + U.esc(f.code) + '</span>' : '';
    const hint = f.hint ? '<span class="field-hint">' + U.esc(f.hint) + '</span>' : '';
    const errHtml = err ? '<span class="field-error" id="e-' + f.name + '">' + U.esc(err) + '</span>' : '';
    const aria = err ? ' aria-invalid="true" aria-describedby="e-' + f.name + '"' : '';
    const disabled = f.name === 'max_rental_months' && !(listing && listing.rental_type === 'limited') ? ' disabled' : '';

    if (f.kind === 'tri') {
      return '<div class="field' + (err ? ' is-invalid' : '') + '" role="radiogroup" aria-labelledby="l-' + f.name + '">' +
        '<span class="field-label" id="l-' + f.name + '">' + U.esc(f.label) + code + '</span><div class="choice-group">' +
        TRI.map(([v, l]) => '<label class="choice"><input type="radio" name="' + f.name + '" value="' + v + '"' + (val === v ? ' checked' : '') +
          '><span>' + l + '</span></label>').join('') + '</div>' + hint + errHtml + '</div>';
    }
    let control;
    if (f.kind === 'select') {
      control = '<select class="select" id="' + id + '" name="' + f.name + '"' + aria + '>' +
        f.options.map(([v, l]) => '<option value="' + v + '"' + (val === v ? ' selected' : '') + '>' + l + '</option>').join('') + '</select>';
    } else {
      const type = f.kind === 'date' ? 'date' : 'text';
      const mode = f.kind === 'number' ? ' inputmode="' + (f.integer ? 'numeric' : 'decimal') + '"' : '';
      const ph = f.placeholder ? ' placeholder="' + U.esc(f.placeholder) + '"' : '';
      control = '<input class="input" id="' + id + '" name="' + f.name + '" type="' + type + '" value="' + U.esc(val) + '"' + mode + ph + aria + disabled + '>';
      if (f.unit) control = '<div class="input-unit">' + control + '<span>' + U.esc(f.unit) + '</span></div>';
    }
    return '<div class="field' + (err ? ' is-invalid' : '') + '"><label for="' + id + '">' + U.esc(f.label) + code + '</label>' + control + hint + errHtml + '</div>';
  }

  function privacyNote(flatmates, bathroom) {
    const p = AW.engine.derivePrivacy(flatmates, bathroom);
    if (p === null) return '<b>Privacy score (E14): unknown</b> · enter the number of flatmates' + (flatmates > 0 ? ' and whether there is a private bathroom' : '') + '.';
    const why = flatmates === 0 ? 'no flatmates' : F.plural(flatmates, 'flatmate') + (bathroom ? ' plus a private bathroom' : ', shared bathroom');
    return '<b>Privacy score (E14): ' + p + ' of 5</b> · derived from ' + why + '. Not entered by hand.';
  }

  function renderForm(listing, isNew) {
    const l = listing || {};
    return '<form class="card apt-form" id="apt-form" novalidate>' +
      '<h2 class="card-title">' + (isNew ? 'Add apartment' : 'Edit ' + U.esc(l.apartment_id)) + '</h2>' +
      '<p class="card-intro">Leave a field empty if you don\'t know the value. Unknown values are shown in the results, never guessed.</p>' +
      (Object.keys(errors).length ? '<div class="alert alert-danger" role="alert"><span class="alert-icon" aria-hidden="true">!</span><div><strong>Please check the marked fields.</strong></div></div>' : '') +
      FORM.map(g => '<fieldset class="form-group"><legend>' + g.legend + '</legend><div class="form-grid">' +
        g.fields.map(f => renderField(f, l)).join('') + '</div>' +
        (g.wide ? '<div class="form-grid is-wide" style="margin-top:18px">' + g.wide.map(f => renderField(f, l)).join('') + '</div>' : '') +
        (g.legend === 'Room' ? '<p class="field-note" id="privacy-note">' + privacyNote(l.flatmates, l.private_bathroom) + '</p>' : '') +
        '</fieldset>').join('') +
      '<div class="btn-row" style="margin-top:24px"><button class="btn btn-primary" type="submit">Save apartment</button>' +
      '<button class="btn btn-outline" type="button" data-action="cancel">Cancel</button></div></form>';
  }

  function renderTable() {
    const list = S.state.apartments;
    if (!list.length) {
      return '<div class="empty-state"><div class="empty-icon" aria-hidden="true">▦</div><h2>No apartments yet</h2>' +
        '<p>Load the test dataset or add the apartments you are considering.</p></div>';
    }
    return '<div class="table-wrap"><table class="data-table"><caption class="visually-hidden">Apartments added to this comparison</caption><thead><tr>' +
      '<th scope="col">ID</th><th scope="col">Listing</th><th scope="col" class="num">Rent</th><th scope="col" class="num">Deposit</th>' +
      '<th scope="col">Available</th><th scope="col">Rental period</th><th scope="col" class="num">Commute</th><th scope="col" class="num">Room</th>' +
      '<th scope="col">Missing</th><th scope="col"><span class="visually-hidden">Actions</span></th></tr></thead><tbody>' +
      list.map(l => '<tr><td>' + U.esc(l.apartment_id) + '</td><td class="cell-title">' + U.esc(U.title(l)) + '</td>' +
        '<td class="num">' + F.euro(l.monthly_cost_eur) + '</td><td class="num">' + F.euro(l.deposit_eur) + '</td>' +
        '<td>' + F.date(l.available_from) + '</td><td>' + U.rentalText(l) + '</td>' +
        '<td class="num">' + (l.commute_min === null ? '–' : F.number(l.commute_min) + ' min') + '</td>' +
        '<td class="num">' + (l.room_size_m2 === null ? '–' : F.number(l.room_size_m2, 1) + ' m²') + '</td>' +
        '<td>' + U.missingCell(l) + '</td><td class="actions"><button class="btn-text" type="button" data-action="edit" data-id="' + U.esc(l.apartment_id) +
        '">Edit</button> <button class="btn-text btn-danger-text" type="button" data-action="delete" data-id="' + U.esc(l.apartment_id) + '">Delete</button></td></tr>').join('') +
      '</tbody></table></div>';
  }

  function render(el) {
    const st = S.state;
    const editId = st.ui.editId;
    const editing = editId === 'new' ? null : (editId ? S.findApartment(editId) : null);
    if (editId && editId !== 'new' && !editing) st.ui.editId = null;
    const n = st.apartments.length;

    el.innerHTML = U.pageHeader('STEP 1 OF 3', 'Apartments', 'Add the apartments you want to compare. You can also load the 50-listing test dataset.') +
      U.stepper('apartments') +
      '<div class="toolbar btn-row">' +
        '<button class="btn btn-primary btn-small" type="button" data-action="add">+ Add apartment</button>' +
        '<button class="btn btn-outline btn-small" type="button" data-action="load-dataset">Load test dataset (50 listings)</button>' +
        '<button class="btn btn-outline btn-small" type="button" data-action="import">Import JSON</button>' +
        '<input type="file" id="import-file" accept=".json,application/json" hidden>' +
        (n ? '<button class="btn-text" type="button" data-action="export">Export JSON</button><button class="btn-text btn-danger-text" type="button" data-action="clear">Remove all</button>' : '') +
      '</div>' +
      (st.ui.editId ? renderForm(editing, editId === 'new') : '') +
      renderTable() +
      (n ? '<p class="table-note">"Missing" lists only fields a criterion needs. Display-only fields such as district or floor are never flagged.</p>' : '') +
      '<div class="step-nav"><span></span><a class="btn btn-primary' + (n ? '' : ' is-disabled') + '" href="#decision/preferences"' + (n ? '' : ' aria-disabled="true"') +
        '>Continue to preferences <span aria-hidden="true">→</span></a></div>';
  }

  /* ---------- Form handling ---------- */

  function readForm(form) {
    const fd = new FormData(form);
    const raw = {};
    ALL_FIELDS.forEach(f => { raw[f.name] = fd.has(f.name) ? String(fd.get(f.name)) : ''; });
    // Disabled inputs are not part of FormData
    if (form.elements.max_rental_months && form.elements.max_rental_months.disabled) raw.max_rental_months = '';
    return raw;
  }

  function validate(raw) {
    const errs = {};
    const out = {};
    ALL_FIELDS.forEach(f => {
      const s = raw[f.name].trim();
      if (f.kind === 'text') { out[f.name] = s || null; return; }
      if (f.kind === 'tri' || (f.kind === 'select' && (f.name === 'elevator' || f.name === 'private_bathroom'))) {
        out[f.name] = s === '' ? null : s === 'true'; return;
      }
      if (f.kind === 'select') { out[f.name] = s || null; return; }
      if (f.kind === 'date') {
        if (!s) { out[f.name] = null; return; }
        if (!AW.engine.isValidDate(s)) errs[f.name] = 'Enter a valid date.';
        out[f.name] = s; return;
      }
      const v = U.parseNumber(s);
      out[f.name] = v;
      if (v === null) return;
      if (isNaN(v)) errs[f.name] = 'Enter a number.';
      else if (f.integer && !Number.isInteger(v)) errs[f.name] = 'Enter a whole number.';
      else if (f.positive && v <= 0) errs[f.name] = 'Enter a value greater than 0.';
      else if (f.min !== undefined && v < f.min) errs[f.name] = 'The value cannot be negative.';
    });
    if (out.rental_type !== 'limited') out.max_rental_months = null;
    out.privacy_score = AW.engine.derivePrivacy(out.flatmates, out.private_bathroom);
    return { errs, listing: out };
  }

  function onSubmit(e, el) {
    if (e.target.id !== 'apt-form') return;
    e.preventDefault();
    const { errs, listing } = validate(readForm(e.target));
    errors = errs;
    const st = S.state;
    if (Object.keys(errs).length) {
      const snapshot = Object.assign({}, listing);
      // keep what the user typed in invalid fields
      const raw = readForm(e.target);
      Object.keys(errs).forEach(k => { snapshot[k] = raw[k]; });
      snapshot.apartment_id = st.ui.editId === 'new' ? '' : st.ui.editId;
      render(el);
      const form = el.querySelector('#apt-form');
      form.outerHTML = renderForm(snapshot, st.ui.editId === 'new');
      const first = el.querySelector('[aria-invalid="true"], .field.is-invalid input');
      if (first) first.focus();
      return;
    }
    listing.apartment_id = st.ui.editId === 'new' ? S.nextUserId() : st.ui.editId;
    S.upsertApartment(listing);
    st.ui.editId = null;
    errors = {};
    AW.ui.toast(listing.apartment_id + ' saved');
    render(el);
  }

  function openForm(el, id) {
    S.state.ui.editId = id;
    errors = {};
    render(el);
    const form = el.querySelector('#apt-form');
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    form.querySelector('input, select').focus({ preventScroll: true });
  }

  function importFile(file, el) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const listings = Array.isArray(parsed) ? parsed : parsed.listings;
        if (!Array.isArray(listings)) throw new Error('No "listings" array found.');
        const valid = listings.filter(l => l && typeof l === 'object');
        const r = S.importListings(valid);
        U.toast('Imported ' + F.plural(r.added, 'apartment') + (r.replaced ? ', replaced ' + r.replaced : ''));
      } catch (err) {
        U.toast('Import failed: ' + err.message);
      }
      render(el);
    };
    reader.readAsText(file);
  }

  function onClick(e, el) {
    const t = e.target.closest('[data-action], a.is-disabled');
    if (!t) return;
    if (t.matches('a.is-disabled')) { e.preventDefault(); U.toast('Add at least one apartment first.'); return; }
    const action = t.dataset.action;
    const st = S.state;
    if (action === 'add') openForm(el, 'new');
    else if (action === 'edit') openForm(el, t.dataset.id);
    else if (action === 'cancel') { st.ui.editId = null; errors = {}; render(el); }
    else if (action === 'delete') {
      if (confirm('Delete ' + t.dataset.id + '? This cannot be undone.')) { S.removeApartment(t.dataset.id); U.toast(t.dataset.id + ' deleted'); render(el); }
    } else if (action === 'clear') {
      if (confirm('Remove all ' + st.apartments.length + ' apartments from this comparison?')) { S.clearApartments(); render(el); }
    } else if (action === 'load-dataset') {
      const r = S.importListings(AW.testDataset.listings);
      U.toast('Test dataset loaded: ' + F.plural(r.added, 'apartment') + ' added' + (r.replaced ? ', ' + r.replaced + ' updated' : ''));
      render(el);
    } else if (action === 'import') el.querySelector('#import-file').click();
    else if (action === 'export') U.downloadJson('apartments.json', { metadata: { exported: new Date().toISOString(), records: st.apartments.length }, listings: st.apartments });
  }

  function onChange(e, el) {
    if (e.target.id === 'import-file' && e.target.files[0]) { importFile(e.target.files[0], el); return; }
    const form = e.target.closest('#apt-form');
    if (!form) return;
    if (e.target.name === 'rental_type') {
      const max = form.elements.max_rental_months;
      max.disabled = e.target.value !== 'limited';
      if (max.disabled) max.value = '';
    }
    if (e.target.name === 'flatmates' || e.target.name === 'private_bathroom') {
      const fm = U.parseNumber(form.elements.flatmates.value);
      const pb = form.elements.private_bathroom.value;
      form.querySelector('#privacy-note').innerHTML = privacyNote(Number.isInteger(fm) ? fm : null, pb === '' ? null : pb === 'true');
    }
  }

  AW.views = AW.views || {};
  // Live update of the derived privacy score while typing (file inputs are handled on change only).
  function onInput(e, el) { if (e.target.name === 'flatmates') onChange(e, el); }

  AW.views.apartments = { render, onClick, onChange, onSubmit, onInput };
})(window.AW = window.AW || {});
