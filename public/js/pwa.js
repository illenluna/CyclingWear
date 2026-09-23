// Cycling Wear — PWA: service worker e modo offline (somente leitura)

const offlineBanner = document.getElementById('offlineBanner');

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('Service worker não registrado:', err);
    });
  });
}

// Sem conexão, o app mostra os dados em cache e bloqueia ações de escrita
// (botões marcados com data-online-only).
export function initOfflineMode() {
  const update = () => {
    const offline = !navigator.onLine;
    offlineBanner.classList.toggle('hidden', !offline);
    document.querySelectorAll('[data-online-only]').forEach(btn => {
      btn.disabled = offline;
      btn.title = offline ? 'Indisponível offline' : '';
    });
  };
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}

// Remove dados da API guardados pelo service worker (usado no logout)
export async function clearDataCache() {
  if (!('caches' in window)) return;
  const keys = await caches.keys();
  await Promise.all(keys.filter(k => k.startsWith('cw-data')).map(k => caches.delete(k)));
}
