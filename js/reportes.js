// ═══════════════════════════════════════════════
// REPORTES.JS — Reportes de ruta de usuarios
// ═══════════════════════════════════════════════

let repRef = null;

function submitReporte() {
  const texto = document.getElementById('reporte-texto').value.trim();
  if (!texto || texto.length < 5) return;
  const categoria = document.getElementById('reporte-categoria').value;
  const profile = window.__profile || {};
  const user = firebase.auth().currentUser;
  if (!user) return;

  const data = {
    usuario: profile.nombre || user.email,
    uid: user.uid,
    empresa: profile.empresa || '',
    texto,
    categoria,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  };

  if (window.userLocationCoords) {
    data.lat = window.userLocationCoords.lat;
    data.lng = window.userLocationCoords.lng;
  }

  firebase.database().ref('reportes').push(data);
  document.getElementById('reporte-texto').value = '';
}

function buildReportesFeed(snap) {
  const feed = document.getElementById('reportes-feed');
  if (!feed) return;
  const vals = snap.val();
  if (!vals) { feed.innerHTML = '<div style="font-size:13px;color:var(--text3);text-align:center;padding:16px">Todavía no hay reportes. ¡Sé el primero!</div>'; return; }

  const items = Object.entries(vals).reverse();
  const CAT_ICONS = { ruta:'🚧', clima:'🌤', accidente:'🚑', corte:'⛔', otro:'📌' };
  const CAT_LABELS = { ruta:'Estado de ruta', clima:'Clima', accidente:'Accidente', corte:'Corte/Desvío', otro:'Otro' };

  feed.innerHTML = items.map(([id, r]) => `
    <div style="background:var(--panel2);border:1px solid var(--border);border-radius:10px;padding:10px 12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <div style="font-size:12px;font-weight:600;color:var(--text2)">${CAT_ICONS[r.categoria] || '📌'} ${r.usuario || 'Anónimo'}</div>
        <span style="font-size:10px;color:var(--text3)">${r.timestamp ? timeAgo(r.timestamp) : ''}</span>
      </div>
      <div style="font-size:13px;color:var(--text);line-height:1.4">${escHtml(r.texto)}</div>
      <div style="display:flex;gap:6px;margin-top:4px">
        <span style="font-size:10px;background:var(--panel);color:var(--text3);padding:2px 8px;border-radius:4px">${CAT_LABELS[r.categoria] || r.categoria}</span>
        ${r.empresa ? `<span style="font-size:10px;background:var(--panel);color:var(--text3);padding:2px 8px;border-radius:4px">${escHtml(r.empresa)}</span>` : ''}
      </div>
    </div>
  `).join('');
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `hace ${days}d`;
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  if (typeof firebase === 'undefined' || !firebase.apps.length) return;

  const db = firebase.database();
  repRef = db.ref('reportes').limitToLast(50);

  // Hide form if not logged in
  const form = document.getElementById('reportes-form');
  firebase.auth().onAuthStateChanged(user => {
    if (form) form.style.display = user ? '' : 'none';
  });

  document.getElementById('reporte-submit')?.addEventListener('click', submitReporte);
  document.getElementById('reporte-texto')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.ctrlKey) submitReporte();
  });

  repRef.on('value', buildReportesFeed);
});
