/*
  Sidebar pages next to the Decision Maker: All Apartments, Favorites and Good to Know.
*/
(function (AW) {
  'use strict';

  const C = AW.criteria;
  const F = AW.fmt;
  const U = AW.ui;
  const S = AW.store;

  function statusMap() {
    const ev = S.evaluation();
    const map = {};
    if (!ev.ready) return { ready: false, map };
    ev.items.forEach(i => { map[i.id] = i; });
    return { ready: true, ev, map };
  }

  function statusCell(item, ev) {
    if (!item) return '–';
    if (item.status === 'ranked' && !ev.rankingWithheld) return U.badge('ranked') + ' <span class="rank-chip">#' + item.rank + ' · ' + item.displayScore + '</span>';
    if (item.status === 'ranked') return '<span class="badge badge-incomplete">Ranking withheld</span>';
    return U.badge(item.status);
  }

  /* ---------- All Apartments ---------- */

  const filter = { q: '', status: '' };

  function rows() {
    const sm = statusMap();
    const q = filter.q.trim().toLowerCase();
    const list = S.state.apartments.filter(l => {
      if (q && ![l.apartment_id, l.listing_title, l.district, l.housing_type].some(v => v && String(v).toLowerCase().includes(q))) return false;
      if (filter.status && sm.ready) {
        const it = sm.map[l.apartment_id];
        if (!it || it.status !== filter.status) return false;
      }
      return true;
    });
    if (!list.length) return '<tr><td colspan="10" class="empty-row">No apartments match your filter.</td></tr>';
    return list.map(l => {
      const it = sm.map[l.apartment_id];
      return '<tr><td>' + U.favButton(l.apartment_id) + '</td><td>' + U.esc(l.apartment_id) + '</td><td class="cell-title">' + U.esc(U.title(l)) + '</td><td>' +
        U.esc(l.district || '–') + '</td><td class="num">' + F.euro(l.monthly_cost_eur) + '</td><td class="num">' + (l.room_size_m2 === null ? '–' : F.number(l.room_size_m2, 1) + ' m²') +
        '</td><td class="num">' + (l.commute_min === null ? '–' : l.commute_min + ' min') + '</td><td>' + F.date(l.available_from) + '</td><td>' +
        (sm.ready ? statusCell(it, sm.ev) : '–') + '</td><td>' + U.missingCell(l) + '</td></tr>';
    }).join('');
  }

  const allApartments = {
    render(el) {
      const n = S.state.apartments.length;
      const sm = statusMap();
      const head = U.pageHeader('EXPLORE YOUR OPTIONS', 'All Apartments', 'Every apartment in your comparison, with its current status.');
      if (!n) {
        el.innerHTML = head + '<div class="empty-state"><div class="empty-icon" aria-hidden="true">▦</div><h2>No apartments yet</h2><p>Add apartments or load the test dataset in the Decision Maker.</p>' +
          '<div class="btn-row" style="justify-content:center;margin-top:18px"><a class="btn btn-primary btn-small" href="#decision/apartments">Add apartments</a></div></div>';
        return;
      }
      el.innerHTML = head +
        '<div class="filter-bar"><div class="field"><label for="apt-search">Search</label><input class="input" id="apt-search" type="search" placeholder="ID, title, district …" value="' + U.esc(filter.q) + '"></div>' +
        '<div class="field"><label for="apt-status">Status</label><select class="select" id="apt-status"' + (sm.ready ? '' : ' disabled') + '><option value="">All</option>' +
        Object.keys(U.STATUS).map(k => '<option value="' + k + '"' + (filter.status === k ? ' selected' : '') + '>' + U.STATUS[k].label + '</option>').join('') + '</select></div></div>' +
        (sm.ready ? '' : '<p class="table-note">The status appears once your preference profile is complete.</p>') +
        '<div class="table-wrap"><table class="data-table"><caption class="visually-hidden">All apartments</caption><thead><tr><th scope="col"><span class="visually-hidden">Favorite</span></th>' +
        '<th scope="col">ID</th><th scope="col">Listing</th><th scope="col">District</th><th scope="col" class="num">Rent</th><th scope="col" class="num">Room</th>' +
        '<th scope="col" class="num">Commute</th><th scope="col">Available</th><th scope="col">Status</th><th scope="col">Missing</th></tr></thead><tbody id="apt-rows">' + rows() + '</tbody></table></div>';
    },
    onInput(e, el) {
      if (e.target.id === 'apt-search') { filter.q = e.target.value; el.querySelector('#apt-rows').innerHTML = rows(); }
    },
    onChange(e, el) {
      if (e.target.id === 'apt-status') { filter.status = e.target.value; el.querySelector('#apt-rows').innerHTML = rows(); }
    }
  };

  /* ---------- Favorites ---------- */

  const COMPARE_ROWS = [
    { label: 'Monthly cost', get: l => l.monthly_cost_eur, show: v => F.euro(v), best: 'min' },
    { label: 'Deposit', get: l => l.deposit_eur, show: v => F.euro(v), best: 'min' },
    { label: 'Available from', get: l => l.available_from, show: v => F.date(v) },
    { label: 'Rental period', get: l => l, show: l => U.rentalText(l) },
    { label: 'Commute', get: l => l.commute_min, show: v => v === null ? '–' : v + ' min', best: 'min' },
    { label: 'Supermarket', get: l => l.supermarket_distance_m, show: v => v === null ? '–' : F.number(v) + ' m', best: 'min' },
    { label: 'Room size', get: l => l.room_size_m2, show: v => v === null ? '–' : F.number(v, 1) + ' m²', best: 'max' },
    { label: 'Privacy', get: l => l.privacy_score, show: v => v === null ? '–' : v + ' of 5', best: 'max' },
    { label: 'Furnishing', get: l => l.furnishing, show: v => v ? C.FURNISHING_LABELS[v] : '–' },
    { label: 'Written contract', get: l => l.written_contract, show: v => v === null ? '–' : v ? 'yes' : 'no' },
    { label: 'Step-free access', get: l => l.step_free_access, show: v => v === null ? '–' : v ? 'yes' : 'no' },
    { label: 'Flatmates', get: l => l.flatmates, show: v => v === null ? '–' : String(v) },
    { label: 'District', get: l => l.district, show: v => U.esc(v || '–') },
    { label: 'Min. commitment', get: l => l.min_commitment_months, show: v => v ? F.plural(v, 'month') : '–' }
  ];

  const favorites = {
    render(el) {
      const favs = S.state.favorites.map(id => S.findApartment(id)).filter(Boolean);
      const head = U.pageHeader('YOUR SHORTLIST', 'Favorites', 'Compare your shortlisted apartments side by side.');
      if (!favs.length) {
        el.innerHTML = head + '<div class="empty-state"><div class="empty-icon" aria-hidden="true">♡</div><h2>No favorites yet</h2><p>Tap the heart on a result or in the apartment list to shortlist it.</p>' +
          '<div class="btn-row" style="justify-content:center;margin-top:18px"><a class="btn btn-primary btn-small" href="#decision">Open the Decision Maker</a></div></div>';
        return;
      }
      const sm = statusMap();
      const cols = favs.map(l => '<th scope="col"><div class="compare-head"><span>' + U.esc(l.apartment_id) + '</span>' + U.favButton(l.apartment_id) + '</div><div class="compare-title">' +
        U.esc(U.title(l)) + '</div></th>').join('');
      const statusRow = '<tr><th scope="row">Status</th>' + favs.map(l => '<td>' + (sm.ready ? statusCell(sm.map[l.apartment_id], sm.ev) : '–') + '</td>').join('') + '</tr>';
      const body = COMPARE_ROWS.map(r => {
        const vals = favs.map(l => r.get(l));
        let best = null;
        if (r.best && favs.length > 1) {
          const nums = vals.filter(v => typeof v === 'number');
          if (nums.length > 1) best = r.best === 'min' ? Math.min.apply(null, nums) : Math.max.apply(null, nums);
        }
        return '<tr><th scope="row">' + r.label + '</th>' + vals.map(v => '<td' + (best !== null && v === best ? ' class="is-best"' : '') + '>' + r.show(v) +
          (best !== null && v === best ? ' <span class="visually-hidden">(best)</span>' : '') + '</td>').join('') + '</tr>';
      }).join('');
      el.innerHTML = head + '<div class="table-wrap"><table class="data-table compare-table"><caption class="visually-hidden">Favorites compared</caption><thead><tr><th scope="col">Criterion</th>' +
        cols + '</tr></thead><tbody>' + statusRow + body + '</tbody></table></div>' +
        '<p class="table-note">Highlighted cells show the best value in a row. The ranking still depends on your weights, so the best single value does not decide alone.</p>';
    }
  };

  /* ---------- Good to Know ---------- */

  const ARTICLES = [
    { icon: '◈', title: 'How the Decision Maker works', body:
      '<p>The decision runs in two stages. <b>Stage 1</b> checks your hard limits (budget, move-in date, rental period, written contract and, if you need it, step-free access). An apartment that fails one of them is excluded, no matter how good it is otherwise.</p>' +
      '<p><b>Stage 2</b> scores the remaining apartments on seven soft criteria: monthly cost, deposit, commute, supermarket distance, room size, privacy and furnishing. Each criterion gives 0–100 % depending on your reference values, multiplied by its weight. The sum is a score from 0 to 100.</p>' },
    { icon: '⚖', title: 'Why pairwise comparisons?', body:
      '<p>Saying "rent is 27 % important" is hard. Saying "rent matters more than the supermarket" is easy. The Analytic Hierarchy Process (AHP) turns these simple answers into weights.</p>' +
      '<p>Because you answer many overlapping questions, the system can check whether your answers fit together. This is the consistency ratio (CR). Above 0.10 the answers contradict each other too much, and you are asked to review the comparison that deviates most. Your answers are never changed automatically.</p>' },
    { icon: '%', title: 'What the score means, and what it does not', body:
      '<p>A score of 80 means the apartment matches your stated preferences well. It is <b>not</b> an 80 % chance that you will be happy there.</p>' +
      '<p>A criterion can score high and still add few points, if you gave it a low weight. That is why the results show both: the criterion score and the points it contributes. When two apartments are only a few tenths of a point apart, treat them as equal and compare them yourself.</p>' },
    { icon: '?', title: 'Missing information', body:
      '<p>Unknown values are never guessed. If a hard criterion cannot be checked, the apartment is marked as <i>insufficient data</i>. If a soft value is missing, it is <i>incomplete</i> and left out of the ranking, so that all ranked apartments are compared on the same basis.</p>' +
      '<p>One exception: if an apartment already fails a hard limit, missing values do not matter, because nothing could change that result.</p>' },
    { icon: '✎', title: 'Before you sign', body:
      '<ul><li><b>Written contract:</b> insist on a written rental agreement and read the notice periods and the minimum commitment.</li>' +
      '<li><b>Deposit:</b> in Germany the deposit for a residential lease may be at most three months\' net cold rent (§ 551 BGB). You may pay it in three instalments.</li>' +
      '<li><b>Subletting:</b> for a sublet (Untermiete / Zwischenmiete) the main tenant needs the landlord\'s permission. The Decision Maker does not check this, so ask for it in writing.</li>' +
      '<li><b>Registration:</b> after moving in you have to register your address within two weeks. The landlord confirms the move-in with a Wohnungsgeberbestätigung.</li></ul>' },
    { icon: '⌂', title: 'Viewing checklist', body:
      '<ul><li>Is the stated rent the warm rent including utilities? Which costs are extra (electricity, internet)?</li>' +
      '<li>Measure the room yourself. The listed size is sometimes the whole flat.</li>' +
      '<li>Check the way to the university at the time you would really travel.</li>' +
      '<li>Ask the flatmates how the shared rooms and cleaning are organised.</li></ul>' }
  ];

  const tips = {
    render(el) {
      el.innerHTML = U.pageHeader('USEFUL INSIGHTS', 'Good to Know', 'How the Decision Maker works and what to check before you sign.') +
        '<div class="tips-grid">' + ARTICLES.map(a => '<article class="card tip-card"><div class="tip-icon" aria-hidden="true">' + a.icon + '</div><h2 class="card-title">' + a.title + '</h2>' +
          a.body + '</article>').join('') + '</div>' +
        '<p class="table-note">General information for students, not legal advice. Rules may differ by city and contract.</p>';
    }
  };

  AW.views = AW.views || {};
  AW.views.allApartments = allApartments;
  AW.views.favorites = favorites;
  AW.views.tips = tips;
})(window.AW = window.AW || {});
