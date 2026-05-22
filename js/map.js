// ═══════════════════════════════════════════════
// MAP.JS — Gestión del mapa Leaflet
// ═══════════════════════════════════════════════

let map, sosCluster = null, currentRouteLayer = null, altRouteLayer = null;
const isMobile = window.innerWidth <= 768;
let cutLayers = [], 
    sosLayers = [], 
    sosRouteLayers = [],
    climaLayers = [], 
    routeNetworkLayers = [],
    provincialRouteLayers = [];
const TILE_LAYERS = {
  argenmap_oscuro: { url: 'https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/argenmap_oscuro@EPSG%3A3857@png/{z}/{x}/{y}.png', attr: '<a href="http://www.ign.gob.ar" target="_blank">IGN Argentina</a> + <a href="http://www.osm.org/copyright" target="_blank">OpenStreetMap</a>', tms: true, maxZoom: 18 },
  argenmap: { url: 'https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG%3A3857@png/{z}/{x}/{y}.png', attr: '<a href="http://www.ign.gob.ar" target="_blank">IGN Argentina</a> + <a href="http://www.osm.org/copyright" target="_blank">OpenStreetMap</a>', tms: true, maxZoom: 18 },
  satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr: '© Esri' }
};

let currentTileLayer = null;

function initMap() {
  try {
  map = L.map('map', {
    center: [-38.4161, -63.6167],
    zoom: 5,
    zoomControl: false,
    maxZoom: 18,
    minZoom: 4,
    preferCanvas: true
  });

  sosCluster = L.markerClusterGroup({
    chunkedLoading: true,
    maxClusterRadius: 50,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true,
    disableClusteringAtZoom: 15
  });
  map.addLayer(sosCluster);

  const defaultLayer = TILE_LAYERS.argenmap_oscuro;
  currentTileLayer = L.tileLayer(defaultLayer.url, {
    attribution: defaultLayer.attr,
    maxZoom: defaultLayer.maxZoom || 19,
    tms: defaultLayer.tms || false
  }).addTo(map);

  // Zoom buttons
  document.getElementById('zoom-in-btn')?.addEventListener('click', () => map.zoomIn());
  document.getElementById('zoom-out-btn')?.addEventListener('click', () => map.zoomOut());
  const doZoomIn = () => { map.setZoom(Math.min(map.getZoom() + 1, map.getMaxZoom())); };
  const doZoomOut = () => { map.setZoom(Math.max(map.getZoom() - 1, map.getMinZoom())); };
  const mzi = document.getElementById('mobile-zoom-in');
  const mzo = document.getElementById('mobile-zoom-out');
  if (mzi) { mzi.onclick = doZoomIn; mzi.ontouchstart = function(e) { e.preventDefault(); doZoomIn(); }; mzi.onmousedown = doZoomIn; }
  if (mzo) { mzo.onclick = doZoomOut; mzo.ontouchstart = function(e) { e.preventDefault(); doZoomOut(); }; mzo.onmousedown = doZoomOut; }

  // Layer toggle
  document.querySelectorAll('.layer-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.layer-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const l = TILE_LAYERS[btn.dataset.layer];
      if (currentTileLayer) map.removeLayer(currentTileLayer);
      currentTileLayer = L.tileLayer(l.url, { attribution: l.attr, maxZoom: l.maxZoom || 19, tms: l.tms || false }).addTo(map);
      currentTileLayer.bringToBack();
    });
  });

  renderRoutesNetwork();
  renderProvincialRoutes();
  renderCutsOnMap();
  renderSOSOnMap();
  renderClimaOnMap();

  // Re-render cuts/weather on map move
  map.on('moveend', () => {
    renderCutsOnMap();
    renderClimaOnMap();
  });

  } catch (e) {
    console.error('Error en initMap:', e);
  }
}

