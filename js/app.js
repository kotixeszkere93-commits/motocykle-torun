/* =========================================================================
   app.js — router (hash), start aplikacji, pasek stanu, statystyki hero,
   tryb offline i instalacja jako aplikacja (PWA).
   ========================================================================= */

const App = (() => {
  'use strict';

  const VIEWS = ['start', 'planer', 'trasy', 'trasa', 'ranking', 'garaz', 'poradnik', 'profil'];
  let currentView = null;
  let deferredInstall = null;

  /* ------------------------------------------------------------- ROUTER */
  function parseHash() {
    const hash = location.hash.replace(/^#\/?/, '');
    if (!hash) return { view: 'start', param: null };
    const [path, param] = hash.split('/');
    const view = VIEWS.includes(path) ? path : 'start';
    return { view, param: param || null };
  }

  function navigate() {
    const { view, param } = parseHash();

    document.querySelectorAll('.view').forEach(el => el.classList.remove('is-active'));
    const target = document.getElementById(`view-${view}`);
    if (target) target.classList.add('is-active');

    document.querySelectorAll('.site-nav a').forEach(a => {
      a.classList.toggle('is-active', a.dataset.nav === view || (view === 'trasa' && a.dataset.nav === 'trasy'));
    });

    document.getElementById('siteNav')?.classList.remove('is-open');
    document.getElementById('menuToggle')?.setAttribute('aria-expanded', 'false');

    if (view !== currentView) {
      window.scrollTo({ top: 0, behavior: currentView ? 'smooth' : 'auto' });
      currentView = view;
    }

    // Hooks widoków
    if (view === 'planer') {
      Planner.init();
      Planner.resize();
    }
    if (view === 'trasa') {
      if (param) Routes.showDetail(param);
      else location.hash = '#/trasy';
    }
    if (view === 'trasy') Routes.renderGrid(Store.routes);
    if (view === 'ranking') Ranking.render();
    if (view === 'garaz') { Garage.render(); Garage.renderMyBike(); }
    if (view === 'profil') Auth.renderProfile();

    document.title = title({ view, param });
  }

  function title({ view, param }) {
    const base = 'Moto Świry Toruń';
    if (view === 'trasa' && param) {
      const route = Store.routes.find(r => r.id === param);
      if (route) return `${route.title} — trasa motocyklowa | ${base}`;
    }
    const names = {
      planer: 'Planer tras',
      trasy: 'Trasy społeczności',
      ranking: 'Ranking',
      garaz: 'Katalog motocykli',
      poradnik: 'Poradnik',
      profil: 'Mój profil',
      start: 'planer tras, społeczność i ranking motocyklistów'
    };
    return `${names[view] || ''} | ${base}`;
  }

  /* --------------------------------------------------------------- START */
  async function boot() {
    UI.initTheme();
    UI.initChrome();
    UI.hydrateIcons();

    Routes.init();
    Ranking.init();
    Auth.init();
    Auth.bindProfileModal();
    Garage.init();

    window.addEventListener('hashchange', navigate);
    navigate();

    // Ładujemy dane (Firestore albo tryb lokalny)
    await Store.init();
    updateSystemBar();
    updateHeroStats();

    Store.onRoutes(() => {
      updateHeroStats();
      if (currentView === 'trasy') Routes.renderGrid(Store.routes);
      if (currentView === 'trasa' && parseHash().param) Routes.showDetail(parseHash().param);
    });
    Store.onUsers(updateHeroStats);
    Store.onAuth(() => updateHeroStats());

    handleQueryParams();
    registerServiceWorker();
    bindInstall();
    bindNetwork();
    bindGlobalShortcuts();
  }

  /** ?planer=lat,lng;lat,lng — link współdzielony z planera */
  function handleQueryParams() {
    const params = new URLSearchParams(location.search);
    if (params.get('planer')) {
      if (!location.hash) location.hash = '#/planer';
      setTimeout(() => Planner.init(), 80);
    }
  }

  /* ---------------------------------------------------------- PASEK STANU */
  function updateSystemBar() {
    const bar = document.getElementById('systemBar');
    if (!bar) return;

    const dismissNote = sessionStorage.getItem(`${APP.storagePrefix}bar-dismissed`);
    if (!navigator.onLine) {
      show(bar, 'warn', 'Jesteś offline — pokazujemy ostatnio zapisane dane.', false);
      return;
    }
    if (Store.isCloud && Store.readLimited && !Store.hasAccount) {
      show(bar, 'warn',
        'Baza społeczności wymaga zalogowania — po zalogowaniu zobaczysz trasy ekipy i ranking. Planer i katalog motocykli działają bez konta.',
        true);
      return;
    }
    if (!Store.isCloud && !dismissNote) {
      show(bar, 'info',
        'Tryb lokalny: baza społeczności jest chwilowo niedostępna, więc trasy i konto trzymamy w tej przeglądarce. Wszystkie funkcje poza synchronizacją działają.',
        true);
      return;
    }
    bar.classList.add('is-hidden');
  }

  function show(bar, kind, text, dismissible) {
    bar.className = `system-bar system-bar--${kind}`;
    bar.innerHTML = `<span>${UI.escapeHtml(text)}</span>`;
    if (dismissible) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('aria-label', 'Zamknij informację');
      btn.textContent = '×';
      btn.addEventListener('click', () => {
        sessionStorage.setItem(`${APP.storagePrefix}bar-dismissed`, '1');
        bar.classList.add('is-hidden');
      });
      bar.appendChild(btn);
    }
  }

  function bindNetwork() {
    window.addEventListener('online', () => {
      UI.toast('Wróciło połączenie', 'Możesz znów synchronizować trasy.', 'ok');
      updateSystemBar();
    });
    window.addEventListener('offline', () => {
      UI.toast('Brak połączenia', 'Planer policzy trasę w trybie szacunkowym.', 'warn');
      updateSystemBar();
    });
  }

  /* -------------------------------------------------------- STATYSTYKI HERO */
  function updateHeroStats() {
    const set = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };
    const routes = Store.routes;
    const km = routes.reduce((sum, r) => sum + (Number(r.distanceKm) || 0), 0);
    const riders = new Set();
    routes.forEach(r => {
      if (r.authorId) riders.add(r.authorId);
      (r.participants || []).forEach(p => riders.add(p.userId));
    });

    set('statRoutes', routes.length ? UI.fmt.num(routes.length) : '—');
    set('statRiders', riders.size ? UI.fmt.num(riders.size) : (Store.users.length ? Store.users.length : '—'));
    set('statKm', km ? UI.fmt.num(km) : '—');
    set('statPoi', String(POI.length));
  }

  /* ------------------------------------------------------------- INSTALL (PWA) */
  function bindInstall() {
    const btn = document.getElementById('installBtn');
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      deferredInstall = e;
      btn?.classList.remove('is-hidden');
    });
    btn?.addEventListener('click', async () => {
      if (!deferredInstall) {
        UI.toast('Instalacja', 'W menu przeglądarki wybierz „Dodaj do ekranu głównego”.', 'info');
        return;
      }
      deferredInstall.prompt();
      await deferredInstall.userChoice;
      deferredInstall = null;
      btn.classList.add('is-hidden');
    });
    window.addEventListener('appinstalled', () => UI.toast('Zainstalowano', 'Moto Świry są teraz na Twoim ekranie głównym.', 'ok'));
  }

  /* ---------------------------------------------------------- SERVICE WORKER */
  function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('[Moto Świry] SW:', err.message));
  }

  /* ------------------------------------------------------- SKRÓTY KLAWIATUROWE */
  function bindGlobalShortcuts() {
    document.addEventListener('keydown', e => {
      if (e.key === '/' && !/input|textarea|select/i.test(e.target.tagName)) {
        e.preventDefault();
        const { view } = parseHash();
        const target = view === 'garaz' ? 'bikeSearch' : 'routeSearch';
        if (view !== 'trasy' && view !== 'garaz') location.hash = '#/trasy';
        setTimeout(() => document.getElementById(target)?.focus(), 200);
      }
      if (e.key === '?' && e.shiftKey && !/input|textarea/i.test(e.target.tagName)) {
        UI.toast('Skróty', '/ — szukaj · Backspace w planerze — cofnij punkt · Ctrl+Z — cofnij punkt · Esc — zamknij okno', 'info', 8000);
      }
    });
  }

  return { boot, navigate, updateSystemBar };
})();

document.addEventListener('DOMContentLoaded', () => App.boot());
