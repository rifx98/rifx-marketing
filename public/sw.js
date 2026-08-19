// RIFX — Service Worker para Notificaciones Push
self.addEventListener('push', function (event) {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'RIFX', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'RIFX Marketing';
  const options = {
    body: data.body || '',
    icon: data.icon || '/images/rifx-logo-user.png',
    badge: '/images/rifx-logo-user.png',
    // A stable event tag lets retries replace the same notification instead
    // of showing duplicates after a worker/runtime interruption.
    tag: typeof data.tag === 'string' ? data.tag.slice(0, 120) : undefined,
    renotify: false,
    data: { url: data.url || '/panel' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/panel';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/panel') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
