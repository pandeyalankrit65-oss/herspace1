// HerSpace service worker: keeps the whole app usable offline after the first visit.
// - The app itself: every built file is stored (from /precache-manifest.json), so any page
//   opens offline, not just the ones already visited.
// - Map tiles the user has looked at, up to a limit, so the map isn't blank offline.
// API responses are never stored here; the app keeps the little it needs offline itself.
const CACHE = "herspace-v3";
const TILES = "herspace-tiles-v1";
const MAX_TILES = 600;
const TILE_HOSTS = /(^|\.)tile\.openstreetmap\.org$/;

// Servers often send "Vary: Origin"; module scripts are requested with an Origin header while
// precached copies were stored without one, so matches must ignore Vary or they silently miss.
const match = (request) => caches.match(request, { ignoreVary: true });
const SHELL = ["/", "/sos", "/manifest.webmanifest", "/icon.svg", "/icon-192.png", "/calculator.svg"];

// Stores every file of the current build that isn't stored yet, and drops files from old builds.
async function precacheBuild() {
  const res = await fetch("/precache-manifest.json", { cache: "no-store" });
  if (!res.ok) return;
  const { files } = await res.json();
  const cache = await caches.open(CACHE);
  const stored = new Set((await cache.keys()).map((r) => new URL(r.url).pathname));
  const missing = files.filter((f) => !stored.has(f));
  // One at a time: a single failed file shouldn't stop the rest.
  for (const f of missing) await cache.add(f).catch(() => {});
  const current = new Set(files);
  await Promise.all(
    [...stored].filter((p) => p.startsWith("/assets/") && !current.has(p)).map((p) => cache.delete(p))
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => precacheBuild().catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== TILES).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trimTiles() {
  const cache = await caches.open(TILES);
  const keys = await cache.keys();
  // Oldest first (insertion order): drop the excess.
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_TILES)).map((k) => cache.delete(k)));
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Map tiles: network first so the map stays current, stored copy when offline.
  if (TILE_HOSTS.test(url.hostname)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(TILES).then((cache) => cache.put(request, copy).then(trimTiles));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || Response.error()))
    );
    return;
  }

  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  // Pages: always try the network for the latest version, fall back to the stored app shell.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put("/", copy));
          return response;
        })
        .catch(() => match("/"))
    );
    return;
  }

  // Build files have content hashes in their names, so a stored copy never goes stale.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
      )
    );
    return;
  }

  // Everything else (icons, images): serve stored, refresh in the background.
  event.respondWith(
    match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

self.addEventListener("message", (event) => {
  // Sent by the page on every load: after a new deploy, store the new build's files.
  if (event.data?.type === "PRECACHE") {
    event.waitUntil(precacheBuild().catch(() => {}));
    return;
  }
  // The first visit loads before this worker controls the page, so the page also sends the
  // files it already loaded.
  if (event.data?.type !== "CACHE_URLS" || !Array.isArray(event.data.urls)) return;
  const urls = event.data.urls.filter((u) => {
    try {
      const url = new URL(u, self.location.origin);
      return url.origin === self.location.origin && !url.pathname.startsWith("/api/");
    } catch {
      return false;
    }
  });
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(urls)).catch(() => {}));
});
