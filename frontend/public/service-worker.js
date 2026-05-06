/* JOY Automart — minimal service worker.
   Strategy:
     - HTML / API: always network-first (avoid stale data on a B2B platform).
     - Static assets (JS/CSS/font/image): stale-while-revalidate.
     - Cart endpoint: cache last successful GET so offline users still see their cart.
*/

const CACHE_VERSION = "joy-v4";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const CART_CACHE = `${CACHE_VERSION}-cart`;

const STATIC_ASSETS = ["/", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((c) => c.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

const isStatic = (req) =>
  /\.(?:js|css|woff2?|ttf|otf|png|jpe?g|webp|gif|svg|ico)$/i.test(new URL(req.url).pathname);

const isCartGet = (req) =>
  req.method === "GET" && new URL(req.url).pathname === "/api/cart";

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // never cache writes

  const url = new URL(req.url);

  // Cart: try network, on success update cache; on failure fall back to cache (offline cart visibility)
  if (isCartGet(req)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CART_CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || new Response(JSON.stringify({ items: [], offline: true }), { headers: { "Content-Type": "application/json" } })))
    );
    return;
  }

  // Other API calls: always network, with NO cache fallback (data must be fresh)
  if (url.pathname.startsWith("/api/")) return;

  // Static assets: stale-while-revalidate
  if (isStatic(req)) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then((cache) =>
        cache.match(req).then((cached) => {
          const networkFetch = fetch(req).then((res) => {
            if (res && res.ok && res.type !== "opaque") cache.put(req, res.clone());
            return res;
          }).catch(() => cached);
          return cached || networkFetch;
        })
      )
    );
    return;
  }

  // HTML navigations: network-first, fall back to cached "/" shell on offline
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match("/").then((c) => c || new Response("Offline", { status: 503 })))
    );
  }
});

/* ---------- Web Push ---------- */

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { title: "JOY Automart", body: event.data?.text() || "" };
  }
  const title = data.title || "JOY Automart";
  const options = {
    body: data.body || "",
    icon: data.icon || "https://customer-assets.emergentagent.com/job_458d530b-69c9-4d64-8b89-03923696b1c8/artifacts/gnewd2f2_IMG-20260209-WA0017.jpg",
    badge: data.icon || "https://customer-assets.emergentagent.com/job_458d530b-69c9-4d64-8b89-03923696b1c8/artifacts/gnewd2f2_IMG-20260209-WA0017.jpg",
    tag: data.tag || "joy-default",
    data: { url: data.url || "/dashboard" },
    requireInteraction: false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/dashboard";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      // Reuse an open window if any
      for (const w of wins) {
        try {
          const u = new URL(w.url);
          if (u.origin === self.location.origin) {
            return w.focus().then(() => w.navigate ? w.navigate(targetUrl) : null);
          }
        } catch (_) { /* ignore */ }
      }
      return clients.openWindow(targetUrl);
    })
  );
});
