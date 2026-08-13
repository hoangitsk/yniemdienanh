'use strict';
const CACHE = 'ynda-sw-v3';

self.addEventListener('install', function(e) {
    self.skipWaiting();
});

self.addEventListener('activate', function(e) {
    e.waitUntil(
        caches.keys().then(function(keys) {
            return Promise.all(keys.map(function(k) { return caches.delete(k); }));
        }).then(function() {
            return self.clients.claim();
        })
    );
});

// Network-first strategy
self.addEventListener('fetch', function(e) {
    var url = new URL(e.request.url);
    if (url.pathname.startsWith('/api/')) return;
    if (e.request.method !== 'GET') return;

    e.respondWith(
        fetch(e.request).then(function(res) {
            if (res.ok && url.origin === location.origin) {
                var copy = res.clone();
                caches.open(CACHE).then(function(c) { c.put(e.request, copy); });
            }
            return res;
        }).catch(function() {
            return caches.match(e.request);
        })
    );
});
