// Tabistock Service Worker
// 目的：PWA としてインストール可能にする＋静的ファイルを高速化／簡易オフライン対応。
// 方針（安全第一）：
//   - 同一オリジンの GET だけを扱う。
//   - Firebase / Firestore / Storage など別オリジンの通信は一切触らない
//     （= キャッシュしない）。常に最新データがネットから取れるようにするため。
//   - HTML（ページ遷移）はネット優先＋失敗時キャッシュ（更新を即反映）。
//   - CSS/JS/画像は stale-while-revalidate（まず表示→裏で更新）。

const VERSION = 'tabistock-v98';
const CACHE = VERSION;

// ---- プッシュ通知（FCM）----
// 既存SWに統合する（SWを2つに分けると scope が衝突するため）。
// CDN取得に失敗しても素のキャッシュSWは動くよう try/catch で隔離。
try {
  importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');
  firebase.initializeApp({
    apiKey: 'AIzaSyC64CiQzn6RrpLKNv8ZEIWdtJ3vVqrxlsQ',
    authDomain: 'tabistock.firebaseapp.com',
    projectId: 'tabistock',
    storageBucket: 'tabistock.firebasestorage.app',
    messagingSenderId: '1003651778196',
    appId: '1:1003651778196:web:ce29437f495873f1acd681'
  });
  const messaging = firebase.messaging();
  // data-only メッセージを受け取り、ここで通知表示する（二重表示防止）。
  messaging.onBackgroundMessage((payload) => {
    const d = (payload && payload.data) || {};
    self.registration.showNotification(d.title || 'Tabistock', {
      body: d.body || '',
      icon: '/favicon-192x192.png',
      badge: '/favicon-192x192.png',
      data: { url: d.url || '/' }
    });
  });
} catch (e) {
  // プッシュ非対応環境ではスキップ（キャッシュ機能は継続）。
}

// 通知タップ：該当ページを開く（既存タブがあれば再利用）。
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes(url) && 'focus' in c) return c.focus();
      }
      return self.clients.openWindow ? self.clients.openWindow(url) : null;
    })
  );
});

// インストール時に最低限の「アプリの骨格」を先読みしておく。
const PRECACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/firebase-config.js',
  '/tabistock-render.js',
  '/auth-status.js',
  '/notify.js',
  '/push.js',
  '/search.html',
  '/ask.html',
  '/map.html',
  '/post.html',
  '/post-transit.html',
  '/dm.html',
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
