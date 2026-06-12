// ═══════════════════════════════════════════════
// APP.JS — Lógica principal de AusTrack
// ═══════════════════════════════════════════════

let notificationsEnabled = false;
let notifInterval = null;
let savedRouteData = null;

let availableRouteOptions = [];
let notifiedAlerts = new Set();
// ─── INIT ───────────────────────────────────────
// Called from boot script after Firebase auth resolves
async function initApp(profile) {
  try {
    // Try to fetch real data from Ruta0 and SMN
    fetchRealData().then(({ cutsFetched, weatherFetched }) => {
      if (cutsFetched || weatherFetched) {
        renderCutsOnMap();
        renderClimaOnMap();
        buildAlertsList('all');
      }
    });

    initMap();
    buildAlertsList('all');
    buildServiciosList('combustible');
    buildLegendModal();
    setupEventListeners();
    checkOnlineStatus();
    registerServiceWorker();
    setTimeout(startNotificationDemo, 3000);
    setTimeout(requestUserLocation, 1000);
    setTimeout(() => initFlota(profile?.empresa), 2000);

    if (profile?.rol === 'empleado') {
      setupEmpleadoSharing(profile);
    }
  } catch (err) {
    console.error('Error en inicialización:', err);
    showNotification({ title: 'Error de carga', body: 'Ocurrió un error al iniciar la aplicación: ' + err.message, type: 'danger' });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  onAuthReady((user, profile) => {
    if (!user) { window.location.href = 'login.html'; return; }
    document.getElementById('user-name').textContent = profile?.nombre || user.email;
    document.getElementById('user-btn').style.display = '';

    const mUserBtn = document.getElementById('mobile-user-btn');
    if (mUserBtn) mUserBtn.style.display = 'flex';
    const mLogoutBtn = document.getElementById('mobile-logout-btn');
    if (mLogoutBtn) mLogoutBtn.style.display = 'flex';
    document.getElementById('logout-btn-header').style.display = '';

    function doLogout() { logout().then(() => window.location.href = 'login.html'); }

    document.getElementById('logout-btn-header').onclick = doLogout;
    if (mLogoutBtn) mLogoutBtn.onclick = doLogout;

    initApp(profile);
  });
});

// ─── SERVICE WORKER ─────────────────────────────
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js')
      .then(reg => console.log('SW registrado:', reg.scope))
      .catch(err => console.log('SW error:', err));
  }
}

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

      // Check for road cuts along the route
      const routeCuts = findCutsAlongRoute(coords, RUTAS_CORTADAS);
      const hasCuts = routeCuts.length > 0;

      // Alternative from OSRM, or fallback to cut's alternativa data
      let altData = null;
      if (alt) {
        const altCoords = alt.geometry.coordinates.map(c => [c[1], c[0]]);
        drawRoute(altCoords, 'alternative');
        fitRoute([...coords, ...altCoords]);
        altData = { desc: 'Ruta alternativa disponible', kmExtra: Math.round((alt.distance - primary.distance) / 1000), minExtra: Math.round((alt.duration - primary.duration) / 60) };
      } else if (hasCuts) {
        // Use alternativa from the first cut that has one
        const cutWithAlt = routeCuts.find(c => c.alternativa);
        if (cutWithAlt) {
          const a = cutWithAlt.alternativa;
          if (a.altCoords && a.altCoords.length > 0) {
            drawRoute(a.altCoords, 'alternative');
            fitRoute([...coords, ...a.altCoords]);
          }
          altData = { desc: a.desc, kmExtra: a.kmExtra, minExtra: a.minExtra };
        } else {
          fitRoute(coords);
        }
      } else {
        fitRoute(coords);
      }

      updateRouteInfo({
        distance: primary.distance,
        duration: primary.duration,
        hasCuts,
        cuts: routeCuts,
        alt: altData
      });

      if (hasCuts) {
        const warningSection = document.getElementById('route-warning');
        const warningText = document.getElementById('warning-text');
        warningSection.classList.remove('hidden');
        warningText.innerHTML = routeCuts.map(c =>
          `🚧 <strong>${c.ruta}</strong> — ${c.motivo} (${c.provincia})`
        ).join('<br>');
        showNotification({ title: '⚠️ Cortes en la ruta', body: `Se detectaron ${routeCuts.length} corte(s) en el camino`, type: 'warning', duration: 8000 });
      } else {
        document.getElementById('route-warning')?.classList.add('hidden');
      }

      // Route click handlers — focus on selected route
      const primaryToggle = document.getElementById('route-primary-toggle');
      const altToggle = document.getElementById('route-alt-toggle');
      if (primaryToggle) {
        primaryToggle.onclick = () => focusRoute('primary');
      }
      if (altToggle) {
        altToggle.onclick = () => focusRoute('alternative');
      }

      // Enable sharing button for employees
      if (sharingProfile) {
        const destName = document.getElementById('dest-input')?.value || 'Destino';
        enableSharingButton();
        updateSharingDestInfo(destName, Math.round(primary.distance / 1000), formatDuration(primary.duration));
      }
    })
    .catch(err => {
      hideLoading();
      console.error('Error al calcular ruta:', err);
      showNotification({ title: 'Error de ruta', body: 'No se pudo conectar con OSRM', type: 'danger', duration: 4000 });
    });
}

