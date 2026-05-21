import type { Metadata } from 'next'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@nowflow.io'

export const landingMetadata: Metadata = {
  title: 'NowFlow Community',
  description: 'Open source workflow automation for building and running automations.',
  keywords: [
    'NowFlow',
    'NowFlow Community',
    'workflow automation',
    'automation builder',
    'open source automation',
  ],
  authors: [{ name: 'NowFlow Community', url: APP_URL }],
  creator: 'NowFlow Community',
  publisher: 'NowFlow Community',
  applicationName: 'NowFlow Community',
  generator: 'Next.js',
  referrer: 'origin-when-cross-origin',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(APP_URL),
  alternates: {
    canonical: '/',
    languages: {
      'en-US': '/en-US',
    },
  },
  openGraph: {
    title: 'NowFlow Community',
    description: 'Open source workflow automation for community use.',
    url: APP_URL,
    siteName: 'NowFlow Community',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'NowFlow Community',
        type: 'image/png',
      },
    ],
    emails: [SUPPORT_EMAIL],
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
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  other: {
    'theme-color': '#0f172a',
    'msapplication-TileColor': '#0f172a',
    'msapplication-navbutton-color': '#0f172a',
  },
}

export const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  '@id': `${APP_URL}/#software`,
  name: 'NowFlow Community',
  alternateName: 'NowFlow',
  description: 'Open source workflow automation for community use.',
  url: APP_URL,
  applicationCategory: 'BusinessApplication',
  applicationSubCategory: 'Workflow Automation',
  operatingSystem: 'Web Browser',
  isAccessibleForFree: true,
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
    'Self-hosted runtime control',
  ],
  provider: {
    '@id': `${APP_URL}/#organization`,
  },
  creator: {
    '@id': `${APP_URL}/#organization`,
  },
}

export const organizationStructuredData = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${APP_URL}/#organization`,
  name: 'NowFlow Community',
  legalName: 'NowFlow Community',
  url: APP_URL,
  logo: {
    '@type': 'ImageObject',
    url: `${APP_URL}/opengraph-image`,
    width: 1200,
    height: 630,
    caption: 'NowFlow Community',
  },
  description: 'Open source workflow automation for community use.',
  foundingDate: '2024',
  email: SUPPORT_EMAIL,
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'Support',
    email: SUPPORT_EMAIL,
    url: APP_URL,
    availableLanguage: 'English',
  },
  brand: {
    '@type': 'Brand',
    name: 'NowFlow',
    description: 'Workflow automation for builders and teams.',
    logo: `${APP_URL}/opengraph-image`,
  },
}

export const websiteStructuredData = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${APP_URL}/#website`,
  url: APP_URL,
  name: 'NowFlow Community',
  description: 'Open source workflow automation for community use.',
  publisher: {
    '@id': `${APP_URL}/#organization`,
  },
  inLanguage: 'en-US',
  copyrightHolder: {
    '@id': `${APP_URL}/#organization`,
  },
  copyrightYear: 2024,
}

export const productStructuredData = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  '@id': `${APP_URL}/#product`,
  name: 'NowFlow Community',
  description: 'Open source workflow automation for community use.',
  brand: {
    '@id': `${APP_URL}/#organization`,
  },
  offers: {
    '@type': 'Offer',
    url: APP_URL,
    priceCurrency: 'USD',
    price: '0',
    availability: 'https://schema.org/InStock',
    seller: {
      '@id': `${APP_URL}/#organization`,
    },
  },
  image: `${APP_URL}/opengraph-image`,
  category: 'Business Software > Workflow Automation',
}

export const faqStructuredData = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is NowFlow Community?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'NowFlow Community is the open source edition of NowFlow for building and running workflow automations.',
      },
    },
    {
      '@type': 'Question',
      name: 'How is NowFlow Community deployed?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'NowFlow Community is designed for local and self-hosted deployments where users manage their own infrastructure, credentials, and data.',
      },
    },
  ],
}

export const breadcrumbStructuredData = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: APP_URL,
    },
  ],
}
