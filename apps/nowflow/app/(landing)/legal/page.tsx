import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicInfoPageShell } from '../components/public-info-page-shell'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Legal | NowFlow Community',
  description: 'A central hub for NowFlow legal, privacy, security, and data processing documents.',
}

export default function LegalPage() {
  return (
    <PublicInfoPageShell
      eyebrow="Legal"
      title="Trust,"
      accent="privacy, and terms"
      description="A single place to review the policies, agreements, and operational commitments that govern the NowFlow platform."
      metrics={[
        { label: 'Policies', value: '4 core docs' },
        { label: 'Security', value: 'Dedicated page' },
      ]}
      quickLinks={[
        { label: 'Privacy Policy', href: '/privacy' },
        { label: 'Terms of Service', href: '/terms' },
        { label: 'Cookie Policy', href: '/cookies' },
        { label: 'DPA', href: '/dpa' },
      ]}
    >
      <section>
        <h2 className="odyssey-info-heading mb-4">Legal center</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {[
            [
              'Privacy Policy',
              '/privacy',
              'How personal data is collected, used, protected, and governed across NowFlow.',
            ],
            [
              'Terms of Service',
              '/terms',
              'The commercial and platform terms that apply when using NowFlow.',
            ],
            [
              'Cookie Policy',
              '/cookies',
              'How cookies, analytics, preferences, and consent are managed.',
            ],
            [
              'Data Processing Agreement',
              '/dpa',
              'The processor-controller terms for customers handling regulated data.',
            ],
            [
              'Security Policy',
              '/security',
              'Operational security controls, incident response, and security reporting paths.',
            ],
          ].map(([title, href, copy]) => (
            <Link
              key={href}
              href={href}
              className="silver-glass-pane rounded-[24px] p-5 transition-transform duration-200 hover:-translate-y-0.5"
            >
              <p className="odyssey-info-card-title mb-2">{title}</p>
              <p className="odyssey-info-copy text-[13px]">{copy}</p>
            </Link>
          ))}
        </div>
      </section>

      <div className="h-px bg-black/[0.06] dark:bg-white/[0.06]" />

      <section>
        <h2 className="odyssey-info-heading mb-4">Need something specific?</h2>
        <p className="odyssey-info-copy mb-5 text-[14px]">
          For customer-specific paperwork, security questionnaires, or compliance follow-ups, reach
          out directly and we will route the request to the right team.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ['Legal', 'mailto:legal@nowflow.io'],
            ['Privacy', 'mailto:privacy@nowflow.io'],
            ['Security', 'mailto:security@nowflow.io'],
          ].map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="silver-glass-pane odyssey-info-card-title rounded-[24px] p-5 text-[13px] transition-colors duration-200 hover:text-[#4A7A68] dark:text-white dark:hover:text-[#8CB09C]"
            >
              {label}
            </Link>
          ))}
        </div>
      </section>
    </PublicInfoPageShell>
  )
}
