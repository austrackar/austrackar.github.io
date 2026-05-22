// ═══════════════════════════════════════════════
// FLOTA.JS — Tracking de empleados en tiempo real
// ═══════════════════════════════════════════════
// Depende de: firebase-config.js, Firebase App + Database SDK
// ═══════════════════════════════════════════════

let flotaMarkers = {};
let flotaData = {};
let flotaInitialized = false;
let flotaDbRef = null;
let flotaLayerGroup = null;

function initFlota() {
  if (flotaInitialized) return;
  try {
    if (typeof firebase === 'undefined' || !FIREBASE_CONFIG) {
      console.warn('⚠️ Firebase no disponible. Flota desactivada.');
      showNotification({ title: 'Flota no disponible', body: 'Configurá Firebase en js/firebase-config.js para usar el tracking de flota.', type: 'warning', duration: 5000 });
      return;
    }
    firebase.initializeApp(FIREBASE_CONFIG);
    const db = firebase.database();
    flotaDbRef = db.ref('flota');
    flotaLayerGroup = L.layerGroup().addTo(map);

    flotaDbRef.on('value', snapshot => {
      const data = snapshot.val();
      if (!data) {
        clearFlotaMarkers();
        updateFlotaPanel([]);
        return;
      }
      flotaData = data;
      updateFlotaMarkers(data);
      updateFlotaPanel(data);
    });

    flotaInitialized = true;
    console.log('✅ Flota conectada a Firebase');
  } catch (e) {
    console.error('Error al iniciar flota:', e);
  }
}

function updateFlotaMarkers(data) {
  const activeIds = new Set(Object.keys(data));
  // Remove markers for employees no longer present
  Object.keys(flotaMarkers).forEach(id => {
    if (!activeIds.has(id)) {
      flotaLayerGroup.removeLayer(flotaMarkers[id]);
      delete flotaMarkers[id];
    }
  });

  Object.entries(data).forEach(([id, emp]) => {
    if (!emp.lat || !emp.lng) return;
    const coords = [emp.lat, emp.lng];
    const now = Date.now();
    const lastSeen = emp.timestamp || 0;
    const isActive = (now - lastSeen) < 60000; // active if seen within 60s

    if (flotaMarkers[id]) {
      flotaMarkers[id].setLatLng(coords);
      flotaMarkers[id].setOpacity(isActive ? 1 : 0.4);
    } else {
      const color = isActive ? '#22c55e' : '#6b7280';
      const icon = L.divIcon({
        html: `<div style="display:flex;align-items:center;gap:4px;background:${color};color:white;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.5);border:2px solid white">
          🚛 ${emp.nombre || id}
          <span style="background:rgba(0,0,0,0.3);border-radius:50%;width:8px;height:8px;display:inline-block;animation:${isActive ? 'pulse 1.5s infinite' : 'none'}"></span>
        </div>`,
        className: '',
        iconSize: [0, 0],
        iconAnchor: [0, 0]
      });
      const marker = L.marker(coords, { icon, zIndexOffset: 1000 }).addTo(flotaLayerGroup);
      marker.bindPopup(`
        <strong>🚛 ${emp.nombre}</strong><br>
        ${emp.ruta ? '🛣️ ' + emp.ruta + '<br>' : ''}
        📱 ${isActive ? '🟢 En línea' : '🔴 Sin señal'}<br>
        🕐 ${lastSeen ? new Date(lastSeen).toLocaleTimeString('es-AR') : '—'}
      `);
      flotaMarkers[id] = marker;
    }
  });
}

function clearFlotaMarkers() {
  Object.values(flotaMarkers).forEach(m => flotaLayerGroup.removeLayer(m));
  flotaMarkers = {};
}

function updateFlotaPanel(data) {
  const container = document.getElementById('flota-list');
  if (!container) return;
  const entries = Object.entries(data).filter(([, e]) => e.lat && e.lng);
  if (entries.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:var(--text3);font-size:13px;padding:20px">Nadie en ruta todavía</div>';
    return;
  }
  container.innerHTML = entries.map(([id, emp]) => {
    const now = Date.now();
    const lastSeen = emp.timestamp || 0;
    const isActive = (now - lastSeen) < 60000;
    const ago = lastSeen ? formatTimeAgo(now - lastSeen) : '—';
    return `<div class="flota-card" data-flota-id="${id}">
      <div class="flota-avatar" style="background:${isActive ? '#16a34a' : '#6b7280'}">🚛</div>
      <div class="flota-info">
        <div class="flota-name">${emp.nombre}</div>
        <div class="flota-meta">${emp.ruta ? '🛣️ ' + emp.ruta + ' · ' : ''}${ago}</div>
      </div>
      <span class="flota-status" style="background:${isActive ? '#16a34a' : '#6b7280'}">${isActive ? 'En ruta' : 'Inactivo'}</span>
    </div>`;
  }).join('');

  // Click to center on employee
  container.querySelectorAll('.flota-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.flotaId;
      const emp = data[id];
      if (emp && emp.lat && emp.lng && map) {
        map.setView([emp.lat, emp.lng], 12, { animate: true });
        if (flotaMarkers[id]) {
          flotaMarkers[id].openPopup();
        }
      }
    });
  });
}

function formatTimeAgo(diffMs) {
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return 'Ahora';
  const min = Math.floor(sec / 60);
  if (min < 60) return `Hace ${min} min`;
  const h = Math.floor(min / 60);
  return `Hace ${h}h ${min % 60}min`;
}
