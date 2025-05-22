const CACHE_NAME = "todolist-cache-v1";
const urlsToCache = [
    "./",
    "./index.html",
    "./CSS/main.css",
    "./JS/main.js",
    "./JS/time.js",
    "./assets/favicon.png",
    "./offline.html"
];

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener("fetch", event => {
    event.respondWith(
        fetch(event.request)
        .then(response => response)
        .catch(() => {
            return caches.match(event.request).then(response => {
                // Kalau file tidak ada di cache, fallback ke offline.html untuk dokumen HTML
                if (event.request.destination === 'document') {
                    return caches.match("./offline.html");
                }
                return response;
            });
        })
    );
});