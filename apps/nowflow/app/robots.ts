import { MetadataRoute } from 'next'

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

/**
 * Dynamic robots.txt for NowFlow
 * Replaces public/robots.txt to support environment-based domain configuration
 * Updated: 2026-03-05
 */
export default function robots(): MetadataRoute.Robots {
  const commonDisallow = ['/api/', '/_next/', '/w/*']

  const extendedDisallow = [
    ...commonDisallow,
    '/verify',
    '/forgot-password',
    '/reset-password',
    '/invite/',
  ]

  return {
    rules: [
      // Traditional Search Engine Crawlers
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: extendedDisallow,
      },
      {
        userAgent: 'Bingbot',
        allow: '/',
        disallow: extendedDisallow,
      },
      {
        userAgent: 'Yandex',
        allow: '/',
        disallow: commonDisallow,
      },
      {
        userAgent: 'DuckDuckBot',
        allow: '/',
        disallow: commonDisallow,
      },

      // AI Training & LLM Crawlers
      {
        userAgent: 'GPTBot',
        allow: ['/', '/login', '/signup', '/privacy', '/terms', '/cookies', '/security', '/dpa'],
        disallow: extendedDisallow,
      },
      {
        userAgent: 'ChatGPT-User',
        allow: '/',
        disallow: commonDisallow,
      },
      {
        userAgent: 'Claude-Web',
        allow: ['/', '/login', '/signup', '/privacy', '/terms'],
        disallow: commonDisallow,
      },
      {
        userAgent: 'ClaudeBot',
        allow: '/',
        disallow: commonDisallow,
      },
      {
        userAgent: 'Google-Extended',
        allow: ['/', '/login', '/signup', '/privacy', '/terms'],
        disallow: commonDisallow,
      },
      {
        userAgent: 'anthropic-ai',
        allow: '/',
        disallow: commonDisallow,
      },
      {
        userAgent: 'cohere-ai',
        allow: '/',
        disallow: commonDisallow,
      },
      {
        userAgent: 'FacebookBot',
        allow: '/',
        disallow: commonDisallow,
      },
      {
        userAgent: 'Meta-ExternalAgent',
        allow: '/',
        disallow: commonDisallow,
      },
      {
        userAgent: 'Amazonbot',
        allow: '/',
        disallow: commonDisallow,
      },
      {
        userAgent: 'Applebot',
        allow: '/',
        disallow: commonDisallow,
      },
      {
        userAgent: 'Applebot-Extended',
        allow: '/',
        disallow: commonDisallow,
      },
      {
        userAgent: 'DuckAssistBot',
        allow: '/',
        disallow: commonDisallow,
      },
      {
        userAgent: 'Diffbot',
        allow: '/',
        disallow: commonDisallow,
      },
      {
        userAgent: 'CCBot',
        allow: '/',
        disallow: commonDisallow,
      },
      {
        userAgent: 'Bytespider',
        allow: '/',
        disallow: commonDisallow,
      },
      {
        userAgent: 'YouBot',
        allow: '/',
        disallow: commonDisallow,
      },
      {
        userAgent: 'Brave-Indexer',
        allow: '/',
        disallow: commonDisallow,
      },
      {
        userAgent: 'MojeekBot',
        allow: '/',
        disallow: commonDisallow,
      },
      {
        userAgent: 'Neevabot',
        allow: '/',
        disallow: commonDisallow,
      },
      {
        userAgent: 'DeepSeekBot',
        allow: '/',
        disallow: commonDisallow,
      },
      {
        userAgent: 'GrokBot',
        allow: '/',
        disallow: commonDisallow,
      },
      {
        userAgent: 'MistralBot',
        allow: '/',
        disallow: commonDisallow,
      },
      {
        userAgent: 'AI2Bot',
        allow: '/',
        disallow: commonDisallow,
      },

      // Social Media Crawlers
      {
        userAgent: 'Twitterbot',
        allow: '/',
      },
      {
        userAgent: 'LinkedInBot',
        allow: '/',
      },
      {
        userAgent: 'Slackbot',
        allow: '/',
      },
      {
        userAgent: 'WhatsApp',
        allow: '/',
      },
      {
        userAgent: 'TelegramBot',
        allow: '/',
      },

      // Default rule for all other crawlers
      {
        userAgent: '*',
        allow: ['/', '/login', '/signup', '/privacy', '/terms', '/cookies', '/security', '/dpa'],
        disallow: [...extendedDisallow, '/shapes-demo/', '/examples/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
