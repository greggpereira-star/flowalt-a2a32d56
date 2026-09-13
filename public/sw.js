// Service Worker for PWA + Push Notifications
// v5: o SW so era registrado por quem ativava notificacao e nunca procurava
// versao nova, entao navegadores ficavam presos numa build antiga. O registro
// passou para o boot (src/lib/pwa/registerServiceWorker.ts) e a troca de
// versao agora recarrega a pagina sozinha. Subir os nomes de cache aqui
// descarta o que ficou gravado pelas versoes anteriores.
//
// v4: o filtro de API estava quebrado (ver comentario no handler de fetch) e
// respostas autenticadas foram parar no cache dos navegadores. Subir a versao
// faz o activate descartar o cache antigo, junto com esses dados.
const CACHE_NAME = 'flowalt-v5';
const STATIC_CACHE = 'flowalt-static-v4';

// Static assets to cache for offline (o HTML principal (`/`) nunca entra aqui:
// precisa sempre vir da rede para nao travar o app numa versao antiga)
const STATIC_ASSETS = [
  '/manifest.json',
  '/flowalt-symbol.png',
];

// Install - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker installed');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activated');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== STATIC_CACHE)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch - network first, cache fallback
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and API calls
  if (event.request.method !== 'GET') return;

  // O filtro antigo procurava por 'supabase.co', dominio do projeto hospedado
  // que foi desligado na migracao. Com o Supabase self-hosted a condicao nunca
  // batia, entao TODA resposta da API passou a ser cacheada: dados financeiros
  // e de kanban ficavam gravados no navegador e eram servidos como atuais
  // quando a rede caia. Filtrar pelos caminhos da API funciona em qualquer
  // dominio, agora e depois de uma futura troca de host.
  const apiPathMarkers = [
    '/api/',
    '/rest/v1/',
    '/auth/v1/',
    '/storage/v1/',
    '/realtime/v1/',
    '/functions/v1/',
  ];
  if (apiPathMarkers.some((marker) => event.request.url.includes(marker))) {
    return;
  }

  // Navegacoes (o HTML da SPA) sempre direto da rede, sem cache: garante que
  // toda atualizacao publicada chega na hora, sem depender de o cache expirar.
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

// Push notifications
self.addEventListener('push', (event) => {
  console.log('Push received:', event);
  
  let data = { title: 'Flowalt', body: 'Nova notificação' };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/flowalt-symbol.png',
    badge: '/flowalt-symbol.png',
    tag: data.tag || 'default',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
    },
    actions: [
      { action: 'open', title: 'Abrir' },
      { action: 'dismiss', title: 'Dispensar' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  console.log('Notification click:', event);
  
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      })
  );
});
