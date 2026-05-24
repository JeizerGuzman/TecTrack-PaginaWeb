/* ═══════════════════════════════════════════════
   TrackSecurity — Service Worker (sw.js)

   ═══════════════════════════════════════════════ */

// Escuchar notificaciones push entrantes
self.addEventListener('push', function(event) {
    let payload = { title: 'TrackSecurity', body: 'Alerta en tu flota', tag: 'ts-alerta', vehiculo: '' };

    try {
        if (event.data) payload = { ...payload, ...event.data.json() };
    } catch(e) {}

    

    const options = {
        body:      payload.body,
        tag:       payload.tag,
        renotify:  true,
        icon:      '/static/img/icono.png',   // opcional: agrega un ícono
        badge:     '/static/img/badge.png',   // opcional
        vibrate:   [200, 100, 200],
        data:      { url: payload.url || '/panel' },
        actions: [
            { action: 'ver', title: 'Ver dashboard' },
            { action: 'cerrar', title: 'Cerrar' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(payload.title, options)
    );
});

// Click en la notificación → abrir el panel
self.addEventListener('notificationclick', function(event) {
    event.notification.close();

    if (event.action === 'cerrar') return;

    const url = event.notification.data?.url || '/panel';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(function(clientList) {
                for (const c of clientList) {
                    if (c.url.includes('/panel') && 'focus' in c) return c.focus();
                }
                if (clients.openWindow) return clients.openWindow(url);
            })
    );
});

// Activación del SW — limpiar caches viejos si los hubiera
self.addEventListener('activate', function(event) {
    event.waitUntil(clients.claim());
});