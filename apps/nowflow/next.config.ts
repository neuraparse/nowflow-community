import type { NextConfig } from 'next'
import path from 'path'

// Load environment variables from .env file if not already loaded
if (!process.env.GOOGLE_CLIENT_ID && require('fs').existsSync('../../.env')) {
  require('dotenv').config({ path: '../../.env' })
}

// Suppress verbose Next.js cache logs in all environments
require('./lib/suppress-nextjs-logs')

// Load error handlers in development
if (process.env.NODE_ENV === 'development') {
  require('./lib/error-handlers')
}

// Build domain configuration from environment variables
const appHost = process.env.NEXT_PUBLIC_APP_URL
  ? new URL(process.env.NEXT_PUBLIC_APP_URL).host
  : undefined
const altHost = process.env.NEXT_PUBLIC_ALT_DOMAIN
  ? new URL(process.env.NEXT_PUBLIC_ALT_DOMAIN).host
  : undefined
const extraOrigins =
  process.env.ALLOWED_ORIGINS?.split(',')
    .map((s) => s.trim())
    .filter(Boolean) || []

const normalizeDevOriginHost = (origin: string) => {
  try {
    return new URL(origin).hostname.toLowerCase()
  } catch {
    return origin.replace(/:\d+$/, '').toLowerCase()
  }
}

const allowedDevOriginHosts = Array.from(
  new Set(
    ['localhost', '127.0.0.1', '0.0.0.0', process.env.DEV_ORIGIN, ...extraOrigins]
      .filter(Boolean)
      .map((origin) => normalizeDevOriginHost(origin as string))
  )
)

// CSP domain lists derived from env vars.
const cspAppDomains = [
  ...(appHost ? [`https://${appHost}`] : []),
  ...(altHost ? [`https://${altHost}`] : []),
]