// ─── NETWORK DE RUTAS NACIONALES ─────────────────
function renderRoutesNetwork() {
  routeNetworkLayers.forEach(l => map.removeLayer(l));
  routeNetworkLayers = [];

  fetch('data/export.json')
    .then(res => res.json())
    .then(data => {
      const layer = L.geoJSON(data, {
        filter: feature => {
          return feature.geometry &&
            (
              feature.geometry.type === 'LineString' ||
              feature.geometry.type === 'MultiLineString'
            );
        },
        style: feature => ({
          color: '#fb923c',
          weight: isMobile ? 0.5 : 1,
          opacity: isMobile ? 0.1 : 0.2
        }),
        onEachFeature: (feature, layer) => {
          const ref = feature.properties.ref;
          const name = feature.properties.name;

          layer.bindTooltip(
            ref ? `RN ${ref}` : name || 'Ruta Nacional',
            { sticky: true }
          );
        }
      }).addTo(map);

      routeNetworkLayers.push(layer);
      generateSOSOnRoutes(data);
    })
    .catch(err => {
      console.error('Error cargando rutas nacionales:', err);
    });

}

// ─── POSTES SOS SOBRE RUTAS NACIONALES ──────────
function generateSOSOnRoutes(geoData) {
  if (!sosCluster) return;
  sosCluster.clearLayers();
  sosRouteLayers = [];

  const icon = L.divIcon({
    html: `<div style="background:#dc2626;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;box-shadow:0 2px 8px rgba(0,0,0,0.5);border:2px solid white;color:white;letter-spacing:0.5px">SOS</div>`,
    className: '', iconSize: [22, 22], iconAnchor: [11, 11]
  });

  let count = 0;
  const STEP = 800;

  geoData.features.forEach(feature => {
    if (!feature.geometry) return;
    const ref = feature.properties.ref || feature.properties.name || 'Ruta Nacional';
    const coords = feature.geometry.coordinates;
    const paths = feature.geometry.type === 'MultiLineString' ? coords : [coords];

    paths.forEach(path => {
      for (let i = 0; i < path.length; i += STEP) {
        const [lng, lat] = path[i];
        const marker = L.marker([lat, lng], { icon });
        marker.bindPopup(`
          <div style="font-family:Inter,sans-serif;min-width:170px">
            <div style="background:#dc2626;color:white;padding:8px 12px;border-radius:6px 6px 0 0;margin:-4px -4px 8px;font-size:13px;font-weight:700">🆘 Poste SOS</div>
            <div style="font-size:12px;margin-bottom:4px"><strong>${ref}</strong></div>
            <div style="font-size:11px;color:#666">Emergencias: <strong>0800-555-5050</strong></div>
          </div>
        `);
        sosRouteLayers.push(marker);
        sosCluster.addLayer(marker);
        count++;
      }
    });
  });
}

function renderProvincialRoutes() {

  provincialRouteLayers.forEach(l => map.removeLayer(l));

  provincialRouteLayers = [];

  fetch('data/provinciales.json')

    .then(res => res.json())

    .then(data => {

      const layer = L.geoJSON(data, {

        filter: feature => {

          return feature.geometry && (

            feature.geometry.type === 'LineString' ||

            feature.geometry.type === 'MultiLineString'

          );

        },

        style: feature => ({

          color: '#38bdf8',
          weight: isMobile ? 0.4 : 0.8,
          opacity: isMobile ? 0.06 : 0.12

        }),

        onEachFeature: (feature, layer) => {

          const ref = feature.properties.ref;

          const name = feature.properties.name;

          layer.bindTooltip(

            ref ? `RP ${ref}` : name || 'Ruta Provincial',

            { sticky: true }

          );

        }

      }).addTo(map);

      provincialRouteLayers.push(layer);

    })

    .catch(err => {

      console.error('Error cargando rutas provinciales:', err);

    });

}

// ─── FILTRO POR VISTA ─────────────────────────
function inViewport(latlng, pad = 0.3) {
  if (!map) return true;
  return map.getBounds().pad(pad).contains(latlng);
}

