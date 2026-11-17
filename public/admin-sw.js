// Service worker du back-office : seulement les alertes de l'équipe en push (même back-office fermé).
// Pas de cache : le back-office se charge toujours depuis le réseau.
// Message du serveur (lib/adminAlerts.ts) : { title, body, path, tag }.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { data = { body: e.data?.text() }; }
  e.waitUntil((async () => {
    // Back-office ouvert et visible : la cloche suffit, on prévient seulement la page.
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    wins.forEach((w) => w.postMessage({ type: 'alert' }));
    if (wins.some((w) => w.visibilityState === 'visible' && w.focused)) return;
    await self.registration.showNotification(data.title || 'On Bade · équipe', {
      body: data.body || '',
      icon: 'assets/icon-192.png',
      badge: 'assets/icon-192.png',
      tag: data.tag,
      data: { path: data.path || '/' },
    });
  })());
});

// Clic : ouvre la page concernée du back-office (fenêtre existante, sinon une nouvelle).
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const path = e.notification.data?.path || '/';
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const win = wins.find((w) => new URL(w.url).origin === self.location.origin);
    if (win) { await win.focus(); win.postMessage({ type: 'navigate', path }); return; }
    await self.clients.openWindow(`./#${path}`);
  })());
});
