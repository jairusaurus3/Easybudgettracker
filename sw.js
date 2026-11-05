/* Easy Budget Tracker service worker: lets the app open offline.
   Only same-origin GET requests are handled; Google sign-in and Drive calls are never touched. */
var CACHE = 'ebt-v9-35';
var SHELL = ['./', 'index.html', 'manifest.json', 'guides/guides.css', 'styles.css?v=9.35.0', 'js/storage.js?v=9.35.0', 'js/calc.js?v=9.35.0', 'js/budget.js?v=9.35.0', 'js/google-sync.js?v=9.35.0', 'js/import-export.js?v=9.35.0', 'js/routing.js?v=9.35.0', 'js/transactions.js?v=9.35.0', 'js/reports.js?v=9.35.0', 'js/navigation.js?v=9.35.0', 'js/collectibles.js?v=9.35.0', 'js/help.js?v=9.35.0', 'js/groceries.js?v=9.35.0', 'js/notebook.js?v=9.35.0', 'js/boot.js?v=9.35.0', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'privacy.html', 'terms.html', 'guides/', 'guides/index.html', 'guides/50-30-20-rule.html', 'guides/budget-20000-salary-philippines.html', 'guides/emergency-fund.html', 'guides/monthly-bills-checklist.html', 'guides/pay-off-credit-card-debt.html', 'guides/track-expenses-beginners.html'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return Promise.all(SHELL.map(function (u) { return c.add(u).catch(function () {}); })); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  // Network first so updates show up. If the network is slow (over 4 seconds) or offline, use the cached copy.
  e.respondWith((function () {
    var net = fetch(req).then(function (res) {
      if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
      return res;
    });
    var slow = new Promise(function (resolve) {
      setTimeout(function () { caches.match(req).then(function (hit) { if (hit) resolve(hit); }); }, 4000);
    });
    return Promise.race([net, slow]).catch(function () {
      return caches.match(req).then(function (hit) { return hit || (req.mode === 'navigate' ? caches.match('index.html') : undefined); });
    });
  })());
});
