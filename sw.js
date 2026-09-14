// Service worker: caches the app shell so the whole app opens with
// zero network connection (critical for mid-flight use). Uploaded PDFs,
// downloaded charts, and notes are stored separately in IndexedDB (see
// index.html) — this file only handles the app's own code/assets.

const CACHE_NAME = "fliteboard-v11";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-180.png",
  "./icons/favicon.ico",
  "./icons/favicon-16.png",
  "./icons/favicon-32.png"
];
// PDF.js — powers the chart/document annotator. jsPDF — powers the
// in-app VFR/IFR blank template generator. Cached separately (best
// effort) so a hiccup fetching these doesn't fail the whole install and
// leave the core app shell uncached.
const PDFJS_ASSETS = [
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(APP_SHELL);
      await Promise.all(
        PDFJS_ASSETS.map((url) =>
          fetch(url, { mode: "cors" })
            .then((res) => { if (res.ok) return cache.put(url, res); })
            .catch(() => {})
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // App shell + CDN assets: cache-first, so it works fully offline.
  // Live chart search (AviationAPI) intentionally bypasses this and just
  // fails gracefully offline — see index.html.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response.ok && event.request.method === "GET") {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
    })
  );
});
