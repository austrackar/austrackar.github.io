// ═══════════════════════════════════════════════
// APP.JS — Lógica principal de RutaSegura AR
// ═══════════════════════════════════════════════

let notificationsEnabled = false;
let notifInterval = null;
let savedRouteData = null;

let availableRouteOptions = [];
let notifiedAlerts = new Set();
// ─── INIT ───────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  try {
    initMap();
    buildAlertsList('all');
    buildServiciosList('combustible');
    buildLegendModal();
    setupEventListeners();
    checkOnlineStatus();
    setTimeout(startNotificationDemo, 3000);
    setTimeout(requestUserLocation, 1000);
  } catch (e) {
    console.error('Error en inicialización:', e);
    showNotification({ title: 'Error de carga', body: 'Ocurrió un error al iniciar la aplicación: ' + e.message, type: 'danger' });
  }
});

// ─── SERVICE WORKER ─────────────────────────────
//function registerServiceWorker() {
  //if ('serviceWorker' in navigator) {
    //navigator.serviceWorker.register('./service-worker.js')
      //.then(reg => console.log('SW registrado:', reg.scope))
      //.catch(err => console.log('SW error:', err));
  //}
//}

// ─── ONLINE/OFFLINE ─────────────────────────────
function checkOnlineStatus() {
  window.addEventListener('online', () => setOfflineMode(false));
  window.addEventListener('offline', () => {
    setOfflineMode(true);
    showNotification({ title: 'Sin conexión', body: 'Mostrando datos descargados. El mapa puede estar limitado.', type: 'warning', location: [-38.4161, -63.6167] });
  });
}

// ─── EVENT LISTENERS ────────────────────────────
function setupEventListeners() {
  // Filter tabs
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      buildAlertsList(tab.dataset.filter);
    });
  });

  // Servicios filter tabs
  document.querySelectorAll('.serv-filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.serv-filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      buildServiciosList(tab.dataset.serv);
    });
  });

  // Search inputs
  const originInput = document.getElementById('origin-input');
  const destInput = document.getElementById('dest-input');

  originInput.addEventListener('input', e => showSuggestions('origin-input', 'origin-suggestions', e.target.value));
  destInput.addEventListener('input', e => showSuggestions('dest-input', 'dest-suggestions', e.target.value));

  document.addEventListener('click', e => {
    if (!e.target.closest('.input-group')) {
      document.getElementById('origin-suggestions').classList.add('hidden');
      document.getElementById('dest-suggestions').classList.add('hidden');
    }
  });

  // Swap
  document.getElementById('swap-btn').addEventListener('click', swapOriginDest);

  // Calculate route
  document.getElementById('calculate-btn').addEventListener('click', handleCalculateRoute);

  // Download route
  document.getElementById('download-btn').addEventListener('click', handleDownloadRoute);

  // Notifications toggle
  document.getElementById('notif-toggle-btn').addEventListener('click', toggleNotifications);

  // Legend
  document.getElementById('legend-toggle-btn').addEventListener('click', () => showModal('legend-modal'));
  document.getElementById('legend-close').addEventListener('click', () => hideModal('legend-modal'));
  document.getElementById('legend-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('legend-modal')) hideModal('legend-modal');
  });

  // Windy weather
  const showWindy = () => showModal('windy-modal');
  document.getElementById('weather-btn').addEventListener('click', showWindy);
  document.getElementById('mobile-weather-btn')?.addEventListener('click', showWindy);
  document.getElementById('windy-close').addEventListener('click', () => hideModal('windy-modal'));
  document.getElementById('windy-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('windy-modal')) hideModal('windy-modal');
  });

  function onTap(el, fn) {
    if (!el) return;
    el.addEventListener('click', fn);
  }

  // Mobile notification button
  const mobileNotifBtn = document.getElementById('mobile-notif-btn');
  onTap(mobileNotifBtn, () => {
    const notifBtn = document.getElementById('notif-toggle-btn');
    if (notifBtn) notifBtn.click();
    const isActive = notificationsEnabled;
    mobileNotifBtn.textContent = isActive ? '🔕' : '🔔';
    mobileNotifBtn.style.borderColor = isActive ? 'var(--accent)' : 'rgba(255,255,255,0.1)';
  });

  // Mobile alerts button
  const mobileAlertsBtn = document.querySelector('.mobile-alerts-btn');
  onTap(mobileAlertsBtn, () => {
    panel.classList.add('open');
    panel.scrollTop = panel.scrollHeight;
  });

  // Mobile zoom buttons
  const zoomIn = document.getElementById('mobile-zoom-in');
  const zoomOut = document.getElementById('mobile-zoom-out');
  onTap(zoomIn, () => { if (typeof map !== 'undefined' && map) map.zoomIn(); });
  onTap(zoomOut, () => { if (typeof map !== 'undefined' && map) map.zoomOut(); });

  // Panel handle toggle
  const panelHandle = document.getElementById('panel-handle');
  onTap(panelHandle, () => { panel.classList.toggle('open'); });

  // Close bottom sheet when tapping on the map
  document.addEventListener('click', (e) => {
    if (panel.classList.contains('open')) {
      const mapEl = document.getElementById('map');
      if (mapEl && mapEl.contains(e.target)) {
        panel.classList.remove('open');
      }
    }
  });

  // Mobile search toggle
  const mobileSearch = document.getElementById('mobile-search');
  const mobileSearchToggle = document.getElementById('mobile-search-toggle');
  const mobileSearchInput = document.getElementById('mobile-search-input');
  onTap(mobileSearchToggle, () => {
    mobileSearch.classList.toggle('open');
    if (mobileSearch.classList.contains('open')) {
      setTimeout(() => mobileSearchInput.focus(), 100);
    }
  });

  // Mobile search: geocode on Enter and show on map
  if (mobileSearchInput) {
    mobileSearchInput.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        const query = e.target.value.trim();
        if (!query) return;
        mobileSearch.classList.remove('open');
        const coords = await geocodeCity(query);
        if (coords && typeof map !== 'undefined' && map) {
          map.setView(coords, 10, { animate: true });
          L.marker(coords, {
            icon: L.divIcon({ html: `<div style="background:#f59e0b;color:#000;padding:6px 10px;border-radius:8px;font-size:12px;font-weight:700;white-space:nowrap;box-shadow:0 3px 10px rgba(0,0,0,0.4)">📍 ${query}</div>`, className: '' })
          }).addTo(map);
        } else {
          showNotification({ title: 'No encontrado', body: 'No se pudo encontrar esa ubicación.', type: 'warning' });
        }
      }
    });
  }
}