function renderCutsOnMap() {
  cutLayers.forEach(l => map.removeLayer(l));
  cutLayers = [];

  RUTAS_CORTADAS.forEach(corte => {
    if (!corte.coords || corte.coords.length < 2) return;
    const visible = corte.coords.some(c => inViewport(c, 0.4));
    if (!visible) return;
    const isTotal = corte.severidad === 'total';
    const color = isTotal ? '#ef4444' : '#f97316';
    const bgGlow = isTotal ? 'rgba(239,68,68,0.35)' : 'rgba(249,115,22,0.35)';

    // Halo exterior (glow effect)
    const halo = L.polyline(corte.coords, {
      color: bgGlow, weight: 18, opacity: 1
    }).addTo(map);

    // Línea principal del corte
    const polyline = L.polyline(corte.coords, {
      color,
      weight: isTotal ? 8 : 6,
      opacity: 1,
      dashArray: isTotal ? null : '12,6',
      lineCap: 'round'
    }).addTo(map);

    // Marcador central con ícono grande
    const midIdx = Math.floor(corte.coords.length / 2);
    const midPt = corte.coords[midIdx];

    const markerHtml = `
      <div style="position:relative;text-align:center">
        <div style="
          background:${color};
          color:white;
          padding:6px 10px 6px 8px;
          border-radius:10px;
          font-size:12px;
          font-weight:800;
          white-space:nowrap;
          box-shadow:0 3px 14px rgba(0,0,0,0.6);
          border:2px solid white;
          display:flex;align-items:center;gap:5px
        ">
          🚧 ${corte.ruta}
          <span style="background:rgba(0,0,0,0.25);border-radius:6px;padding:1px 5px;font-size:10px">${isTotal ? 'CERRADO' : 'PARCIAL'}</span>
        </div>
        <div style="
          width:0;height:0;
          border-left:8px solid transparent;
          border-right:8px solid transparent;
          border-top:8px solid ${color};
          margin:0 auto;
        "></div>
      </div>`;

    const icon = L.divIcon({ html: markerHtml, className: '', iconAnchor: [55, 42] });
    const marker = L.marker(midPt, { icon, zIndexOffset: 500 }).addTo(map);

    // Popup de detalle
    const popupContent = `
      <div style="font-family:Inter,sans-serif;min-width:260px">
        <div style="background:${color};color:white;padding:12px 14px;border-radius:8px 8px 0 0;margin:-5px -5px 12px">
          <div style="font-size:16px;margin-bottom:2px">🚧 ${corte.ruta}</div>
          <strong style="font-size:13px">km ${corte.kmInicio} – ${corte.kmFin}</strong>
          <div style="font-size:11px;opacity:0.85;margin-top:2px">📍 ${corte.localidad}, ${corte.provincia}</div>
        </div>
        <div style="padding:0 2px">
          <div style="background:${isTotal ? '#fef2f2' : '#fff7ed'};border-radius:8px;padding:10px;margin-bottom:10px">
            <p style="font-size:13px;font-weight:700;color:${color};margin-bottom:4px">${corte.motivo}</p>
            <p style="font-size:12px;color:#555">${corte.descripcion}</p>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:11px;margin-bottom:10px">
            <div style="background:#f8fafc;padding:8px;border-radius:6px">
              <div style="color:#666;margin-bottom:2px">⏰ Desde</div>
              <strong>${formatDate(corte.desde)}</strong>
            </div>
            <div style="background:#f8fafc;padding:8px;border-radius:6px">
              <div style="color:#666;margin-bottom:2px">🔓 Estimación</div>
              <strong>${formatDate(corte.estimacion)}</strong>
            </div>
          </div>
          <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:10px">
            <strong style="color:#16a34a;font-size:12px">🔄 Ruta Alternativa:</strong>
            <p style="font-size:11px;color:#333;margin:4px 0">${corte.alternativa.desc}</p>
            <div style="display:flex;gap:12px;font-size:11px;margin-top:6px">
              ${corte.alternativa.kmExtra > 0 ? `<span style="background:#dcfce7;padding:2px 8px;border-radius:10px">+${corte.alternativa.kmExtra} km</span>` : ''}
              <span style="background:#dcfce7;padding:2px 8px;border-radius:10px">+${corte.alternativa.minExtra} min</span>
            </div>
          </div>
          <div style="font-size:10px;color:#999;margin-top:8px;text-align:right">Fuente: ${corte.fuente}</div>
        </div>
      </div>`;

    halo.bindPopup(popupContent, { maxWidth: 320 });
    polyline.bindPopup(popupContent, { maxWidth: 320 });
    marker.bindPopup(popupContent, { maxWidth: 320 });

    cutLayers.push(halo, polyline, marker);
  });
}