function findCutsAlongRoute(routeCoords, cuts) {
  const R = 6371;
  const toRad = d => d * Math.PI / 180;
  const haversine = (p1, p2) => {
    const dLat = toRad(p2[0] - p1[0]);
    const dLng = toRad(p2[1] - p1[1]);
    const a = Math.sin(dLat/2)**2 + Math.cos(toRad(p1[0])) * Math.cos(toRad(p2[0])) * Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const affected = [];
  const THRESHOLD = 20; // km

  cuts.forEach(cut => {
    if (!cut.coords || cut.coords.length === 0) return;
    let near = false;
    for (let i = 0; i < routeCoords.length; i += 10) {
      for (let j = 0; j < cut.coords.length; j += 2) {
        if (haversine(routeCoords[i], cut.coords[j]) < THRESHOLD) {
          near = true;
          break;
        }
      }
      if (near) break;
    }
    if (near) affected.push(cut);
  });

  return affected;
}

// ─── USER LOCATION ────────────────────────────────
let userLocationMarker = null;

function requestUserLocation() {
  if (!navigator.geolocation) return;

  const userIcon = L.divIcon({
    html: '<div style="background:#3b82f6;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.5)"></div>',
    className: '', iconSize: [16, 16], iconAnchor: [8, 8]
  });

  function onPosition(pos) {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    checkNearbyAlerts(lat, lng);

    if (userLocationMarker) {
      userLocationMarker.setLatLng([lat, lng]);
    } else {
      userLocationMarker = L.marker([lat, lng], { icon: userIcon, zIndexOffset: 2000 })
        .addTo(map)
        .bindPopup('<strong>📍 Tu ubicación</strong>');
    }
  }

  // Get initial position
  navigator.geolocation.getCurrentPosition(onPosition, err => console.warn('GPS init:', err.message), { enableHighAccuracy: true, timeout: 10000 });

  // Watch for changes
  navigator.geolocation.watchPosition(onPosition, err => console.warn('GPS watch:', err.message), { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 });
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
      title: '🚛 AusTrack activo',
      body: 'Sistema de monitoreo vial en funcionamiento',
      type: 'success',
      duration: 4000
    });
  }, 3000);
}

// ─── EMPLEADO SHARING ─────────────────────────────
let sharingWatchId = null;
let sharingInterval = null;
let sharingActive = false;
let sharingProfile = null;
let sharingDestCoords = null;
let sharingRouteCoords = null;

function setupEmpleadoSharing(profile) {
  sharingProfile = profile;
  const section = document.getElementById('compartir-section');
  if (section) section.classList.remove('hidden');

  // Detect browser for tips
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  if (isSafari) {
    document.getElementById('compartir-status').textContent =
      '⚠️ Safari requiere permisos: tocá "aA" en la barra → Configuración del sitio web → Ubicación: Permitir.';
  } else if (/chrome/i.test(navigator.userAgent)) {
    document.getElementById('compartir-status').innerHTML =
      '📌 Hacé clic en el 🔒 de la barra de direcciones → <strong>Ubicación</strong>: Permitir. Después tocá <strong>Empezar Viaje</strong>.';
  }

  document.getElementById('compartir-start-btn')?.addEventListener('click', startSharing);
  document.getElementById('compartir-stop-btn')?.addEventListener('click', stopSharing);
}

function enableSharingButton() {
  const btn = document.getElementById('compartir-start-btn');
  if (btn && sharingProfile) btn.disabled = false;
}

