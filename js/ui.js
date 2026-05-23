// ═══════════════════════════════════════════════
// UI.JS — Gestión de interfaz
// ═══════════════════════════════════════════════

function buildAlertsList(filter = 'all') {
  const container = document.getElementById('alerts-list');
  if (!container) return;
  container.innerHTML = '';

  const allItems = [
    ...RUTAS_CORTADAS.map(c => ({ ...c, _kind: 'corte' })),
    ...ALERTAS_CLIMA.map(a => ({ ...a, _kind: 'clima' }))
  ];

  let filtered = filter === 'all' ? allItems
    : filter === 'corte' ? allItems.filter(i => i._kind === 'corte')
    : allItems.filter(i => i._kind === 'clima');

  // Filter by current map viewport
  if (map) {
    const bounds = map.getBounds().pad(0.5);
    filtered = filtered.filter(item => {
      if (item._kind === 'corte') {
        if (!item.coords || item.coords.length === 0) return true;
        return item.coords.some(c => bounds.contains(c));
      } else {
        return bounds.contains(item.center);
      }
    });
  }

  if (filtered.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:var(--text3);font-size:13px;padding:20px">Sin alertas para este filtro</div>';
    return;
  }

  filtered.forEach(item => {
    const card = document.createElement('div');
    const sev = item.severidad || 'amarillo';
    card.className = `alert-card severidad-${sev}`;

    if (item._kind === 'corte') {
      const typeEmoji = { total: '🔴', parcial: '🟠' }[sev] || '⚠️';
      const realTag = item.esReal ? '<span style="font-size:9px;background:#1f6feb;color:white;padding:1px 6px;border-radius:6px;margin-left:4px">EN VIVO</span>' : '';
      card.innerHTML = `
        <div class="alert-header">
          <span class="alert-title">${typeEmoji} ${item.motivo}${realTag}</span>
          <span class="alert-badge badge-${sev}">${sev === 'total' ? 'TOTAL' : 'PARCIAL'}</span>
        </div>
        <div class="alert-meta">
          <span class="alert-ruta">🛣️ ${item.ruta}</span>${item.kmInicio ? ` · km ${item.kmInicio}–${item.kmFin}` : ''}<br>
          📍 ${item.localidad}, ${item.provincia}
        </div>`;
      card.addEventListener('click', () => {
        if (item.coords && item.coords.length > 0) {
          const mid = item.coords[Math.floor(item.coords.length / 2)];
          map.setView(mid, 10, { animate: true });
        } else {
          map.setView([-38.4161, -63.6167], 5, { animate: true });
        }
      });
    } else {
      const emoji = { viento: '💨', nieve: '❄️', lluvia: '🌧️', tormenta: '⛈️', niebla: '🌫️' }[item.tipo] || '⚠️';
      card.innerHTML = `
        <div class="alert-header">
          <span class="alert-title">${emoji} ${item.titulo}</span>
          <span class="alert-badge badge-${sev}">${sev.toUpperCase()}</span>
        </div>
        <div class="alert-meta">
          📍 ${item.region}<br>
          🛣️ ${item.rutas.join(', ')}
        </div>`;
      card.addEventListener('click', () => {
        map.setView(item.center, 7, { animate: true });
      });
    }

    container.appendChild(card);
  });
}