// ─── SWAP ORIGIN/DEST ───────────────────────────
function swapOriginDest() {
  const originInput = document.getElementById('origin-input');
  const destInput = document.getElementById('dest-input');
  const tmpVal = originInput.value;
  const tmpLat = originInput.dataset.lat;
  const tmpLng = originInput.dataset.lng;
  originInput.value = destInput.value;
  originInput.dataset.lat = destInput.dataset.lat || '';
  originInput.dataset.lng = destInput.dataset.lng || '';
  destInput.value = tmpVal;
  destInput.dataset.lat = tmpLat || '';
  destInput.dataset.lng = tmpLng || '';
}

// ─── CALCULATE ROUTE ────────────────────────────
async function handleCalculateRoute() {
  const originInput = document.getElementById('origin-input');
  const destInput = document.getElementById('dest-input');
  const originName = originInput.value.trim();
  const destName = destInput.value.trim();

  if (!originName || !destName) {
    showNotification({ title: 'Campos incompletos', body: 'Por favor ingresá el origen y destino del viaje.', type: 'warning' });
    return;
  }

  showLoading();

  try {
    // Get coordinates (from dataset if selected from dropdown, else geocode)
    let originCoords = originInput.dataset.lat
      ? [parseFloat(originInput.dataset.lat), parseFloat(originInput.dataset.lng)]
      : await geocodeCity(originName);

    let destCoords = destInput.dataset.lat
      ? [parseFloat(destInput.dataset.lat), parseFloat(destInput.dataset.lng)]
      : await geocodeCity(destName);

    if (!originCoords || !destCoords) {
      hideLoading();
      showNotification({ title: 'Ciudad no encontrada', body: 'No se pudieron encontrar las ciudades. Revisá los nombres.', type: 'danger' });
      return;
    }

    // Get route from OSRM
    const routeOptions = await getRouteOptions(originCoords, destCoords);

if (!routeOptions || routeOptions.length === 0) {
  hideLoading();

  showNotification({
    title: 'Sin ruta disponible',
    body: 'No se pudo obtener ninguna ruta.',
    type: 'error'
  });

  return;
}

const selectedRoute = routeOptions[0];

availableRouteOptions = routeOptions;
renderRouteOptions(routeOptions, originCoords, destCoords, originName, destName);

const {
  coords,
  distance,
  duration
} = selectedRoute;

    // Draw primary route
    drawRoute(coords, 'primary');
    fitRoute(coords);

    // Add origin/dest markers
    addRouteMarkers(originCoords, destCoords, originName, destName);

    // Check route intersects cuts
    const affectedCuts = [];

    // Show alternative if cuts found
    let altInfo = null;
    if (affectedCuts.length > 0) {
      altInfo = affectedCuts[0].alternativa;
      const altCoords = affectedCuts[0].alternativa.altCoords || generateAlternativeRoute(coords, affectedCuts[0]);
      drawRoute(altCoords, 'alternative');
      const cutMid = affectedCuts[0].coords[Math.floor(affectedCuts[0].coords.length / 2)];
      showNotification({
        title: '⚠️ Corte detectado en tu ruta',
        body: `Se detectó un corte en ${affectedCuts[0].ruta}. Se muestra ruta alternativa en verde.`,
        type: 'danger', duration: 8000,
        location: cutMid
      });
    } else {
      showNotification({ title: '✅ Ruta calculada', body: `${originName} → ${destName}. Ruta libre de cortes.`, type: 'success', location: originCoords });
    }

    // Update UI
    updateRouteInfo({ distance, duration, hasCuts: affectedCuts.length > 0, cuts: affectedCuts, alt: altInfo });

    // Save route data for download
    savedRouteData = { originName, destName, originCoords, destCoords, coords, distance, duration, affectedCuts, timestamp: new Date().toISOString() };

    hideLoading();
  } catch (err) {
    hideLoading();
    console.error(err);
    showNotification({ title: 'Error', body: 'Ocurrió un error al calcular la ruta. ' + err.message, type: 'danger' });
  }
}

