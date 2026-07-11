let cachedSpriteUrl = null;

function getSpriteUrl() {
  if (cachedSpriteUrl) return cachedSpriteUrl;
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        if (!rule.style || rule.selectorText !== '.icon') continue;
        const raw = rule.style.backgroundImage || rule.style.background || '';
        const m = raw.match(/url\(\s*["']?([^"'\s)]+)["']?\s*\)/);
        if (!m) continue;
        cachedSpriteUrl = `url("${new URL(m[1], sheet.href || location.href).href}")`;
        return cachedSpriteUrl;
      }
    } catch (e) {}
  }
  return null;
}

function getCsrfToken() {
  for (const s of document.querySelectorAll('script')) {
    const m = s.textContent?.match(/supermodelCSRF\s*=\s*["']([^"']+)["']/);
    if (m) return m[1];
  }
}

async function toggleWatchlist(lid, add) {
  const csrf = getCsrfToken();
  if (!csrf) return;
  try {
    const r = await fetch(`/api/v0/me/watchlist/${lid}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json; charset=UTF-8', 'x-csrf-token': csrf },
      body: JSON.stringify({ inWatchlist: add }),
    });
    if (!r.ok) return;
    return (await r.text()) || true;
  } catch (e) {}
}

function setIcon(iconEl, inWatchlist) {
  const url = getSpriteUrl();
  if (!url) return;
  iconEl.style.maskImage = inWatchlist ? 'none' : url;
  iconEl.style.webkitMaskImage = inWatchlist ? 'none' : url;
  iconEl.style.backgroundImage = inWatchlist ? url : 'none';
}

function createButton(inWatchlist, lid) {
  const target = document.createElement('span');
  target.className = 'watchlist-link-target';
  target.innerHTML = `
    <span class="has-icon watchlist-link like-link ${inWatchlist ? 'icon-liked icon-watchlisted' : 'icon-like icon-watchlist'}">
      <span class="icon"></span>
    </span>`;
  setIcon(target.querySelector('.icon'), inWatchlist);
  target.addEventListener('click', handleWatchlistClick);
  return target;
}

function setButtonState(button, inWatchlist) {
  const link = button.querySelector('.watchlist-link');
  if (!link) return;
  link.className = `has-icon watchlist-link like-link ${inWatchlist ? 'icon-liked icon-watchlisted' : 'icon-like icon-watchlist'}`;
  setIcon(link.querySelector('.icon'), inWatchlist);
}

function handleWatchlistClick(e) {
  e.preventDefault();
  e.stopPropagation();
  const target = e.currentTarget;
  const lazyPoster = target.closest('[data-component-class="LazyPoster"]');
  if (!lazyPoster) return;
  const lid = JSON.parse(lazyPoster.dataset.posteredIdentifier).lid;
  const filmPoster = lazyPoster.querySelector('.film-poster');
  if (!filmPoster) return;

  const newState = filmPoster.dataset.inWatchlist !== 'true';
  filmPoster.dataset.inWatchlist = String(newState);

  const realBtn = document.querySelector(`[data-component-class="Watchlist"][data-watchlistable-identifier*="${lid}"] a.action.-watchlist`);
  if (realBtn) { realBtn.click(); return; }

  toggleWatchlist(lid, newState).then(ok => {
    if (!ok) filmPoster.dataset.inWatchlist = String(!newState);
  });
}

function updateOverlays() {
  for (const lazyPoster of document.querySelectorAll('[data-component-class="LazyPoster"]')) {
    const filmPoster = lazyPoster.querySelector('.film-poster');
    if (!filmPoster) continue;
    const overlay = lazyPoster.querySelector('.overlay-actions');
    if (!overlay) continue;
    overlay.classList.toggle('overlay-large', filmPoster.offsetWidth >= 110);
    if (filmPoster.offsetWidth < 110) continue;
    const isInWatchlist = filmPoster.dataset.inWatchlist === 'true';

    const existing = overlay.querySelector('.watchlist-link-target');
    if (existing) {
      setButtonState(existing, isInWatchlist);
    } else {
      const lid = JSON.parse(lazyPoster.dataset.posteredIdentifier).lid;
      const button = createButton(isInWatchlist, lid);
      const menuLink = overlay.querySelector('.menu-link');
      if (menuLink) {
        overlay.insertBefore(button, menuLink);
      } else {
        overlay.appendChild(button);
      }
    }
  }
}

new MutationObserver(updateOverlays).observe(document.body, {
  childList: true, subtree: true, attributes: true,
  attributeFilter: ['data-in-watchlist'],
});

function syncFromWatchlistComponents() {
  for (const wc of document.querySelectorAll('[data-component-class="Watchlist"]')) {
    try {
      const lid = JSON.parse(wc.dataset.watchlistableIdentifier).lid;
      const link = wc.querySelector('a.action.-watchlist');
      if (!link) continue;
      const isInWL = !link.classList.contains('add-to-watchlist');
      for (const lp of document.querySelectorAll('[data-component-class="LazyPoster"]')) {
        if (JSON.parse(lp.dataset.posteredIdentifier).lid !== lid) continue;
        const fp = lp.querySelector('.film-poster');
        if (fp && fp.dataset.inWatchlist !== String(isInWL)) fp.dataset.inWatchlist = String(isInWL);
      }
    } catch (e) {}
  }
}

new MutationObserver(syncFromWatchlistComponents).observe(document.body, {
  childList: true, subtree: true, attributes: true,
});

updateOverlays();
