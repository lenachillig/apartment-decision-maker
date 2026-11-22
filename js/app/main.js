/*
  Router and event dispatch.
  Routes: #home, #decision/apartments, #decision/preferences, #decision/results, #apartments, #favorites, #tips.
  Each view exposes render(container) and optional onClick / onInput / onChange / onSubmit handlers.
  Events are delegated once on the view container and passed to the active view.
*/
(function (AW) {
  'use strict';

  const ROUTES = {
    'decision/apartments': { view: () => AW.views.apartments, nav: 'decision' },
    'decision/preferences': { view: () => AW.views.preferences, nav: 'decision' },
    'decision/results': { view: () => AW.views.results, nav: 'decision' },
    'apartments': { view: () => AW.views.allApartments, nav: 'apartments' },
    'favorites': { view: () => AW.views.favorites, nav: 'favorites' },
    'tips': { view: () => AW.views.tips, nav: 'tips' }
  };

  const container = document.getElementById('view');
  let current = null;
  let currentRoute = null;

  function routeFromHash() {
    let route = location.hash.replace(/^#\/?/, '') || 'home';
    if (route === 'decision') {
      // Continue where the user left off.
      const st = AW.store.state;
      const check = AW.engine.checkProfile(st.profile);
      route = !st.apartments.length ? 'decision/apartments' : check.complete ? 'decision/results' : 'decision/preferences';
      history.replaceState(null, '', '#' + route);
    }
    return route;
  }

  function render(keepScroll) {
    const y = window.scrollY;
    if (current) current.render(container);
    AW.ui.updateFavCount();
    if (keepScroll) window.scrollTo(0, y);
  }

  function navigate() {
    const route = routeFromHash();
    const entry = ROUTES[route];
    document.getElementById('home').hidden = Boolean(entry);
    document.getElementById('workspace').hidden = !entry;
    if (!entry) { current = null; currentRoute = null; document.title = 'Apartment Decision Maker'; return; }

    const changed = route !== currentRoute;
    current = entry.view();
    currentRoute = route;
    document.querySelectorAll('.side-nav a').forEach(link => {
      const active = link.dataset.page === entry.nav;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    });
    render(false);
    const h1 = container.querySelector('h1');
    document.title = (h1 ? h1.textContent + ' · ' : '') + 'ApartmentWise';
    if (changed) {
      window.scrollTo(0, 0);
      document.getElementById('workspace-main').focus({ preventScroll: true });
    }
  }

  function dispatch(type) {
    return e => {
      // Favorites work the same on every page.
      const fav = type === 'onClick' && e.target.closest('[data-action="fav"]');
      if (fav) {
        const added = AW.store.toggleFavorite(fav.dataset.id);
        AW.ui.toast(added ? fav.dataset.id + ' added to favorites' : fav.dataset.id + ' removed from favorites');
        render(true);
        const again = container.querySelector('[data-action="fav"][data-id="' + CSS.escape(fav.dataset.id) + '"]');
        if (again) again.focus();
        return;
      }
      if (current && current[type]) current[type](e, container);
    };
  }

  container.addEventListener('click', dispatch('onClick'));
  container.addEventListener('input', dispatch('onInput'));
  container.addEventListener('change', dispatch('onChange'));
  container.addEventListener('submit', dispatch('onSubmit'));
  container.addEventListener('keydown', dispatch('onKeydown'));

  window.addEventListener('hashchange', navigate);

  AW.app = { render, go: hash => { if (location.hash === hash) navigate(); else location.hash = hash; } };
  navigate();
})(window.AW = window.AW || {});
