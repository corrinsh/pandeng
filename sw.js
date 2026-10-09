/* 攀登 · Service Worker（离线可玩） */

const CACHE = 'climb-v9';

const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './src/css/tokens.css',
  './src/css/base.css',
  './src/css/skins.css',
  './src/css/screens.css',
  './src/js/main.js',
  './src/js/router.js',
  './src/js/store.js',
  './src/js/theme.js',
  './src/js/ui.js',
  './src/js/quiz.js',
  './src/js/generator.js',
  './src/js/version.js',
  './src/js/fullscreen.js',
  './src/js/screens/select.js',
  './src/js/screens/map.js',
  './src/js/screens/level.js',
  './src/data/tiers.js',
  './src/data/content.js',
  './src/data/tier-a.js',
  './src/data/tier-a/ch1.js',
  './src/data/tier-a/ch2.js',
  './src/data/tier-a/ch3.js',
  './src/data/tier-b.js',
  './src/data/tier-b/ch1.js',
  './src/data/tier-b/ch2.js',
  './src/data/tier-b/ch3.js',
  './src/data/tier-c.js',
  './src/data/tier-c/ch1.js',
  './src/data/tier-c/ch2.js',
  './src/data/tier-c/ch3.js'
];

/* ⚠️ 绝不能用 caches.addAll()。
   它是「全有或全无」：SHELL 里只要有一个 URL 拿不到（404 / 重定向 / 网络抖动），
   整个 install 就 reject → 新 SW 永远装不上 → 用户永远停在旧版本。
   这是本项目真实事故：Corrin 手机上一直看到旧版（带横线的），根因就在这里。 */
self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(SHELL.map(u => c.add(u).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

/* 网络优先、断网回落缓存。
   不用「缓存优先」是因为开发期改一次就要等缓存过期，手机上永远看到旧版。 */
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
  );
});
