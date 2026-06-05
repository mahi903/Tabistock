// Tabistock Service Worker
// 目的：PWA としてインストール可能にする＋静的ファイルを高速化／簡易オフライン対応。
// 方針（安全第一）：
//   - 同一オリジンの GET だけを扱う。
//   - Firebase / Firestore / Storage など別オリジンの通信は一切触らない
//     （= キャッシュしない）。常に最新データがネットから取れるようにするため。
//   - HTML（ページ遷移）はネット優先＋失敗時キャッシュ（更新を即反映）。
//   - CSS/JS/画像は stale-while-revalidate（まず表示→裏で更新）。

const VERSION = 'tabistock-v22';
const CACHE = VERSION;

// インストール時に最低限の「アプリの骨格」を先読みしておく。
const PRECACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/firebase-config.js',
  '/tabistock-render.js',
  '/auth-status.js',
  '/notify.js',
  '/search.html',
  '/map.html',
  '/post.html',
  '/account.html',
  '/favicon-192x192.png',
  '/favicon-512x512.png',
  '/apple-touch-icon.png',
  '/site.webmanifest'
];

self.addEventListener('install', (event) => {
  // ここでは skipWaiting しない（新SWは「待機」状態にとどめ、
  // ページ側の「更新」ボタンが押されたら切り替える）。
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // 一部が 404 でも全体が失敗しないよう個別に追加。
      Promise.allSettled(PRECACHE.map((url) => cache.add(url)))
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ページから「更新」を指示されたら待機中の新SWを有効化する。
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // GET 以外（POST など）は触らない。
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 別オリジン（Firebase / gstatic / unpkg / Google Fonts など）は素通り。
  if (url.origin !== self.location.origin) return;

  // ページ遷移（HTML）：ネット優先、失敗時はキャッシュ、最後はトップ。
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then((hit) => hit || caches.match('/index.html'))
        )
    );
    return;
  }

  // 静的アセット（CSS/JS/画像など）：stale-while-revalidate。
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
