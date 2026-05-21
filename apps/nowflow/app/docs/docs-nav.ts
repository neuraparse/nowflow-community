export interface DocsNavItem {
  label: string
  href: string
}

export interface DocsNavGroup {
  title: string
  items: DocsNavItem[]
}

export const docsNav: DocsNavGroup[] = [
  {
    title: 'Docs Home',
    items: [{ label: 'Overview', href: '/docs' }],
  },
  {
    title: 'Getting Started',
    items: [
      { label: 'Quick Start', href: '/docs/getting-started/quick-start' },
      { label: 'Documentation Map', href: '/docs/getting-started/documentation-map' },
    ],
  },
  {
    title: 'Platform',
    items: [
      { label: 'Workflow System', href: '/docs/platform/workflow-system' },
      { label: 'Core Capabilities', href: '/docs/platform/core-capabilities' },
      { label: 'Deployment', href: '/docs/platform/deployment' },
      { label: 'Resources & Knowledge', href: '/docs/platform/resources-knowledge' },
      { label: 'Observability', href: '/docs/platform/observability' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Security & Compliance', href: '/docs/operations/security-compliance' },
      { label: 'Authentication', href: '/docs/operations/authentication' },
    ],
  },
  {
    title: 'Blocks',
    items: [{ label: 'Blocks Catalog', href: '/docs/blocks' }],
  },
]
