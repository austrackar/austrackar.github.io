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
    setTimeout(initFlota, 2000);
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

function toggleFlotaPanel() {
  const section = document.getElementById('flota-section');
  const isHidden = section.classList.contains('hidden');
  section.classList.toggle('hidden');
  // Close other panels if opening
  if (!section.classList.contains('hidden')) {
    // Scroll to flota section
    section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

const panel = document.getElementById('left-panel');

// ─── SETUP EVENT LISTENERS ───────────────────────
function setupEventListeners() {
  // Flota toggle
  document.getElementById('flota-btn')?.addEventListener('click', toggleFlotaPanel);
  document.getElementById('flota-close-btn')?.addEventListener('click', () => document.getElementById('flota-section')?.classList.add('hidden'));

  // Weather modal
  document.getElementById('weather-btn')?.addEventListener('click', () => showModal('windy-modal'));
  document.getElementById('mobile-weather-btn')?.addEventListener('click', () => showModal('windy-modal'));
  document.getElementById('windy-close')?.addEventListener('click', () => hideModal('windy-modal'));

  // Legend modal
  document.getElementById('legend-toggle-btn')?.addEventListener('click', () => showModal('legend-modal'));
  document.getElementById('legend-close')?.addEventListener('click', () => hideModal('legend-modal'));

  // Notifications toggle
  document.getElementById('notif-toggle-btn')?.addEventListener('click', () => {
    const container = document.getElementById('notifications-container');
    container.style.display = container.style.display === 'none' ? 'block' : 'none';
  });
  document.getElementById('mobile-notif-btn')?.addEventListener('click', () => {
    const container = document.getElementById('notifications-container');
    container.style.display = container.style.display === 'none' ? 'block' : 'none';
  });

  // Alert filter tabs
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      buildAlertsList(tab.dataset.filter);
    });
  });

  // Servicio filter tabs
  document.querySelectorAll('.serv-filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.serv-filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      buildServiciosList(tab.dataset.serv);
    });
  });

  // Mobile search toggle
  document.getElementById('mobile-search-toggle')?.addEventListener('click', () => {
    const ms = document.getElementById('mobile-search');
    ms.style.display = ms.style.display === 'none' ? 'block' : 'none';
  });

  // Mobile alerts button
  document.querySelector('.mobile-alerts-btn')?.addEventListener('click', () => {
    const panel = document.getElementById('left-panel');
    panel.classList.toggle('open');
    panel.scrollTop = 0;
  });

  // Panel handle (mobile)
  document.getElementById('panel-handle')?.addEventListener('click', () => {
    document.getElementById('left-panel').classList.toggle('open');
  });

  // Route calculation
  document.getElementById('calculate-btn')?.addEventListener('click', calculateRoute);

  // Swap origin/dest
  document.getElementById('swap-btn')?.addEventListener('click', () => {
    const origin = document.getElementById('origin-input');
    const dest = document.getElementById('dest-input');
    [origin.value, dest.value] = [dest.value, origin.value];
  });

  // Origin/dest input suggestions
  document.getElementById('origin-input')?.addEventListener('input', (e) => showSuggestions('origin-input', 'origin-suggestions', e.target.value));
  document.getElementById('dest-input')?.addEventListener('input', (e) => showSuggestions('dest-input', 'dest-suggestions', e.target.value));

  // Close suggestions on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#origin-input, #dest-input, .suggestions-dropdown')) {
      document.querySelectorAll('.suggestions-dropdown').forEach(d => d.classList.add('hidden'));
    }
  });
}