function updateSharingDestInfo(nombre, dist, dur) {
  document.getElementById('compartir-dest-name').textContent = nombre;
  document.getElementById('compartir-dist').textContent = dist ? `${dist} km` : '';
  document.getElementById('compartir-time').textContent = dur || '';
  document.getElementById('compartir-dest-info').classList.remove('hidden');
}

function startSharing() {
  if (sharingActive || !sharingProfile) return;
  const destInput = document.getElementById('dest-input');
  const destName = destInput?.value?.trim() || 'En viaje';
  const destLat = destInput?.dataset?.lat;
  const destLng = destInput?.dataset?.lng;

  sharingActive = true;
  document.getElementById('compartir-start-btn').classList.add('hidden');
  document.getElementById('compartir-stop-btn').classList.remove('hidden');
  document.getElementById('compartir-gps-status').textContent = '🟢 Iniciando GPS...';

  try {
    if (typeof firebase === 'undefined' || !firebase.apps.length) {
      document.getElementById('compartir-gps-status').textContent = '⚠️ Firebase no conectado';
      return;
    }
  } catch (e) {
    document.getElementById('compartir-gps-status').textContent = '⚠️ Error: ' + e.message;
    return;
  }

  const db = firebase.database();
  const empId = firebase.auth().currentUser?.uid;
  if (!empId) {
    document.getElementById('compartir-gps-status').textContent = '⚠️ Sesión no encontrada';
    return;
  }
  const empresa = sharingProfile.empresa;
  const nombre = sharingProfile.nombre;

  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  function handleGpsError(err) {
    console.warn('GPS error:', err.code, err.message);
    let msg = '';
    if (err.code === 1) {
      if (isSafari) msg = 'Permiso denegado. Tocá "aA" en la barra → Configuración → Ubicación: Permitir';
      else if (/chrome/i.test(navigator.userAgent)) msg = 'Permiso denegado. Hacé clic en el 🔒 de la barra → Ubicación → Permitir';
      else msg = 'Permiso de ubicación denegado. Activá la ubicación en la configuración del navegador.';
    } else if (err.code === 2) {
      msg = 'GPS no disponible. Verificá que el GPS esté activado.';
    } else if (err.code === 3) {
      msg = 'GPS tardó mucho. Probá al aire libre o verificá la señal.';
    } else {
      msg = 'Error de GPS: ' + err.message;
    }
    document.getElementById('compartir-gps-status').textContent = '⚠️ ' + msg;
  }

  function sendLocation() {
    navigator.geolocation.getCurrentPosition(
      pos => {
        const data = {
          nombre,
          destino: destName,
          destinoCoords: (destLat && destLng) ? [parseFloat(destLng), parseFloat(destLat)] : null,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          timestamp: Date.now(),
          activo: true
        };
        db.ref('flota/' + empresa + '/' + empId).set(data)
          .then(() => document.getElementById('compartir-gps-status').textContent = '🟢 Compartiendo ubicación...')
          .catch(e => document.getElementById('compartir-gps-status').textContent = '⚠️ Error Firebase: ' + e.message);
      },
      handleGpsError,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  }

  sendLocation();
  sharingInterval = setInterval(sendLocation, 10000);

  sharingWatchId = navigator.geolocation.watchPosition(
    pos => {
      const data = {
        nombre,
        destino: destName,
        destinoCoords: (destLat && destLng) ? [parseFloat(destLng), parseFloat(destLat)] : null,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        timestamp: Date.now(),
        activo: true
      };
      db.ref('flota/' + empresa + '/' + empId).set(data);
    },
    handleGpsError,
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
  );

  showNotification({ title: '📍 Viaje iniciado', body: 'Compartiendo ubicación con el dueño', type: 'success', duration: 4000 });
}

function stopSharing() {
  if (!sharingActive) return;
  sharingActive = false;

  if (sharingInterval) { clearInterval(sharingInterval); sharingInterval = null; }
  if (sharingWatchId) { navigator.geolocation.clearWatch(sharingWatchId); sharingWatchId = null; }

  const db = firebase.database();
  const empId = firebase.auth().currentUser.uid;
  db.ref('flota/' + sharingProfile.empresa + '/' + empId).update({ activo: false, timestamp: Date.now() });

  document.getElementById('compartir-start-btn').classList.remove('hidden');
  document.getElementById('compartir-stop-btn').classList.add('hidden');
  document.getElementById('compartir-gps-status').textContent = '🔴 No compartiendo';

  showNotification({ title: 'Viaje finalizado', body: 'Dejaste de compartir tu ubicación', type: 'info', duration: 4000 });
}