const nextConfig: NextConfig = {
  reactCompiler: true,
  devIndicators: false,
  // Generate unique build ID for each build to prevent cache issues
  generateBuildId: async () => {
    // Use timestamp + random string for unique build IDs
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  },
  // Disable TypeScript checking during builds; run `npm run check-types` separately.
  typescript: {
    ignoreBuildErrors: true,
  },
  // Server-side packages that should not be bundled
  serverExternalPackages: [
    'pino',
    'pino-pretty',
    'thread-stream',
    'officeparser',
    'unpdf',
    'tesseract.js',
    'tesseract.js-core',
    'impit',
    'jsdom',
    'turndown',
    'quickjs-emscripten',
    '@jitl/quickjs-wasmfile-release-sync',
  ],
  // Configure Server Actions for reverse proxy setups.
  experimental: {
    // Minify server-side bundles.
    serverMinification: true,
    serverActions: {
      allowedOrigins: [
        ...(appHost ? [appHost] : []),
        ...(altHost ? [altHost] : []),
        'localhost:3000',
        '127.0.0.1:3000',
        ...extraOrigins,
      ],
    },
    optimizeCss: true,
    optimizePackageImports: [
      'lucide-react',
      'framer-motion',
      '@radix-ui/react-icons',
      '@xyflow/react',
      'date-fns',
      'react-icons',
      '@aws-sdk/client-s3',
      '@aws-sdk/s3-request-presigner',
      '@radix-ui/react-accordion',
      '@radix-ui/react-alert-dialog',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-popover',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip',
      'lodash',
      'react-hook-form',
      'zod',
    ],
  },
  // Keep source maps out of browser bundles.
  productionBrowserSourceMaps: false,
  compress: true,
  poweredByHeader: false,
  // Suppress verbose logging in development
  logging: {
    fetches: {
      fullUrl: false,
    },
    ...(process.env.NODE_ENV === 'development' && {
      level: 'error', // Only show errors in development
    }),
  },
  // Note: onDemandEntries was removed in Next.js 15+ (handled internally)
  // Allow cross-origin requests from the server IP in development
  ...(process.env.NODE_ENV === 'development' && {
    allowedDevOrigins: allowedDevOriginHosts,
  }),
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 2678400,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'oaidalleapiprodscus.blob.core.windows.net',
      },
      {
        protocol: 'https',
        hostname: 'api.stability.ai',
      },
    ],
  },
  output: 'standalone',
  outputFileTracingExcludes: {
    '*': [
      '.git/**/*',
      '.github/**/*',
      '.turbo/**/*',
      '**/.turbo/**/*',
      '**/.next/cache/**/*',
      '**/node_modules/.cache/**/*',
      '**/__tests__/**/*',
      '**/*.test.*',
      '**/*.spec.*',
      '**/*.tsbuildinfo',
      '**/tsconfig*.json',
      '**/.env*',
      '**/.gitignore',
      '**/.dockerignore',
      'next.config.*',
      'README.md',
      'docs/**/*',
    ],
  },
  turbopack: {
    resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.json'],
    // Alias for pdf-parse to resolve internal paths
    resolveAlias: {
      'pdf-parse/lib/pdf-parse.js': 'pdf-parse',
    },
  },
  ...(process.env.NODE_ENV === 'development' && {
    outputFileTracingRoot: path.join(__dirname, '../../'),
  }),
  webpack: (config, { isServer, dev }) => {
    // Skip webpack configuration in development when using Turbopack
    if (dev && process.env.NEXT_RUNTIME === 'turbopack') {
      return config
    }

    // Configure webpack cache based on environment
    if (config.cache) {
      if (process.env.NODE_ENV === 'production') {
        // Use memory cache for server builds to avoid container memory spikes.
        config.cache = {
          type: 'memory',
        }
      } else {
        // Use filesystem cache for development with proper path validation
        const cacheDir = path.resolve(process.cwd(), '.next/cache/webpack')
        config.cache = {
          type: 'filesystem',
          buildDependencies: {
            config: [__filename],
          },
          cacheDirectory: cacheDir,
          // Optimize cache settings for memory efficiency
          maxAge: 1000 * 60 * 60 * 24 * 3, // 3 days (reduced)
          compression: 'gzip',
          maxMemorySize: 1024 * 1024 * 512, // 512MB max cache size
          // Add name to avoid illegal path warnings
          name: 'webpack-cache',
        }
      }
    }

    // Avoid aliasing React on the server/edge runtime builds because it bypasses
    // the "react-server" export condition, which Next.js relies on when
    // bundling React Server Components and API route handlers.
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        react: path.join(__dirname, '../../node_modules/react'),
        'react-dom': path.join(__dirname, '../../node_modules/react-dom'),
      }
    }

    // Configure for Transformers.js and server-only packages
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
      net: false,
      tls: false,
      perf_hooks: false,
      os: false,
    }

    // Handle WASM files for Transformers.js
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    }

    // Add rule for WASM files
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'webassembly/async',
    })

    // Production optimizations
    // Note: Next.js 15+ has its own optimized chunk splitting strategy.
    // Custom splitChunks/runtimeChunk overrides can break hydration and routing.
    // moduleIds and chunkIds are already 'deterministic' by default.
    if (!dev) {
      config.optimization = {
        ...config.optimization,
        moduleIds: 'deterministic',
        chunkIds: 'deterministic',
      }
    }

    return config
  },
  transpilePackages: [
    'prettier',
    '@react-email/components',
    '@react-email/render',
    'youtube-transcript',
  ],
  async headers() {
    return [
      {
        // HTML pages - NEVER cache to ensure users always get latest build
        // This prevents users from seeing old cached HTML that references old JS/CSS
        source: '/:path((?!_next|static|api|fonts).*)*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate, max-age=0',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
        ],
      },
      {
        // RSC (React Server Components) payloads - CRITICAL for App Router
        // These are loaded during SPA navigation with ?_rsc query parameter
        // Must have same no-cache policy as HTML to prevent stale navigation
        // Note: Query parameters in Next.js headers use a different approach
        source: '/:path(.*)',
        has: [
          {
            type: 'query',
            key: '_rsc',
          },
        ],
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate, max-age=0',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
        ],
      },
      {
        // Robots.txt - allow all crawlers
        source: '/robots.txt',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, s-maxage=3600',
          },
          {
            key: 'X-Robots-Tag',
            value: 'all',
          },
        ],
      },
      {
        // Sitemap - allow all crawlers
        source: '/sitemap.xml',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, s-maxage=3600',
          },
          {
            key: 'X-Robots-Tag',
            value: 'all',
          },
        ],
      },
      {
        // Service worker - always revalidate to avoid stale clients after deploys
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, max-age=0, must-revalidate',
          },
        ],
      },
      {
        // Static assets caching
        source: '/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Font files caching (custom /fonts/ directory only)
        source: '/fonts/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // Note: /_next/static, /_next/image, /_next/static/media cache headers
      // are managed automatically by Next.js 16 — custom overrides are not allowed.
      {
        // API routes CORS headers
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Credentials',
            value: 'true',
          },
          // Access-Control-Allow-Origin is set dynamically in middleware.ts
          // to support browser clients in development.
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET,POST,OPTIONS,PUT,DELETE',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value:
              'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, Cookie',
          },
        ],
      },
      {
        // Apply Cross-Origin Isolation headers to all routes except those that use the Google Drive Picker
        source: '/((?!w/.*|api/auth/oauth/drive).*)',
        headers: [
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
        ],
      },
      {
        // For routes that use the Google Drive Picker, only apply COOP but not COEP
        source: '/(w/.*|api/auth/oauth/drive)',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
        ],
      },
      // Apply security headers to all routes
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-XSS-Protection',
            value: '0',
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'same-site',
          },
          {
            key: 'X-Permitted-Cross-Domain-Policies',
            value: 'none',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              `default-src 'self'`,
              `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.google.com https://apis.google.com https://challenges.cloudflare.com`,
              `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
              `img-src 'self' data: blob: ${cspAppDomains.join(' ')} https://*.googleusercontent.com https://*.google.com https://*.atlassian.com https://unpkg.com https://cdn.jsdelivr.net https://*.licdn.com`,
              `media-src 'self' blob:`,
              `font-src 'self' https://fonts.gstatic.com`,
              `connect-src 'self' http://localhost:3000 http://127.0.0.1:3000 ${cspAppDomains.join(' ')} ${process.env.OLLAMA_HOST || 'http://localhost:11434'} https://*.googleapis.com https://*.amazonaws.com https://*.s3.amazonaws.com https://*.atlassian.com https://api.openai.com https://api.anthropic.com https://api.x.ai https://api.deepseek.com https://generativelanguage.googleapis.com https://api.linkedin.com https://www.linkedin.com https://*.graph.microsoft.com https://challenges.cloudflare.com`,
              `frame-src https://drive.google.com https://*.google.com https://challenges.cloudflare.com`,
              `frame-ancestors 'self'`,
              `form-action 'self'`,
              `base-uri 'self'`,
              `object-src 'none'`,
            ].join('; '),
          },
        ],
      },
    ]
  },
}

export default nextConfig
