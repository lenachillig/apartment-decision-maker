// Navigation prototype only. No apartment data or ranking logic yet.
const pages = {
  decision: { title: 'Decision Maker', description: 'Your space for comparing apartments and making decisions.', eyebrow: 'MAKE YOUR CHOICE', icon: '◈' },
  apartments: { title: 'All Apartments', description: 'Explore the apartments available for comparison.', eyebrow: 'EXPLORE YOUR OPTIONS', icon: '▦' },
  favorites: { title: 'Favorites', description: 'Your selected apartments will appear here.', eyebrow: 'YOUR SHORTLIST', icon: '♡' },
  tips: { title: 'Good to Know', description: 'Helpful insights and things to consider when choosing a home.', eyebrow: 'USEFUL INSIGHTS', icon: '✦' }
};

function navigate() {
  const route = location.hash.replace(/^#\/?/, '') || 'home';
  const page = pages[route];
  document.getElementById('home').hidden = Boolean(page);
  document.getElementById('workspace').hidden = !page;
  if (!page) return;
  document.getElementById('page-title').textContent = page.title;
  document.getElementById('page-description').textContent = page.description;
  document.getElementById('page-eyebrow').textContent = page.eyebrow;
  document.getElementById('page-icon').textContent = page.icon;
  document.querySelectorAll('.side-nav a').forEach(link => {
    const active = link.dataset.page === route;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', navigate);
navigate();