// ─── GEOCODE ─────────────────────────────────────
function normalizeNombre(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
async function geocodeCity(name) {
  const normalized = normalizeNombre(name);
  // First check local data (sin tildes)
  const local = CIUDADES_ARGENTINA.find(c => normalizeNombre(c.nombre) === normalized);
  if (local) return local.coords;

  // Try Nominatim
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name + ', Argentina')}&format=json&limit=1&countrycodes=ar`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { headers: { 'Accept-Language': 'es' }, signal: controller.signal });
    clearTimeout(timer);
    const data = await res.json();
    if (data.length > 0) return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
  } catch (e) {
    console.warn('Geocoding error:', e);
  }
  return null;
}
async function getOSRMRouteWithWaypoints(points) {
  const coordsText = points
    .map(p => `${p[1]},${p[0]}`)
    .join(';');

  const url = `https://router.project-osrm.org/route/v1/driving/${coordsText}?overview=full&geometries=geojson&alternatives=false`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (!data.routes || data.routes.length === 0) return null;

    const route = data.routes[0];

    const coords = route.geometry.coordinates.map(p => [
      p[1],
      p[0]
    ]);

    return {
      coords,
      distance: route.distance,
      duration: route.duration
    };
  } catch (e) {
    console.warn('OSRM waypoints error:', e);
    return null;
  }
}