// ─── CALCULATE ROUTE ─────────────────────────────
function calculateRoute() {
  const originInput = document.getElementById('origin-input');
  const destInput = document.getElementById('dest-input');
  const origin = originInput?.dataset.lat && originInput?.dataset.lng
    ? [parseFloat(originInput.dataset.lat), parseFloat(originInput.dataset.lng)]
    : null;
  const dest = destInput?.dataset.lat && destInput?.dataset.lng
    ? [parseFloat(destInput.dataset.lat), parseFloat(destInput.dataset.lng)]
    : null;

  if (!origin || !dest) {
    showNotification({ title: 'Seleccioná origen y destino', body: 'Usá las sugerencias del campo de búsqueda', type: 'warning', duration: 4000 });
    return;
  }

  showLoading();
  const url = `https://router.project-osrm.org/route/v1/driving/${origin[1]},${origin[0]};${dest[1]},${dest[0]}?overview=full&geometries=geojson&alternatives=true`;

  fetch(url)
    .then(res => res.json())
    .then(data => {
      hideLoading();
      if (!data.routes || data.routes.length === 0) {
        showNotification({ title: 'Sin ruta disponible', body: 'No se encontró ruta entre esos puntos', type: 'danger', duration: 4000 });
        return;
      }
      const primary = data.routes[0];
      const alt = data.routes[1] || null;
      const coords = primary.geometry.coordinates.map(c => [c[1], c[0]]);
      drawRoute(coords, 'primary');

      if (alt) {
        const altCoords = alt.geometry.coordinates.map(c => [c[1], c[0]]);
        drawRoute(altCoords, 'alternative');
        fitRoute([...coords, ...altCoords]);
      } else {
        fitRoute(coords);
      }

      updateRouteInfo({
        distance: primary.distance,
        duration: primary.duration,
        hasCuts: false,
        cuts: [],
        alt: alt ? { desc: 'Ruta alternativa disponible', kmExtra: Math.round((alt.distance - primary.distance) / 1000), minExtra: Math.round((alt.duration - primary.duration) / 60) } : null
      });
    })
    .catch(err => {
      hideLoading();
      console.error('Error al calcular ruta:', err);
      showNotification({ title: 'Error de ruta', body: 'No se pudo conectar con OSRM', type: 'danger', duration: 4000 });
    });
}

// ─── USER LOCATION ────────────────────────────────
function requestUserLocation() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    pos => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      checkNearbyAlerts(lat, lng);

      // Add a blue dot marker for user location
      const userIcon = L.divIcon({
        html: '<div style="background:#3b82f6;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.5)"></div>',
        className: '', iconSize: [16, 16], iconAnchor: [8, 8]
      });
      L.marker([lat, lng], { icon: userIcon, zIndexOffset: 2000 })
        .addTo(map)
        .bindPopup('<strong>📍 Tu ubicación</strong>');
    },
    err => console.warn('Geolocation error:', err.message),
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

// ─── NEARBY ALERTS (Haversine) ────────────────────
function checkNearbyAlerts(lat, lng) {
  const R = 6371;
  const toRad = d => d * Math.PI / 180;
  const dist = (p1, p2) => {
    const dLat = toRad(p2[0] - p1[0]);
    const dLng = toRad(p2[1] - p1[1]);
    const a = Math.sin(dLat/2)**2 + Math.cos(toRad(p1[0])) * Math.cos(toRad(p2[0])) * Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const position = [lat, lng];
  const THRESHOLD = 100; // km

  // Check cuts
  RUTAS_CORTADAS.forEach(corte => {
    if (!corte.coords || notifiedAlerts.has(`cut-${corte.ruta}-${corte.kmInicio}`)) return;
    const near = corte.coords.some(c => dist(position, c) <= THRESHOLD);
    if (near) {
      notifiedAlerts.add(`cut-${corte.ruta}-${corte.kmInicio}`);
      showNotification({
        title: `🚧 Corte en ${corte.ruta}`,
        body: `${corte.motivo} — km ${corte.kmInicio}–${corte.kmFin}`,
        type: 'danger',
        location: corte.coords[Math.floor(corte.coords.length / 2)]
      });
    }
  });

  // Check climate alerts
  ALERTAS_CLIMA.forEach(alerta => {
    if (notifiedAlerts.has(`clima-${alerta.titulo}`)) return;
    if (dist(position, alerta.center) <= THRESHOLD) {
      notifiedAlerts.add(`clima-${alerta.titulo}`);
      showNotification({
        title: `⛈️ ${alerta.titulo}`,
        body: `${alerta.region} — ${alerta.descripcion}`,
        type: 'warning',
        location: alerta.center
      });
    }
  });
}

// ─── NOTIFICATION DEMO ────────────────────────────
function startNotificationDemo() {
  setTimeout(() => {
    showNotification({
      title: '🚛 RutaSegura AR activo',
      body: 'Sistema de monitoreo vial en funcionamiento',
      type: 'success',
      duration: 4000
    });
  }, 3000);
}