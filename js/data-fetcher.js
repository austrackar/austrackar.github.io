const CORS_PROXY = 'https://api.allorigins.win/get?url=';

let REALTIME_DATA = { cuts: [], weather: [] };

async function fetchRealData() {
  let cutsFetched = false;
  let weatherFetched = false;

  try {
    const res = await fetch(CORS_PROXY + encodeURIComponent('https://www.ruta0.com/estado_rutas.aspx')).then(r => r.json());
    const html = res.contents;
    const cuts = parseRuta0Alerts(html);
    if (cuts.length > 0) {
      REALTIME_DATA.cuts = cuts;
      mergeRealCuts(cuts);
      cutsFetched = true;
      console.log('✅ Cortes reales cargados desde Ruta0 (' + cuts.length + ' alertas)');
    }
  } catch (e) {
    console.warn('⚠️ No se pudieron obtener cortes reales:', e.message);
  }

  try {
    const res = await fetch(CORS_PROXY + encodeURIComponent('https://ssl.smn.gob.ar/feeds/CAP/rss_alertaCAP_nuevo.xml')).then(r => r.json());
    const xml = res.contents;
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

  // Each alert is a div with this exact inline style pattern
  const alertDivPattern = /<div style="background:#fff;border:1px solid #dce8f8;border-radius:7px;padding:8px 10px;margin-bottom:6px">([\s\S]*?)<\/div>\s*(?=<div style="background:#fff;border|$)/g;
  let match;

  while ((match = alertDivPattern.exec(html)) !== null) {
    const block = match[1];

    const typeMatch = block.match(/(CORTE TOTAL|RESTRINGIDA|CORTE PARCIAL)/);
    if (!typeMatch) continue;
    const type = typeMatch[1];

    // Capture the whole route string after RN&nbsp; (handles "3", "40", "Ex 34", etc.)
    const routeMatch = block.match(/RN\s*(?:&nbsp;)?([\d A-Za-z]+)/);
    if (!routeMatch) continue;
    const ruta = ('RN ' + routeMatch[1].trim()).replace(/&nbsp;/g, ' ');

    const provMatch = block.match(/(Buenos Aires|Santa Cruz|Mendoza|San Juan|Santiago del Estero|Tucumán|Salta|Córdoba|La Pampa|Río Negro|Neuquén|Chubut|Entre Ríos|Santa Fe|San Luis|Jujuy|Catamarca|La Rioja|Corrientes|Misiones|Formosa|Chaco|Tierra del Fuego)/);
    const provincia = provMatch ? provMatch[1] : 'Argentina';

    const innerDivs = block.match(/<div[^>]*>([\s\S]*?)<\/div>/g);
    let tramo = '';
    let desc = '';
    if (innerDivs && innerDivs.length >= 2) {
      const tramoDiv = innerDivs[1];
      const tramoClean = tramoDiv.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      tramo = tramoClean.replace(/·.*$/, '').trim();
    }
    if (innerDivs && innerDivs.length >= 3) {
      desc = innerDivs[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }

    const severidad = type === 'CORTE TOTAL' ? 'total' : 'parcial';
    const motivo = type === 'CORTE TOTAL' ? 'Corte total de ruta' : type === 'RESTRINGIDA' ? 'Circulación restringida' : 'Corte parcial';

    cuts.push({
      ruta,
      kmInicio: null,
      kmFin: null,
      provincia,
      localidad: tramo.substring(0, 80),
      motivo,
      descripcion: desc.substring(0, 200),
      desde: new Date().toISOString(),
      estimacion: '',
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
