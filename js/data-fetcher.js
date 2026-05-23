const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

let REALTIME_DATA = { cuts: [], weather: [] };

async function fetchRealData() {
  let cutsFetched = false;
  let weatherFetched = false;

  try {
    const html = await fetch(CORS_PROXY + encodeURIComponent('https://www.ruta0.com/estado_rutas.aspx')).then(r => r.text());
    const cuts = parseRuta0Alerts(html);
    if (cuts.length > 0) {
      REALTIME_DATA.cuts = cuts;
      // Merge with existing map-ready data (simulated coords are kept for map rendering)
      mergeRealCuts(cuts);
      cutsFetched = true;
      console.log('✅ Cortes reales cargados desde Ruta0 (' + cuts.length + ' alertas)');
    }
  } catch (e) {
    console.warn('⚠️ No se pudieron obtener cortes reales:', e.message);
  }

  try {
    const xml = await fetch(CORS_PROXY + encodeURIComponent('https://ssl.smn.gob.ar/feeds/CAP/rss_alertaCAP_nuevo.xml')).then(r => r.text());
    const alerts = parseSmnAlerts(xml);
    if (alerts.length > 0) {
      REALTIME_DATA.weather = alerts;
      window.ALERTAS_CLIMA = alerts;
      weatherFetched = true;
      console.log('✅ Alertas SMN reales cargadas (' + alerts.length + ')');
    }
  } catch (e) {
    console.warn('⚠️ No se pudieron obtener alertas SMN:', e.message);
  }

  return { cutsFetched, weatherFetched };
}

function mergeRealCuts(realCuts) {
  if (!window.RUTAS_CORTADAS || !Array.isArray(window.RUTAS_CORTADAS)) {
    window.RUTAS_CORTADAS = realCuts;
    return;
  }

  // Keep simulated cuts with coords for map markers
  const existing = window.RUTAS_CORTADAS;
  window.RUTAS_CORTADAS = [];

  // Add real cuts first (they'll have a badge indicating real source)
  realCuts.forEach((c, i) => {
    window.RUTAS_CORTADAS.push({ ...c, id: 'real-' + i, esReal: true });
  });

  // Append simulated cuts (they have GPS coords for map display)
  existing.forEach((c, i) => {
    if (c.coords && c.coords.length > 0) {
      window.RUTAS_CORTADAS.push({ ...c, id: 'sim-' + i, esReal: false });
    }
  });
}

function parseRuta0Alerts(html) {
  const cuts = [];
  const alertSection = html.match(/Alertas Vialidad Nacional\s*<[^>]*>(\d+)\s*tramos/i);
  if (!alertSection) return cuts;

  // Split alerts by type markers
  const blocks = html.split(/CORTE TOTAL|RESTRINGIDA|CORTE PARCIAL/);
  const types = html.match(/(CORTE TOTAL|RESTRINGIDA|CORTE PARCIAL)/g);

  if (!types || blocks.length < 2) return cuts;

  for (let i = 1; i < blocks.length && i - 1 < types.length; i++) {
    const block = blocks[i];
    const type = types[i - 1];

    const routeMatch = block.match(/RN\s*(\d+[A-Z]?)/i);
    if (!routeMatch) continue;
    const ruta = 'RN ' + routeMatch[1];

    const provMatch = block.match(/(Buenos Aires|Santa Cruz|Mendoza|San Juan|Santiago del Estero|Tucumán|Salta|Córdoba|La Pampa|Río Negro|Neuquén|Chubut|Entre Ríos|Santa Fe|San Luis|Jujuy|Catamarca|La Rioja|Corrientes|Misiones|Formosa|Chaco|Tierra del Fuego)/);
    const provincia = provMatch ? provMatch[1] : 'Argentina';

    // Clean description (remove nav/HTML garbage)
    let desc = block
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Try to extract location info
    const tramoMatch = block.match(/>([^<]+)<[^>]*>\s*·\s*([^<]+)</);
    const tramo = tramoMatch ? tramoMatch[1].trim() : '';

    const severidad = type === 'CORTE TOTAL' ? 'total' : type === 'RESTRINGIDA' ? 'parcial' : 'parcial';
    const motivo = type === 'CORTE TOTAL' ? 'Corte total de ruta' : type === 'RESTRINGIDA' ? 'Circulación restringida' : 'Corte parcial';

    // Look for km info in the description
    const kmMatch = desc.match(/(?:km\s*)?(\d+)[\s,]*/i);
    const km = kmMatch ? parseInt(kmMatch[1]) : 500;

    cuts.push({
      id: 'real-' + cuts.length,
      ruta,
      kmInicio: km,
      kmFin: km + 15,
      provincia,
      localidad: tramo.split('›').pop()?.trim() || tramo,
      motivo,
      descripcion: desc.substring(0, 200),
      desde: new Date().toISOString(),
      estimacion: new Date(Date.now() + 86400000).toISOString(),
      severidad,
      coords: [],
      fuente: 'Ruta0.com / Vialidad Nacional',
      alternativa: { desc: 'Consultar desvíos en ruta0.com', kmExtra: 0, minExtra: 0, altCoords: [] }
    });
  }

  return cuts;
}

function parseSmnAlerts(xml) {
  const alerts = [];
  const items = xml.match(/<item>[\s\S]*?<\/item>/g);
  if (!items) return alerts;

  items.forEach((item, idx) => {
    const titleMatch = item.match(/<title[^>]*>([^<]+)</);
    const descMatch = item.match(/<description[^>]*>([^<]+)</);
    const title = titleMatch ? titleMatch[1] : '';
    const desc = descMatch ? descMatch[1] : '';

    if (!title) return;

    alerts.push({
      id: 'smn-' + idx,
      titulo: title,
      descripcion: desc || '',
      tipo: 'tormenta',
      severidad: 'amarillo',
      region: 'Argentina',
      provincias: ['Argentina'],
      rutas: ['Generales'],
      radio: 100000,
      center: [-38.4161, -63.6167],
      validoHasta: new Date(Date.now() + 86400000).toISOString(),
      fuente: 'SMN'
    });
  });

  return alerts;
}
