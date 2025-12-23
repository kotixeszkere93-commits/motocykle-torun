// GŁÓWNA MAPA
const mainMap = L.map('mainMap', {
  maxBounds: [
    [54.9, 13.5],
    [48.8, 24.5]
  ],
  maxBoundsViscosity: 1.0
}).setView([52.0, 19.0], 6);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mainMap);

let mainMarkers = [];
let mainRouteLayer = null;
let mainGoogleLink = "";

// Klikanie na głównej mapie
mainMap.on('click', async e => {
  if (mainMarkers.length === 2) resetMainMap();

  const marker = L.marker(e.latlng).addTo(mainMap);
  mainMarkers.push(marker);

  if (mainMarkers.length === 2) {
    const p1 = mainMarkers[0].getLatLng();
    const p2 = mainMarkers[1].getLatLng();
    const res = await drawRouteOnMap(mainMap, p1, p2, "info");
    mainGoogleLink = `https://www.google.com/maps/dir/${p1.lat},${p1.lng}/${p2.lat},${p2.lng}`;
  }
});

async function drawRouteOnMap(mapObj, p1, p2, infoElementId) {
  const url = `https://router.project-osrm.org/route/v1/driving/${p1.lng},${p1.lat};${p2.lng},${p2.lat}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  const data = await res.json();
  const route = data.routes[0];
  const km = (route.distance / 1000).toFixed(1);

  if (infoElementId === "info") {
    if (mainRouteLayer) mapObj.removeLayer(mainRouteLayer);
    mainRouteLayer = L.geoJSON(route.geometry).addTo(mapObj);
  }

  document.getElementById(infoElementId).innerText = `Dystans: ${km} km`;
  return { distanceKm: parseFloat(km) };
}

function resetMainMap() {
  mainMarkers.forEach(m => mainMap.removeLayer(m));
  mainMarkers = [];
  if (mainRouteLayer) mainMap.removeLayer(mainRouteLayer);
  mainRouteLayer = null;
  mainGoogleLink = "";
  document.getElementById("info").innerText = "Kliknij dwa punkty na mapie";
}

function copyMainLink() {
  if (!mainGoogleLink) {
    alert("Najpierw wybierz trasę.");
    return;
  }
  navigator.clipboard.writeText(mainGoogleLink);
  alert("Link skopiowany!");
}

// Pokazanie zapisanej trasy na głównej mapie
async function showRouteOnMainMapFromPoints(p1, p2, distanceKm) {
  resetMainMap();
  const m1 = L.marker(p1).addTo(mainMap);
  const m2 = L.marker(p2).addTo(mainMap);
  mainMarkers.push(m1, m2);
  const res = await drawRouteOnMap(mainMap, p1, p2, "info");
  mainMap.fitBounds([p1, p2], { padding: [20, 20] });
  const link = `https://www.google.com/maps/dir/${p1.lat},${p1.lng}/${p2.lat},${p2.lng}`;
  mainGoogleLink = link;
}

// MAPA W MODALU PROPOZYCJI TRASY
let routeMapObj = null;
let routeMarkers = [];
let routeRouteLayer = null;

function initRouteMap() {
  if (routeMapObj) {
    routeMapObj.invalidateSize();
    return;
  }

  routeMapObj = L.map('routeMap', {
    maxBounds: [
      [54.9, 13.5],
      [48.8, 24.5]
    ],
    maxBoundsViscosity: 1.0
  }).setView([52.0, 19.0], 6);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(routeMapObj);

  routeMapObj.on('click', async e => {
    if (routeMarkers.length === 2) {
      resetRouteMapSelection();
    }

    const marker = L.marker(e.latlng).addTo(routeMapObj);
    routeMarkers.push(marker);

    if (routeMarkers.length === 2) {
      const p1 = routeMarkers[0].getLatLng();
      const p2 = routeMarkers[1].getLatLng();
      const res = await drawRouteOnRouteMap(p1, p2);
      window.routeSelection = {
        start: p1,
        end: p2,
        distanceKm: res.distanceKm
      };
    }
  });
}

function resetRouteMapSelection() {
  if (!routeMapObj) return;
  routeMarkers.forEach(m => routeMapObj.removeLayer(m));
  routeMarkers = [];
  if (routeRouteLayer) routeMapObj.removeLayer(routeRouteLayer);
  routeRouteLayer = null;
}

async function drawRouteOnRouteMap(p1, p2) {
  const url = `https://router.project-osrm.org/route/v1/driving/${p1.lng},${p1.lat};${p2.lng},${p2.lat}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  const data = await res.json();
  const route = data.routes[0];
  const km = (route.distance / 1000).toFixed(1);

  if (routeRouteLayer) routeMapObj.removeLayer(routeRouteLayer);
  routeRouteLayer = L.geoJSON(route.geometry).addTo(routeMapObj);

  document.getElementById("routeInfo").innerText = `Dystans: ${km} km`;
  return { distanceKm: parseFloat(km) };
}
