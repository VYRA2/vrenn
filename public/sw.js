// VRENN Service Worker
// Estratégia: cache-first para assets estáticos (JS/CSS/fontes/ícones),
// network-first para navegação (páginas), com fallback offline.
// Dados dinâmicos (feed, metas, chat, etc.) NUNCA são cacheados —
// esse app depende de dados em tempo real via Supabase.

const CACHE_VERSION = "vrenn-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;

const PRECACHE_URLS = [
  "/",
  "/offline.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

// Instala e pré-cacheia o essencial
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

// Ativa e limpa caches antigos de versões anteriores
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key.startsWith("vrenn-") && key !== STATIC_CACHE).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(request) {
  const url = new URL(request.url);
  return (
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/assets/") ||
      url.pathname.startsWith("/icons/") ||
      url.pathname.endsWith(".css") ||
      url.pathname.endsWith(".js") ||
      url.pathname.endsWith(".woff2") ||
      url.pathname.endsWith(".png") ||
      url.pathname.endsWith(".jpg") ||
      url.pathname.endsWith(".svg"))
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Só GET, só mesma origem — nunca intercepta chamadas ao Supabase/Strava/APIs externas
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navegação de página (HTML) — network-first, cai pro offline.html se falhar
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
    return;
  }

  // Assets estáticos — cache-first, atualiza em segundo plano (stale-while-revalidate)
  if (isStaticAsset(request)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const fetchPromise = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => cached);
        return cached ?? fetchPromise;
      }),
    );
  }
  // Qualquer outra requisição (API, dados) segue direto pra rede, sem interceptar.
});

// ─── Push Notifications ───────────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "VRENN", body: event.data.text() };
  }

  const options = {
    body: data.body,
    icon: data.icon || "/icons/icon-192.png",
    badge: data.badge || "/icons/icon-192.png",
    image: data.image,
    tag: data.tag,
    data: { url: data.url || "/" },
    vibrate: [100, 50, 100],
  };

  event.waitUntil(self.registration.showNotification(data.title || "VRENN", options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        const clientUrl = new URL(client.url);
        if (clientUrl.pathname === targetUrl && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    }),
  );
});
