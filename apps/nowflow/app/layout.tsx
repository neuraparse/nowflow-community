import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { GlobalProviders } from '@/components/global-providers'
import { createLogger } from '@/lib/logs/console-logger'
import { ContextMenuPrevention } from './context-menu-prevention'
import './globals.css'
import { PointerEventsGuard } from './pointer-events-guard'
import { ZoomPrevention } from './zoom-prevention'

// Force all routes to render dynamically — this app requires auth, DB, and env vars at request time
export const dynamic = 'force-dynamic'

// Local font configuration - optimized for Next.js 16+ (2026)
//
// Preload strategy:
//   - Geist Sans: PRIMARY body font (font-sans). Preloaded for fast FCP.
//   - Inter: Secondary sans-serif in font-sans stack. Preloaded for fast FCP.
//   - Instrument Serif: Decorative/display font. No preload (used sparingly).
//   - Plus Jakarta Sans: Logo/brand font. No preload (used sparingly).
//
// adjustFontFallback generates a size-adjusted @font-face for the fallback so
// the swap from system font -> custom font causes minimal CLS.
const inter = localFont({
  src: [
    {
      path: '../public/fonts/inter-latin-400-normal.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../public/fonts/inter-latin-500-normal.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../public/fonts/inter-latin-600-normal.woff2',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../public/fonts/inter-latin-700-normal.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-inter',
  display: 'swap',
  preload: true, // Secondary body font — preload for fast fallback rendering
  fallback: ['system-ui', 'arial'],
  adjustFontFallback: 'Arial', // Size-adjusted fallback to reduce CLS
})

const geistSans = localFont({
  src: [
    { path: '../public/fonts/geist-sans-400.woff2', weight: '400', style: 'normal' },
    { path: '../public/fonts/geist-sans-500.woff2', weight: '500', style: 'normal' },
    { path: '../public/fonts/geist-sans-600.woff2', weight: '600', style: 'normal' },
    { path: '../public/fonts/geist-sans-700.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-geist-sans',
  display: 'swap',
  preload: true, // Primary body font — critical for above-fold text
  fallback: ['system-ui', 'sans-serif'],
  adjustFontFallback: 'Arial', // Size-adjusted fallback to reduce CLS
})

const instrumentSerif = localFont({
  src: [
    { path: '../public/fonts/instrument-serif-regular.woff2', weight: '400', style: 'normal' },
    { path: '../public/fonts/instrument-serif-italic.woff2', weight: '400', style: 'italic' },
  ],
  variable: '--font-instrument-serif',
  display: 'swap',
  preload: false, // Decorative font — not needed on first paint
  fallback: ['Georgia', 'serif'],
  adjustFontFallback: 'Times New Roman', // Size-adjusted fallback to reduce CLS
})

const plusJakartaSans = localFont({
  src: [
    { path: '../public/fonts/plus-jakarta-sans-300.woff2', weight: '300', style: 'normal' },
    { path: '../public/fonts/plus-jakarta-sans-400.woff2', weight: '400', style: 'normal' },
    { path: '../public/fonts/plus-jakarta-sans-500.woff2', weight: '500', style: 'normal' },
    { path: '../public/fonts/plus-jakarta-sans-700.woff2', weight: '700', style: 'normal' },
    { path: '../public/fonts/plus-jakarta-sans-800.woff2', weight: '800', style: 'normal' },
  ],
  variable: '--font-plus-jakarta',
  display: 'swap',
  preload: false, // Brand/logo font — not critical for first paint
  fallback: ['system-ui', 'sans-serif'],
  adjustFontFallback: 'Arial', // Size-adjusted fallback to reduce CLS
})

// ── Mona Sans removed 2026-05-12 ──
// The bundled woff2 was an HTML 404 page from a botched download (committed
// 2026-04-01, sat unnoticed for 41 days because Next.js silently falls back).
// Browser kept emitting `OTS parsing error: invalid sfntVersion: 168430090`
// (= 0x0A0A0A0A line-feeds) on every page load. Removed the import entirely
// rather than re-download because the font is purely decorative — the stack
// above (inter / geist / plus-jakarta) already
// covers every usage. If you genuinely want Mona Sans back, drop a clean
// `wOF2`-magic woff2 into public/fonts/ and re-add this `localFont(...)`.

const logger = createLogger('RootLayout')

// Add browser extension attributes that we want to ignore
const BROWSER_EXTENSION_ATTRIBUTES = [
  'data-new-gr-c-s-check-loaded',
  'data-gr-ext-installed',
  'data-gr-ext-disabled',
  'data-grammarly',
  'data-fgm',
  'data-lt-installed',
  // Add other known extension attributes here
]

if (typeof window !== 'undefined') {
  const originalError = console.error
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('Hydration')) {
      const isExtensionError = BROWSER_EXTENSION_ATTRIBUTES.some((attr) =>
        args.some((arg) => typeof arg === 'string' && arg.includes(attr))
      )

      if (!isExtensionError) {
        logger.error('Hydration Error', {
          details: args,
          componentStack: args.find(
            (arg) => typeof arg === 'string' && arg.includes('component stack')
          ),
        })
      }
    }
    originalError.apply(console, args as Parameters<typeof console.error>)
  }
}

export const viewport: Viewport = {
  themeColor: '#ffffff',
  colorScheme: 'light dark',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
}

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export const metadata: Metadata = {
  title: 'NowFlow Community',
  description: 'Open source workflow automation for building and running automations.',
  applicationName: 'NowFlow Community',
  authors: [{ name: 'NowFlow Community', url: baseUrl }],
  generator: 'Next.js',
  keywords: [
    'NowFlow',
    'NowFlow Community',
    'workflow automation',
    'automation builder',
    'open source automation',
    'automation platform',
  ],
  referrer: 'strict-origin-when-cross-origin',
  creator: 'NowFlow Community',
  publisher: 'NowFlow Community',
  metadataBase: new URL(baseUrl),
  alternates: {
    canonical: '/',
    languages: {
      'en-US': '/en-US',
    },
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-video-preview': -1,
      'max-snippet': -1,
    },
  },
  other: {
    'msapplication-TileColor': '#0f172a',
    'msapplication-navbutton-color': '#0f172a',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: baseUrl,
    title: 'NowFlow Community',
    description: 'Open source workflow automation for community use.',
    siteName: 'NowFlow Community',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'NowFlow Community',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NowFlow Community',
    description: 'Open source workflow automation for community use.',
    images: [
      {
        url: '/twitter-image',
        alt: 'NowFlow Community',
      },
    ],
  },
  icons: {
    icon: [{ url: '/static/nowflow-logo.svg', type: 'image/svg+xml' }],
  },
  formatDetection: {
    telephone: false,
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const serviceWorkerVersion =
    process.env.NEXT_PUBLIC_SW_VERSION ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    process.env.CF_PAGES_COMMIT_SHA ||
    ''

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Core Web Vitals Optimization - Performance Hints (2026) */}

        {/* DNS Prefetch for external domains */}
        <link rel="dns-prefetch" href="https://api.openai.com" />
        <link rel="dns-prefetch" href="https://api.anthropic.com" />
        {/* Note: fonts.googleapis.com dns-prefetch removed — Google Fonts are only
            used in server-rendered email templates, not in client-side code */}

        {/* Preconnect to critical origins */}
        <link rel="preconnect" href={baseUrl} />

        {/* PWA Manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/* Icons are defined via metadata.icons — no manual <link> needed */}

        {/* Organization Schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              '@id': `${baseUrl}/#organization`,
              name: 'NowFlow Community',
              legalName: 'NowFlow Community',
              url: baseUrl,
              logo: {
                '@type': 'ImageObject',
                url: `${baseUrl}/opengraph-image`,
                width: 1200,
                height: 630,
              },
              description: 'Open source workflow automation for community use.',
              foundingDate: '2024',
              brand: {
                '@type': 'Brand',
                name: 'NowFlow',
                description: 'Workflow automation for builders and teams.',
              },
            }),
          }}
        />

        {/* SoftwareApplication Schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              '@id': `${baseUrl}/#software`,
              name: 'NowFlow',
              applicationCategory: 'BusinessApplication',
              applicationSubCategory: 'Workflow Automation',
              operatingSystem: 'Web Browser',
              url: baseUrl,
              description: 'Open source workflow automation for community use.',
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'USD',
                availability: 'https://schema.org/InStock',
              },
              featureList: [
                'Visual workflow builder',
                'Automation execution',
                'Community integrations',
                'Enterprise upgrade paths',
              ],
              screenshot: `${baseUrl}/opengraph-image`,
              provider: {
                '@id': `${baseUrl}/#organization`,
              },
              creator: {
                '@id': `${baseUrl}/#organization`,
              },
            }),
          }}
        />

        {/* WebSite Schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              '@id': `${baseUrl}/#website`,
              url: baseUrl,
              name: 'NowFlow',
              description: 'Open source workflow automation for community use.',
              publisher: {
                '@id': `${baseUrl}/#organization`,
              },
              inLanguage: 'en-US',
              potentialAction: {
                '@type': 'SearchAction',
                target: {
                  '@type': 'EntryPoint',
                  urlTemplate: `${baseUrl}/blog?q={search_term_string}`,
                },
                'query-input': 'required name=search_term_string',
              },
            }),
          }}
        />

        {/* BreadcrumbList Schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'BreadcrumbList',
              itemListElement: [
                {
                  '@type': 'ListItem',
                  position: 1,
                  name: 'Home',
                  item: baseUrl,
                },
              ],
            }),
          }}
        />

        {/* Critical CSS - Inline for faster first paint */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              /* Critical enterprise surface styles for above-the-fold content */
              .liquid-glass {
                background: #fff;
                border: 1px solid rgba(24, 24, 27, 0.1);
                box-shadow: 0 1px 2px rgba(24, 24, 27, 0.06);
              }
              .glass-shimmer {
                position: relative;
                overflow: hidden;
              }
              .glass-shimmer::before {
                display: none;
              }
              .frosted-glass {
                background: #fff;
                border: 1px solid rgba(24, 24, 27, 0.1);
              }
            `,
          }}
        />

        {/* Service Worker Registration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  var explicitVersion = ${JSON.stringify(serviceWorkerVersion)};
                  var buildId = (window.__NEXT_DATA__ && window.__NEXT_DATA__.buildId) ? String(window.__NEXT_DATA__.buildId) : '';
                  var version = explicitVersion || buildId;
                  var swUrl = version ? ('/sw.js?v=' + encodeURIComponent(version)) : '/sw.js';
                  navigator.serviceWorker.register(swUrl, { updateViaCache: 'none' }).then(
                    function(registration) {
                      console.log('ServiceWorker registration successful');
                      registration.update?.();
                      // Poll for SW updates every 5 minutes. Browsers only auto-check
                      // /sw.js on navigation (and at most every 24h), so a tab left
                      // open during a deploy could sit on stale assets all day. The
                      // update() call is a cheap HEAD-equivalent that triggers the
                      // standard install→activate flow when a new BUILD_ID is
                      // detected; skipWaiting() inside the SW means activation is
                      // immediate, and clients.claim() picks up open tabs.
                      // We don't auto-reload here on purpose — interrupting a user
                      // mid-edit is worse than letting them keep the old session.
                      setInterval(function() {
                        registration.update().catch(function(){});
                      }, 5 * 60 * 1000);
                    },
                    function(err) {
                      console.log('ServiceWorker registration failed: ', err);
                    }
                  );
                });
              }
            `,
          }}
        />
      </head>
      <body
        className={`${inter.variable} ${geistSans.variable} ${instrumentSerif.variable} ${plusJakartaSans.variable} font-sans antialiased bg-[#fafafa] dark:bg-slate-950`}
        suppressHydrationWarning
      >
        <a href="#main-content" className="skip-to-content">
          Skip to main content
        </a>
        <ZoomPrevention />
        <ContextMenuPrevention />
        <PointerEventsGuard />
        <GlobalProviders>{children}</GlobalProviders>
      </body>
    </html>
  )
}
