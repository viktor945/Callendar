// No cache of shared plans or private data. Opening the installed app fetches
// the current server state; push can wake this worker when the app is closed.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('push', event => {
  let message = {};
  try { message = event.data?.json() || {}; } catch { /* Show a neutral fallback. */ }
  event.waitUntil(self.registration.showNotification('Вдвоём', {
    body: message.body || 'Есть обновление в вашем общем пространстве.',
    icon: '/icons/icon-192.png', badge: '/icons/icon-192.png',
    tag: message.tag || 'shared-plans', data: { url: message.url || '/' },
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  let target = new URL('/', self.location.origin);
  try {
    const proposed = new URL(event.notification.data?.url || '/', self.location.origin);
    if (proposed.origin === self.location.origin) target = proposed;
  } catch { /* Never navigate a notification to another origin. */ }
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if ('focus' in client) { await client.navigate(target.href); return client.focus(); }
    }
    return self.clients.openWindow(target.href);
  })());
});