// ─── SERVICIOS ──────────────────────────────────
function buildServiciosList(filter = 'combustible') {
  const container = document.getElementById('servicios-list');
  if (!container) return;
  container.innerHTML = '';

  let items;
  if (filter === 'peaje') items = PEAJES;
  else if (filter === 'balanza') items = BALANZAS;
  else items = filter === 'combustible' ? ESTACIONES_SERVICIO : ALOJAMIENTOS;

  if (!items.length) {
    container.innerHTML = '<div style="text-align:center;color:var(--text3);font-size:13px;padding:20px">Sin servicios disponibles</div>';
    return;
  }

  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'alert-card';

    if (filter === 'peaje') {
      const meta = item.operador ? '🏢 ' + item.operador : '📍 ' + item.lat.toFixed(4) + ', ' + item.lng.toFixed(4);
      card.innerHTML = `
        <div class="alert-header" style="padding-bottom:2px">
          <span class="alert-title">💰 ${item.nombre || 'Peaje'}</span>
          <span class="alert-badge" style="background:#a855f7;color:white">PEAJE</span>
        </div>
        <div class="alert-meta">${meta}</div>`;
      card.addEventListener('click', () => {
        map.setView([item.lat, item.lng], 14, { animate: true });
        L.popup().setLatLng([item.lat, item.lng]).setContent(`<strong>💰 ${item.nombre || 'Peaje'}</strong><br>${item.operador ? '🏢 ' + item.operador : ''}`).openOn(map);
      });
    } else if (filter === 'balanza') {
      const meta = item.operador ? '🏢 ' + item.operador : '📍 ' + item.lat.toFixed(4) + ', ' + item.lng.toFixed(4);
      card.innerHTML = `
        <div class="alert-header" style="padding-bottom:2px">
          <span class="alert-title">⚖️ ${item.nombre}</span>
          <span class="alert-badge" style="background:#06b6d4;color:white">BALANZA</span>
        </div>
        <div class="alert-meta">${meta}</div>`;
      card.addEventListener('click', () => {
        map.setView([item.lat, item.lng], 14, { animate: true });
        L.popup().setLatLng([item.lat, item.lng]).setContent(`<strong>⚖️ ${item.nombre}</strong><br>${item.operador ? '🏢 ' + item.operador : ''}`).openOn(map);
      });
    } else if (filter === 'combustible') {
      const horarioOk = item.horario === '24h' || item.horario === '24/7';
      const marcaDisplay = item.marca && item.marca !== item.nombre ? ` · ${item.marca}` : '';
      card.innerHTML = `
        <div class="alert-header" style="padding-bottom:2px">
          <span class="alert-title">⛽ ${item.nombre}${marcaDisplay}</span>
          <span class="alert-badge" style="background:${horarioOk ? '#16a34a' : '#f59e0b'};color:white">${horarioOk ? '24h' : item.horario}</span>
        </div>
        <div class="alert-meta">
          📞 ${item.telefono || 'Sin teléfono'}
        </div>`;
      card.addEventListener('click', () => {
        map.setView(item.coords, 16, { animate: true });
        L.popup().setLatLng(item.coords).setContent(`<strong>⛽ ${item.nombre}</strong><br>${item.marca ? 'Marca: ' + item.marca + '<br>' : ''}📞 ${item.telefono || 'Sin teléfono'}`).openOn(map);
      });
    } else {
      card.innerHTML = `
        <div class="alert-header" style="padding-bottom:2px">
          <span class="alert-title">🏨 ${item.nombre}</span>
          <span class="alert-badge" style="background:#7c3aed;color:white;font-size:10px">HOTEL</span>
        </div>
        <div class="alert-meta" style="font-size:12px">
          ${item.direccion ? `📍 ${item.direccion}<br>` : ''}
          📞 ${item.telefono}
          ${item.web ? `<br>🌐 ${item.web}` : ''}
        </div>`;
      card.addEventListener('click', () => {
        map.setView(item.coords, 16, { animate: true });
        L.popup().setLatLng(item.coords).setContent(`<strong>🏨 ${item.nombre}</strong><br>${item.direccion ? '📍 ' + item.direccion + '<br>' : ''}📞 ${item.telefono}`).openOn(map);
      });
    }

    container.appendChild(card);
  });
}

function updateRouteInfo({ distance, duration, hasCuts, cuts, alt }) {
  const section = document.getElementById('route-info-section');
  section.classList.remove('hidden');

  document.getElementById('route-distance').textContent = `${(distance / 1000).toFixed(0)} km`;
  document.getElementById('route-duration').textContent = formatDuration(duration);
  const statusEl = document.getElementById('route-status');
  statusEl.textContent = hasCuts ? '⚠️ Afectada' : '✅ Libre';
  statusEl.style.color = hasCuts ? 'var(--danger)' : 'var(--success)';

  const warnEl = document.getElementById('route-warning');
  const altEl = document.getElementById('alternative-route-info');

  if (hasCuts && cuts.length > 0) {
    warnEl.classList.remove('hidden');
    document.getElementById('warning-text').textContent =
      `Tu ruta pasa por ${cuts.length} zona(s) con cortes: ${cuts.map(c => `${c.ruta} (${c.motivo})`).join(', ')}.`;

    if (alt) {
      altEl.classList.remove('hidden');
      document.getElementById('alt-route-details').innerHTML = `
        <div class="alt-detail"><span>📍 ${alt.desc}</span></div>
        <div class="alt-detail"><span>Distancia adicional</span><strong>+${alt.kmExtra} km</strong></div>
        <div class="alt-detail"><span>Tiempo adicional</span><strong>+${alt.minExtra} min</strong></div>`;
    } else {
      altEl.classList.add('hidden');
    }
  } else {
    warnEl.classList.add('hidden');
    altEl.classList.add('hidden');
  }

  document.getElementById('download-btn').disabled = false;
}

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m} min`;
}

function showNotification({ title, body, type = 'info', duration = 6000, location = null }) {
  const icons = { info: '📢', danger: '🚨', success: '✅', warning: '⚠️' };
  const container = document.getElementById('notifications-container');
  const el = document.createElement('div');
  el.className = `notification ${type}`;
  if (location) el.style.cursor = 'pointer';
  const now = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  el.innerHTML = `
    <span class="notification-icon">${icons[type]}</span>
    <div>
      <div class="notification-title">${title}</div>
      <div class="notification-body">${body}</div>
      <div class="notification-time">${now}</div>
    </div>
    <button onclick="event.stopPropagation();this.parentElement.remove()" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:16px;margin-left:auto;align-self:flex-start">✕</button>`;
  if (location) {
    el.addEventListener('click', () => {
      if (typeof map !== 'undefined' && map) {
        map.setView(location, 10, { animate: true });
        el.remove();
      }
    });
  }
  container.appendChild(el);
  setTimeout(() => el.remove(), duration);
}

