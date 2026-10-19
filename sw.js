/* Offline cache for Parlor and every game in it.
   First visit (online): saves the pages, shared files and dictionaries on the device.
   Later visits: opens instantly from the saved copy, even offline, and quietly checks
   the website for updates in the background (picked up on the next launch).
   When you add a game or change the list of files below, also change CACHE so devices refresh it. */
const CACHE = "parlor-v8";
// Only the games listed on the hub are cached; the others in the repo still open online.
const FILES = [
  "./", "./index.html", "./manifest.webmanifest", "./icons/icon-180.png", "./icons/icon-512.png",
  "./icons/tumbleword-180.png", "./icons/cover-story-180.png", "./icons/triad-180.png", "./icons/dice-cup-180.png",
  "./shared/theme.css", "./shared/core.js", "./shared/vendor/fflate.min.js", "./shared/words/nouns.js",
  "./tumbleword/", "./tumbleword/index.html", "./tumbleword/brand.css", "./tumbleword/card.html", "./tumbleword/card.css",
  "./tumbleword/tumbleword.js", "./tumbleword/dict-words.bin", "./tumbleword/dict-defs.bin",
  "./cover-story/", "./cover-story/index.html", "./cover-story/brand.css", "./cover-story/card.html", "./cover-story/card.css",
  "./cover-story/cover-story.js",
  "./triad/", "./triad/index.html", "./triad/brand.css", "./triad/card.html", "./triad/card.css", "./triad/triad.js",
  "./dice-cup/", "./dice-cup/index.html", "./dice-cup/brand.css", "./dice-cup/card.html", "./dice-cup/card.css", "./dice-cup/dice-cup.js"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(req, { ignoreSearch: true }).then((hit) => {
        const update = fetch(req)
          .then((res) => { if (res.ok) cache.put(req, res.clone()); return res; })
          .catch(() => hit);
        if (hit) { e.waitUntil(update); return hit; }   // saved copy now, refresh in background
        return update;                                    // not saved yet: go to the network
      })
    )
  );
});
