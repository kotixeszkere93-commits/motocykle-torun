/* =========================================================================
   routes.js — katalog tras społeczności: filtry, karty z miniaturami,
   widok szczegółów (mapa, komentarze, propozycje zmian), zapis nowej trasy,
   udostępnianie i eksport.
   ========================================================================= */

const Routes = (() => {
  'use strict';

  const filters = { q: '', region: '', difficulty: '', surface: '', sort: 'new' };
  let detailMap = null;
  let detailId = null;
  let pendingPayload = null;

  /* ------------------------------------------------------------- INICJACJA */
  function init() {
    fillRegionOptions();
    bindToolbar();
    bindGrid();
    bindSaveDialog();
    bindSuggestionModal();
    bindShareModal();

    Store.onRoutes(routes => {
      renderGrid(routes);
      renderHome(routes);
    });

    window.addEventListener('hashchange', syncFromHash);
  }

  function fillRegionOptions() {
    const host = document.getElementById('routeRegion');
    const field = document.getElementById('routeRegionField');
    const options = REGIONS.map(r => `<option value="${r.id}">${UI.escapeHtml(r.name)}</option>`).join('');
    if (host) host.innerHTML = `<option value="">Wszystkie regiony</option>${options}`;
    if (field) field.innerHTML = options;
  }

  function bindToolbar() {
    const q = document.getElementById('routeSearch');
    const region = document.getElementById('routeRegion');
    const difficulty = document.getElementById('routeDifficulty');
    const surface = document.getElementById('routeSurface');
    const sort = document.getElementById('routeSort');
    const clear = document.getElementById('routeClearFilters');

    let timer = null;
    q?.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => { filters.q = q.value.trim().toLowerCase(); renderGrid(Store.routes); }, 180);
    });
    region?.addEventListener('change', () => { filters.region = region.value; renderGrid(Store.routes); });
    difficulty?.addEventListener('change', () => { filters.difficulty = difficulty.value; renderGrid(Store.routes); });
    surface?.addEventListener('change', () => { filters.surface = surface.value; renderGrid(Store.routes); });
    sort?.addEventListener('change', () => { filters.sort = sort.value; renderGrid(Store.routes); });

    clear?.addEventListener('click', () => {
      Object.assign(filters, { q: '', region: '', difficulty: '', surface: '', sort: 'new' });
      if (q) q.value = '';
      if (region) region.value = '';
      if (difficulty) difficulty.value = '';
      if (surface) surface.value = '';
      if (sort) sort.value = 'new';
      renderGrid(Store.routes);
    });

    document.querySelectorAll('[data-action="focus-planner"]').forEach(btn => {
      btn.addEventListener('click', () => { location.hash = '#/planer'; });
    });
  }

  function bindGrid() {
    const grid = document.getElementById('routesGrid');
    grid?.addEventListener('click', e => {
      if (e.target.closest('#emptyClear')) {
        document.getElementById('routeClearFilters')?.click();
        return;
      }
      const likeBtn = e.target.closest('[data-action="like"]');
      if (likeBtn) { e.preventDefault(); onLike(likeBtn.dataset.id); return; }
      const joinBtn = e.target.closest('[data-action="join"]');
      if (joinBtn) { e.preventDefault(); onJoin(joinBtn.dataset.id); return; }
      const shareBtn = e.target.closest('[data-action="share"]');
      if (shareBtn) { e.preventDefault(); openShareModal(shareBtn.dataset.id); return; }
    });
  }

  /* -------------------------------------------------------------- FILTROWANIE */
  function applyFilters(routes) {
    let list = routes.slice();
    if (filters.q) {
      const q = filters.q;
      list = list.filter(r =>
        (r.title || '').toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q) ||
        (r.authorName || '').toLowerCase().includes(q) ||
        (REGIONS.find(x => x.id === r.region)?.name || '').toLowerCase().includes(q)
      );
    }
    if (filters.region) list = list.filter(r => r.region === filters.region);
    if (filters.difficulty) list = list.filter(r => r.difficulty === filters.difficulty);
    if (filters.surface) list = list.filter(r => r.surface === filters.surface);

    const sorters = {
      new: (a, b) => Store.toMillis(b.createdAt) - Store.toMillis(a.createdAt),
      long: (a, b) => (b.distanceKm || 0) - (a.distanceKm || 0),
      short: (a, b) => (a.distanceKm || 0) - (b.distanceKm || 0),
      likes: (a, b) => (b.likes?.length || 0) - (a.likes?.length || 0),
      crew: (a, b) => (b.participants?.length || 0) - (a.participants?.length || 0)
    };
    return list.sort(sorters[filters.sort] || sorters.new);
  }

  /* ----------------------------------------------------------------- RENDER */
  function renderGrid(routes) {
    const grid = document.getElementById('routesGrid');
    const count = document.getElementById('routesCount');
    if (!grid) return;

    if (!Store.state.routesReady) {
      grid.innerHTML = Array.from({ length: 3 }, () => '<div class="skeleton skeleton-card"></div>').join('');
      if (count) count.textContent = 'Wczytuję trasy…';
      return;
    }

    const list = applyFilters(routes);

    if (count) {
      count.textContent = list.length === routes.length
        ? `${routes.length} ${UI.plural(routes.length, 'trasa', 'trasy', 'tras')} w katalogu`
        : `${list.length} z ${routes.length} tras po filtrach`;
    }

    const tag = document.getElementById('routesModeTag');
    if (tag) {
      tag.textContent = Store.isCloud ? 'Baza społeczności' : 'Tryb lokalny';
      tag.className = `mode-tag ${Store.isCloud ? 'mode-tag--cloud' : 'mode-tag--local'}`;
    }

    if (!list.length) {
      grid.innerHTML = emptyState(routes.length);
      return;
    }
    grid.innerHTML = list.map(card).join('');
    UI.hydrateIcons(grid);
  }

  function emptyState(total) {
    if (Store.readLimited && !Store.hasAccount) {
      return `<div class="empty-state" style="grid-column:1/-1">
        ${UI.icon('lock')}
        <h3>Zaloguj się, aby zobaczyć trasy ekipy</h3>
        <p>Baza społeczności jest dostępna dla zalogowanych motocyklistów. Planer i katalog motocykli działają bez konta.</p>
        <button class="btn btn-primary" type="button" data-action="open-auth">Zaloguj / Zarejestruj</button>
      </div>`;
    }
    if (!total) {
      return `<div class="empty-state" style="grid-column:1/-1">
        ${UI.icon('route')}
        <h3>Jeszcze nie ma tu żadnej trasy</h3>
        <p>Bądź pierwszy — zaplanuj trasę w planerze i opublikuj ją dla ekipy.</p>
        <a class="btn btn-primary" href="#/planer">Zaplanuj pierwszą trasę</a>
      </div>`;
    }
    return `<div class="empty-state" style="grid-column:1/-1">
      ${UI.icon('search')}
      <h3>Nic nie pasuje do filtrów</h3>
      <p>Spróbuj innego regionu, trudności albo wyczyść filtry.</p>
      <button class="btn btn-outline" type="button" id="emptyClear">Wyczyść filtry</button>
    </div>`;
  }

  function sparkline(path) {
    if (!path || path.length < 3) return '';
    const lats = path.map(p => p[0]);
    const lngs = path.map(p => p[1]);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const w = 300, h = 84, pad = 8;
    const scaleX = v => pad + ((v - minLng) / (maxLng - minLng || 1)) * (w - pad * 2);
    const scaleY = v => h - pad - ((v - minLat) / (maxLat - minLat || 1)) * (h - pad * 2);
    const d = path.map((p, i) => `${i ? 'L' : 'M'}${scaleX(p[1]).toFixed(1)},${scaleY(p[0]).toFixed(1)}`).join(' ');
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
      <path d="${d}" fill="none" stroke="#ff8a1f" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>
    </svg>`;
  }

  function card(r) {
    const diff = DIFFICULTY[r.difficulty] || DIFFICULTY.srednia;
    const surf = SURFACE[r.surface] || SURFACE.mieszana;
    const region = REGIONS.find(x => x.id === r.region);
    const likes = r.likes?.length || 0;
    const liked = Store.user && r.likes?.includes(Store.user.uid);
    const riders = r.participants?.length || 0;
    const comments = r.comments?.length || 0;

    return `<article class="route-card">
      <div class="route-card-head">
        <div>
          <h3><a href="#/trasa/${r.id}">${UI.escapeHtml(r.title)}</a></h3>
          <p class="route-author">
            ${UI.avatar(r.authorName, 'sm')}
            <span>${UI.escapeHtml(r.authorName || 'Motocyklista')} · ${UI.escapeHtml(r.authorBike || '—')}</span>
          </p>
        </div>
        <span class="muted small nowrap">${UI.fmt.timeAgo(r.createdAt)}</span>
      </div>

      <div class="route-spark">${sparkline(r.path) || `<div class="center muted small" style="height:100%;display:grid;place-items:center">${UI.escapeHtml(region?.name || 'Polska')}</div>`}</div>

      <div class="route-card-meta">
        <span class="badge ${diff.cls}">${UI.escapeHtml(diff.label)}</span>
        <span class="badge ${surf.cls}">${UI.escapeHtml(surf.label)}</span>
        ${region ? `<span class="badge">${UI.escapeHtml(region.name)}</span>` : ''}
        ${r.rideDate ? `<span class="badge badge--ride">${UI.fmt.date(r.rideDate)}</span>` : ''}
      </div>

      ${r.description ? `<p class="route-desc">${UI.escapeHtml(r.description)}</p>` : ''}

      <div class="route-stats">
        <span>${UI.icon('ruler')} ${UI.fmt.km(r.distanceKm)}</span>
        ${r.durationSec ? `<span>${UI.icon('clock')} ${UI.fmt.duration(r.durationSec)}</span>` : ''}
        <span>${UI.icon('users')} ${riders}</span>
        <span>${UI.icon('comment')} ${comments}</span>
      </div>

      <div class="route-card-foot">
        <div class="row gap-sm">
          <button class="btn btn-sm ${liked ? 'is-active' : 'btn-outline'}" type="button" data-action="like" data-id="${r.id}" aria-pressed="${liked ? 'true' : 'false'}">
            ${UI.icon('heart')} ${likes}
          </button>
          <button class="btn btn-sm btn-outline" type="button" data-action="share" data-id="${r.id}">
            ${UI.icon('share')} Udostępnij
          </button>
        </div>
        <a class="btn btn-sm btn-primary" href="#/trasa/${r.id}">Szczegóły ${UI.icon('arrow-right')}</a>
      </div>
    </article>`;
  }

  function renderHome(routes) {
    const host = document.getElementById('homeRoutes');
    if (!host) return;
    if (!Store.state.routesReady) {
      host.innerHTML = Array.from({ length: 3 }, () => '<div class="skeleton skeleton-card"></div>').join('');
      return;
    }
    if (!routes.length) {
      host.innerHTML = emptyState(0);
      UI.hydrateIcons(host);
      return;
    }
    host.innerHTML = routes.slice(0, 3).map(card).join('');
    UI.hydrateIcons(host);
    host.querySelectorAll('[data-action="like"]').forEach(btn => {
      btn.addEventListener('click', () => onLike(btn.dataset.id));
    });
  }

  /* --------------------------------------------------------------- AKCJE */
  async function onLike(id) {
    if (!Store.hasAccount) {
      UI.toast('Zaloguj się', 'Lajki i zapisywanie tras wymagają konta (darmowego).', 'warn');
      document.querySelector('[data-action="open-auth"]')?.click();
      return;
    }
    try {
      await Store.toggleLike(id);
      renderGrid(Store.routes);
      renderHome(Store.routes);
    } catch (e) {
      UI.toast('Nie udało się', UI.firebaseError(e), 'err');
    }
  }

  async function onJoin(id) {
    if (!Store.hasAccount) {
      UI.toast('Zaloguj się', 'Dołączanie do wyjazdu wymaga konta.', 'warn');
      document.querySelector('[data-action="open-auth"]')?.click();
      return;
    }
    const route = Store.routes.find(r => r.id === id);
    if (!route) return;
    const joined = route.participants.some(p => p.userId === Store.user.uid);
    try {
      if (joined) {
        await Store.leaveRoute(id);
      } else {
        await Store.joinRoute(id);
        if (route.rideDate) {
          UI.toast('Termin wyjazdu', `${UI.fmt.date(route.rideDate)}${route.meetingPoint ? ` · zbiórka: ${route.meetingPoint}` : ''}`, 'info', 6000);
        }
      }
      renderGrid(Store.routes);
      if (detailId === id) renderDetail(Store.routes.find(r => r.id === id));
    } catch (e) {
      UI.toast('Nie udało się', UI.firebaseError(e), 'err');
    }
  }

  /* ------------------------------------------------- ZAPIS NOWEJ TRASY */
  function openSaveDialog(payload) {
    const modal = document.getElementById('routeModal');
    if (!modal) return;
    const preview = document.getElementById('routePreviewMini');
    const region = REGIONS.find(r => r.id === payload.region);
    if (preview) {
      preview.innerHTML = `
        <strong>${UI.fmt.km(payload.distanceKm)}</strong> · ${UI.fmt.duration(payload.durationSec)}
        · ${payload.points.length} ${UI.plural(payload.points.length, 'punkt', 'punkty', 'punktów')}
        <br><span class="muted small">${payload.places.map(p => UI.escapeHtml(p)).join(' → ')}</span>
        ${region ? `<br><span class="muted small">Region: ${UI.escapeHtml(region.name)}</span>` : ''}`;
    }
    const select = document.getElementById('routeRegionField');
    if (select) { select.dataset.touched = ''; select.value = payload.region || 'kujawy'; }
    const title = document.getElementById('routeTitle');
    document.getElementById('routeMessage').textContent = '';
    pendingPayload = payload;
    UI.openModal(modal);
    setTimeout(() => title?.focus(), 80);
  }

  function bindSaveDialog() {
    const form = document.getElementById('routeForm');
    const select = document.getElementById('routeRegionField');
    select?.addEventListener('change', () => { select.dataset.touched = '1'; });

    form?.addEventListener('submit', async e => {
      e.preventDefault();
      await saveRoute();
    });
  }

  async function saveRoute() {
    const payload = pendingPayload;
    const msg = document.getElementById('routeMessage');
    const btn = document.getElementById('routeSubmit');
    const title = document.getElementById('routeTitle').value.trim();
    const description = document.getElementById('routeDescription').value.trim();

    if (!title) {
      msg.className = 'message err';
      msg.textContent = 'Podaj nazwę trasy — bez tego nikt jej nie znajdzie.';
      document.getElementById('routeTitle').classList.add('is-invalid');
      return;
    }
    if (!payload || !payload.distanceKm) {
      msg.className = 'message err';
      msg.textContent = 'Trasa nie została jeszcze policzona. Wróć do planera i poczekaj na dystans.';
      return;
    }

    UI.setLoading(btn, true, 'Publikuję…');
    try {
      const route = await Store.addRoute({
        title,
        description,
        region: document.getElementById('routeRegionField').value,
        difficulty: document.getElementById('routeDifficultyField').value,
        surface: document.getElementById('routeSurfaceField').value,
        rideDate: document.getElementById('routeRideDate').value,
        meetingPoint: document.getElementById('routeMeeting').value,
        ...payload
      });
      await Store.addScore(POINTS.route);

      msg.className = 'message ok';
      msg.textContent = `Trasa opublikowana. +${POINTS.route} pkt do rankingu!`;
      document.getElementById('routeTitle').classList.remove('is-invalid');
      document.getElementById('routeForm').reset();

      UI.toast('Trasa opublikowana', `„${route.title}” · +${POINTS.route} pkt`, 'ok');
      setTimeout(() => {
        UI.closeModal('routeModal');
        location.hash = `#/trasa/${route.id}`;
      }, 900);
    } catch (err) {
      console.error(err);
      msg.className = 'message err';
      msg.textContent = UI.firebaseError(err);
    } finally {
      UI.setLoading(btn, false);
    }
  }

  /* ------------------------------------------------------- WIDOK SZCZEGÓŁÓW */
  function syncFromHash() {
    const match = /^#\/trasa\/(.+)$/.exec(location.hash);
    if (match) showDetail(match[1]);
  }

  function showDetail(id) {
    detailId = id;
    const route = Store.routes.find(r => r.id === id);
    const host = document.getElementById('routeDetail');
    if (!host) return;

    if (!Store.state.routesReady) {
      host.innerHTML = '<p class="muted">Wczytywanie trasy…</p>';
      return;
    }
    if (!route) {
      host.innerHTML = `<div class="empty-state">
        ${UI.icon('alert')}
        <h3>Nie ma takiej trasy</h3>
        <p>Możliwe, że została usunięta albo link jest nieaktualny.</p>
        <a class="btn btn-primary" href="#/trasy">Wróć do katalogu</a>
      </div>`;
      UI.hydrateIcons(host);
      return;
    }
    renderDetail(route);
  }

  function renderDetail(route) {
    const host = document.getElementById('routeDetail');
    if (!host || !route) return;

    const diff = DIFFICULTY[route.difficulty] || DIFFICULTY.srednia;
    const surf = SURFACE[route.surface] || SURFACE.mieszana;
    const region = REGIONS.find(r => r.id === route.region);
    const isOwner = Store.user && route.authorId === Store.user.uid;
    const joined = Store.user && route.participants.some(p => p.userId === Store.user.uid);
    const liked = Store.user && route.likes.includes(Store.user.uid);

    host.innerHTML = `
      <div class="detail-head">
        <a class="btn btn-sm btn-ghost" href="#/trasy">${UI.icon('arrow-left')} Wszystkie trasy</a>
        <h1>${UI.escapeHtml(route.title)}</h1>
        <div class="detail-meta">
          <span class="route-author">${UI.avatar(route.authorName)} ${UI.escapeHtml(route.authorName || 'Motocyklista')} · ${UI.escapeHtml(route.authorBike || '—')}</span>
          <span class="badge ${diff.cls}" title="${UI.escapeHtml(diff.desc)}">${UI.escapeHtml(diff.label)}</span>
          <span class="badge ${surf.cls}">${UI.escapeHtml(surf.label)}</span>
          ${region ? `<span class="badge">${UI.escapeHtml(region.name)}</span>` : ''}
          ${route.rideDate ? `<span class="badge badge--ride">Wyjazd: ${UI.fmt.date(route.rideDate)}</span>` : ''}
          <span class="muted small">Dodano ${UI.fmt.timeAgo(route.createdAt)}</span>
        </div>
      </div>

      <div class="detail-grid">
        <div class="stack gap-md">
          <div class="stat-grid">
            <div class="metric"><span class="metric-label">Dystans</span><span class="metric-value">${UI.fmt.km(route.distanceKm)}</span></div>
            <div class="metric"><span class="metric-label">Czas jazdy</span><span class="metric-value">${UI.fmt.duration(route.durationSec)}</span></div>
            <div class="metric"><span class="metric-label">Przystanki</span><span class="metric-value">${(route.waypoints?.length || 0) + 2}</span></div>
            <div class="metric"><span class="metric-label">Zapisanych</span><span class="metric-value">${route.participants.length}</span></div>
          </div>

          <div class="card">
            <h2 class="card-title">${UI.icon('route')} Przebieg trasy</h2>
            <div id="detailMap" class="detail-map"></div>
            <div id="detailWaypoints" class="waypoint-list mt-md"></div>
          </div>

          ${route.description ? `<div class="card prose"><h2 class="card-title">${UI.icon('info')} Opis trasy</h2><p>${UI.escapeHtml(route.description)}</p></div>` : ''}

          <div class="card">
            <h2 class="card-title">${UI.icon('comment')} Komentarze (${route.comments.length})</h2>
            <div id="commentList">
              ${route.comments.length
                ? route.comments.map(c => commentTemplate(route, c)).join('')
                : '<p class="muted small">Nikt jeszcze nic nie napisał. Może Ty?</p>'}
            </div>
            <form class="comment-form" id="commentForm">
              <span class="input-wrap">
                <input type="text" id="commentInput" maxlength="400" placeholder="Napisz coś o trasie…" aria-label="Treść komentarza">
              </span>
              <button class="btn btn-primary" type="submit">${UI.icon('chat')} Wyślij</button>
            </form>
          </div>
        </div>

        <aside class="stack gap-md">
          <div class="card">
            <h2 class="card-title">${UI.icon('users')} Ekipa (${route.participants.length})</h2>
            <div class="participant-list">
              ${route.participants.length
                ? route.participants.map(p => `<span class="participant">${UI.avatar(p.name, 'sm')} ${UI.escapeHtml(p.name)}</span>`).join('')
                : '<p class="muted small">Nikt się jeszcze nie zapisał. Bądź pierwszy.</p>'}
            </div>
            ${route.meetingPoint ? `<p class="muted small mt-md">${UI.icon('pin')} Zbiórka: ${UI.escapeHtml(route.meetingPoint)}</p>` : ''}
            <div class="stack gap-sm mt-md">
              <button class="btn ${joined ? 'btn-outline' : 'btn-primary'} btn-block" type="button" data-action="join" data-id="${route.id}">
                ${UI.icon(joined ? 'check' : 'plus')} ${joined ? 'Jadę — wypisz mnie' : 'Biorę udział'}
              </button>
              <button class="btn ${liked ? 'is-active btn-outline' : 'btn-outline'} btn-block" type="button" data-action="like" data-id="${route.id}">
                ${UI.icon('heart')} ${liked ? 'Polubione' : 'Lubię'} (${route.likes.length})
              </button>
            </div>
          </div>

          <div class="card">
            <h2 class="card-title">${UI.icon('share')} Zapisz i jedź</h2>
            <div class="stack gap-sm">
              <button class="btn btn-outline btn-block" type="button" data-action="gpx" data-id="${route.id}">
                ${UI.icon('download')} Pobierz GPX
              </button>
              <button class="btn btn-outline btn-block" type="button" data-action="google" data-id="${route.id}">
                ${UI.icon('external')} Otwórz w Google Maps
              </button>
              <button class="btn btn-outline btn-block" type="button" data-action="planner" data-id="${route.id}">
                ${UI.icon('route')} Skopiuj do planera
              </button>
              <button class="btn btn-outline btn-block" type="button" data-action="share" data-id="${route.id}">
                ${UI.icon('share')} Udostępnij trasę
              </button>
            </div>
          </div>

          <div class="card">
            <h2 class="card-title">${UI.icon('sparkles')} Propozycje zmian (${route.suggestions.length})</h2>
            <div id="suggestionList">
              ${route.suggestions.length
                ? route.suggestions.map(s => `<div class="suggestion"><strong>${UI.escapeHtml(s.authorName)}:</strong> ${UI.escapeHtml(s.text)}</div>`).join('')
                : '<p class="muted small">Brak propozycji. Masz lepszy pomysł na tę trasę?</p>'}
            </div>
            <button class="btn btn-outline btn-block mt-md" type="button" data-action="suggest" data-id="${route.id}">
              ${UI.icon('edit')} Zaproponuj zmianę
            </button>
          </div>

          ${isOwner ? `<div class="card">
            <h2 class="card-title">${UI.icon('lock')} Zarządzanie</h2>
            <button class="btn btn-danger btn-block" type="button" data-action="delete" data-id="${route.id}">
              ${UI.icon('trash')} Usuń trasę
            </button>
          </div>` : ''}
        </aside>
      </div>`;

    UI.hydrateIcons(host);
    renderWaypoints(route);
    renderDetailMap(route);
    bindDetailActions(route);
  }

  function commentTemplate(route, c) {
    const mine = Store.user && c.userId === Store.user.uid;
    return `<div class="comment">
      ${UI.avatar(c.authorName, 'sm')}
      <div class="comment-body">
        <div class="comment-head">
          <strong>${UI.escapeHtml(c.authorName)}</strong>
          <time datetime="${c.createdAt}">${UI.fmt.timeAgo(c.createdAt)}</time>
          ${mine ? `<button class="comment-delete" type="button" data-delete-comment="${c.id}" data-route="${route.id}">usuń</button>` : ''}
        </div>
        <p>${UI.escapeHtml(c.text)}</p>
      </div>
    </div>`;
  }

  function renderWaypoints(route) {
    const host = document.getElementById('detailWaypoints');
    if (!host) return;
    const points = [route.start, ...(route.waypoints || []), route.end];
    host.innerHTML = points.map((p, i) => {
      const kind = i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'via';
      const label = kind === 'start' ? 'Start' : kind === 'end' ? 'Meta' : `Przystanek ${i}`;
      return `<li class="waypoint-item waypoint-item--${kind}">
        <span class="waypoint-index">${kind === 'start' ? 'S' : kind === 'end' ? 'M' : i}</span>
        <span><strong>${label}</strong><br>
        <span class="waypoint-coords">${UI.escapeHtml(MapEngine.nearestPlace({ lat: p.lat, lng: p.lng }).label)}</span></span>
      </li>`;
    }).join('');
  }

  async function renderDetailMap(route) {
    const host = document.getElementById('detailMap');
    if (!host) return;
    if (detailMap) { detailMap.remove(); detailMap = null; }
    detailMap = MapEngine.create('detailMap', { zoomControl: true });
    if (!detailMap) return;
    MapEngine.invalidate('detailMap');

    const points = [route.start, ...(route.waypoints || []), route.end];
    points.forEach((p, i) => {
      const kind = i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'via';
      MapEngine.marker(detailMap, L.latLng(p.lat, p.lng), { kind, text: kind === 'via' ? String(i) : '' });
    });

    if (route.path && route.path.length > 2) {
      MapEngine.drawLine(detailMap, route.path, { fit: true, bounds: L.latLngBounds(points) });
    } else {
      const result = await MapEngine.route(points, { avoidHighways: true });
      if (result && detailMap) {
        MapEngine.drawLine(detailMap, result.coords, { fit: true, bounds: L.latLngBounds(points) });
      } else {
        MapEngine.fit(detailMap, points.map(p => L.latLng(p.lat, p.lng)));
        MapEngine.drawLine(detailMap, points.map(p => [p.lat, p.lng]), { dashed: true, fit: true });
      }
    }
    MapEngine.fit(detailMap, points.map(p => L.latLng(p.lat, p.lng)));
  }

  function bindDetailActions(route) {
    const host = document.getElementById('routeDetail');
    if (!host) return;

    host.querySelector('#commentForm')?.addEventListener('submit', async e => {
      e.preventDefault();
      const input = document.getElementById('commentInput');
      const text = input.value.trim();
      if (!text) return;
      if (!Store.hasAccount) {
        UI.toast('Zaloguj się', 'Komentarze wymagają konta.', 'warn');
        document.querySelector('[data-action="open-auth"]')?.click();
        return;
      }
      try {
        await Store.addComment(route.id, text);
        input.value = '';
        UI.toast('Komentarz dodany', `+${POINTS.comment} pkt`, 'ok', 2600);
      } catch (err) {
        UI.toast('Nie udało się dodać komentarza', UI.firebaseError(err), 'err');
      }
    });

    host.addEventListener('click', async e => {
      const del = e.target.closest('[data-delete-comment]');
      if (del) {
        await Store.deleteComment(del.dataset.route, del.dataset.deleteComment);
        return;
      }
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const id = btn.dataset.id;

      if (action === 'join') {
        await onJoin(id);
        renderDetail(Store.routes.find(r => r.id === id));
        return;
      }
      if (action === 'like') {
        await onLike(id);
        renderDetail(Store.routes.find(r => r.id === id));
        return;
      }
      if (action === 'gpx') return downloadGpx(route);
      if (action === 'google') return openInGoogle(route);
      if (action === 'planner') {
        location.hash = '#/planer';
        setTimeout(() => Planner.loadRoute(route), 120);
        UI.toast('Trasa w planerze', 'Możesz ją zmodyfikować i zapisać jako własną.', 'ok');
        return;
      }
      if (action === 'share') return openShareModal(id);
      if (action === 'suggest') {
        if (!Store.hasAccount) {
          UI.toast('Zaloguj się', 'Propozycje zmian wymagają konta.', 'warn');
          return;
        }
        openSuggestionModal(route);
        return;
      }
      if (action === 'delete') {
        const ok = await UI.confirmDialog({
          title: 'Usunąć trasę?',
          text: `„${route.title}” zniknie dla wszystkich. Tego nie cofniemy.`,
          okLabel: 'Usuń trasę'
        });
        if (!ok) return;
        try {
          await Store.deleteRoute(id);
          UI.toast('Trasa usunięta', 'Dzięki, że dbasz o porządek.', 'info');
          location.hash = '#/trasy';
        } catch (err) {
          UI.toast('Nie udało się usunąć', UI.firebaseError(err), 'err');
        }
      }
    });
  }

  /* ------------------------------------------------------------- EKSPORT */
  function routePathSync(route) {
    if (route.path && route.path.length > 2) return route.path;
    return [route.start, ...(route.waypoints || []), route.end].map(p => [p.lat, p.lng]);
  }

  function downloadGpx(route) {
    const gpx = MapEngine.buildGpx(route.title, [{ name: route.title, coords: routePathSync(route) }]);
    MapEngine.download(`${Store.slugify(route.title)}.gpx`, gpx);
    UI.toast('GPX pobrany', 'Wgraj plik do swojej nawigacji.', 'ok');
  }

  function openInGoogle(route) {
    const points = [route.start, ...(route.waypoints || []), route.end]
      .map(p => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`).join('/');
    window.open(`https://www.google.com/maps/dir/${points}`, '_blank', 'noopener');
  }

  /* ------------------------------------------------------- PROPOZYCJE ZMIAN */
  function openSuggestionModal(route) {
    const modal = document.getElementById('suggestionModal');
    if (!modal) return;
    modal.dataset.routeId = route.id;
    modal.querySelector('#suggestionTarget').textContent = route.title;
    modal.querySelector('#suggestionText').value = '';
    UI.openModal(modal);
  }

  function bindSuggestionModal() {
    const modal = document.getElementById('suggestionModal');
    const form = document.getElementById('suggestionForm');
    form?.addEventListener('submit', async e => {
      e.preventDefault();
      const routeId = modal.dataset.routeId;
      const text = modal.querySelector('#suggestionText').value.trim();
      if (!text) return;
      const btn = document.getElementById('suggestionSubmit');
      UI.setLoading(btn, true, 'Wysyłam…');
      try {
        await Store.addSuggestion(routeId, text);
        UI.closeModal(modal);
      } catch (err) {
        UI.toast('Nie udało się wysłać propozycji', UI.firebaseError(err), 'err');
      } finally {
        UI.setLoading(btn, false);
      }
    });
  }

  /* --------------------------------------------------------- UDOSTĘPNIANIE */
  function bindShareModal() {
    const modal = document.getElementById('shareModal');
    if (!modal) return;
    modal.querySelector('#shareGpx')?.addEventListener('click', () => {
      const route = Store.routes.find(r => r.id === modal.dataset.routeId);
      if (route) downloadGpx(route);
    });
    modal.querySelector('#shareCopy')?.addEventListener('click', async () => {
      const link = modal.querySelector('#shareLink').value;
      const ok = await UI.copyText(link);
      UI.toast(ok ? 'Link skopiowany' : 'Nie udało się skopiować', ok ? 'Wklej go w grupie.' : link, ok ? 'ok' : 'warn');
    });
    modal.querySelector('#shareNative')?.addEventListener('click', async () => {
      const link = modal.querySelector('#shareLink').value;
      const route = Store.routes.find(r => r.id === modal.dataset.routeId);
      if (navigator.share && route) {
        try {
          await navigator.share({ title: route.title, text: `Trasa Moto Świrów: ${route.title}`, url: link });
        } catch (e) { /* anulowane */ }
      } else {
        UI.toast('Udostępnianie systemowe niedostępne', 'Skopiuj link ręcznie.', 'warn');
      }
    });
  }

  function openShareModal(id) {
    const route = Store.routes.find(r => r.id === id);
    if (!route) return;
    const modal = document.getElementById('shareModal');
    modal.dataset.routeId = id;
    const link = `${location.origin}${location.pathname}#/trasa/${id}`;
    modal.querySelector('#shareLink').value = link;
    modal.querySelector('#shareWhatsapp').href =
      `https://wa.me/?text=${encodeURIComponent(`Trasa Moto Świrów: ${route.title} — ${UI.fmt.km(route.distanceKm)} ${link}`)}`;
    UI.openModal(modal);
  }

  return {
    init, renderGrid, renderHome, showDetail, openSaveDialog, openShareModal,
    downloadGpx, openInGoogle,
    get filters() { return filters; }
  };
})();
