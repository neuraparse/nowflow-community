import type { Metadata } from 'next'
import Link from 'next/link'
import { ENTERPRISE_URL } from '@/lib/community/enterprise'
import { PublicInfoPageShell } from '../components/public-info-page-shell'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Contact | NowFlow Community',
  description:
    'Get in touch with the NowFlow team for demos, security inquiries, partnerships, or support.',
}

export default function ContactPage() {
  return (
    <PublicInfoPageShell
      eyebrow="Company"
      title="Get in"
      accent="touch"
      description="Reach the right team for demos, partnerships, security questions, and product support without hunting through the product."
      metrics={[
        { label: 'Demo route', value: 'Tailored session' },
        { label: 'Security route', value: 'Direct inbox' },
      ]}
      quickLinks={[
        { label: 'Demo Request', href: ENTERPRISE_URL },
        { label: 'Security', href: '/security' },
        { label: 'Company', href: '/company' },
        { label: 'Legal hub', href: '/legal' },
      ]}
    >
      <section>
        <h2 className="odyssey-info-heading mb-4">Contact channels</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {[
            [
              'General',
              'hello@nowflow.io',
              'Questions about the platform, partnerships, and introductions.',
            ],
            [
              'Support',
              'support@nowflow.io',
              'Product issues, account help, and workflow troubleshooting.',
            ],
            [
              'Security',
              'security@nowflow.io',
              'Vulnerability reports and security-related questions.',
            ],
            [
              'Privacy / Legal',
              'legal@nowflow.io',
              'Compliance, legal requests, and data governance questions.',
            ],
          ].map(([title, email, copy]) => (
            <div key={email} className="silver-glass-pane rounded-[14px] p-5">
              <p className="odyssey-info-card-title mb-2">{title}</p>
              <Link
                href={`mailto:${email}`}
                className="font-body text-[13px] text-[#6b5df6] underline decoration-[#6b5df6]/20 underline-offset-4 transition-colors duration-200 hover:decoration-[#6b5df6]/50 dark:text-[#9ea6ff] dark:decoration-[#9ea6ff]/20 dark:hover:decoration-[#9ea6ff]/50"
              >
                {email}
              </Link>
              <p className="odyssey-info-copy mt-3 text-[13px]">{copy}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="h-px bg-black/[0.06] dark:bg-white/[0.06]" />

      <section>
        <h2 className="odyssey-info-heading mb-4">Faster routes</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Link
            href={ENTERPRISE_URL}
            target="_blank"
            rel="noreferrer"
            className="silver-glass-pane rounded-[14px] p-5 transition-transform duration-200 hover:-translate-y-0.5"
          >
            <p className="odyssey-info-card-title mb-2">Request a guided demo</p>
            <p className="odyssey-info-copy text-[13px]">
              Share your stack, use case, and goals so we can tailor the walkthrough around real
              workflows.
            </p>
          </Link>
          <Link
            href="/blog"
            className="silver-glass-pane rounded-[14px] p-5 transition-transform duration-200 hover:-translate-y-0.5"
          >
            <p className="odyssey-info-card-title mb-2">Browse updates and guides</p>
            <p className="odyssey-info-copy text-[13px]">
              Product notes, workflow patterns, and deployment ideas from the NowFlow team.
            </p>
          </Link>
        </div>
      </section>
    </PublicInfoPageShell>
  )
}
