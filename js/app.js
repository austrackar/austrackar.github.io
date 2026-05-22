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