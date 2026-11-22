/*
  App state: apartments, preference profile, favorites and small UI state.
  Saved in localStorage so a reload keeps the session. Nothing leaves the browser.
*/
(function (AW) {
  'use strict';

  const KEY = 'apartmentwise.v1';

  function emptyProfile() {
    const anchors = {};
    AW.criteria.numericSoft.forEach(c => { anchors[c.id] = { ideal: null, worst: null }; });
    return {
      budget: null, moveInBy: null, minRentalMonths: null, needStepFree: null,
      furnishing: null, anchors, judgments: {}, advanced: false
    };
  }

  const state = {
    apartments: [],
    profile: emptyProfile(),
    favorites: [],
    ui: { pairIndex: 0, editId: null, resultsTab: 'ranked', expanded: {} }
  };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (Array.isArray(saved.apartments)) state.apartments = saved.apartments;
      if (saved.profile) state.profile = Object.assign(emptyProfile(), saved.profile);
      if (Array.isArray(saved.favorites)) state.favorites = saved.favorites;
      if (saved.ui) Object.assign(state.ui, { pairIndex: saved.ui.pairIndex || 0, resultsTab: saved.ui.resultsTab || 'ranked' });
    } catch (e) { /* storage blocked or corrupt: start empty */ }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        apartments: state.apartments, profile: state.profile, favorites: state.favorites,
        ui: { pairIndex: state.ui.pairIndex, resultsTab: state.ui.resultsTab }
      }));
    } catch (e) { /* private mode: keep working in memory */ }
  }

  // Keeps only the dataset fields. test_note belongs to the test fixtures, not to an alternative.
  const FIELDS = ['apartment_id', 'listing_title', 'housing_type', 'district', 'monthly_cost_eur', 'deposit_eur',
    'available_from', 'rental_type', 'max_rental_months', 'min_commitment_months', 'written_contract', 'floor',
    'elevator', 'step_free_access', 'commute_min', 'supermarket_distance_m', 'room_size_m2', 'flatmates',
    'private_bathroom', 'privacy_score', 'furnishing'];

  function cleanListing(l) {
    const out = {};
    FIELDS.forEach(f => { out[f] = l[f] === undefined ? null : l[f]; });
    out.apartment_id = String(out.apartment_id || '').trim();
    return out;
  }

  function nextUserId() {
    let n = 1;
    const ids = new Set(state.apartments.map(a => a.apartment_id));
    while (ids.has('USR-' + String(n).padStart(3, '0'))) n++;
    return 'USR-' + String(n).padStart(3, '0');
  }

  function findApartment(id) { return state.apartments.find(a => a.apartment_id === id) || null; }

  function upsertApartment(listing) {
    const clean = cleanListing(listing);
    const i = state.apartments.findIndex(a => a.apartment_id === clean.apartment_id);
    if (i >= 0) state.apartments[i] = clean; else state.apartments.push(clean);
    save();
    return clean;
  }

  function removeApartment(id) {
    state.apartments = state.apartments.filter(a => a.apartment_id !== id);
    state.favorites = state.favorites.filter(f => f !== id);
    save();
  }

  // Adds listings; listings with an existing ID replace the old entry.
  function importListings(listings) {
    let added = 0, replaced = 0;
    listings.forEach(l => {
      const clean = cleanListing(l);
      if (!clean.apartment_id) clean.apartment_id = nextUserId();
      const i = state.apartments.findIndex(a => a.apartment_id === clean.apartment_id);
      if (i >= 0) { state.apartments[i] = clean; replaced++; } else { state.apartments.push(clean); added++; }
    });
    save();
    return { added, replaced };
  }

  function clearApartments() { state.apartments = []; state.favorites = []; save(); }

  function toggleFavorite(id) {
    const i = state.favorites.indexOf(id);
    if (i >= 0) state.favorites.splice(i, 1); else state.favorites.push(id);
    save();
    return i < 0;
  }

  function isFavorite(id) { return state.favorites.includes(id); }

  function setProfile(profile) { state.profile = Object.assign(emptyProfile(), profile); state.ui.pairIndex = 0; save(); }
  function resetProfile() { setProfile(emptyProfile()); }

  // Evaluation of the current state. Cached until apartments or profile change.
  let cache = { key: null, result: null };
  function evaluation() {
    const key = JSON.stringify([state.apartments, state.profile]);
    if (cache.key !== key) cache = { key, result: AW.engine.evaluate(state.apartments, state.profile) };
    return cache.result;
  }

  load();

  AW.store = {
    state, save, emptyProfile, cleanListing, nextUserId, findApartment, upsertApartment, removeApartment,
    importListings, clearApartments, toggleFavorite, isFavorite, setProfile, resetProfile, evaluation
  };
})(window.AW = window.AW || {});
