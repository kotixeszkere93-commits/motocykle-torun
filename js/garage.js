/* =========================================================================
   garage.js — katalog motocykli: filtry, porównywarka, „mój motocykl”
   z kalkulatorem kosztu paliwa. Dane z data/motorcycles.json + fallback.
   ========================================================================= */

const Garage = (() => {
  'use strict';

  const CATEGORY = {
    adventure: 'Adventure',
    turystyczny: 'Turystyczny',
    naked: 'Naked',
    sportowy: 'Sportowy',
    cruiser: 'Cruiser',
    dual: 'Dual sport / enduro',
    enduro: 'Enduro',
    klasyk: 'Klasyk / retro',
    '125': '125 cm³',
    skuter: 'Skuter'
  };

  const LICENSE_RANK = { A1: 1, A2: 2, A: 3 };

  const filters = { q: '', category: '', license: '', sort: 'popular' };
  const compare = [];
  let bikes = [];
  let meta = {};

  /** Minimalny zestaw, gdy plik JSON jest niedostępny (np. file://). */
  const FALLBACK = [
    { brand: 'Honda', model: 'Africa Twin CRF1000L', category: 'adventure', license: 'A', cc: 998, power: 95, weight: 232, consumption: 5.4, tank: 18.8, years: '2016–2019', price: { min: 42000, max: 62000 }, desc: 'Kultowa wyprawówka z oponami 21/18.' },
    { brand: 'Yamaha', model: 'Ténéré 700', category: 'adventure', license: 'A', cc: 689, power: 73, weight: 204, consumption: 4.6, tank: 16, years: '2019–2025', price: { min: 38000, max: 52000 }, desc: 'Lekka i prosta — świetna w terenie.' },
    { brand: 'KTM', model: '790 Adventure', category: 'adventure', license: 'A', cc: 799, power: 95, weight: 189, consumption: 4.7, tank: 20, years: '2019–2021', price: { min: 34000, max: 48000 }, desc: 'Nisko położony bak, świetne prowadzenie.' },
    { brand: 'Suzuki', model: 'V-Strom 650', category: 'adventure', license: 'A', cc: 645, power: 70, weight: 213, consumption: 4.4, tank: 20, years: '2004–2023', price: { min: 14000, max: 34000 }, desc: 'Niezawodny i tani w utrzymaniu.' },
    { brand: 'Honda', model: 'CB500X', category: 'adventure', license: 'A2', cc: 471, power: 47, weight: 197, consumption: 4.0, tank: 17.5, years: '2019–2024', price: { min: 23000, max: 36000 }, desc: 'Świetny na pierwszy motocykl.' },
    { brand: 'BMW', model: 'R 1250 GS Adventure', category: 'adventure', license: 'A', cc: 1254, power: 136, weight: 268, consumption: 5.4, tank: 30, years: '2019–2025', price: { min: 65000, max: 105000 }, desc: 'Wzorzec wyprawówki z 30-litrowym bakiem.' },
    { brand: 'Yamaha', model: 'MT-07', category: 'naked', license: 'A2', cc: 689, power: 73, weight: 184, consumption: 4.3, tank: 13, years: '2014–2025', price: { min: 24000, max: 40000 }, desc: 'Fun-to-ride w klasie średniej.' },
    { brand: 'Royal Enfield', model: 'Himalayan 411', category: 'dual', license: 'A2', cc: 411, power: 25, weight: 199, consumption: 3.5, tank: 15, years: '2018–2024', price: { min: 14000, max: 21000 }, desc: 'Tani, prosty, zaskakująco dobry w terenie.' }
  ];

  /* ------------------------------------------------------------- INICJACJA */
  async function init() {
    bindFilters();
    bindCompare();
    bindBikeModal();

    try {
      const res = await fetch('data/motorcycles.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error('http ' + res.status);
      const data = await res.json();
      bikes = Array.isArray(data.bikes) ? data.bikes : flatLegacy(data);
      meta = data.meta || {};
    } catch (e) {
      console.warn('[Moto Świry] Katalog z pliku niedostępny:', e.message);
      bikes = FALLBACK;
      meta = { note: 'Wersja skrócona katalogu (offline).' };
    }

    bikes = bikes.map(b => ({ ...b, id: `${b.brand}-${b.model}`.replace(/\s+/g, '-').toLowerCase() }));
    fillCategoryOptions();
    fillDatalist();
    render();
    renderMyBike();
  }

  /** Obsługa starego formatu danych (marka → rocznik → modele). */
  function flatLegacy(data) {
    const out = [];
    Object.entries(data).forEach(([brand, years]) => {
      Object.entries(years).forEach(([year, models]) => {
        models.forEach(m => out.push({
          brand,
          model: m.model,
          category: 'adventure',
          license: 'A',
          cc: 0,
          power: 0,
          weight: 0,
          consumption: PLANNER.consumptionDefault,
          tank: 17,
          years: year,
          price: { min: m.price?.min, max: m.price?.max },
          desc: 'Widełki cenowe z katalogu.'
        }));
      });
    });
    return out;
  }

  function fillCategoryOptions() {
    const select = document.getElementById('bikeCategory');
    if (!select) return;
    const used = Array.from(new Set(bikes.map(b => b.category))).sort();
    select.innerHTML = '<option value="">Każda kategoria</option>' +
      used.map(c => `<option value="${c}">${UI.escapeHtml(CATEGORY[c] || c)}</option>`).join('');
  }

  function fillDatalist() {
    const dl = document.getElementById('bikeOptions');
    if (!dl) return;
    dl.innerHTML = bikes.map(b => `<option value="${UI.escapeHtml(`${b.brand} ${b.model}`)}"></option>`).join('');
  }

  /* ---------------------------------------------------------------- FILTRY */
  function bindFilters() {
    const q = document.getElementById('bikeSearch');
    const category = document.getElementById('bikeCategory');
    const license = document.getElementById('bikeLicense');
    const sort = document.getElementById('bikeSort');
    const clear = document.getElementById('bikeClearFilters');

    let timer = null;
    q?.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => { filters.q = q.value.trim().toLowerCase(); render(); }, 180);
    });
    category?.addEventListener('change', () => { filters.category = category.value; render(); });
    license?.addEventListener('change', () => { filters.license = license.value; render(); });
    sort?.addEventListener('change', () => { filters.sort = sort.value; render(); });

    clear?.addEventListener('click', () => {
      Object.assign(filters, { q: '', category: '', license: '', sort: 'popular' });
      if (q) q.value = '';
      if (category) category.value = '';
      if (license) license.value = '';
      if (sort) sort.value = 'popular';
      render();
    });
  }

  function applyFilters() {
    let list = bikes.slice();
    if (filters.q) {
      const q = filters.q;
      list = list.filter(b =>
        `${b.brand} ${b.model}`.toLowerCase().includes(q) ||
        (CATEGORY[b.category] || '').toLowerCase().includes(q) ||
        (b.desc || '').toLowerCase().includes(q));
    }
    if (filters.category) list = list.filter(b => b.category === filters.category);
    if (filters.license) {
      const want = LICENSE_RANK[filters.license] || 3;
      list = list.filter(b => (LICENSE_RANK[b.license] || 3) <= want);
    }

    const sorters = {
      popular: null,
      priceAsc: (a, b) => (a.price?.min || 0) - (b.price?.min || 0),
      priceDesc: (a, b) => (b.price?.max || 0) - (a.price?.max || 0),
      ccDesc: (a, b) => (b.cc || 0) - (a.cc || 0),
      powerDesc: (a, b) => (b.power || 0) - (a.power || 0),
      weightAsc: (a, b) => (a.weight || 999) - (b.weight || 999)
    };
    const sorter = sorters[filters.sort];
    return sorter ? list.sort(sorter) : list;
  }

  /* ---------------------------------------------------------------- RENDER */
  function render() {
    const grid = document.getElementById('bikeGrid');
    const count = document.getElementById('bikesCount');
    if (!grid) return;

    const list = applyFilters();
    if (count) {
      count.textContent = list.length === bikes.length
        ? `${bikes.length} ${UI.plural(bikes.length, 'model', 'modele', 'modeli')} w katalogu`
        : `${list.length} z ${bikes.length} modeli po filtrach`;
    }

    if (!list.length) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
        ${UI.icon('search')}
        <h3>Brak modeli dla tych filtrów</h3>
        <p>Spróbuj innej marki, kategorii albo wyczyść filtry.</p>
        <button class="btn btn-outline" type="button" id="bikeEmptyClear">Wyczyść filtry</button>
      </div>`;
      grid.querySelector('#bikeEmptyClear')?.addEventListener('click', () => document.getElementById('bikeClearFilters')?.click());
      UI.hydrateIcons(grid);
      return;
    }

    grid.innerHTML = list.map(card).join('');
    UI.hydrateIcons(grid);

    grid.querySelectorAll('[data-set-bike]').forEach(btn => {
      btn.addEventListener('click', () => openBikeModal(btn.dataset.setBike));
    });
    grid.querySelectorAll('[data-compare]').forEach(box => {
      box.addEventListener('change', () => toggleCompare(box.dataset.compare, box.checked));
    });
  }

  function card(b) {
    const price = UI.fmt.price(b.price?.min, b.price?.max);
    const avg = b.price?.min && b.price?.max ? (b.price.min + b.price.max) / 2 : null;
    const myBike = Store.getMyBike();
    const isMine = myBike && myBike.id === b.id;
    const inCompare = compare.includes(b.id);
    const electric = !b.consumption;

    return `<article class="card bike-card" id="bike-${b.id}">
      <div class="bike-card-head">
        <div>
          <div class="bike-brand">${UI.escapeHtml(b.brand)}</div>
          <div class="bike-name">${UI.escapeHtml(b.model)}</div>
          <div class="bike-years">${UI.escapeHtml(b.years || '')}${electric ? ' · elektryczny' : ''}</div>
        </div>
        <div class="bike-price">
          ${price}
          <small>rynek wtórny</small>
        </div>
      </div>

      <div class="chips">
        <span class="badge">${UI.escapeHtml(CATEGORY[b.category] || b.category)}</span>
        <span class="badge">${UI.escapeHtml(b.license || 'A')}</span>
        ${b.cc ? `<span class="badge">${b.cc} cm³</span>` : ''}
        ${b.power ? `<span class="badge">${b.power} KM</span>` : ''}
      </div>

      <div class="bike-specs">
        <div><span>Masa</span><span>${b.weight ? `${b.weight} kg` : '—'}</span></div>
        <div><span>Spalanie</span><span>${electric ? '0 l' : `${UI.fmt.dec(b.consumption)} l/100`}</span></div>
        <div><span>Bak</span><span>${b.tank ? `${UI.fmt.dec(b.tank)} l` : '—'}</span></div>
        <div><span>Zasięg</span><span>${b.tank && b.consumption ? `${Math.round(b.tank / b.consumption * 100)} km` : '—'}</span></div>
      </div>

      ${b.desc ? `<p class="bike-desc">${UI.escapeHtml(b.desc)}</p>` : ''}
      ${avg ? `<p class="muted small">Średnia cena: ${UI.fmt.money(avg)}</p>` : ''}

      <div class="bike-actions">
        <button class="btn btn-sm ${isMine ? 'btn-primary' : 'btn-outline'}" type="button" data-set-bike="${b.id}">
          ${UI.icon('bike')} ${isMine ? 'To mój motocykl' : 'Ustaw jako mój'}
        </button>
        <label class="chip ${inCompare ? 'is-active' : ''}">
          <input type="checkbox" data-compare="${b.id}" ${inCompare ? 'checked' : ''} style="margin:0" aria-label="Porównaj ${UI.escapeHtml(b.brand)} ${UI.escapeHtml(b.model)}">
          Porównaj
        </label>
      </div>
    </article>`;
  }

  /* -------------------------------------------------------------- MOJA MASZYNA */
  function bindBikeModal() {
    const modal = document.getElementById('bikeModal');
    if (!modal) return;
    modal.querySelector('#bikeForm')?.addEventListener('submit', async e => {
      e.preventDefault();
      const brand = modal.querySelector('#bikeBrand').value;
      const model = modal.querySelector('#bikeModel').value;
      const id = modal.dataset.bikeId || `${brand}-${model}`.replace(/\s+/g, '-').toLowerCase();
      const bike = {
        id,
        brand,
        model,
        cc: Number(modal.querySelector('#bikeCc').value) || 0,
        consumption: Number(modal.querySelector('#bikeConsumption').value) || PLANNER.consumptionDefault,
        tank: Number(modal.querySelector('#bikeTank').value) || 17,
        fuelPrice: Number(modal.querySelector('#bikeFuelPrice').value) || PLANNER.fuelPriceDefault
      };
      Store.setMyBike(bike);
      UI.closeModal(modal);
      UI.toast('Motocykl ustawiony', `${brand} ${model} — planer policzy teraz paliwo i zasięg.`, 'ok');
      render();
      renderMyBike();
      if (typeof Planner !== 'undefined' && Planner.isVisible()) {
        document.getElementById('plannerReset')?.blur();
      }
    });

    document.getElementById('myBikeBtn')?.addEventListener('click', () => {
      const mine = Store.getMyBike();
      openBikeModal(mine ? mine.id : null);
    });
  }

  function openBikeModal(bikeId) {
    const modal = document.getElementById('bikeModal');
    if (!modal) return;
    const b = bikes.find(x => x.id === bikeId);
    const mine = Store.getMyBike();

    modal.dataset.bikeId = b ? b.id : '';
    modal.querySelector('#bikeModalTitle').textContent = b ? `${b.brand} ${b.model}` : 'Mój motocykl';
    modal.querySelector('#bikeBrand').value = b ? b.brand : (mine?.brand || '');
    modal.querySelector('#bikeModel').value = b ? b.model : (mine?.model || '');
    modal.querySelector('#bikeCc').value = b ? (b.cc || '') : (mine?.cc || '');
    modal.querySelector('#bikeConsumption').value = b ? (b.consumption || PLANNER.consumptionDefault) : (mine?.consumption || PLANNER.consumptionDefault);
    modal.querySelector('#bikeTank').value = b ? (b.tank || 17) : (mine?.tank || 17);
    modal.querySelector('#bikeFuelPrice').value = mine?.fuelPrice || PLANNER.fuelPriceDefault;
    UI.openModal(modal);
  }

  function renderMyBike() {
    const host = document.getElementById('myBikePanel');
    if (!host) return;

    const mine = Store.getMyBike();
    const profile = Store.profile;
    if (!mine && !profile) {
      host.innerHTML = `<p class="muted small">Nie ustawiłeś jeszcze swojego motocykla. Wybierz model z listy, a planer policzy koszt paliwa, zasięg i przypomni o tankowaniu.</p>`;
      return;
    }

    const consumption = mine?.consumption || PLANNER.consumptionDefault;
    const price = mine?.fuelPrice || PLANNER.fuelPriceDefault;
    const per100 = (consumption / 100) * price;
    const range = mine?.tank ? Math.round((mine.tank / consumption) * 100) : null;

    host.innerHTML = `
      ${mine ? `
        <div class="metrics">
          <div class="metric"><span class="metric-label">Koszt 100 km</span><span class="metric-value">${UI.fmt.money(per100)}</span></div>
          <div class="metric"><span class="metric-label">Koszt 300 km</span><span class="metric-value">${UI.fmt.money(per100 * 3)}</span></div>
          <div class="metric"><span class="metric-label">Zasięg na baku</span><span class="metric-value">${range ? `${range} km` : '—'}</span></div>
          <div class="metric"><span class="metric-label">Cena paliwa</span><span class="metric-value">${UI.fmt.dec(price, 2)} zł</span></div>
        </div>
        <p class="muted small mt-sm">Przy ${UI.fmt.dec(consumption)} l/100 km i baku ${UI.fmt.dec(mine.tank || 0)} l. Zmień dane, jeśli jeździsz inaczej niż fabryka.</p>
      ` : ''}`;
  }

  /* ------------------------------------------------------------- PORÓWNANIE */
  function bindCompare() {
    document.getElementById('compareOpen')?.addEventListener('click', openCompare);
    document.getElementById('compareClear')?.addEventListener('click', () => {
      compare.length = 0;
      render();
    });
  }

  function toggleCompare(id, on) {
    if (on) {
      if (compare.length >= 3) {
        UI.toast('Maksymalnie 3 modele', 'Odznacz coś, żeby dodać kolejny.', 'warn');
        const box = document.querySelector(`[data-compare="${id}"]`);
        if (box) box.checked = false;
        return;
      }
      compare.push(id);
    } else {
      const i = compare.indexOf(id);
      if (i > -1) compare.splice(i, 1);
    }
    renderCompareBar();
  }

  function renderCompareBar() {
    const bar = document.getElementById('compareBar');
    const chips = document.getElementById('compareChips');
    if (!bar || !chips) return;
    bar.classList.toggle('is-hidden', compare.length === 0);
    chips.innerHTML = compare.map(id => {
      const b = bikes.find(x => x.id === id);
      if (!b) return '';
      return `<span class="chip is-active">${UI.escapeHtml(`${b.brand} ${b.model}`)}
        <button class="chip-close" type="button" data-remove-compare="${id}" aria-label="Usuń z porównania">×</button></span>`;
    }).join('');
    chips.querySelectorAll('[data-remove-compare]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.removeCompare;
        const i = compare.indexOf(id);
        if (i > -1) compare.splice(i, 1);
        render();
      });
    });
  }

  function openCompare() {
    const host = document.getElementById('compareTable');
    if (!host || !compare.length) return;
    const list = compare.map(id => bikes.find(b => b.id === id)).filter(Boolean);
    const rows = [
      ['Marka i model', b => `${b.brand} ${b.model}`],
      ['Kategoria', b => CATEGORY[b.category] || b.category],
      ['Uprawnienia', b => b.license || 'A'],
      ['Pojemność', b => (b.cc ? `${b.cc} cm³` : '—')],
      ['Moc', b => (b.power ? `${b.power} KM` : '—')],
      ['Masa', b => (b.weight ? `${b.weight} kg` : '—')],
      ['Spalanie', b => (b.consumption ? `${UI.fmt.dec(b.consumption)} l/100 km` : 'elektryczny')],
      ['Bak', b => (b.tank ? `${UI.fmt.dec(b.tank)} l` : '—')],
      ['Zasięg', b => (b.tank && b.consumption ? `${Math.round(b.tank / b.consumption * 100)} km` : '—')],
      ['Roczniki', b => b.years || '—'],
      ['Cena (widełki)', b => UI.fmt.price(b.price?.min, b.price?.max)],
      ['Średnia cena', b => (b.price?.min && b.price?.max ? UI.fmt.money((b.price.min + b.price.max) / 2) : '—')],
      ['Koszt 100 km', b => (b.consumption ? UI.fmt.money((b.consumption / 100) * (Store.getMyBike()?.fuelPrice || PLANNER.fuelPriceDefault)) : '—')],
      ['Koszt 300 km', b => (b.consumption ? UI.fmt.money((b.consumption / 100) * (Store.getMyBike()?.fuelPrice || PLANNER.fuelPriceDefault) * 3) : '—')],
      ['O czym pamiętać', b => b.desc || '—']
    ];

    host.innerHTML = `<table class="table">
      <thead><tr><th>Parametr</th>${list.map(b => `<th>${UI.escapeHtml(b.brand)}<br><span class="muted small">${UI.escapeHtml(b.model)}</span></th>`).join('')}</tr></thead>
      <tbody>
        ${rows.map(([label, fn]) => `<tr><th scope="row">${label}</th>${list.map(b => `<td>${UI.escapeHtml(String(fn(b)))}</td>`).join('')}</tr>`).join('')}
      </tbody>
    </table>`;
    UI.openModal('compareModal');
  }

  /* ----------------------------------------------------------------- API */
  return {
    init, render, renderCompareBar, openBikeModal, renderMyBike,
    get bikes() { return bikes; },
    get meta() { return meta; }
  };
})();
