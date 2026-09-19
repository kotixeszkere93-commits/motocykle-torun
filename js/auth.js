/* =========================================================================
   auth.js — logowanie, rejestracja, reset hasła, menu użytkownika
   i widok profilu z podsumowaniem dorobku.
   ========================================================================= */

const Auth = (() => {
  'use strict';

  let activeTab = 'login';
  let menuOpen = false;

  const COPY = {
    login: { submit: 'Zaloguj się', hint: 'Konto nie jest wymagane, by planować trasy — ale potrzebne, aby publikować i zbierać punkty.' },
    register: { submit: 'Utwórz konto', hint: 'Rejestracja jest darmowa i zajmuje 20 sekund. Twój motocykl pojawi się w rankingu.' },
    reset: { submit: 'Wyślij link do zmiany hasła', hint: 'Wyślemy link na podany email — sprawdź też folder spam.' }
  };

  /* ------------------------------------------------------------- INICJACJA */
  function init() {
    document.addEventListener('click', e => {
      const opener = e.target.closest('[data-action="open-auth"]');
      if (opener) {
        e.preventDefault();
        open(opener.dataset.tab || 'login');
      }
    });

    document.querySelectorAll('[data-auth-tab]').forEach(tab => {
      tab.addEventListener('click', () => setTab(tab.dataset.authTab));
    });

    document.getElementById('authForm')?.addEventListener('submit', onSubmit);
    document.getElementById('authEmail')?.addEventListener('input', () => clearError('authEmail'));

    Store.onAuth(({ user, profile }) => {
      renderArea();
      renderProfile();
      if (user && profile) {
        document.querySelectorAll('[data-auth-only]').forEach(el => el.classList.remove('is-hidden'));
      }
    });

    document.addEventListener('click', e => {
      if (menuOpen && !e.target.closest('#userMenu') && !e.target.closest('#userChip')) {
        closeMenu();
      }
    });

    setTab('login');
  }

  function open(tab = 'login') {
    setTab(tab);
    document.getElementById('authMessage').textContent = '';
    UI.openModal('authModal');
  }

  function setTab(tab) {
    activeTab = COPY[tab] ? tab : 'login';
    document.querySelectorAll('[data-auth-tab]').forEach(t => {
      const on = t.dataset.authTab === activeTab;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', String(on));
    });
    document.querySelectorAll('#authForm [data-pane]').forEach(pane => {
      const keys = pane.dataset.pane.split(' ');
      pane.classList.toggle('is-hidden', !keys.includes(activeTab));
    });
    const submit = document.getElementById('authSubmit');
    if (submit) submit.textContent = COPY[activeTab].submit;
    const hint = document.getElementById('authModeHint');
    if (hint) {
      hint.textContent = `${COPY[activeTab].hint} ${Store.isCloud ? '' : 'Uwaga: pracujemy w trybie lokalnym — konto istnieje tylko w tej przeglądarce.'}`.trim();
    }
    const pw = document.getElementById('authPassword');
    if (pw) pw.autocomplete = activeTab === 'register' ? 'new-password' : 'current-password';
  }

  /* --------------------------------------------------------------- WALIDACJA */
  function setError(id, message) {
    const el = document.getElementById(id);
    const err = document.querySelector(`[data-error-for="${id}"]`);
    if (el) el.classList.toggle('is-invalid', Boolean(message));
    if (err) err.textContent = message || '';
    return !message;
  }

  function clearError(id) { setError(id, ''); }

  function validate() {
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    let ok = true;

    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) {
      ok = setError('authEmail', 'Podaj poprawny adres email.') && ok;
    } else {
      clearError('authEmail');
    }

    if (activeTab !== 'reset') {
      if (password.length < 6) ok = setError('authPassword', 'Hasło musi mieć minimum 6 znaków.') && ok;
      else clearError('authPassword');
    }

    if (activeTab === 'register') {
      const name = document.getElementById('authName').value.trim();
      if (name.length < 3) ok = setError('authName', 'Podaj imię albo ksywkę (min. 3 znaki).') && ok;
      else clearError('authName');

      const terms = document.getElementById('authTerms').checked;
      if (!terms) ok = setError('authTerms', 'Potwierdź, że akceptujesz zasady ekipy.') && ok;
      else clearError('authTerms');
    }
    return ok;
  }

  /* ------------------------------------------------------------------ WYSYŁKA */
  async function onSubmit(e) {
    e.preventDefault();
    const msg = document.getElementById('authMessage');
    const btn = document.getElementById('authSubmit');
    if (!validate()) {
      msg.className = 'message err';
      msg.textContent = 'Popraw zaznaczone pola.';
      return;
    }

    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    const name = document.getElementById('authName').value.trim();
    const bike = document.getElementById('authBike').value.trim();

    UI.setLoading(btn, true, 'Chwila…');
    try {
      if (activeTab === 'login') {
        await Store.login({ email, password });
        msg.className = 'message ok';
        msg.textContent = 'Zalogowano. Jedziemy!';
        UI.toast('Witaj z powrotem!', 'Miłego planowania trasy.', 'ok');
        setTimeout(() => { UI.closeModal('authModal'); document.getElementById('authForm').reset(); }, 600);
      } else if (activeTab === 'register') {
        await Store.register({ email, password, name, bike: bike || 'Motocykl w planach' });
        msg.className = 'message ok';
        msg.textContent = 'Konto utworzone. Witaj w ekipie!';
        UI.toast('Witaj w Moto Świrach!', `Twoje konto: ${name}. Zaplanuj pierwszą trasę i zdobądź ${POINTS.route} pkt.`, 'ok', 7000);
        setTimeout(() => { UI.closeModal('authModal'); document.getElementById('authForm').reset(); location.hash = '#/planer'; }, 900);
      } else {
        await Store.resetPassword(email);
        msg.className = 'message ok';
        msg.textContent = 'Link do zmiany hasła wysłany — sprawdź skrzynkę.';
      }
    } catch (err) {
      msg.className = 'message err';
      msg.textContent = UI.firebaseError(err);
    } finally {
      UI.setLoading(btn, false);
    }
  }

  /* -------------------------------------------------------- PASEK UŻYTKOWNIKA */
  function renderArea() {
    const host = document.getElementById('authArea');
    if (!host) return;
    const user = Store.user;
    const profile = Store.profile;

    if (!user) {
      host.innerHTML = `
        <button class="btn btn-primary" type="button" data-action="open-auth">
          ${UI.icon('user')}
          <span class="hide-xs">Zaloguj / Zarejestruj</span><span class="hide-sm-up">Konto</span>
        </button>`;
      UI.hydrateIcons(host);
      return;
    }

    const name = profile?.name || user.email;
    const score = Number(profile?.score) || 0;
    host.innerHTML = `
      <button class="user-chip" type="button" id="userChip" aria-haspopup="true" aria-expanded="false">
        ${UI.avatar(name, 'sm')}
        <span class="user-chip-text">
          <strong>${UI.escapeHtml(name.split(' ')[0])}</strong>
          <span>${score} pkt</span>
        </span>
      </button>`;
    UI.hydrateIcons(host);

    host.querySelector('#userChip')?.addEventListener('click', toggleMenu);
    renderMenu(name, profile);
  }

  function renderMenu(name, profile) {
    closeMenu();
    const host = document.getElementById('authArea');
    const menu = document.createElement('div');
    menu.className = 'user-menu';
    menu.id = 'userMenu';
    menu.innerHTML = `
      <div class="user-menu-head">
        <strong>${UI.escapeHtml(name)}</strong>
        <span>${UI.escapeHtml(profile?.bike || 'Motocykl nieustalony')} · ${Number(profile?.score) || 0} pkt</span>
      </div>
      <hr>
      <a href="#/profil">${UI.icon('user')} Mój profil</a>
      <a href="#/planer">${UI.icon('route')} Zaplanuj trasę</a>
      <a href="#/ranking">${UI.icon('trophy')} Ranking</a>
      <a href="#/garaz">${UI.icon('bike')} Mój motocykl</a>
      <hr>
      <button type="button" data-menu-action="logout">${UI.icon('logout')} Wyloguj się</button>`;
    host.appendChild(menu);
    UI.hydrateIcons(menu);

    menu.querySelector('[data-menu-action="logout"]').addEventListener('click', async () => {
      closeMenu();
      await Store.logout();
      UI.toast('Wylogowano', 'Do zobaczenia na trasie!', 'info');
      if (location.hash.startsWith('#/profil')) location.hash = '#/';
    });
    menu.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
  }

  function toggleMenu() {
    if (menuOpen) return closeMenu();
    menuOpen = true;
    document.getElementById('userMenu')?.classList.add('is-open');
    document.getElementById('userChip')?.setAttribute('aria-expanded', 'true');
  }

  function closeMenu() {
    menuOpen = false;
    document.getElementById('userMenu')?.remove();
    document.getElementById('userChip')?.setAttribute('aria-expanded', 'false');
  }

  /* ----------------------------------------------------------------- PROFIL */
  function renderProfile() {
    const host = document.getElementById('profilePanel');
    if (!host) return;

    if (!Store.hasAccount) {
      host.innerHTML = `<div class="empty-state">
        ${UI.icon('lock')}
        <h3>Nie jesteś zalogowany</h3>
        <p>Zaloguj się, aby zobaczyć swój profil, punkty i statystyki.</p>
        <button class="btn btn-primary" type="button" data-action="open-auth">Zaloguj / Zarejestruj</button>
      </div>`;
      UI.hydrateIcons(host);
      return;
    }

    const me = Store.profile || {};
    const myRoutes = Store.routes.filter(r => r.authorId === Store.user.uid);
    const joined = Store.routes.filter(r => (r.participants || []).some(p => p.userId === Store.user.uid));
    const km = myRoutes.reduce((sum, r) => sum + (Number(r.distanceKm) || 0), 0);
    const suggestions = Store.routes.reduce((sum, r) => sum + (r.suggestions || []).filter(s => s.userId === Store.user.uid).length, 0);
    const badges = BADGES.filter(b => b.test({
      routes: myRoutes.length,
      joins: joined.length,
      km,
      gravel: myRoutes.filter(r => r.surface === 'szuter' || r.difficulty === 'trudna').length,
      score: Number(me.score) || 0,
      suggestions
    }));
    const bike = Store.getMyBike();

    host.innerHTML = `
      <div class="profile-head">
        ${UI.avatar(me.name || Store.user.email, 'lg')}
        <div>
          <h2>${UI.escapeHtml(me.name || Store.user.email)}</h2>
          <p class="muted">${UI.escapeHtml(me.bike || bike?.model || 'Motocykl w planach')} · ${UI.escapeHtml(Store.user.email)}</p>
        </div>
        <div class="mt-md row gap-sm row-wrap">
          <button class="btn btn-outline" type="button" id="editProfileBtn">${UI.icon('edit')} Edytuj dane</button>
          <a class="btn btn-primary" href="#/planer">${UI.icon('route')} Nowa trasa</a>
        </div>
      </div>

      <div class="profile-stats">
        <div class="metric-card"><span class="metric-label">Punkty</span><span class="metric-value">${Number(me.score) || 0}</span></div>
        <div class="metric-card"><span class="metric-label">Opublikowane trasy</span><span class="metric-value">${myRoutes.length}</span></div>
        <div class="metric-card"><span class="metric-label">Wyjazdy w ekipie</span><span class="metric-value">${joined.length}</span></div>
        <div class="metric-card"><span class="metric-label">Zaplanowane km</span><span class="metric-value">${UI.fmt.num(km)}</span></div>
        <div class="metric-card"><span class="metric-label">Odznaki</span><span class="metric-value">${badges.length} / ${BADGES.length}</span></div>
      </div>

      <div class="grid grid-2">
        <div class="card">
          <h2 class="card-title">${UI.icon('trophy')} Odznaki</h2>
          ${badges.length
            ? `<div class="chips">${badges.map(b => `<span class="badge badge--ride" title="${UI.escapeHtml(b.desc)}">${UI.icon(b.icon)} ${UI.escapeHtml(b.name)}</span>`).join('')}</div>`
            : '<p class="muted small">Jeszcze nic tu nie ma. Opublikuj trasę i zdobądź pierwszą odznakę.</p>'}
          <div class="chips mt-md">
            ${BADGES.filter(b => !badges.includes(b))
              .slice(0, 5)
              .map(b => `<span class="badge" title="${UI.escapeHtml(b.desc)}">${UI.icon('lock')} ${UI.escapeHtml(b.name)}</span>`).join('')}
          </div>
        </div>

        <div class="card">
          <h2 class="card-title">${UI.icon('route')} Moje trasy (${myRoutes.length})</h2>
          ${myRoutes.length
            ? `<div class="stack gap-sm">${myRoutes.slice(0, 6).map(r => `
                <a class="chip" href="#/trasa/${r.id}" style="justify-content:space-between;width:100%">
                  <span>${UI.escapeHtml(r.title)}</span>
                  <span class="muted small">${UI.fmt.km(r.distanceKm)}</span>
                </a>`).join('')}</div>`
            : `<p class="muted small">Nie masz jeszcze tras. Zaplanuj pierwszą — to zajmuje minutę.</p>
               <a class="btn btn-primary btn-block mt-md" href="#/planer">${UI.icon('route')} Zaplanuj trasę</a>`}
        </div>
      </div>`;

    UI.hydrateIcons(host);
    host.querySelector('#editProfileBtn')?.addEventListener('click', openEditProfile);
  }

  function openEditProfile() {
    const me = Store.profile || {};
    const modal = document.getElementById('profileModal');
    if (!modal) return;
    modal.querySelector('#profileName').value = me.name || '';
    modal.querySelector('#profileBike').value = me.bike || '';
    UI.openModal(modal);
  }

  function bindProfileModal() {
    const modal = document.getElementById('profileModal');
    const form = modal?.querySelector('#profileForm');
    form?.addEventListener('submit', async e => {
      e.preventDefault();
      const name = modal.querySelector('#profileName').value.trim();
      const bike = modal.querySelector('#profileBike').value.trim();
      if (name.length < 3) {
        UI.toast('Imię jest za krótkie', 'Podaj co najmniej 3 znaki.', 'warn');
        return;
      }
      const btn = modal.querySelector('#profileSubmit');
      UI.setLoading(btn, true, 'Zapisuję…');
      try {
        await Store.updateProfile({ name, bike });
        UI.toast('Profil zaktualizowany', 'Zmiany widoczne od razu w rankingu.', 'ok');
        UI.closeModal(modal);
        renderArea();
        renderProfile();
      } catch (err) {
        UI.toast('Nie udało się zapisać', UI.firebaseError(err), 'err');
      } finally {
        UI.setLoading(btn, false);
      }
    });
  }

  return { init, open, setTab, renderArea, renderProfile, bindProfileModal };
})();
