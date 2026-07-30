/**
 * DONI | DEV — Firebase Cloud Messaging background handler
 * This MUST be a separate file at the site root named exactly this way —
 * it's Firebase's convention for the background push handler, distinct
 * from the app's main sw.js (which handles offline caching).
 */
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyBH3qWCy9jRT2HOrX8smaQA1XI5IUVtZlg",
    authDomain: "aboutme-8a339.firebaseapp.com",
    projectId: "aboutme-8a339",
    storageBucket: "aboutme-8a339.firebasestorage.app",
    messagingSenderId: "638307646276",
    appId: "1:638307646276:web:fe52c653fd16fa81f37511"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title || 'DONI | DEV';
    const options = {
        body: payload.notification?.body || '',
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-192.png',
        data: { url: payload.data?.url || '/' }
    };
    self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification.data?.url || '/';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url.includes(url) && 'focus' in client) return client.focus();
            }
            if (clients.openWindow) return clients.openWindow(url);
        })
    );
});
