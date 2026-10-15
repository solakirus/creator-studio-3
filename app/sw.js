/* Service worker — what makes this installable and usable with no signal.

   The danger with these is the opposite of the one people expect: not failing
   to cache, but caching so well that a device is stranded on an old version
   forever. So:

     - BUILD is stamped by scripts/build-sw.js at deploy time, and the cache is
       named after it. A new deploy is a new cache; every older one is deleted
       on activate, so nothing accumulates and nothing old survives.
     - FILES is generated from what is actually on disk, so it can never drift
       out of step with index.html the way a hand-kept list would.
     - The page itself is network-first. If the network answers, you get the
       current app; the cache is only the fallback. Scripts and fonts are
       cache-first, because they are fetched dozens at a time and only change
       when BUILD does.

   The database is untouched by any of this. IndexedDB is not part of the cache
   and a service worker update never clears it. */

const BUILD = '__BUILD__';
const CACHE = 'cs3-' + BUILD;
const FILES = __FILES__;

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    /* One at a time rather than addAll: addAll rejects the whole install if a
       single file 404s, which would leave the app with no offline copy at all
       and no clue which file was missing. */
    await Promise.all(FILES.map(async f => {
      try { await c.add(new Request(f, { cache: 'reload' })); }
      catch (err) { console.warn('[sw] could not cache', f, err && err.message); }
    }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('cs3-') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

const isPage = req => req.mode === 'navigate' ||
  (req.destination === '' && req.headers.get('accept') || '').includes('text/html');

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;     /* never touch anything off-site */

  if (isPage(req)) {
    /* network first, so a deploy is picked up as soon as there is signal */
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const c = await caches.open(CACHE);
        c.put(req, fresh.clone());
        return fresh;
      } catch (err) {
        const hit = await caches.match(req) || await caches.match('./index.html');
        if (hit) return hit;
        throw err;
      }
    })());
    return;
  }

  /* everything else: cache first, fall back to the network, and keep what the
     network gave so a file added after install is there next time */
  e.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    const fresh = await fetch(req);
    if (fresh && fresh.ok && fresh.type === 'basic') {
      const c = await caches.open(CACHE);
      c.put(req, fresh.clone());
    }
    return fresh;
  })());
});

/* The page can ask for the running build, which Settings shows, so "am I on
   the current version?" is answerable without guessing. */
self.addEventListener('message', e => {
  if (e.data === 'build' && e.source) e.source.postMessage({ build: BUILD });
});