async function getRouteOptions(originCoords, destCoords) {
  const options = [];

  const directa = await getOSRMRoute(originCoords, destCoords);

  if (directa) {
    options.push({
      nombre: 'Ruta recomendada',
      descripcion: 'Ruta calculada automáticamente',
      color: '#fbbf24',
      ...directa
    });
  }

  const porRN3 = await getOSRMRouteWithWaypoints([
    originCoords,
    [-45.8648, -67.4998],
    [-38.7183, -62.2663],
    destCoords
  ]);

  if (porRN3) {
    options.push({
      nombre: 'Opción por RN 3',
      descripcion: 'Pasando por Comodoro Rivadavia y Bahía Blanca',
      color: '#22c55e',
      ...porRN3
    });
  }

  const porRN40 = await getOSRMRouteWithWaypoints([
    originCoords,
    [-50.3371, -72.2648],
    [-41.1456, -71.3082],
    [-38.8986, -70.0650],
    destCoords
  ]);

  if (porRN40) {
    options.push({
      nombre: 'Opción por RN 40',
      descripcion: 'Pasando por El Calafate, Bariloche y Zapala',
      color: '#38bdf8',
      ...porRN40
    });
  }

  return options;
}
// ─── OSRM ROUTE ──────────────────────────────────
async function getOSRMRoute(origin, dest) {
  async function tryFetch(geom) {
    const url = `https://router.project-osrm.org/route/v1/driving/${origin[1]},${origin[0]};${dest[1]},${dest[0]}?overview=full&geometries=${geom}&alternatives=false`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return res.json();
  }
  try {
    let data;
    try { data = await tryFetch('polyline'); } catch { data = await tryFetch('polyline6'); }
    if (!data || !data.routes || data.routes.length === 0) return null;
    const route = data.routes[0];
    let coords;
    try { coords = decodePolyline(route.geometry); } catch { coords = null; }
    if (!coords || coords.length < 2) {
      try { coords = decodePolyline6(route.geometry); } catch { coords = null; }
    }
    if (!coords || coords.length < 2) return null;
    return { coords, distance: route.distance, duration: route.duration };
  } catch (e) {
    console.warn('OSRM error:', e);
    // Fallback
    const midLat = (origin[0] + dest[0]) / 2;
    const midLng = (origin[1] + dest[1]) / 2;
    const coords = [origin, [midLat, midLng], dest];
    return { coords, distance: haversine(origin, dest), duration: haversine(origin, dest) / 80 * 3.6, fallback: true };
  }
}

// ─── CHECK CUTS ON ROUTE ──────────────────────────
function checkRouteCuts(routeCoords) {
  const affected = [];
  RUTAS_CORTADAS.forEach(corte => {
    const cutMid = corte.coords[Math.floor(corte.coords.length / 2)];
    const minDist = routeCoords.reduce((min, pt) => {
      const d = haversine(pt, cutMid);
      return d < min ? d : min;
    }, Infinity);
    if (minDist < 150000) { // within 150km of route
      affected.push(corte);
    }
  });
  return affected;
}

// ─── GENERATE ALTERNATIVE ROUTE (simplified) ──────
function generateAlternativeRoute(mainCoords, cut) {
  if (!mainCoords || mainCoords.length < 2) return mainCoords;
  // Slightly offset route to simulate alternative path
  return mainCoords.map((pt, i) => {
    const factor = Math.sin(i / mainCoords.length * Math.PI) * 0.3;
    return [pt[0] + factor * 0.5, pt[1] + factor * 0.5];
  });
}

