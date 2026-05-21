/**
 * GET /sw.js
 *
 * Serves the service worker source with a per-build cache version injected
 * at request time. Replaces the static `public/sw.js` so the SW's
 * `CACHE_VERSION` constant can never drift behind the rest of the bundle.
 *
 * How auto-versioning works end to end:
 *
 *   1. `next.config.ts#generateBuildId` mints a fresh `${Date.now()}-${rand}`
 *      string at every `next build`. The result lands in `.next/BUILD_ID`.
 *
 *   2. On registration, `app/layout.tsx` reads `window.__NEXT_DATA__.buildId`
 *      and appends `?v=<buildId>` to the SW URL. The SW reads that query
 *      param at install time, so each deploy registers as a different URL,
 *      and the browser treats it as a different SW → install + activate
 *      cycle runs without operator action.
 *
 *   3. Inside the SW, `CACHE_VERSION` is built from the `?v=` param when
 *      present, falling back to the value injected here (the same BUILD_ID
 *      from `.next/BUILD_ID`). The `activate` handler deletes every cache
 *      bucket whose name doesn't match the current version, so stale assets
 *      are GC'd automatically on the next visit after a deploy.
 *
 * Why a Route Handler and not `public/sw.js`:
 *   - A static file can't know the BUILD_ID at request time.
 *   - The old design hardcoded `FALLBACK_CACHE_VERSION = 'v6'` and required
 *     a manual bump every time someone wanted to flush caches — easy to
 *     forget. The Mona Sans incident (2026-04-01 → 2026-05-12) was the
 *     symptom: clients kept the bad asset in cache until someone realized
 *     they had to bump the constant.
 *
 * HTTP headers:
 *   - Cache-Control no-cache so browsers/CDN always re-fetch on navigation
 *     (`registration.update()` and the 24h auto-refresh both rely on this).
 *   - Service-Worker-Allowed: '/' so the SW can claim the whole origin
 *     regardless of where the script is served from.
 */
import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

let cachedBuildId: string | null = null

/**
 * Resolves the current build id. In production Next.js writes it to
 * `.next/BUILD_ID` (single line, trimmed). In dev there is no build, so we
 * fall back to a stable string — SW cache invalidation isn't useful during
 * dev because HMR replaces assets anyway.
 */
async function getBuildId(): Promise<string> {
  if (cachedBuildId) return cachedBuildId
  try {
    const raw = await readFile(join(process.cwd(), '.next', 'BUILD_ID'), 'utf8')
    cachedBuildId = raw.trim() || 'dev'
  } catch {
    cachedBuildId = 'dev'
  }
  return cachedBuildId
}

// Service worker source. The placeholder `__BUILD_ID__` is substituted at
// request time. Keep this in sync with the operational contract documented
// in the file header.
const SW_SOURCE = String.raw`
const CACHE_PREFIX = 'nowflow-'

// FALLBACK_CACHE_VERSION is injected by app/sw.js/route.ts from .next/BUILD_ID.
// The ?v= query param (set by layout.tsx from window.__NEXT_DATA__.buildId)
// takes precedence — both should normally agree. The fallback only kicks in
// for direct /sw.js fetches without query params (debug tools, crawler).
const FALLBACK_CACHE_VERSION = '__BUILD_ID__'
const CACHE_VERSION = (() => {
  try {
    const url = new URL(self.location.href)
    return url.searchParams.get('v') || FALLBACK_CACHE_VERSION
  } catch {
    return FALLBACK_CACHE_VERSION
  }
})()
const STATIC_CACHE = CACHE_PREFIX + 'static-' + CACHE_VERSION
const DYNAMIC_CACHE = CACHE_PREFIX + 'dynamic-' + CACHE_VERSION
const MAX_DYNAMIC_ENTRIES = 50

const CACHEABLE_PATH_PREFIXES = ['/static/', '/twitter/']
const STATIC_ASSETS = ['/static/logo-9.png', '/manifest.json']

// Install — pre-warm the static bucket; never fail the install on a single
// missing asset.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll(STATIC_ASSETS).catch((err) => {
        console.log('[SW] static prewarm failed:', err)
      })
    )
  )
  self.skipWaiting()
})

// Activate — drop every cache bucket whose name doesn't match the current
// CACHE_VERSION. This is the auto-invalidation engine: each deploy mints a
// new BUILD_ID → new bucket names → old buckets get deleted here.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys()
      await Promise.all(
        cacheNames
          .filter(
            (name) =>
              name.startsWith(CACHE_PREFIX) && name !== STATIC_CACHE && name !== DYNAMIC_CACHE
          )
          .map((name) => caches.delete(name))
      )
      await self.clients.claim()
    })()
  )
})

async function trimCache(cacheName, maxEntries) {
  try {
    const cache = await caches.open(cacheName)
    const keys = await cache.keys()
    if (keys.length <= maxEntries) return
    await Promise.all(
      keys.slice(0, keys.length - maxEntries).map((req) => cache.delete(req))
    )
  } catch (err) {
    console.log('[SW] trim failed:', err)
  }
}

// Fetch — opinionated: never cache Next.js hashed chunks, HTML navigations,
// fonts, /api/, or the SW itself. Only stable static assets under the
// CACHEABLE_PATH_PREFIXES whitelist get the cache-first treatment.
self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  let url
  try {
    url = new URL(request.url)
  } catch {
    return
  }
  if (url.origin !== location.origin) return
  if (url.pathname.startsWith('/api/')) return
  if (url.pathname.startsWith('/_next/')) return
  if (url.pathname === '/sw.js') return
  if (url.pathname.startsWith('/fonts/') || /\.(woff2?|ttf|otf|eot)$/.test(url.pathname)) return

  const accept = request.headers.get('accept') || ''
  const isHtmlNavigation = request.mode === 'navigate' || accept.includes('text/html')
  if (isHtmlNavigation) {
    event.respondWith(
      fetch(request).catch(
        () => new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
      )
    )
    return
  }

  const shouldCache = CACHEABLE_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))
  if (!shouldCache) {
    event.respondWith(fetch(request).catch(() => new Response('Offline', { status: 503 })))
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request)
        .then((response) => {
          if (
            !response ||
            response.status !== 200 ||
            response.type === 'error' ||
            response.type === 'opaque'
          ) {
            return response
          }
          const clone = response.clone()
          event.waitUntil(
            caches
              .open(DYNAMIC_CACHE)
              .then((cache) => cache.put(request, clone))
              .then(() => trimCache(DYNAMIC_CACHE, MAX_DYNAMIC_ENTRIES))
          )
          return response
        })
        .catch((err) => {
          console.log('[SW] fetch failed:', err)
          return new Response('Offline', { status: 503 })
        })
    })
  )
})

// Background sync hook (waitlist offline submissions — placeholder).
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-waitlist') {
    event.waitUntil(Promise.resolve())
  }
})

// Push notifications.
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {}
  const title = data.title || 'NowFlow'
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/static/logo-9.png',
    badge: '/static/logo-9.png',
    data: data.url || '/',
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(clients.openWindow(event.notification.data || '/'))
})
`

export async function GET() {
  const buildId = await getBuildId()
  const body = SW_SOURCE.replace(/__BUILD_ID__/g, buildId)
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Service-Worker-Allowed': '/',
      // Expose the build id to clients that want to display a build banner
      // or correlate logs without parsing the body.
      'X-Build-Id': buildId,
    },
  })
}