function renderSOSOnMap() {
  sosLayers.forEach(l => map.removeLayer(l));
  sosLayers = [];

  const typeConfig = {
    gendarmeria: { color: '#16a34a', bg: '#dcfce7', emoji: '🪖' },
    hospital: { color: '#dc2626', bg: '#fee2e2', emoji: '🏥' },
    policia: { color: '#1d4ed8', bg: '#dbeafe', emoji: '👮' },
    bomberos: { color: '#ea580c', bg: '#fed7aa', emoji: '🚒' },
    peaje: { color: '#7c3aed', bg: '#ede9fe', emoji: '🛣️' },
    'estacion-servicio': { color: '#0891b2', bg: '#cffafe', emoji: '⛽' }
  };

  PUNTOS_SOS.forEach(sos => {
    const cfg = typeConfig[sos.tipo] || typeConfig.policia;
    const icon = L.divIcon({
      html: `<div style="background:${cfg.color};width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 3px 10px rgba(0,0,0,0.4);border:2px solid white">${cfg.emoji}</div>`,
      className: '', iconSize: [32, 32], iconAnchor: [16, 16]
    });
    const marker = L.marker(sos.coords, { icon }).addTo(map);

    const servicesHtml = sos.servicios.map(s =>
      `<span style="background:${cfg.bg};color:${cfg.color};font-size:10px;padding:2px 8px;border-radius:10px;display:inline-block;margin:2px;font-weight:600">${s}</span>`
    ).join('');

    const popup = `
      <div style="font-family:Inter,sans-serif;min-width:230px">
        <div style="background:${cfg.color};color:white;padding:10px 14px;border-radius:8px 8px 0 0;margin:-5px -5px 10px">
          <div style="font-size:18px">${cfg.emoji} <strong>PUNTO SOS</strong></div>
          <div style="font-size:12px;opacity:0.9">${sos.nombre}</div>
        </div>
        <div style="padding:0 4px">
          <div style="font-size:11px;color:#666;margin-bottom:8px">${sos.ruta} — km ${sos.km}</div>
          <div style="font-size:14px;font-weight:800;color:${cfg.color};margin-bottom:8px">📞 ${sos.telefono}</div>
          <div style="margin-bottom:6px"><strong style="font-size:11px;color:#333">Servicios disponibles:</strong><br>${servicesHtml}</div>
        </div>
      </div>`;

    marker.bindPopup(popup, { maxWidth: 280 });
    sosLayers.push(marker);
  });
}

