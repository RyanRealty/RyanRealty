/* Ryan Realty service worker — the receiving end of the durable broker-alert
 * web-push channel (W5.5 leg b).
 *
 * Served statically from /sw.js so it registers at ROOT scope with no build
 * step (app/sw.ts is a Serwist source that next.config.ts does not currently
 * wrap — see the "Serwist requires webpack" note there — so it never emits).
 *
 * Deliberately has NO `fetch` handler: this worker must not interpose on a
 * single navigation or asset request. It exists to receive pushes and to open
 * the deep link. If Serwist is ever enabled it will claim this same filename —
 * fold these two listeners into that build rather than shipping two workers.
 *
 * Payload contract (app/api/push/_lib/deliver.ts alertToNotification):
 *   { title: string, body: string, url: string, tag: string }
 */

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let data = {}
  if (event.data) {
    try {
      data = event.data.json()
    } catch {
      data = { title: 'Ryan Realty', body: event.data.text() }
    }
  }

  const title = data.title || 'Ryan Realty'
  const options = {
    body: data.body || 'Open the CRM for the detail.',
    // Brand marks live in public/icons; the notification degrades to the
    // browser default if either is missing rather than failing to show.
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.tag || 'ryan-realty-alert',
    renotify: true,
    requireInteraction: true,
    data: { url: data.url || 'https://ryan-realty.com/admin' },
  }

  // waitUntil keeps the worker alive until the notification is actually shown —
  // without it the browser can kill the worker first and the alert is lost.
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || 'https://ryan-realty.com/admin'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Reuse an already-open admin tab when there is one; the broker keeps
      // their place instead of getting a second window per alert.
      for (const client of clientList) {
        if (client.url.includes('/admin') && 'focus' in client) {
          client.navigate(target)
          return client.focus()
        }
      }
      return self.clients.openWindow(target)
    }),
  )
})
