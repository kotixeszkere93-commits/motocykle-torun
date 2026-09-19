/* =========================================================================
   planner.js — planer tras: punkty, routing, metryki, koszt paliwa, pogoda,
   eksport GPX, udostępnianie linku, obsługa pętli i dróg lokalnych.
   ========================================================================= */

const Planner = (() => {
  'use strict';

  const MIN_POINTS = 2;
  const MAP_ID = 'plannerMap';

  const state = {
    points: [],
    markers: [],
    line: null,
    result: null,
    layer: 'map',
    loop: false,
    avoidHighways: true,
    poiLayer: null,
    poiVisible: false,
    busy: false,
    dirty: false,
    lastComputed: null,
    abort: null
  };

  let map = null;
  let debounceTimer = null;

  /* ------------------------------------------------------------- INICJACJA */
  function init() {
    if (map) {
      MapEngine.invalidate(MAP_ID);
      return;
    }
    map = MapEngine.create(MAP_ID, { center: APP.homeCoords, zoom: 11 });
    if (!map) return;

    map.on('click', e => addPoint(e.latlng));

    bindUi();
    renderRegionChips();
    loadFromQuery();
    render();
  }

  function bindUi() {
    const $ = id => document.getElementById(id);

    $('plannerReset')?.addEventListener('click', async () => {
      if (state.points.length && !(await UI.confirmDialog({
        title: 'Wyczyścić trasę?',
        text: 'Wszystkie punkty znikną z mapy.',
        okLabel: 'Wyczyść'
      }))) return;
      reset();
    });

    $('plannerSave')?.addEventListener('click', () => {
      if (state.points.length < MIN_POINTS || !state.result) {
        UI.toast('Trasa jest za krótka', 'Zaznacz co najmniej dwa punkty na mapie.', 'warn');
        return;
      }
      if (!Store.hasAccount) {
        UI.toast('Zaloguj się, aby zapisać trasę', 'Planowanie jest darmowe — publikacja wymaga konta.', 'warn');
        document.querySelector('[data-action="open-auth"]')?.click();
        return;
      }
      if (typeof Routes !== 'undefined') Routes.openSaveDialog(plannerPayload());
    });

    $('undoPoint')?.addEventListener('click', () => {
      state.points.pop();
      render();
      scheduleCompute();
    });

    $('reverseRoute')?.addEventListener('click', () => {
      state.points.reverse();
      render();
      scheduleCompute();
      UI.toast('Trasa odwrócona', 'Start i meta zamienione miejscami.', 'info', 2600);
    });

    $('loopRoute')?.addEventListener('click', e => {
      state.loop = !state.loop;
      e.currentTarget.setAttribute('aria-pressed', String(state.loop));
      e.currentTarget.classList.toggle('is-active', state.loop);
      scheduleCompute();
    });

    $('avoidToggle')?.addEventListener('change', e => {
      state.avoidHighways = e.target.checked;
      scheduleCompute();
    });

    document.querySelectorAll('#layerSwitch .seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#layerSwitch .seg-btn').forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        state.layer = btn.dataset.layer;
        MapEngine.setLayer(MAP_ID, state.layer);
      });
    });

    $('locateBtn')?.addEventListener('click', async () => {
      try {
        const pos = await MapEngine.currentPosition();
        map.setView(pos, 13);
        addPoint(pos);
        UI.toast('Jesteś tutaj', 'Punkt dodany jako start trasy.', 'ok', 3000);
      } catch (e) {
        UI.toast('Nie udało się ustalić pozycji', 'Sprawdź uprawnienia lokalizacji w przeglądarce.', 'err');
      }
    });

    $('poiToggle')?.addEventListener('click', e => {
      state.poiVisible = !state.poiVisible;
      e.currentTarget.classList.toggle('is-active', state.poiVisible);
      if (state.poiVisible) {
        if (!state.poiLayer) state.poiLayer = MapEngine.poiLayer(map, addPoiToRoute);
        state.poiLayer.addTo(map);
        UI.toast('Punkty na trasie włączone', 'Kliknij pinezkę, aby dodać ją jako przystanek.', 'info', 3400);
      } else if (state.poiLayer) {
        map.removeLayer(state.poiLayer);
      }
    });

    $('fullscreenBtn')?.addEventListener('click', () => {
      const el = document.querySelector('.planner-map');
      if (!document.fullscreenElement) {
        el.requestFullscreen?.().then(() => MapEngine.invalidate(MAP_ID)).catch(() => {});
      } else {
        document.exitFullscreen?.();
      }
    });
    document.addEventListener('fullscreenchange', () => setTimeout(() => MapEngine.invalidate(MAP_ID), 120));

    $('exportGpx')?.addEventListener('click', exportGpx);
    $('openGoogle')?.addEventListener('click', openGoogleMaps);
    $('copyRouteLink')?.addEventListener('click', copyLink);

    document.addEventListener('keydown', e => {
      if (!isVisible()) return;
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        state.points.pop();
        render();
        scheduleCompute();
      }
      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        state.points.pop();
        render();
        scheduleCompute();
      }
    });

    window.addEventListener('resize', () => MapEngine.invalidate(MAP_ID));
  }

  function renderRegionChips() {
    const host = document.getElementById('regionChips');
    if (!host) return;
    host.innerHTML = REGIONS.map(r => `<button class="chip" type="button" data-region="${r.id}">${UI.escapeHtml(r.name)}</button>`).join('');
    host.addEventListener('click', e => {
      const btn = e.target.closest('[data-region]');
      if (!btn) return;
      const region = REGIONS.find(r => r.id === btn.dataset.region);
      if (!region || !map) return;
      host.querySelectorAll('.chip').forEach(c => c.classList.remove('is-active'));
      btn.classList.add('is-active');
      map.flyTo(region.center, region.zoom, { duration: 0.7 });
      UI.toast(region.name, region.note, 'info', 4200);
    });
  }

  /* ---------------------------------------------------------------- PUNKTY */
  function addPoint(latlng) {
    if (state.points.length >= PLANNER.maxWaypoints) {
      UI.toast('Limit punktów', `Maksymalnie ${PLANNER.maxWaypoints} punktów na trasę.`, 'warn');
      return;
    }
    state.points.push({ lat: latlng.lat, lng: latlng.lng });
    render();
    scheduleCompute();
  }

  function addPoiToRoute(poi) {
    addPoint({ lat: poi.lat, lng: poi.lng });
    map.closePopup();
    UI.toast('Dodano przystanek', poi.name, 'ok', 3000);
  }

  function movePoint(index, latlng) {
    if (!state.points[index]) return;
    state.points[index] = { lat: latlng.lat, lng: latlng.lng };
    scheduleCompute();
  }

  function removePoint(index) {
    state.points.splice(index, 1);
    render();
    scheduleCompute();
  }

  function reset() {
    state.points = [];
    state.result = null;
    render();
    scheduleCompute();
  }

  function reverse() {
    state.points.reverse();
    render();
    scheduleCompute();
  }

  /* ---------------------------------------------------------------- RENDER */
  function render() {
    if (!map) return;
    const points = routePoints();

    // Markery
    state.markers.forEach(m => map.removeLayer(m));
    state.markers = [];

    points.forEach((p, i) => {
      const kind = i === 0 ? 'start' : i === points.length - 1 && points.length > 1 ? 'end' : 'via';
      const text = kind === 'via' ? String(i) : '';
      const m = MapEngine.marker(map, L.latLng(p.lat, p.lng), {
        kind,
        text,
        draggable: true,
        onDrag: latlng => {
          state.points[i] = { lat: latlng.lat, lng: latlng.lng };
        },
        onDragEnd: () => scheduleCompute()
      });
      state.markers.push(m);
    });

    renderWaypointList(points);
    updateHint(points.length);
    renderRegionTag(points);
  }

  function renderWaypointList(points) {
    const host = document.getElementById('waypointList');
    if (!host) return;
    if (!points.length) {
      host.innerHTML = '<li class="empty muted small">Brak punktów. Kliknij na mapie, aby zacząć.</li>';
    } else {
      host.innerHTML = points.map((p, i) => {
        const kind = i === 0 ? 'start' : i === points.length - 1 && points.length > 1 ? 'end' : 'via';
        const label = kind === 'start' ? 'Start' : kind === 'end' ? 'Meta' : `Przystanek ${i}`;
        const name = MapEngine.nearestPlace({ lat: p.lat, lng: p.lng });
        return `<li class="waypoint-item waypoint-item--${kind}">
          <span class="waypoint-index">${kind === 'start' ? 'S' : kind === 'end' ? 'M' : i}</span>
          <span>
            <strong>${label}</strong><br>
            <span class="waypoint-coords">${UI.escapeHtml(name.label)}</span>
          </span>
          <span class="waypoint-actions">
            <button type="button" title="Usuń punkt" data-remove="${i}">
              ${UI.icon('close')}
            </button>
          </span>
        </li>`;
      }).join('');
      host.querySelectorAll('[data-remove]').forEach(btn => {
        btn.addEventListener('click', () => removePoint(Number(btn.dataset.remove)));
      });
    }

    const undo = document.getElementById('undoPoint');
    const rev = document.getElementById('reverseRoute');
    if (undo) undo.disabled = !points.length;
    if (rev) rev.disabled = points.length < 2;
  }

  function renderRegionTag(points) {
    if (!points.length) return;
    const regionId = MapEngine.regionOf({ lat: points[0].lat, lng: points[0].lng });
    const region = REGIONS.find(r => r.id === regionId);
    const select = document.getElementById('routeRegionField');
    if (select && region && !select.dataset.touched) select.value = region.id;
  }

  function updateHint(count) {
    const hint = document.getElementById('mapHint');
    if (!hint) return;
    const messages = {
      0: 'Kliknij na mapie, aby dodać start.',
      1: 'Świetnie. Teraz kliknij metę — policzymy trasę po drogach.',
      2: 'Trasa gotowa. Możesz dodać przystanki albo przeciągać punkty.'
    };
    const text = messages[count] ?? 'Kliknij, aby dodać kolejny przystanek (max ' + PLANNER.maxWaypoints + ').';
    hint.textContent = text;
    hint.classList.toggle('is-hidden', count >= 3);
  }

  /* -------------------------------------------------------------- ROUTING */
  function routePoints() {
    const pts = state.points.slice();
    if (state.loop && pts.length >= 2) pts.push({ ...pts[0] });
    return pts;
  }

  function scheduleCompute() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(compute, 220);
  }

  async function compute() {
    const points = routePoints();
    const progress = document.getElementById('routeProgress');
    const errorEl = document.getElementById('plannerError');
    if (errorEl) { errorEl.hidden = true; errorEl.textContent = ''; }

    if (points.length < 2) {
      state.result = null;
      if (state.line) { MapEngine.clearGroup(map, state.line); state.line = null; }
      setMetrics(null);
      setExportState(false);
      renderWeather(null);
      return;
    }

    if (state.abort) state.abort.abort();
    state.abort = new AbortController();

    if (progress) progress.hidden = false;
    setExportState(false);

    try {
      const result = await MapEngine.route(points, {
        avoidHighways: state.avoidHighways,
        signal: state.abort.signal
      });
      state.result = result;
      state.dirty = true;

      if (state.line) MapEngine.clearGroup(map, state.line);
      state.line = MapEngine.drawLine(map, result.coords, {
        color: '#ff8a1f',
        weight: 5,
        dashed: result.approx,
        fit: true
      });

      setMetrics(result);
      setExportState(true);
      renderWeather(routePoints()[0]);

      if (result.approx) {
        if (errorEl) {
          errorEl.hidden = false;
          errorEl.textContent = 'Nie udało się połączyć z serwerem tras — pokazujemy szacunek w linii prostej (z zapasem 28%).';
        }
      }
    } catch (e) {
      if (e.name === 'AbortError') return;
      console.error(e);
      if (errorEl) { errorEl.hidden = false; errorEl.textContent = 'Błąd wyznaczania trasy. Spróbuj przesunąć punkty.'; }
      UI.toast('Problem z routingiem', 'Sprawdź połączenie z internetem.', 'err');
    } finally {
      if (progress) progress.hidden = true;
    }
  }

  function setMetrics(result) {
    const fuel = fuelEstimate(result ? result.distanceKm : null);
    const set = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    if (!result) {
      set('mDistance', '—'); set('mTime', '—'); set('mAvg', '—'); set('mFuel', '—');
      const note = document.getElementById('fuelNote');
      if (note) note.textContent = 'Ustaw swój motocykl w garażu, aby policzyć koszt paliwa i zasięg.';
      return;
    }
    const avg = result.durationSec ? (result.distanceKm / (result.durationSec / 3600)) : 0;
    set('mDistance', UI.fmt.km(result.distanceKm));
    set('mTime', UI.fmt.duration(result.durationSec));
    set('mAvg', avg ? `${Math.round(avg)} km/h` : '—');
    set('mFuel', fuel ? `${fuel.liters.toFixed(1)} l · ${UI.fmt.money(fuel.cost)}` : '—');

    const note = document.getElementById('fuelNote');
    if (note && fuel) {
      note.textContent = `${fuel.bikeName}: ${UI.fmt.dec(fuel.consumption)} l/100 km, paliwo ${UI.fmt.dec(fuel.price, 2)} zł/l. `
        + `Zasięg na baku: ~${Math.round(fuel.range)} km. Przerwa na tankowanie co ~${Math.round(fuel.range * 0.8)} km.`;
    }
  }

  /** Zużycie paliwa i koszt — na podstawie motocykla z garażu. */
  function fuelEstimate(km) {
    if (!km) return null;
    const bike = Store.getMyBike();
    const consumption = (bike && Number(bike.consumption)) || PLANNER.consumptionDefault;
    const price = (bike && Number(bike.fuelPrice)) || PLANNER.fuelPriceDefault;
    const tank = (bike && Number(bike.tank)) || 17;
    const liters = (km / 100) * consumption;
    return {
      liters,
      cost: liters * price,
      consumption,
      price,
      tank,
      range: (tank / consumption) * 100,
      bikeName: bike ? `${bike.brand || ''} ${bike.model || ''}`.trim() || 'Twój motocykl' : 'Domyślne dane'
    };
  }

  function setExportState(enabled) {
    ['exportGpx', 'openGoogle', 'copyRouteLink'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = !enabled;
    });
  }

  async function renderWeather(point) {
    const box = document.getElementById('weatherBox');
    if (!box) return;
    if (!point) {
      box.innerHTML = '<span class="muted small">Dodaj punkt startowy, aby zobaczyć prognozę na 4 dni.</span>';
      return;
    }
    box.innerHTML = `<span class="spinner"></span> <span class="muted small">Pobieram prognozę…</span>`;
    const data = await MapEngine.weather(point.lat, point.lng);
    if (!data) {
      box.innerHTML = '<span class="muted small">Nie udało się pobrać pogody (brak połączenia z serwisem prognoz).</span>';
      return;
    }
    const place = MapEngine.nearestPlace(point);
    box.innerHTML = `
      <div class="weather-now">
        <span style="font-size:2rem" aria-hidden="true">${data.now.icon}</span>
        <span>
          <span class="weather-temp">${data.now.temp}°C</span>
          <span class="muted small">${UI.escapeHtml(data.now.label)}, wiatr ${data.now.wind} km/h</span>
        </span>
      </div>
      <p class="muted small mb-md">Najbliżej: ${UI.escapeHtml(place.label)}</p>
      <div class="weather-days">
        ${data.days.map((d, i) => {
          const score = MapEngine.rideScore(d);
          const scoreLabel = ['Słabo na jazdę', 'Może być', 'Dobrze', 'Idealnie'][score] || '';
          return `<div class="weather-day" title="${UI.escapeHtml(d.label)} · ${scoreLabel}">
            <strong>${i === 0 ? 'dziś' : i === 1 ? 'jutro' : UI.fmt.date(d.date).slice(0, 5)}</strong>
            <div aria-hidden="true">${d.icon}</div>
            ${d.max}° <span class="weather-min">${d.min}°</span>
            ${d.precip > 0.5 ? `<div class="muted">${d.precip.toFixed(1)} mm</div>` : ''}
          </div>`;
        }).join('')}
      </div>`;
  }

  /* ------------------------------------------------------------- EKSPORT */
  function exportGpx() {
    if (!state.result) return;
    const name = `Moto-Swiry ${state.points.length} pkt ${new Date().toISOString().slice(0, 10)}`;
    const gpx = MapEngine.buildGpx(name, [{ name, coords: state.result.coords }]);
    MapEngine.download(`${Store.slugify(name)}.gpx`, gpx);
    UI.toast('GPX pobrany', 'Wgraj plik do Garmina, OsmAnd, Locus albo Calimoto.', 'ok');
  }

  function openGoogleMaps() {
    if (state.points.length < 2) return;
    const pts = routePoints().map(p => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`).join('/');
    window.open(`https://www.google.com/maps/dir/${pts}`, '_blank', 'noopener');
  }

  async function copyLink() {
    if (state.points.length < 2) return;
    const url = shareUrl();
    const ok = await UI.copyText(url);
    UI.toast(ok ? 'Link skopiowany' : 'Skopiuj ręcznie', ok ? 'Wklej go w grupie i jedziemy.' : url, ok ? 'ok' : 'info');
  }

  function shareUrl() {
    const pts = state.points.map(p => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join(';');
    return `${location.origin}${location.pathname}?planer=${pts}`;
  }

  /** Ładuje trasę z parametru ?planer=lat,lng;lat,lng */
  function loadFromQuery() {
    const params = new URLSearchParams(location.search);
    const raw = params.get('planer');
    if (!raw) return;
    const points = raw.split(';').map(pair => {
      const [lat, lng] = pair.split(',').map(Number);
      return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    }).filter(Boolean).slice(0, PLANNER.maxWaypoints);
    if (points.length < 2) return;
    state.points = points;
    render();
    scheduleCompute();
    UI.toast('Trasa wczytana z linku', 'Sprawdź punkty i dopisz brakujące przystanki.', 'ok');
  }

  /** Wczytanie istniejącej trasy ze społeczności do planera. */
  function loadRoute(route) {
    state.points = [
      { lat: route.start.lat, lng: route.start.lng },
      ...(route.waypoints || []).map(w => ({ lat: w.lat, lng: w.lng })),
      { lat: route.end.lat, lng: route.end.lng }
    ];
    state.loop = false;

    init(); // mapa musi istnieć, gdy planer nie był jeszcze otwarty
    if (map) map.flyTo([state.points[0].lat, state.points[0].lng], 9, { duration: 0.6 });
    render();
    scheduleCompute();
  }

  /* ----------------------------------------------------------------- API */
  function plannerPayload() {
    const pts = routePoints();
    return {
      points: state.points.slice(),
      start: { lat: state.points[0].lat, lng: state.points[0].lng },
      end: { lat: state.points[state.points.length - 1].lat, lng: state.points[state.points.length - 1].lng },
      waypoints: state.points.slice(1, -1),
      distanceKm: state.result ? Number(state.result.distanceKm.toFixed(1)) : 0,
      durationSec: state.result ? Math.round(state.result.durationSec) : 0,
      path: state.result ? state.result.path : [],
      loop: state.loop,
      avoidHighways: state.avoidHighways,
      region: MapEngine.regionOf({ lat: state.points[0].lat, lng: state.points[0].lng }),
      places: pts.map(p => MapEngine.nearestPlace({ lat: p.lat, lng: p.lng }).name)
    };
  }

  function isVisible() {
    return document.getElementById('view-planer')?.classList.contains('is-active');
  }

  return {
    init, reset, reverse,
    resize: () => MapEngine.invalidate(MAP_ID),
    loadRoute, loadFromQuery, isVisible,
    get state() { return state; },
    get points() { return state.points; },
    get result() { return state.result; }
  };
})();
