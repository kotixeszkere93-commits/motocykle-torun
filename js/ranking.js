/* =========================================================================
   ranking.js — tabela Moto Świrów, podium, odznaki i statystyki miesiąca.
   Wszystkie liczby liczymy z tras (autorzy, ekipa, propozycje, km),
   dzięki czemu ranking działa nawet bez odczytu kolekcji użytkowników.
   ========================================================================= */

const Ranking = (() => {
  'use strict';

  let cache = [];

  function init() {
    Store.onUsers(() => render());
    Store.onRoutes(() => render());
    document.querySelector('[data-action="points-info"]')?.addEventListener('click', showPointsInfo);
  }

  /* --------------------------------------------------------- AGREGACJE */
  function aggregates() {
    const byUser = new Map();

    const ensure = (id, seed = {}) => {
      if (!byUser.has(id)) {
        byUser.set(id, {
          id,
          name: seed.name || 'Motocyklista',
          bike: seed.bike || '—',
          score: Number(seed.score) || 0,
          routesCount: 0,
          km: 0,
          gravel: 0,
          joins: 0,
          suggestions: 0,
          comments: 0,
          lastActivity: 0
        });
      } else if (seed.name && byUser.get(id).name === 'Motocyklista') {
        const entry = byUser.get(id);
        entry.name = seed.name;
        entry.bike = seed.bike || entry.bike;
      }
      return byUser.get(id);
    };

    Store.users.forEach(u => ensure(u.id, u));

    Store.routes.forEach(route => {
      const created = Store.toMillis(route.createdAt);
      if (route.authorId) {
        const author = ensure(route.authorId, { name: route.authorName, bike: route.authorBike });
        author.routesCount += 1;
        author.km += Number(route.distanceKm) || 0;
        if (route.surface === 'szuter' || route.difficulty === 'trudna') author.gravel += 1;
        author.lastActivity = Math.max(author.lastActivity, created);
      }
      (route.participants || []).forEach(p => {
        const user = ensure(p.userId, { name: p.name, bike: p.bike });
        user.joins += 1;
        user.lastActivity = Math.max(user.lastActivity, created);
      });
      (route.suggestions || []).forEach(s => {
        ensure(s.userId, { name: s.authorName }).suggestions += 1;
      });
      (route.comments || []).forEach(c => {
        ensure(c.userId, { name: c.authorName }).comments += 1;
      });
    });

    // Punkty: z profilu jeśli dostępne, inaczej szacunek z wkładu
    byUser.forEach(u => {
      const estimated = u.routesCount * POINTS.route + u.joins * POINTS.join
        + u.suggestions * POINTS.suggestion + u.comments * POINTS.comment;
      u.estimatedScore = estimated;
      if (!u.score) u.score = estimated;
      u.score = Math.max(u.score, estimated);
      u.badges = BADGES.filter(b => b.test({ ...u, score: u.score }));
    });

    return Array.from(byUser.values()).sort((a, b) => b.score - a.score || b.km - a.km);
  }

  /* ------------------------------------------------------------ RENDER */
  function render() {
    if (!Store.state.routesReady && !Store.users.length) return;
    cache = aggregates();
    renderPodium();
    renderTable();
    renderMyStats();
    renderMonth();
    renderBadgeLegend();
  }

  function renderPodium() {
    const host = document.getElementById('podium');
    if (!host) return;
    const top = cache.slice(0, 3);
    if (!top.length) {
      host.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
        ${UI.icon('trophy')}
        <h3>Ranking jest jeszcze pusty</h3>
        <p>Opublikuj pierwszą trasę, żeby wskoczyć na podium.</p>
        <a class="btn btn-primary" href="#/planer">Zaplanuj trasę</a>
      </div>`;
      UI.hydrateIcons(host);
      return;
    }
    host.innerHTML = top.map((u, i) => `
      <div class="podium-item podium-item--${i + 1}">
        <div class="podium-place">${i + 1}</div>
        ${UI.avatar(u.name, 'lg')}
        <div class="podium-name">${UI.escapeHtml(u.name)}${Store.user && u.id === Store.user.uid ? ' <span class="badge badge--ride">Ty</span>' : ''}</div>
        <div class="podium-bike">${UI.escapeHtml(u.bike)}</div>
        <div class="podium-score">${u.score} pkt</div>
        <div class="muted small">${u.routesCount} ${UI.plural(u.routesCount, 'trasa', 'trasy', 'tras')} · ${UI.fmt.km(u.km)}</div>
      </div>`).join('');
    UI.hydrateIcons(host);
  }

  function renderTable() {
    const body = document.getElementById('rankingBody');
    const count = document.getElementById('rankCount');
    if (!body) return;
    if (count) count.textContent = cache.length ? `${cache.length}` : '—';

    if (!cache.length) {
      body.innerHTML = '<tr><td colspan="7" class="muted">Brak danych — bądź pierwszy w rankingu.</td></tr>';
      return;
    }

    const medals = ['🥇', '🥈', '🥉'];
    body.innerHTML = cache.slice(0, 50).map((u, i) => {
      const me = Store.user && u.id === Store.user.uid;
      return `<tr class="${me ? 'is-me' : ''}">
        <td><span class="rank-cell"><span class="rank-medal">${medals[i] || ''}</span>${i + 1}</span></td>
        <td><span class="rank-cell">${UI.avatar(u.name, 'sm')} ${UI.escapeHtml(u.name)}${me ? ' <span class="muted small">(Ty)</span>' : ''}</span></td>
        <td class="muted">${UI.escapeHtml(u.bike)}</td>
        <td>${u.routesCount}</td>
        <td>${u.joins}</td>
        <td><strong>${u.score}</strong></td>
        <td>
          <span class="chips">
            ${u.badges.slice(0, 3).map(b => `<span class="badge" title="${UI.escapeHtml(b.desc)}">${UI.icon(b.icon)} ${UI.escapeHtml(b.name)}</span>`).join('')}
            ${u.badges.length > 3 ? `<span class="badge">+${u.badges.length - 3}</span>` : ''}
          </span>
        </td>
      </tr>`;
    }).join('');
    UI.hydrateIcons(body);
  }

  function renderMyStats() {
    const rankEl = document.getElementById('myRank');
    const scoreEl = document.getElementById('myScore');
    const gapEl = document.getElementById('myGap');
    if (!rankEl) return;

    if (!Store.hasAccount) {
      rankEl.textContent = '—';
      scoreEl.textContent = '—';
      gapEl.textContent = '—';
      return;
    }
    const index = cache.findIndex(u => u.id === Store.user.uid);
    const me = index > -1 ? cache[index] : null;
    const myScore = me ? me.score : (Number(Store.profile?.score) || 0);

    rankEl.textContent = index > -1 ? `#${index + 1}` : 'poza tabelą';
    scoreEl.textContent = `${myScore} pkt`;

    if (index <= 0) {
      gapEl.textContent = index === 0 ? 'Jesteś liderem 🏆' : 'Zbieraj punkty';
    } else {
      const above = cache[index - 1];
      gapEl.textContent = `${Math.max(1, above.score - myScore + 1)} pkt`;
    }
  }

  function renderMonth() {
    const host = document.getElementById('monthStats');
    if (!host) return;
    const since = Date.now() - 30 * 86400_000;
    const recent = Store.routes.filter(r => Store.toMillis(r.createdAt) >= since);
    const km = recent.reduce((sum, r) => sum + (Number(r.distanceKm) || 0), 0);
    const riders = new Set();
    recent.forEach(r => {
      if (r.authorId) riders.add(r.authorId);
      (r.participants || []).forEach(p => riders.add(p.userId));
    });

    host.innerHTML = `
      <div class="metric"><span class="metric-label">Nowe trasy (30 dni)</span><span class="metric-value">${recent.length}</span></div>
      <div class="metric"><span class="metric-label">Zaplanowane km</span><span class="metric-value">${UI.fmt.num(km)}</span></div>
      <div class="metric"><span class="metric-label">Aktywni motocykliści</span><span class="metric-value">${riders.size}</span></div>
      <div class="metric"><span class="metric-label">Średnia długość trasy</span><span class="metric-value">${recent.length ? UI.fmt.km(km / recent.length) : '—'}</span></div>`;
  }

  function renderBadgeLegend() {
    const host = document.getElementById('badgeLegend');
    if (!host) return;
    const mine = Store.user ? cache.find(u => u.id === Store.user.uid) : null;
    const earned = new Set((mine?.badges || []).map(b => b.id));

    host.innerHTML = BADGES.map(b => `
      <li>
        <span class="${earned.has(b.id) ? 'badge-earned' : ''}">${UI.icon(b.icon)}</span>
        <span>
          <strong>${UI.escapeHtml(b.name)} ${earned.has(b.id) ? '<span class="badge badge--ride">zdobyta</span>' : ''}</strong>
          <span>${UI.escapeHtml(b.desc)}</span>
        </span>
      </li>`).join('');
    UI.hydrateIcons(host);
  }

  /* ----------------------------------------------------------- PUNKTY HELP */
  function showPointsInfo() {
    UI.toast(
      'Punktacja Moto Świrów',
      `Trasa: +${POINTS.route} pkt · Udział w wyjeździe: +${POINTS.join} pkt · Propozycja zmiany: +${POINTS.suggestion} pkt · Komentarz: +${POINTS.comment} pkt. Odznaki zdobywasz za wkład i kilometraż.`,
      'info',
      9000
    );
  }

  return { init, render, get list() { return cache; } };
})();