function showModal(id) { document.getElementById(id).classList.remove('hidden'); }
function hideModal(id) { document.getElementById(id).classList.add('hidden'); }

function showLoading() { document.getElementById('map-loading').classList.remove('hidden'); }
function hideLoading() { document.getElementById('map-loading').classList.add('hidden'); }

function setOfflineMode(offline) {
  const banner = document.getElementById('offline-banner');
  const status = document.getElementById('connection-status');
  if (offline) {
    banner.classList.remove('hidden');
    status.classList.add('offline');
    document.getElementById('status-text').textContent = 'Sin conexión';
  } else {
    banner.classList.add('hidden');
    status.classList.remove('offline');
    document.getElementById('status-text').textContent = 'En línea';
  }
}

// Suggestions dropdown
function normalizeNombre(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
function showSuggestions(inputId, dropdownId, query) {
  const dropdown = document.getElementById(dropdownId);
  if (query.length < 2) { dropdown.classList.add('hidden'); return; }

  const q = normalizeNombre(query);
  const matches = CIUDADES_ARGENTINA.filter(c =>
    normalizeNombre(c.nombre).includes(q)
  ).slice(0, 6);

  if (matches.length === 0) { dropdown.classList.add('hidden'); return; }

  dropdown.innerHTML = matches.map(c =>
    `<div class="suggestion-item" data-lat="${c.coords[0]}" data-lng="${c.coords[1]}" data-nombre="${c.nombre}">
      📍 ${c.nombre}
    </div>`
  ).join('');

  dropdown.classList.remove('hidden');

  dropdown.querySelectorAll('.suggestion-item').forEach(item => {
    item.addEventListener('click', () => {
      document.getElementById(inputId).value = item.dataset.nombre;
      document.getElementById(inputId).dataset.lat = item.dataset.lat;
      document.getElementById(inputId).dataset.lng = item.dataset.lng;
      dropdown.classList.add('hidden');
    });
  });
}

function buildLegendModal() {
  document.getElementById('legend-content').innerHTML = `
    <div class="legend-grid">
      <div class="legend-section-title">🚧 Cortes de Ruta</div>
      <div class="legend-item"><div class="legend-icon" style="background:#ef4444;border-radius:3px;height:4px;width:24px"></div><span>Corte total — ruta bloqueada</span></div>
      <div class="legend-item"><div class="legend-icon" style="background:#f97316;border-radius:3px;height:4px;width:24px;border-top:2px dashed #f97316;background:none"></div><span>Corte parcial / obras</span></div>
      <div class="legend-section-title">🆘 Puntos SOS</div>
      <div class="legend-item"><span>🪖</span><span>Gendarmería Nacional</span></div>
      <div class="legend-item"><span>🏥</span><span>Hospital / Centro de salud</span></div>
      <div class="legend-item"><span>👮</span><span>Comisaría / Policía</span></div>
      <div class="legend-item"><span>🚒</span><span>Bomberos Voluntarios</span></div>
      <div class="legend-item"><span>🛣️</span><span>Peaje con asistencia</span></div>
      <div class="legend-item"><span>⛽</span><span>Estación de servicio</span></div>
      <div class="legend-section-title">⛈️ Alertas Climáticas</div>
      <div class="legend-item"><div class="legend-icon" style="background:rgba(239,68,68,0.3);border:2px solid #ef4444;border-radius:50%;width:18px;height:18px"></div><span>Alerta ROJA — Peligro extremo</span></div>
      <div class="legend-item"><div class="legend-icon" style="background:rgba(249,115,22,0.3);border:2px solid #f97316;border-radius:50%;width:18px;height:18px"></div><span>Alerta NARANJA — Peligro</span></div>
      <div class="legend-item"><div class="legend-icon" style="background:rgba(245,158,11,0.3);border:2px solid #f59e0b;border-radius:50%;width:18px;height:18px"></div><span>Alerta AMARILLA — Precaución</span></div>
      <div class="legend-section-title">🗺️ Rutas Calculadas</div>
      <div class="legend-item"><div style="width:24px;height:4px;background:#3b82f6;border-radius:2px"></div><span>Ruta principal</span></div>
      <div class="legend-item"><div style="width:24px;height:4px;background:#22c55e;border-radius:2px;border-top:2px dashed #22c55e;background:none"></div><span>Ruta alternativa</span></div>
    </div>`;
}
