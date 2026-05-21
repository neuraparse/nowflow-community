import type { Metadata } from 'next'
import Link from 'next/link'
import { ENTERPRISE_URL } from '@/lib/community/enterprise'
import { PublicInfoPageShell } from '../components/public-info-page-shell'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Company | NowFlow Community',
  description: 'Learn about the team, product philosophy, and company principles behind NowFlow.',
}

function isExternalHref(href: string) {
  return href.startsWith('http://') || href.startsWith('https://')
}

export default function CompanyPage() {
  return (
    <PublicInfoPageShell
      eyebrow="Company"
      title="Built for"
      accent="modern automation"
      description="NowFlow helps teams design, deploy, and scale agentic workflows with product-grade surfaces."
      metrics={[
        { label: 'Focus', value: 'Agentic workflows' },
        { label: 'Built for', value: 'Product + ops teams' },
      ]}
      quickLinks={[
        { label: 'Blog', href: '/blog' },
        { label: 'Security', href: '/security' },
        { label: 'Request a demo', href: ENTERPRISE_URL },
        { label: 'Contact', href: '/contact' },
      ]}
    >
      <section>
        <h2 className="odyssey-info-heading mb-4">What we are building</h2>
        <p className="odyssey-info-copy mb-4 text-[14px]">
          NowFlow brings workflow design, AI agents, integrations, deployment, and end-user surfaces
          into one system. Instead of stitching together brittle tools, teams can design a workflow
          once and ship it as an internal tool, embedded UI, API endpoint, or chat surface.
        </p>
        <p className="odyssey-info-copy text-[14px]">
          The product is shaped around a simple idea: automation should feel as intentional and
          composable as building software, without losing speed or operational clarity.
        </p>
      </section>

      <div className="h-px bg-black/[0.06] dark:bg-white/[0.06]" />

      <section>
        <h2 className="odyssey-info-heading mb-4">Product principles</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {[
            [
              'Clarity over complexity',
              'Every workflow should be easy to inspect, reason about, and evolve.',
            ],
            [
              'Multi-surface by default',
              'The same workflow should power internal tools, customer experiences, and APIs.',
            ],
            [
              'Operational trust',
              'Versioning, logs, human review, and observability are first-class.',
            ],
            [
              'Fast iteration',
              'Teams should move from idea to shipped experience in minutes, not weeks.',
            ],
          ].map(([title, description]) => (
            <div key={title} className="silver-glass-pane rounded-[14px] p-5">
              <p className="odyssey-info-card-title mb-2">{title}</p>
              <p className="odyssey-info-copy text-[13px]">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="h-px bg-black/[0.06] dark:bg-white/[0.06]" />

      <section>
        <h2 className="odyssey-info-heading mb-4">Explore more</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: 'Read the journal',
              href: '/blog',
              copy: 'Product notes, workflow patterns, and shipping decisions.',
            },
            {
              title: 'Review security',
              href: '/security',
              copy: 'A closer look at our protection, monitoring, and response posture.',
            },
            {
              title: 'Book a demo',
              href: ENTERPRISE_URL,
              copy: 'See how NowFlow can map to your stack, team, and goals.',
            },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              target={isExternalHref(item.href) ? '_blank' : undefined}
              rel={isExternalHref(item.href) ? 'noopener noreferrer' : undefined}
              className="silver-glass-pane rounded-[14px] p-5 transition-transform duration-200 hover:-translate-y-0.5"
            >
              <p className="odyssey-info-card-title mb-2">{item.title}</p>
              <p className="odyssey-info-copy text-[13px]">{item.copy}</p>
            </Link>
          ))}
        </div>
      </section>
    </PublicInfoPageShell>
  )
}
