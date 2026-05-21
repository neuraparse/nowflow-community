'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Heart } from 'lucide-react'
import { Mail } from 'lucide-react'
import { NowFlowBrandLockup, NowFlowWordmark } from '@/components/branding/nowflow-brand'
import { APP_DOMAIN } from '@/lib/config/app-urls'

interface FooterProps {
  primaryCtaHref?: string
}

const linkGroups = [
  {
    title: 'Product',
    links: [
      { label: 'Workflow Builder', href: '#features' },
      { label: 'AI Agents', href: '#features' },
      { label: 'Integrations', href: '#integrations' },
      { label: 'Pricing', href: '#pricing' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'Company', href: '/company' },
      { label: 'Blog', href: '/blog' },
      { label: 'Security', href: '/security' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Legal', href: '/legal' },
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Cookie Policy', href: '/cookies' },
      { label: 'DPA', href: '/dpa' },
    ],
  },
]

const features = [
  'Agentic Workflow Builder',
  'AI Agents',
  'Extensible Integrations',
  'API Deploy',
  'Embedded UI',
  'Chat Surfaces',
  'Workflow Versioning',
  'Live Canvas',
  'Human-in-the-Loop',
  'Team Workspaces',
  'Owner Setup',
  'Self-Hosted Runtime',
  'Runtime Observability',
  'API & Chat Surfaces',
]

const socials = [
  {
    label: 'Email',
    href: 'mailto:hello@nowflow.io',
    icon: Mail,
  },
]

function isExternalHref(href: string) {
  return href.startsWith('http://') || href.startsWith('https://')
}

function Footer({ primaryCtaHref = APP_DOMAIN }: FooterProps) {
  const [email, setEmail] = useState('')
  const [isSubscribed, setIsSubscribed] = useState(false)

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault()
    if (email) {
      setIsSubscribed(true)
      setEmail('')
      setTimeout(() => setIsSubscribed(false), 3000)
    }
  }

  return (
    <footer className="community-ui-footer relative overflow-hidden bg-[#f4f5f7] dark:bg-[#050505]">
      {/* Subtle geometric decoration */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-4vw] left-[-8vw] z-[1] aspect-[471/470] w-[24vw] rotate-180 opacity-[0.2] dark:opacity-[0.1]"
      >
        <svg
          viewBox="0 0 471 470"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="h-full w-full"
        >
          <path
            d="M471 94.274L471 124.274L365.88 124.274C361.462 124.274 357.88 127.856 357.88 132.274L357.88 225.495C357.88 229.913 354.298 233.495 349.88 233.495L219.5 233.495C215.082 233.495 211.5 237.077 211.5 241.495L211.5 461.5C211.5 465.918 207.918 469.5 203.5 469.5L8.5 469.5C4.082 469.5 0.5 465.918 0.5 461.5L0.5 157.274C0.5 152.856 4.082 149.274 8.5 149.274L184 149.274C188.418 149.274 192 145.692 192 141.274L192 102.274C192 97.856 195.582 94.274 200 94.274L471 94.274Z"
            fill="none"
            stroke="#74D4FF"
            strokeOpacity="0.15"
            strokeWidth="1"
          />
        </svg>
      </div>
      <div className="container mx-auto px-4 md:px-6">
        {/* CTA Band */}
        <div className="py-16 md:py-20">
          <div className="relative">
            {/* Rotating border glow */}
            <div
              className="absolute -inset-[1px] rounded-[29px]"
              style={{
                background:
                  'conic-gradient(from var(--border-angle, 0deg), transparent 0%, rgba(220,253,56,0.18) 20%, transparent 45%, rgba(116,212,255,0.08) 70%, transparent 100%)',
                animation: 'border-spin 8s linear infinite',
              }}
            />
            <div className="community-ui-shell community-ui-cta-shell silver-glass-panel relative rounded-[28px] overflow-hidden px-5 sm:px-8 md:px-16 py-12 sm:py-14 md:py-20">
              {/* Subtle ambient */}
              <div
                className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full blur-3xl opacity-[0.06] pointer-events-none"
                style={{ background: 'radial-gradient(circle, #dcfd38, transparent 70%)' }}
              />
              <div
                className="absolute bottom-0 left-0 w-[300px] h-[300px] rounded-full blur-3xl opacity-[0.04] pointer-events-none"
                style={{ background: 'radial-gradient(circle, #74D4FF, transparent 70%)' }}
              />

              <div className="community-ui-section-head relative z-10 text-center max-w-2xl mx-auto">
                <div className="mb-6 inline-flex odyssey-editorial-kicker">
                  <span className="odyssey-editorial-dot" />
                  <span className="font-tech text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-white/40">
                    Final Call
                  </span>
                  <span className="h-3.5 w-px bg-black/[0.07] dark:bg-white/[0.08]" />
                  <span className="font-heading text-[13px] font-medium tracking-[-0.03em] text-[#4d6268] dark:text-[#b9c8cf]">
                    Build with intent
                  </span>
                </div>
                <h2 className="odyssey-display-title mb-5 text-[2.6rem] text-zinc-800 dark:text-white sm:text-[3rem] md:text-[4rem] lg:text-[5rem]">
                  Ready to Build with{' '}
                  <NowFlowWordmark className="inline text-[inherit]" size="lg" />?
                </h2>
                <p className="odyssey-section-copy mb-8 max-w-lg mx-auto text-[15px] sm:mb-10">
                  Build self-hosted automations with a unified Community runtime you can inspect and
                  operate.
                </p>

                {/* Newsletter */}
                <form
                  onSubmit={handleSubscribe}
                  className="community-ui-footer-newsletter-form max-w-md mx-auto mb-8"
                >
                  <div className="community-ui-footer-newsletter silver-glass-pane flex flex-col sm:flex-row gap-2 p-1.5 rounded-2xl">
                    <input
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="community-ui-footer-input flex-1 bg-transparent px-4 py-2.5 text-[13px] tracking-[-0.01em] font-body text-zinc-700 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-white/25 focus:outline-none"
                      required
                    />
                    <div className="relative rounded-xl shrink-0 group/sub">
                      <div
                        className="absolute -inset-[1px] rounded-[13px] opacity-0 group-hover/sub:opacity-60 transition-opacity duration-500"
                        style={{
                          background:
                            'conic-gradient(from var(--border-angle, 0deg), transparent 0%, #dcfd38 20%, transparent 40%, #74d4ff80 70%, transparent 90%)',
                          animation: 'border-spin 3s linear infinite',
                        }}
                      />
                      <button
                        type="submit"
                        disabled={isSubscribed}
                        className="community-ui-footer-subscribe silver-glass-button-strong relative z-10 flex w-full items-center justify-center gap-1.5 rounded-xl px-5 py-2.5 text-[12px] font-medium tracking-[0.02em] font-body transition-all duration-200 hover:-translate-y-px disabled:opacity-60 sm:w-auto"
                      >
                        {isSubscribed ? (
                          <>
                            <Heart className="w-3.5 h-3.5 text-red-500" />
                            Subscribed
                          </>
                        ) : (
                          <>
                            Subscribe
                            <ArrowRight className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </form>

                {/* CTA */}
                <div className="relative inline-flex rounded-lg group/free">
                  <div
                    className="absolute -inset-[1px] rounded-[9px] opacity-0 group-hover/free:opacity-40 transition-opacity duration-500"
                    style={{
                      background:
                        'conic-gradient(from var(--border-angle, 0deg), transparent 0%, #74d4ff 20%, transparent 40%, #dcfd3880 70%, transparent 90%)',
                      animation: 'border-spin 3s linear infinite',
                    }}
                  />
                  <a
                    href={primaryCtaHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="community-ui-footer-secondary-cta silver-glass-button relative z-10 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-[12px] font-semibold tracking-[0.08em] uppercase font-tech text-zinc-700 dark:text-white/52 hover:text-zinc-900 dark:hover:text-white/78 transition-colors duration-200"
                  >
                    Open Workspace
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Community feature marquee */}
        <div className="community-ui-footer-marquee relative overflow-hidden py-6 border-t border-black/[0.05] dark:border-white/[0.05]">
          <div className="absolute left-0 top-0 bottom-0 w-20 bg-linear-to-r from-[#fafafa] dark:from-[#0A0A0A] to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-20 bg-linear-to-l from-[#fafafa] dark:from-[#0A0A0A] to-transparent z-10 pointer-events-none" />
          <motion.div
            className="flex items-center gap-6 whitespace-nowrap"
            animate={{ x: [0, -1200] }}
            transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
          >
            {[...features, ...features].map((f, i) => (
              <span
                key={i}
                className="community-ui-footer-marquee-text text-[12px] font-tech font-medium tracking-[0.08em] text-zinc-300 dark:text-white/28 uppercase"
              >
                {f}
              </span>
            ))}
          </motion.div>
        </div>

        {/* Links grid */}
        <div className="border-t border-black/[0.05] dark:border-white/[0.05] py-14 md:py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 md:gap-8">
            {/* Brand column */}
            <div className="community-ui-footer-column col-span-2 md:col-span-1">
              <Link href="/" className="inline-block mb-4">
                <NowFlowBrandLockup
                  className="items-start gap-3 text-left"
                  markClassName="h-8 w-8"
                  showSubtitle={false}
                  size="sm"
                  wordmarkClassName="text-[20px]"
                />
              </Link>
              <p className="text-[13px] text-zinc-400 dark:text-white/40 font-body tracking-[-0.01em] leading-[1.6] mb-5 max-w-[220px]">
                Agentic workflow platform by NowFlow Community
              </p>
              {/* Social icons */}
              <div className="flex items-center gap-3">
                {socials.map((s) => (
                  <Link
                    key={s.label}
                    href={s.href}
                    target={s.href.startsWith('http') ? '_blank' : undefined}
                    rel={s.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                    className="community-ui-footer-social silver-glass-chip w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 dark:text-white/40 hover:text-zinc-600 dark:hover:text-white/50 transition-all duration-200"
                    aria-label={s.label}
                  >
                    <s.icon className="w-3.5 h-3.5" />
                  </Link>
                ))}
              </div>
            </div>

            {/* Link columns */}
            {linkGroups.map((group) => (
              <div key={group.title} className="community-ui-footer-column">
                <h4 className="text-[11px] font-semibold font-tech tracking-[0.08em] uppercase text-zinc-400 dark:text-white/25 mb-4">
                  {group.title}
                </h4>
                <ul className="space-y-2.5">
                  {group.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        target={isExternalHref(link.href) ? '_blank' : undefined}
                        rel={isExternalHref(link.href) ? 'noopener noreferrer' : undefined}
                        className="text-[13px] font-body tracking-[-0.01em] text-zinc-500 dark:text-white/[0.65] hover:text-zinc-800 dark:hover:text-white/60 transition-colors duration-200"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="community-ui-footer-bottom border-t border-black/[0.05] dark:border-white/[0.05] py-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-[12px] text-zinc-400 dark:text-white/25 font-body tracking-[-0.01em]">
            © 2026 NowFlow Contributors. Apache-2.0 licensed.
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="/privacy"
              className="text-[12px] text-zinc-400 dark:text-white/25 font-body tracking-[-0.01em] hover:text-zinc-600 dark:hover:text-white/30 transition-colors duration-200"
            >
              Privacy
            </Link>
            <span className="text-zinc-200 dark:text-white/8 text-[8px] select-none">&middot;</span>
            <Link
              href="/terms"
              className="text-[12px] text-zinc-400 dark:text-white/25 font-body tracking-[-0.01em] hover:text-zinc-600 dark:hover:text-white/30 transition-colors duration-200"
            >
              Terms
            </Link>
            <span className="text-zinc-200 dark:text-white/8 text-[8px] select-none">&middot;</span>
            <Link
              href="/cookies"
              className="text-[12px] text-zinc-400 dark:text-white/25 font-body tracking-[-0.01em] hover:text-zinc-600 dark:hover:text-white/30 transition-colors duration-200"
            >
              Cookies
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
