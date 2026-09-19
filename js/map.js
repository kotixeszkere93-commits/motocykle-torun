/* =========================================================================
   map.js — silnik map: warstwy kafelków, trasy z OSRM, markery, POI,
   eksport GPX, pogoda z Open-Meteo. Wszystko z bezpiecznym fallbackiem,
   gdy usługi zewnętrzne nie odpowiadają.
   ========================================================================= */

const MapEngine = (() => {
  'use strict';

  const maps = new Map(); // id → { map, tile, layerKey, overlays }

  /* ------------------------------------------------------------ TWORZENIE */
  function create(elId, opts = {}) {
    const el = document.getElementById(elId);
    if (!el) return null;

    const map = L.map(el, {
      center: opts.center || APP.homeCoords,
      zoom: opts.zoom || 11,
      maxBounds: opts.maxBounds === false ? undefined : L.latLngBounds(PL_BOUNDS),
      maxBoundsViscosity: 0.9,
      zoomControl: opts.zoomControl !== false,
      worldCopyJump: true,
      preferCanvas: true
    });

    if (opts.zoomControl !== false) {
      map.zoomControl.setPosition(opts.zoomControlPosition || 'bottomright');
    }

    const entry = { map, tile: null, layerKey: 'map', overlays: {}, elId, opts };
    maps.set(elId, entry);
    setLayer(elId, opts.layer || 'map');

    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);

    // Kliknięcie poza markerem = dodanie punktu (obsługiwane przez planer)
    return map;
  }

  function get(elId) {
    const entry = maps.get(elId);
    return entry ? entry.map : null;
  }

  function entryOf(elId) { return maps.get(elId); }

  /** Zmiana warstwy kafelków (mapa / teren / satelita). */
  function setLayer(elId, key) {
    const entry = maps.get(elId);
    if (!entry) return;
    const cfg = TILES[key] || TILES.map;
    if (entry.tile) entry.map.removeLayer(entry.tile);
    entry.layerKey = key;
    entry.tile = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: cfg.maxZoom,
      crossOrigin: true,
      detectRetina: true
    }).addTo(entry.map);
    entry.tile.on('tileerror', () => {
      if (entry.tileFailed) return;
      entry.tileFailed = true;
      if (key !== 'map') {
        UI.toast('Warstwa mapy niedostępna', 'Wracam do domyślnej mapy OpenStreetMap.', 'warn');
        setLayer(elId, 'map');
      }
    });
    entry.map.getContainer().classList.toggle('map-sat-active', key === 'sat');
  }

  function invalidate(elId) {
    const map = get(elId);
    if (map) setTimeout(() => map.invalidateSize(), 60);
  }

  /* -------------------------------------------------------------- MARKERY */
  const PIN = {
    start: { cls: 'marker-pin--start', label: 'S' },
    end: { cls: 'marker-pin--end', label: 'M' },
    via: { cls: 'marker-pin--via', label: '•' }
  };

  function makePinIcon(kind, text) {
    const cfg = PIN[kind] || PIN.via;
    const html = `<div class="marker-pin ${cfg.cls}">${text || cfg.label}</div>`;
    return L.divIcon({ html, className: 'mst-pin', iconSize: [26, 26], iconAnchor: [13, 13], popupAnchor: [0, -14] });
  }

  function marker(map, latlng, { kind = 'via', text = '', draggable = false, onDrag, onDragEnd, popup } = {}) {
    const m = L.marker(latlng, {
      icon: makePinIcon(kind, text),
      draggable,
      keyboard: false
    }).addTo(map);
    if (onDrag) m.on('drag', e => onDrag(e.target.getLatLng(), m));
    if (onDragEnd) m.on('dragend', e => onDragEnd(e.target.getLatLng(), m));
    if (popup) m.bindPopup(popup);
    return m;
  }

  function poiIcon(cat) {
    const meta = POI_CATEGORIES.find(c => c.id === cat) || POI_CATEGORIES[0];
    const glyph = { widok: '⛰', paliwo: '⛽', jedzenie: '🍽', nocleg: '⛺', warsztat: '🔧', atrakcja: '★' }[cat] || '•';
    return L.divIcon({
      html: `<div class="poi-marker" title="${UI.escapeHtml(meta.label)}">${glyph}</div>`,
      className: 'mst-poi',
      iconSize: [26, 26],
      iconAnchor: [13, 13],
      popupAnchor: [0, -14]
    });
  }

  /* ----------------------------------------------------------- RYSOWANIE */
  /** Rysuje linię trasy (podwójna: obrys + kolor) i zwraca grupę warstw. */
  function drawLine(map, coords, { color = '#ff8a1f', weight = 5, dashed = false, fit = false, bounds = null } = {}) {
    if (!coords || coords.length < 2) return null;
    const group = L.layerGroup().addTo(map);
    const outline = L.polyline(coords, {
      color: 'rgba(0,0,0,.55)', weight: weight + 4, opacity: .55, lineJoin: 'round', lineCap: 'round'
    }).addTo(group);
    const line = L.polyline(coords, {
      color, weight, opacity: .96, lineJoin: 'round', lineCap: 'round',
      dashArray: dashed ? '8 10' : null
    }).addTo(group);
    group._line = line;
    group._outline = outline;
    if (fit) {
      const b = bounds || L.latLngBounds(coords);
      map.fitBounds(b, { padding: [40, 40], maxZoom: 15 });
    }
    return group;
  }

  function clearGroup(map, group) {
    if (group && map) map.removeLayer(group);
  }

  /* ------------------------------------------------------------- ROUTING */
  const cache = new Map();

  function haversineKm(a, b) {
    const R = 6371;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const lat1 = a.lat * Math.PI / 180;
    const lat2 = b.lat * Math.PI / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function osrmUrl(points, { avoidHighways = true } = {}) {
    const coords = points.map(p => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
    const params = new URLSearchParams({ overview: 'full', geometries: 'geojson', steps: 'false', annotations: 'false' });
    if (avoidHighways) params.set('exclude', 'motorway');
    return `${PLANNER.osrm}${coords}?${params.toString()}`;
  }

  /**
   * Wyznacza trasę po drogach (OSRM). Gdy usługa nie odpowiada lub nie ma
   * połączenia — zwraca estymację w linii prostej z oznaczeniem `approx`.
   */
  async function route(points, { avoidHighways = true, signal } = {}) {
    if (!points || points.length < 2) return null;
    const key = `${avoidHighways ? 'h' : 'd'}|${points.map(p => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join('|')}`;
    if (cache.has(key)) return cache.get(key);

    const attempt = async url => {
      const res = await fetch(url, { signal });
      if (!res.ok) throw new Error(`OSRM ${res.status}`);
      const data = await res.json();
      if (!data.routes || !data.routes.length) throw new Error('Brak trasy');
      return data.routes[0];
    };

    try {
      let routeData;
      try {
        routeData = await attempt(osrmUrl(points, { avoidHighways }));
      } catch (e) {
        routeData = await attempt(osrmUrl(points, { avoidHighways: false }));
      }

      const coords = routeData.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
      const result = {
        distanceKm: routeData.distance / 1000,
        durationSec: routeData.duration,
        coords,
        // OSRM zwraca pełną geometrię; do zapisu przycinamy do ~240 punktów
        path: simplify(coords, 240),
        approx: false
      };
      cache.set(key, result);
      return result;
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      console.warn('[Moto Świry] Routing niedostępny:', e.message);
      const coords = interpolate(points, 24);
      let dist = 0;
      for (let i = 1; i < points.length; i++) dist += haversineKm(points[i - 1], points[i]);
      dist *= 1.28; // typowy współczynnik „drogowy” dla szacunku
      const result = {
        distanceKm: dist,
        durationSec: (dist / PLANNER.avgSpeedFallback) * 3600,
        coords,
        path: coords,
        approx: true
      };
      cache.set(key, result);
      return result;
    }
  }

  /** Deklaratywne uproszczenie geometrii (co n-ty punkt, z zachowaniem brzegów). */
  function simplify(coords, maxPoints) {
    if (coords.length <= maxPoints) return coords;
    const step = Math.ceil(coords.length / maxPoints);
    const out = coords.filter((_, i) => i % step === 0);
    if (out[out.length - 1] !== coords[coords.length - 1]) out.push(coords[coords.length - 1]);
    return out;
  }

  /** Punkty pośrednie prostej linii (dla trybu szacunkowego). */
  function interpolate(points, perLeg) {
    const out = [];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      for (let s = 0; s < perLeg; s++) {
        const t = s / perLeg;
        out.push([a.lat + (b.lat - a.lat) * t, a.lng + (b.lng - a.lng) * t]);
      }
    }
    const last = points[points.length - 1];
    out.push([last.lat, last.lng]);
    return out;
  }

  /* ----------------------------------------------------------------- GPX */
  function buildGpx(name, tracks) {
    const pts = w => w.map(c => `      <trkpt lat="${c[0].toFixed(6)}" lon="${c[1].toFixed(6)}"></trkpt>`).join('\n');
    const escape = s => UI.escapeHtml(s);
    return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Moto Świry Toruń" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escape(name)}</name>
    <desc>Trasa wygenerowana w planerze Moto Świry Toruń</desc>
    <time>${new Date().toISOString()}</time>
  </metadata>
${tracks.map(t => `  <trk>
    <name>${escape(t.name || name)}</name>
    <trkseg>
${pts(t.coords)}
    </trkseg>
  </trk>`).join('\n')}
</gpx>`;
  }

  function download(filename, content, type = 'application/gpx+xml') {
    try {
      const blob = new Blob([content], { type: `${type};charset=utf-8` });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      return true;
    } catch (e) {
      UI.toast('Nie udało się pobrać pliku', 'Spróbuj ponownie w innej przeglądarce.', 'err');
      return false;
    }
  }

  /* -------------------------------------------------------------- POGODA */
  const weatherCache = new Map();

  const WMO = {
    0: ['☀️', 'bezchmurnie'], 1: ['🌤', 'prawie bezchmurnie'], 2: ['⛅️', 'częściowe chmury'], 3: ['☁️', 'pochmurno'],
    45: ['🌫', 'mgła'], 48: ['🌫', 'mgła osadzająca'], 51: ['🌦', 'mżawka'], 53: ['🌦', 'mżawka'], 55: ['🌧', 'gęsta mżawka'],
    61: ['🌧', 'lekki deszcz'], 63: ['🌧', 'deszcz'], 65: ['🌧', 'ulewa'], 66: ['🌧', 'deszcz ze śniegiem'],
    71: ['🌨', 'lekki śnieg'], 73: ['🌨', 'śnieg'], 75: ['❄️', 'intensywny śnieg'],
    80: ['🌦', 'przelotny deszcz'], 81: ['🌧', 'przelotne opady'], 82: ['⛈', 'gwałtowne opady'],
    95: ['⛈', 'burza'], 96: ['⛈', 'burza z gradem'], 99: ['⛈', 'silna burza z gradem']
  };

  const weatherLabel = code => (WMO[code] || ['🌡', 'brak danych']);

  async function weather(lat, lng) {
    const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
    if (weatherCache.has(key)) return weatherCache.get(key);
    try {
      const params = new URLSearchParams({
        latitude: lat.toFixed(4),
        longitude: lng.toFixed(4),
        current: 'temperature_2m,wind_speed_10m,weather_code,precipitation',
        daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max',
        timezone: 'Europe/Warsaw',
        forecast_days: '4'
      });
      const res = await fetch(`${PLANNER.weatherApi}?${params}`);
      if (!res.ok) throw new Error('weather http');
      const data = await res.json();
      const [icon, label] = weatherLabel(data.current.weather_code);
      const result = {
        now: {
          temp: Math.round(data.current.temperature_2m),
          wind: Math.round(data.current.wind_speed_10m),
          icon, label,
          precip: data.current.precipitation
        },
        days: (data.daily.time || []).map((date, i) => {
          const [dIcon, dLabel] = weatherLabel(data.daily.weather_code[i]);
          return {
            date,
            min: Math.round(data.daily.temperature_2m_min[i]),
            max: Math.round(data.daily.temperature_2m_max[i]),
            precip: data.daily.precipitation_sum[i],
            wind: Math.round(data.daily.wind_speed_10m_max[i]),
            icon: dIcon, label: dLabel
          };
        })
      };
      weatherCache.set(key, result);
      return result;
    } catch (e) {
      return null;
    }
  }

  /** Ocena warunków dla motocyklisty (0–3: słabo → idealnie). */
  function rideScore(day) {
    if (!day) return null;
    let score = 3;
    if (day.precip > 5) score -= 2; else if (day.precip > 1) score -= 1;
    if (day.wind > 45) score -= 1;
    if (day.max < 8) score -= 1;
    if (day.min < 2) score -= 1;
    return Math.max(0, Math.min(3, score));
  }

  /* ------------------------------------------------------------- POMOCNE */
  function fit(map, points, opts = {}) {
    if (!map || !points || !points.length) return;
    if (points.length === 1) {
      map.setView(points[0], opts.zoom || 13);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: opts.padding || [40, 40], maxZoom: opts.maxZoom || 15 });
  }

  function coord(lat, lng) {
    const ns = lat >= 0 ? 'N' : 'S';
    const ew = lng >= 0 ? 'E' : 'W';
    return `${Math.abs(lat).toFixed(4)}° ${ns}, ${Math.abs(lng).toFixed(4)}° ${ew}`;
  }

  /** Najbliższy znany region/POI — zamiast pytania o geokoder. */
  function nearestPlace(latlng) {
    let best = null;
    let bestDist = Infinity;
    REGIONS.forEach(r => {
      const d = haversineKm(latlng, { lat: r.center[0], lng: r.center[1] });
      if (d < bestDist) { bestDist = d; best = { name: r.name, kind: 'region', dist: d }; }
    });
    POI.forEach(p => {
      const d = haversineKm(latlng, { lat: p.lat, lng: p.lng });
      if (d < bestDist) { bestDist = d; best = { name: p.name, kind: 'poi', dist: d }; }
    });
    if (best && bestDist <= 25) return { ...best, label: `${best.name} (${bestDist.toFixed(1)} km)` };
    return { label: coord(latlng.lat, latlng.lng), kind: 'coord', dist: bestDist };
  }

  function regionOf(latlng) {
    const near = nearestPlace(latlng);
    const region = REGIONS.find(r => r.name === near.name);
    return region ? region.id : 'kujawy';
  }

  function currentPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('Brak geolokalizacji'));
      navigator.geolocation.getCurrentPosition(
        pos => resolve(L.latLng(pos.coords.latitude, pos.coords.longitude)),
        err => reject(err),
        { enableHighAccuracy: true, timeout: 9000, maximumAge: 60000 }
      );
    });
  }

  /* -------------------------------------------------- SEKCJE POMOCNICZE UI */
  function poiLayer(map, onAdd) {
    const group = L.layerGroup();
    POI.forEach(p => {
      const m = L.marker([p.lat, p.lng], { icon: poiIcon(p.cat), keyboard: false });
      m.bindPopup(`
        <strong>${UI.escapeHtml(p.name)}</strong>
        ${UI.escapeHtml(p.note || '')}
        <div class="popup-actions">
          <button class="btn btn-sm btn-primary" type="button">Dodaj do trasy</button>
        </div>`);
      m.on('popupopen', e => {
        const btn = e.popup.getElement().querySelector('button');
        if (btn) btn.addEventListener('click', () => onAdd && onAdd(p));
      });
      group.addLayer(m);
    });
    return group;
  }

  return {
    create, get, entryOf, setLayer, invalidate,
    marker, drawLine, clearGroup, poiLayer,
    route, haversineKm, simplify, interpolate, buildGpx, download,
    weather, rideScore, weatherLabel,
    fit, coord, nearestPlace, regionOf, currentPosition
  };
})();
