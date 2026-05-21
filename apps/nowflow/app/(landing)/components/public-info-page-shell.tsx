import type { ReactNode } from 'react'
import Link from 'next/link'
import NavWrapper from './nav-wrapper'
import Footer from './sections/footer'

type QuickLink = {
  label: string
  href: string
}

type InfoMetric = {
  label: string
  value: string
}

function isExternalHref(href: string) {
  return href.startsWith('http://') || href.startsWith('https://')
}

interface PublicInfoPageShellProps {
  eyebrow: string
  title: string
  accent?: string
  description: string
  updatedLabel?: string
  quickLinks?: QuickLink[]
  metrics?: InfoMetric[]
  children: ReactNode
}

export function PublicInfoPageShell({
  eyebrow,
  title,
  accent,
  description,
  updatedLabel,
  quickLinks = [],
  metrics = [],
  children,
}: PublicInfoPageShellProps) {
  return (
    <main className="dark relative min-h-screen overflow-hidden bg-[#f4f5f7] dark:bg-[#0A0A0A] odyssey-landing community-ui-framework community-ui-landing font-body">
      <div aria-hidden="true" className="community-ui-scene-backdrop" />
      <NavWrapper />

      <div className="relative z-10">
        <section className="mx-auto max-w-6xl px-4 pb-8 pt-30 sm:px-6 sm:pb-10 sm:pt-36 lg:px-8 lg:pt-40">
          <div className="community-ui-framework-shell silver-glass-panel signal-accent-frame rounded-[18px] p-5 sm:p-8 lg:p-10">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.18fr)_280px] lg:items-end">
              <div className="max-w-3xl">
                <div className="signal-accent-chip mb-5 inline-flex items-center gap-2 rounded-[10px] px-3 py-1.5">
                  <span
                    className="h-1.5 w-1.5 rounded-[2px]"
                    style={{
                      background:
                        'linear-gradient(135deg, var(--ody-signal-coral, #ff7a59) 0%, var(--ody-signal-violet, #802fff) 52%, var(--ody-signal-cyan, #00a1e0) 100%)',
                    }}
                  />
                  <span className="font-tech text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-white/40">
                    {eyebrow}
                  </span>
                </div>
                <h1 className="odyssey-display-title text-[2.9rem] text-zinc-800 dark:text-white sm:text-[3.6rem] md:text-[4.5rem] lg:text-[5.15rem]">
                  {title}{' '}
                  {accent ? (
                    <span className="odyssey-display-accent bg-[var(--ody-signal-line-soft)] bg-clip-text text-transparent">
                      {accent}
                    </span>
                  ) : null}
                </h1>
                <p className="odyssey-section-copy mt-5 max-w-2xl text-base sm:text-lg">
                  {description}
                </p>
              </div>

              <div className="community-ui-framework-pane silver-glass-pane rounded-[14px] p-4 sm:p-5">
                <p className="font-tech text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400 dark:text-white/28">
                  Overview
                </p>
                <div className="mt-4 space-y-3">
                  {updatedLabel ? (
                    <div className="community-ui-framework-data-row dark:border-white/[0.06]">
                      <span className="community-ui-framework-meta-label">Last updated</span>
                      <span className="community-ui-framework-meta-value">{updatedLabel}</span>
                    </div>
                  ) : null}
                  {metrics.map((metric) => (
                    <div
                      key={metric.label}
                      className="community-ui-framework-data-row dark:border-white/[0.06]"
                    >
                      <span className="community-ui-framework-meta-label">{metric.label}</span>
                      <span className="community-ui-framework-meta-value">{metric.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6 sm:pb-32 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_250px] lg:items-start">
            <div className="community-ui-framework-shell silver-glass-panel rounded-[18px] p-5 sm:p-8 lg:p-10">
              <div className="space-y-10">{children}</div>
            </div>

            {quickLinks.length > 0 ? (
              <aside className="hidden lg:block">
                <div className="community-ui-framework-pane silver-glass-pane sticky top-32 rounded-[14px] p-5">
                  <p className="font-tech text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400 dark:text-white/28">
                    Navigate
                  </p>
                  <div className="mt-4 space-y-2">
                    {quickLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        target={isExternalHref(link.href) ? '_blank' : undefined}
                        rel={isExternalHref(link.href) ? 'noopener noreferrer' : undefined}
                        className="community-ui-framework-chip flex items-center justify-between rounded-[10px] bg-white/48 px-3 py-2 text-[12px] text-zinc-600 transition-colors duration-200 hover:text-zinc-900 dark:bg-white/[0.03] dark:text-white/42 dark:hover:text-white"
                      >
                        <span className="font-body font-medium tracking-[-0.01em]">
                          {link.label}
                        </span>
                        <span className="text-zinc-300 dark:text-white/16">/</span>
                      </Link>
                    ))}
                  </div>
                </div>
              </aside>
            ) : null}
          </div>
        </section>
      </div>

      <Footer />
    </main>
  )
}