// ─── HAVERSINE DISTANCE ──────────────────────────
function haversine(a, b) {
  const R = 6371000;
  const dLat = (b[0] - a[0]) * Math.PI / 180;
  const dLon = (b[1] - a[1]) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * Math.PI / 180) * Math.cos(b[0] * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

// ─── ROUTE MARKERS ──────────────────────────────
let originMarker = null, destMarker = null;
function addRouteMarkers(origin, dest, originName, destName) {
  if (originMarker) map.removeLayer(originMarker);
  if (destMarker) map.removeLayer(destMarker);

  originMarker = L.marker(origin, {
    icon: L.divIcon({ html: `<div style="background:#22c55e;color:white;padding:6px 10px;border-radius:8px;font-size:12px;font-weight:700;white-space:nowrap;box-shadow:0 3px 10px rgba(0,0,0,0.4)">📍 ${originName}</div>`, className: '' })
  }).addTo(map);

  destMarker = L.marker(dest, {
    icon: L.divIcon({ html: `<div style="background:#ef4444;color:white;padding:6px 10px;border-radius:8px;font-size:12px;font-weight:700;white-space:nowrap;box-shadow:0 3px 10px rgba(0,0,0,0.4)">🏁 ${destName}</div>`, className: '' })
  }).addTo(map);
}

// ─── DOWNLOAD ROUTE ──────────────────────────────
function handleDownloadRoute() {
  if (!savedRouteData) return;

  // Save to localStorage
  const routes = JSON.parse(localStorage.getItem('rutasDescargadas') || '[]');
  const existing = routes.findIndex(r => r.originName === savedRouteData.originName && r.destName === savedRouteData.destName);
  if (existing >= 0) routes[existing] = savedRouteData;
  else routes.push(savedRouteData);
  localStorage.setItem('rutasDescargadas', JSON.stringify(routes));

  // Request SW to cache map tiles for the route area
  if (navigator.serviceWorker.controller) {
    const tileUrls = generateTileUrls(savedRouteData.coords);
    navigator.serviceWorker.controller.postMessage({ type: 'CACHE_ROUTE', urls: tileUrls });
  }

  showNotification({ title: '⬇️ Ruta descargada', body: `La ruta ${savedRouteData.originName} → ${savedRouteData.destName} fue guardada para uso sin conexión.`, type: 'success', duration: 5000 });
  document.getElementById('download-btn').textContent = '✅ Ruta guardada';
  setTimeout(() => { document.getElementById('download-btn').innerHTML = '⬇️ Descargar'; }, 3000);
}

function generateTileUrls(coords) {
  const urls = [];
  const zoom = 10;
  const seen = new Set();
  coords.forEach(([lat, lon]) => {
    const x = Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
    const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
    const key = `${x},${y}`;
    if (!seen.has(key)) {
      seen.add(key);
      urls.push(`https://a.basemaps.cartocdn.com/dark_all/${zoom}/${x}/${y}.png`);
    }
  });
  return urls.slice(0, 50);
}

// ─── NOTIFICATIONS ───────────────────────────────
function toggleNotifications() {
  notificationsEnabled = !notificationsEnabled;
  const btn = document.getElementById('notif-toggle-btn');
  const icon = document.getElementById('notif-icon');
  const mobileBtn = document.getElementById('mobile-notif-btn');
  if (notificationsEnabled) {
    icon.textContent = '🔔';
    btn.style.borderColor = 'var(--accent)';
    btn.style.color = 'var(--accent)';
    if (mobileBtn) { mobileBtn.textContent = '🔔'; mobileBtn.style.borderColor = 'var(--accent)'; }
    startNotifications();
    showNotification({ title: 'Alertas activadas', body: 'Recibirás notificaciones de cortes y clima en tiempo real.', type: 'success' });
    requestBrowserNotification();
  } else {
    icon.textContent = '🔕';
    btn.style.borderColor = '';
    btn.style.color = '';
    if (mobileBtn) { mobileBtn.textContent = '🔕'; mobileBtn.style.borderColor = ''; }
    stopNotifications();
    showNotification({ title: 'Alertas desactivadas', body: 'Ya no recibirás notificaciones.', type: 'info' });
  }
}

function requestBrowserNotification() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function startNotifications() {
  notifInterval = setInterval(() => {
    const demoNotifs = [
      { title: '🚧 Vialidad Nacional', body: 'RN 3 km 891: Se amplía el corte por inundación. Tiempo estimado de apertura: mañana 12:00hs.', type: 'danger', location: [-47.85, -65.93] },
      { title: '⛈️ Servicio Meteorológico Nacional', body: 'Se intensifican vientos en Patagonia. Se eleva alerta a ROJO en RN 40 y RN 22.', type: 'warning', location: [-40.0, -68.0] },
      { title: '✅ Vialidad Nacional', body: 'RN 7 km 340: Se habilita carril adicional. Demoras reducidas a 15 minutos.', type: 'success', location: [-33.68, -65.45] },
      { title: '🆘 Nuevo corte reportado', body: 'RN 34 km 220: Accidente multiple. Carril derecho bloqueado. Precaución.', type: 'danger', location: [-25.28, -65.30] },
      { title: '❄️ Alerta de nieve', body: 'Paso Los Libertadores (RN 7): Se suspende el tránsito por nevadas intensas.', type: 'warning', location: [-32.82, -70.15] }
    ];
    const n = demoNotifs[Math.floor(Math.random() * demoNotifs.length)];
    showNotification({ ...n, duration: 8000 });
    if (Notification.permission === 'granted') {
      new Notification(n.title, { body: n.body, icon: '🛣️' });
    }
    document.getElementById('notif-badge').textContent = String(parseInt(document.getElementById('notif-badge').textContent || '0') + 1);
  }, 15000);
}

function stopNotifications() {
  if (notifInterval) clearInterval(notifInterval);
}

function startNotificationDemo() {
  // Welcome notification
  showNotification({ title: '👋 Bienvenido a RutaSegura AR', body: 'Sistema cargado. Hay 6 cortes activos y 5 alertas climáticas en el mapa.', type: 'info', duration: 6000 });
  setTimeout(() => {
    showNotification({ title: '🚨 Vialidad Nacional', body: 'RN 40 km 1420 (Mendoza): Derrumbe activo. Ambos carriles cortados.', type: 'danger', duration: 7000, location: [-32.58, -69.10] });
  }, 4000);
}

// ─── UBICACIÓN Y ALERTAS CERCANAS ──────────────
function requestUserLocation() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    pos => checkNearbyAlerts(pos.coords.latitude, pos.coords.longitude),
    () => {},
    { enableHighAccuracy: false, timeout: 8000 }
  );
}

function distKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function checkNearbyAlerts(lat, lng) {
  // Check cuts
  RUTAS_CORTADAS.forEach(c => {
    if (notifiedAlerts.has(c.id)) return;
    const mid = c.coords[Math.floor(c.coords.length / 2)];
    const d = distKm(lat, lng, mid[0], mid[1]);
    if (d < 200) {
      notifiedAlerts.add(c.id);
      showNotification({
        title: `🚧 Corte cerca: ${c.ruta}`,
        body: `${c.motivo}. ${c.localidad}, ${c.provincia} (a ${Math.round(d)} km)`,
        type: 'danger', duration: 10000, location: mid
      });
    }
  });

  // Check weather alerts
  ALERTAS_CLIMA.forEach(a => {
    if (notifiedAlerts.has(a.id)) return;
    const d = distKm(lat, lng, a.center[0], a.center[1]);
    if (d < (a.radio / 1000 + 100)) {
      notifiedAlerts.add(a.id);
      showNotification({
        title: `⛈️ Alerta cerca: ${a.titulo}`,
        body: `${a.descripcion.slice(0, 80)}… (a ${Math.round(d)} km)`,
        type: a.severidad === 'rojo' ? 'danger' : 'warning',
        duration: 10000, location: a.center
      });
    }
  });
}

function renderRouteOptions(routeOptions, originCoords, destCoords, originName, destName) {

 let container = document.getElementById('route-options');

 if (!container) {
  console.error('No existe el div route-options en el HTML');
  return;
}

 container.style.display = 'flex';
 container.style.flexDirection = 'column';
 container.style.gap = '8px';
 container.style.marginTop = '12px';
 container.style.background = '#111827';
 container.style.padding = '12px';
 container.style.borderRadius = '12px';
 container.style.border = '1px solid #334155';

 console.log('Mostrando opciones de ruta:', routeOptions);
 
  container.innerHTML =
    '<h3 style="font-size:14px;margin:8px 0;color:#fff">🛣️ Caminos disponibles</h3>';



  routeOptions.forEach((ruta, index) => {

    const btn = document.createElement('button');

    btn.innerHTML = `
      <strong>${ruta.nombre}</strong><br>
      <small>${ruta.descripcion}</small><br>
      <small>${(ruta.distance / 1000).toFixed(0)} km · ${(ruta.duration / 3600).toFixed(1)} h</small>
    `;

    btn.style.padding = '10px';
    btn.style.borderRadius = '10px';
    btn.style.border = `2px solid ${ruta.color}`;
    btn.style.background = index === 0 ? ruta.color : '#111827';
    btn.style.color = index === 0 ? '#000' : '#fff';
    btn.style.cursor = 'pointer';
    btn.style.textAlign = 'left';

    btn.addEventListener('click', () => {

      drawRoute(ruta.coords, 'primary');

      fitRoute(ruta.coords);

      addRouteMarkers(
        originCoords,
        destCoords,
        originName,
        destName
      );

      document.querySelectorAll('#route-options button')
        .forEach(b => {
          b.style.background = '#111827';
          b.style.color = '#fff';
        });

      btn.style.background = ruta.color;
      btn.style.color = '#000';

    });

    container.appendChild(btn);

  });

}

const panel = document.getElementById('left-panel');