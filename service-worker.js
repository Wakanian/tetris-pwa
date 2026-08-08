// service-worker.js
// オフライン対応テトリス用のシンプルなキャッシュサービスワーカー
//
// ★コードを更新して再配信するときは、このバージョン番号を必ず変更してください。
//   変更しないと、ユーザーの端末に古いキャッシュが残り続けて更新が反映されません。
const CACHE_VERSION = 'v1';
const CACHE_NAME = `tetris-offline-${CACHE_VERSION}`;

// アプリの起動に必要な全ファイル（オフライン時にはここからのみ読み込む）
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-32.png',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// ---- インストール時：必要なファイルをすべてキャッシュに保存 ----
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()) // 新しいservice workerをすぐに有効化
  );
});

// ---- 有効化時：古いバージョンのキャッシュを削除 ----
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('tetris-offline-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim()) // すぐに全ページを制御下に置く
  );
});

// ---- リクエスト時：キャッシュ優先 → なければネットワーク → それも失敗したらオフライン用フォールバック ----
self.addEventListener('fetch', (event) => {
  // GET以外（POST等）はそのままネットワークに任せる
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          // 正常なレスポンスはキャッシュにも保存して次回オフラインでも使えるようにする
          if (response && response.status === 200 && response.type === 'basic') {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // オフラインかつキャッシュにも無い場合、画面遷移リクエストならindex.htmlを返す
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return undefined;
        });
    })
  );
});