function renderClimaOnMap() {
  climaLayers.forEach(l => map.removeLayer(l));
  climaLayers = [];

  const colorMap = {
    rojo: { fill: 'rgba(239,68,68,0.15)', stroke: '#ef4444', icon: '🔴' },
    naranja: { fill: 'rgba(249,115,22,0.15)', stroke: '#f97316', icon: '🟠' },
    amarillo: { fill: 'rgba(245,158,11,0.15)', stroke: '#f59e0b', icon: '🟡' }
  };
  const tipoEmoji = { viento: '💨', nieve: '❄️', lluvia: '🌧️', tormenta: '⛈️', niebla: '🌫️' };

  ALERTAS_CLIMA.forEach(alerta => {
    if (!inViewport(alerta.center, 1.5)) return;
    const cfg = colorMap[alerta.severidad] || colorMap.amarillo;
    const emoji = tipoEmoji[alerta.tipo] || '⚠️';

    const circle = L.circle(alerta.center, {
      radius: alerta.radio,
      fillColor: cfg.fill, fillOpacity: 1,
      color: cfg.stroke, weight: 2, opacity: 0.8,
      dashArray: '8,4'
    }).addTo(map);

    const labelIcon = L.divIcon({
      html: `<div style="background:rgba(0,0,0,0.7);backdrop-filter:blur(4px);color:white;padding:5px 10px;border-radius:20px;font-size:12px;font-weight:600;white-space:nowrap;border:1px solid ${cfg.stroke};box-shadow:0 2px 8px rgba(0,0,0,0.5)">${emoji} ${alerta.titulo}</div>`,
      className: '', iconAnchor: [60, 10]
    });
    const label = L.marker(alerta.center, { icon: labelIcon }).addTo(map);

    const popup = `
      <div style="font-family:Inter,sans-serif;min-width:250px">
        <div style="background:${cfg.stroke};color:white;padding:10px 14px;border-radius:8px 8px 0 0;margin:-5px -5px 10px">
          <strong>${emoji} ${alerta.titulo}</strong>
          <div style="font-size:11px;opacity:0.9">${alerta.region}</div>
        </div>
        <div style="padding:0 4px">
          <p style="font-size:12px;color:#333;margin-bottom:10px">${alerta.descripcion}</p>
          <div style="font-size:11px;color:#555;margin-bottom:6px"><strong>Provincias:</strong> ${alerta.provincias.join(', ')}</div>
          <div style="font-size:11px;color:#555;margin-bottom:6px"><strong>Rutas afectadas:</strong> ${alerta.rutas.join(', ')}</div>
          <div style="font-size:11px;color:#555;margin-bottom:6px"><strong>Válido hasta:</strong> ${formatDate(alerta.validoHasta)}</div>
          <div style="font-size:10px;color:#999;margin-top:8px">Fuente: ${alerta.fuente}</div>
        </div>
      </div>`;

    circle.bindPopup(popup, { maxWidth: 300 });
    label.bindPopup(popup, { maxWidth: 300 });

    climaLayers.push(circle, label);
  });
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function drawRoute(coords, type) {
  clearRoute();
  const isPrimary = type === 'primary';
  // Dark outline/halo for visibility over any background
  const outline = L.polyline(coords, {
    color: '#000',
    weight: isPrimary ? 9 : 7,
    opacity: 0.55,
    dashArray: isPrimary ? null : '12,6'
  }).addTo(map);
  const layer = L.polyline(coords, {
    color: isPrimary ? '#fbbf24' : '#22c55e',
    weight: isPrimary ? 5 : 4,
    opacity: 0.95,
    dashArray: isPrimary ? null : '12,6'
  }).addTo(map);

  if (isPrimary) currentRouteLayer = [outline, layer];
  else altRouteLayer = [outline, layer];

  return layer;
}

function clearRoute() {
  if (currentRouteLayer) {
    currentRouteLayer.forEach(l => map.removeLayer(l));
    currentRouteLayer = null;
  }
  if (altRouteLayer) {
    altRouteLayer.forEach(l => map.removeLayer(l));
    altRouteLayer = null;
  }
}

function fitRoute(coords) {
  if (coords && coords.length > 0) {
    map.fitBounds(L.latLngBounds(coords), { padding: [50, 50] });
  }
}

function decodePolyline(str) {
  let index = 0, lat = 0, lng = 0;
  const coordinates = [];
  while (index < str.length) {
    let shift = 0, result = 0, byte;
    do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = result = 0;
    do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    coordinates.push([lat / 1e5, lng / 1e5]);
  }
  return coordinates;
}

function decodePolyline6(str) {
  let index = 0, lat = 0, lng = 0;
  const coordinates = [];
  while (index < str.length) {
    let shift = 0, result = 0, byte;
    do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = result = 0;
    do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    coordinates.push([lat / 1e6, lng / 1e6]);
  }
  return coordinates;
}
