// RutaProxy — Cloudflare Worker
// Desplegar en: https://dash.cloudflare.com/ → Workers & Pages → Crear Worker
// Pegar este código y desplegar. Luego copiar la URL (ej: rutaproxy.miempresa.workers.dev)

const ALLOWED_HOSTS = ['www.ruta0.com', 'ssl.smn.gob.ar'];

async function handleRequest(request) {
  const url = new URL(request.url);
  const target = url.searchParams.get('url');

  if (!target) {
    return new Response('Falta el parámetro "url"', { status: 400 });
  }

  let targetUrl;
  try {
    targetUrl = new URL(target);
  } catch {
    return new Response('URL inválida', { status: 400 });
  }

  if (!ALLOWED_HOSTS.includes(targetUrl.hostname)) {
    return new Response('Host no permitido: ' + targetUrl.hostname, { status: 403 });
  }

  const response = await fetch(target, {
    headers: {
      'User-Agent': 'RutaSeguraAR/1.0 (+https://github.com/rutaseguraar)'
    }
  });

  const body = await response.text();
  const contentType = response.headers.get('content-type') || 'text/html;charset=UTF-8';

  return new Response(body, {
    status: response.status,
    headers: {
      'content-type': contentType,
      'access-control-allow-origin': '*',
      'cache-control': 'public, max-age=300'
    }
  });
}

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});
