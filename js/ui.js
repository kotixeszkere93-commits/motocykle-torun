/* =========================================================================
   ui.js — narzędziownia interfejsu: ikony, modale, toasty, formatowanie,
   motyw, nawigacja mobilna. Nic tu nie zależy od Firebase.
   ========================================================================= */

const UI = (() => {
  'use strict';

  /* ------------------------------------------------------------- IKONY */
  const PATHS = {
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/>',
    users: '<path d="M16 20v-1.5c0-2.2-2-4-4.5-4S7 16.3 7 18.5V20"/><circle cx="11.5" cy="8" r="3.5"/><path d="M20 20v-1.2c0-1.8-1.4-3.3-3.4-3.7"/><path d="M16.5 5.2a3.3 3.3 0 0 1 0 6.1"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    download: '<path d="M12 3v12"/><path d="M7 11l5 5 5-5"/><path d="M4 20h16"/>',
    route: '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18h4a3.5 3.5 0 0 0 0-7h-1a3.5 3.5 0 0 1 0-7"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 5H5.5A2.5 2.5 0 0 0 8 9.5M16 5h2.5A2.5 2.5 0 0 1 16 9.5"/><path d="M12 13v4M9 20h6"/>',
    bike: '<circle cx="5.5" cy="17" r="3"/><circle cx="18.5" cy="17" r="3"/><path d="M8.5 17h7l-3-7h2.5"/><path d="M11 7h3"/><path d="M9 10.5L7 14"/>',
    shield: '<path d="M12 3l7 3v6c0 4-3 7.5-7 9-4-1.5-7-5-7-9V6z"/><path d="M9.5 12l1.8 1.8L15 10"/>',
    pin: '<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/>',
    save: '<path d="M5 4h11l3 3v13H5z"/><path d="M9 4v6h6V4"/><path d="M8 20v-5h8v5"/>',
    trash: '<path d="M4 7h16"/><path d="M9 7V5h6v2"/><path d="M6 7l1 13h10l1-13"/>',
    locate: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="8"/>',
    expand: '<path d="M4 9V4h5M20 15v5h-5M20 9V4h-5M4 15v5h5"/>',
    share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6"/>',
    external: '<path d="M14 4h6v6"/><path d="M20 4l-8 8"/><path d="M18 14v5H5V6h5"/>',
    link: '<path d="M10 13a4 4 0 0 0 5.7 0l2.6-2.6A4 4 0 0 0 12.6 4.7L11.3 6"/><path d="M14 11a4 4 0 0 0-5.7 0L5.7 13.6A4 4 0 0 0 11.4 19.3L12.7 18"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    cloud: '<path d="M7 18h9.5a3.5 3.5 0 0 0 .3-7 5 5 0 0 0-9.6-1.2A4 4 0 0 0 7 18z"/>',
    gauge: '<path d="M4 18a8 8 0 1 1 16 0"/><path d="M12 18l4-5"/>',
    calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    chat: '<path d="M20 15a3 3 0 0 1-3 3H9l-5 3V7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3z"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 6V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h1"/>',
    eye: '<path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="2.8"/>',
    check: '<path d="M5 13l4.5 4.5L19 7"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
    star: '<path d="M12 4l2.5 5.2 5.5.7-4 3.8 1 5.5L12 16.5 7 19.2l1-5.5-4-3.8 5.5-.7z"/>',
    heart: '<path d="M12 20s-7-4.6-7-9.5A4 4 0 0 1 12 7a4 4 0 0 1 7 3.5C19 15.4 12 20 12 20z"/>',
    comment: '<path d="M20 12a8 8 0 0 1-8 8H8l-4 3v-5.5A8 8 0 0 1 12 4a8 8 0 0 1 8 8z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    'arrow-right': '<path d="M5 12h14M13 6l6 6-6 6"/>',
    'arrow-left': '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    fuel: '<path d="M5 20V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v15"/><path d="M3 20h12"/><path d="M13 9h3l2 2v6a1.6 1.6 0 0 1-3.2 0V9"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/>',
    ruler: '<path d="M3 15l6-6 6 6-6 6z"/><path d="M6 12l1.5 1.5M8.5 9.5L10 11M11 7l1.5 1.5"/>',
    mountain: '<path d="M3 19l6-10 3.5 5.5L15 10l6 9z"/><path d="M12.5 9l1-1.6L15 10"/>',
    utensils: '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3"/><path d="M7 11v10"/><path d="M16 3c2 1 3 2.5 3 5s-1 3.5-2 4v9"/>',
    tent: '<path d="M12 4L3 20h18z"/><path d="M12 4v16"/>',
    wrench: '<path d="M15.5 4.5a4.5 4.5 0 0 0-5.9 5.9L4 16v4h4l5.6-5.6a4.5 4.5 0 0 0 5.9-5.9l-2.6 2.6-2.5-2.5z"/>',
    road: '<path d="M12 3v3M12 10v3M12 17v4"/><path d="M6 21l3-18M18 21l-3-18"/>',
    logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 8l-4 4 4 4M6 12h9"/>',
    edit: '<path d="M4 20h4l10-10-4-4L4 16z"/><path d="M14 6l4 4"/>',
    flag: '<path d="M6 21V4h12l-2 4 2 4H6"/>',
    sparkles: '<path d="M12 4l1.5 4L18 9.5 13.5 11 12 15l-1.5-4L6 9.5 10.5 8z"/><path d="M18 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
    lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V8a4 4 0 0 1 8 0v2"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5L12 13l8.5-6.5"/>'
  };

  const icon = (name, cls = '') =>
    `<span class="ico ${cls}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${PATHS[name] || PATHS.info}</svg></span>`;

  /** Zamienia <span data-ico="x"> na prawdziwe SVG (dla statycznego HTML-a). */
  function hydrateIcons(root = document) {
    root.querySelectorAll('[data-ico]').forEach(el => {
      const name = el.dataset.ico;
      if (!PATHS[name] || el.dataset.hydrated === '1') return;
      el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${PATHS[name]}</svg>`;
      el.dataset.hydrated = '1';
    });
  }

  /* -------------------------------------------------------- FORMATOWANIE */
  const fmt = {
    km: v => (v == null || isNaN(v) ? '—' : `${Number(v).toFixed(v < 10 ? 1 : 0)} km`),
    num: v => (v == null || isNaN(v) ? '—' : new Intl.NumberFormat('pl-PL').format(Math.round(v))),
    /** Liczba z polskim przecinkiem, np. 4,6 */
    dec: (v, digits = 1) => {
      if (v == null || isNaN(v)) return '—';
      return new Intl.NumberFormat('pl-PL', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v);
    },
    money: v => {
      if (v == null || isNaN(v)) return '—';
      const abs = Math.abs(Number(v));
      // Małe kwoty (koszt paliwa) potrzebują groszy, duże (ceny motocykli) nie
      const digits = abs < 100 ? 2 : 0;
      return `${new Intl.NumberFormat('pl-PL', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v)} zł`;
    },
    price: (min, max) => {
      if (min == null && max == null) return '—';
      const fmtPrice = v => new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 }).format(v || 0);
      if (min == null) return `do ${fmtPrice(max)} zł`;
      if (max == null) return `od ${fmtPrice(min)} zł`;
      return `${fmtPrice(min)}–${fmtPrice(max)} zł`;
    },
    duration(seconds) {
      if (!seconds || isNaN(seconds)) return '—';
      const h = Math.floor(seconds / 3600);
      const m = Math.round((seconds % 3600) / 60);
      if (h === 0) return `${m} min`;
      return `${h} h${m ? ` ${m} min` : ''}`;
    },
    date(value) {
      const d = value instanceof Date ? value : new Date(value);
      if (isNaN(d)) return '—';
      return new Intl.DateTimeFormat('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
    },
    dateTime(value) {
      const d = value instanceof Date ? value : new Date(value);
      if (isNaN(d)) return '—';
      return new Intl.DateTimeFormat('pl-PL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d);
    },
    timeAgo(value) {
      const d = value instanceof Date ? value : new Date(value);
      if (isNaN(d)) return '';
      const diff = (Date.now() - d.getTime()) / 1000;
      if (diff < 60) return 'właśnie teraz';
      if (diff < 3600) {
        const m = Math.round(diff / 60);
        return `${m} min temu`;
      }
      if (diff < 86400) {
        const h = Math.round(diff / 3600);
        return `${h} ${plural(h, 'godz.', 'godz.', 'godz.')} temu`;
      }
      if (diff < 7 * 86400) {
        const days = Math.round(diff / 86400);
        return `${days} ${plural(days, 'dzień', 'dni', 'dni')} temu`;
      }
      return fmt.date(d);
    },
    relativeFuture(days) {
      if (days <= 0) return 'dziś';
      if (days === 1) return 'jutro';
      const d = days;
      return `za ${d} ${plural(d, 'dzień', 'dni', 'dni')}`;
    }
  };

  /** Polska odmiana liczebników: plural(3, 'trasa', 'trasy', 'tras'). */
  function plural(n, one, few, many) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (n === 1) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
    return many;
  }

  const escapeHtml = (str = '') => String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);

  /** Skrót nazwy do awatara (np. „Bartek Świr” → „BŚ”). */
  function initials(name = '?') {
    const parts = String(name).trim().split(/\s+/).slice(0, 2);
    return parts.map(p => p[0] || '').join('').toUpperCase() || '?';
  }

  /** Deterministiczny kolor awatara z nazwy. */
  function avatarColor(name = '') {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 360;
    return `hsl(${hash} 68% 62%)`;
  }

  function avatar(name, size = '') {
    const cls = size ? ` avatar--${size}` : '';
    return `<span class="avatar${cls}" style="background:${avatarColor(name)}" title="${escapeHtml(name)}">${escapeHtml(initials(name))}</span>`;
  }

  /* ------------------------------------------------------------- TOASTY */
  function toast(title, text = '', kind = 'info', timeout = 5200) {
    const host = document.getElementById('toasts');
    if (!host) return;
    const el = document.createElement('div');
    el.className = `toast toast--${kind}`;
    el.innerHTML = `
      ${icon(kind === 'err' ? 'alert' : kind === 'ok' ? 'check' : kind === 'warn' ? 'alert' : 'info')}
      <span><strong>${escapeHtml(title)}</strong>${text ? escapeHtml(text) : ''}</span>`;
    host.appendChild(el);
    const remove = () => {
      el.classList.add('is-leaving');
      setTimeout(() => el.remove(), 260);
    };
    el.addEventListener('click', remove);
    setTimeout(remove, timeout);
  }

  /** Komunikaty błędów Firebase → po polsku. */
  function firebaseError(err) {
    const code = (err && err.code) || '';
    const map = {
      'auth/email-already-in-use': 'Ten email jest już zarejestrowany. Zaloguj się zamiast rejestrować.',
      'auth/invalid-email': 'Nieprawidłowy adres email.',
      'auth/weak-password': 'Hasło jest za słabe — minimum 6 znaków.',
      'auth/user-not-found': 'Nie ma takiego konta. Sprawdź email albo się zarejestruj.',
      'auth/wrong-password': 'Błędne hasło.',
      'auth/invalid-credential': 'Błędny email lub hasło.',
      'auth/invalid-login-credentials': 'Błędny email lub hasło.',
      'auth/too-many-requests': 'Zbyt wiele prób logowania. Odczekaj chwilę.',
      'auth/network-request-failed': 'Brak połączenia z serwerem logowania.',
      'auth/missing-password': 'Podaj hasło.',
      'permission-denied': 'Baza odrzuciła zapis (brak uprawnień). Sprawdź zasady Firestore.',
      'unavailable': 'Baza jest chwilowo niedostępna — zapisujemy lokalnie.',
      'failed-precondition': 'Baza wymaga indeksu lub migracji — zgłoś to administratorowi.'
    };
    if (map[code]) return map[code];
    return (err && err.message) || MSG.error;
  }

  /* -------------------------------------------------------------- MODALE */
  const openStack = [];

  function openModal(id) {
    const el = typeof id === 'string' ? document.getElementById(id) : id;
    if (!el) return;
    el.hidden = false;
    el.dataset.open = '1';
    document.body.classList.add('no-scroll');
    openStack.push(el);
    const focusable = el.querySelector('input:not([type=hidden]), select, textarea, button:not([data-close-modal])');
    if (focusable) setTimeout(() => focusable.focus(), 40);
    el._keyHandler = e => { if (e.key === 'Escape') closeModal(el); };
    document.addEventListener('keydown', el._keyHandler);
  }

  function closeModal(id) {
    const el = typeof id === 'string' ? document.getElementById(id) : id;
    if (!el || el.hidden) return;
    el.hidden = true;
    delete el.dataset.open;
    if (el._keyHandler) document.removeEventListener('keydown', el._keyHandler);
    const idx = openStack.indexOf(el);
    if (idx > -1) openStack.splice(idx, 1);
    if (!openStack.length) document.body.classList.remove('no-scroll');
  }

  function closeAllModals() { openStack.slice().forEach(closeModal); }

  /** Modal potwierdzenia zwracający Promise<boolean>. */
  function confirmDialog({ title = 'Potwierdź', text = '', okLabel = 'Potwierdź', danger = true } = {}) {
    return new Promise(resolve => {
      const modal = document.getElementById('confirmModal');
      modal.querySelector('#confirmTitle').textContent = title;
      modal.querySelector('#confirmText').textContent = text;
      const ok = modal.querySelector('#confirmOk');
      const cancel = modal.querySelector('#confirmCancel');
      ok.textContent = okLabel;
      ok.className = `btn ${danger ? 'btn-danger-solid' : 'btn-primary'}`;

      const done = value => {
        ok.removeEventListener('click', onOk);
        cancel.removeEventListener('click', onCancel);
        closeModal(modal);
        resolve(value);
      };
      const onOk = () => done(true);
      const onCancel = () => done(false);
      ok.addEventListener('click', onOk);
      cancel.addEventListener('click', onCancel);
      openModal(modal);
    });
  }

  /* ------------------------------------------------------------- SCHOWEK */
  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (e) {
      return false;
    }
  }

  /* -------------------------------------------------------- STANY PRZYCISKÓW */
  function setLoading(btn, loading, labelWhenLoading = 'Chwila…') {
    if (!btn) return;
    if (loading) {
      btn.dataset.originalHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner"></span> ${escapeHtml(labelWhenLoading)}`;
    } else {
      btn.disabled = false;
      if (btn.dataset.originalHtml) {
        btn.innerHTML = btn.dataset.originalHtml;
        delete btn.dataset.originalHtml;
      }
    }
  }

  /* ---------------------------------------------------------------- MOTYW */
  const THEME_KEY = `${APP.storagePrefix}theme`;

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    const btn = document.getElementById('themeToggle');
    if (btn) {
      btn.innerHTML = `${icon(theme === 'dark' ? 'sun' : 'moon')}<span class="sr-only">Zmień motyw</span>`;
      btn.title = theme === 'dark' ? 'Motyw jasny' : 'Motyw ciemny';
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0b0d0c' : '#f4f6f3');
  }

  function initTheme() {
    let theme = null;
    try { theme = localStorage.getItem(THEME_KEY); } catch (e) { /* prywatny tryb */ }
    if (!theme) {
      theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    applyTheme(theme);
    const btn = document.getElementById('themeToggle');
    if (btn) {
      btn.addEventListener('click', () => {
        const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* ignore */ }
      });
    }
  }

  /* ----------------------------------------------- NAWIGACJA I CHROM UI */
  function initChrome() {
    const toggle = document.getElementById('menuToggle');
    const nav = document.getElementById('siteNav');
    if (toggle && nav) {
      toggle.addEventListener('click', () => {
        const open = nav.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', String(open));
        toggle.innerHTML = `${icon(open ? 'close' : 'menu')}<span class="sr-only">Menu</span>`;
      });
      nav.addEventListener('click', e => {
        if (e.target.closest('a')) {
          nav.classList.remove('is-open');
          toggle.setAttribute('aria-expanded', 'false');
        }
      });
    }

    const progress = document.getElementById('scrollProgress');
    if (progress) {
      const update = () => {
        const h = document.documentElement.scrollHeight - window.innerHeight;
        progress.style.width = `${h > 0 ? Math.min(100, (window.scrollY / h) * 100) : 0}%`;
      };
      window.addEventListener('scroll', update, { passive: true });
      window.addEventListener('resize', update);
      update();
    }

    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => closeModal(btn.closest('.modal-overlay')));
    });
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('mousedown', e => {
        if (e.target === overlay) closeModal(overlay);
      });
    });

    document.querySelectorAll('[data-toggle-password]').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = document.getElementById(btn.dataset.togglePassword);
        if (!input) return;
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.innerHTML = icon(show ? 'lock' : 'eye') + '<span class="sr-only">Pokaż hasło</span>';
      });
    });

    const year = document.getElementById('year');
    if (year) year.textContent = new Date().getFullYear();
  }

  /* -------------------------------------------------- LINKI / NAWIGACJA HASH */
  function navigate(hash) {
    if (location.hash === hash) {
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    } else {
      location.hash = hash;
    }
  }

  return {
    icon, hydrateIcons,
    fmt, plural, escapeHtml, initials, avatarColor, avatar,
    toast, firebaseError,
    openModal, closeModal, closeAllModals, confirmDialog,
    copyText, setLoading,
    initTheme, applyTheme, initChrome, navigate
  };
})();
