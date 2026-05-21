'use client'

import { motion } from 'framer-motion'
import { ArrowRight, Check, Server, Zap } from 'lucide-react'

const plans = [
  {
    name: 'Community Release',
    icon: Zap,
    price: 'Free',
    description: 'Open-source workflow automation for local and self-hosted use.',
    features: [
      'Visual workflow builder',
      'BYOK AI provider settings',
      'Community blocks and integrations',
      'Local PostgreSQL runtime',
      'First-run owner setup',
      'Community support',
    ],
    cta: 'Get Started',
    href: '/signup',
    hex: '#64F2C5',
  },
  {
    name: 'Self-Hosted Runtime',
    icon: Server,
    price: 'Your infra',
    description: 'Run the Community build in an environment you operate and control.',
    features: [
      'Bring your own database',
      'Bring your own model keys',
      'Control credentials and storage',
      'Configure backups and access',
      'Inspectable workflow execution',
      'Apache-2.0 source license',
    ],
    cta: 'Read Docs',
    href: '/docs',
    hex: '#F9C65C',
  },
]

function isExternalHref(href: string) {
  return href.startsWith('http://') || href.startsWith('https://')
}

export default function Pricing() {
  return (
    <section className="community-ui-section gb-pricing relative overflow-hidden bg-[#f4f5f7] py-24 dark:bg-transparent md:py-32 lg:py-40">
      <div className="container relative z-10 mx-auto px-4 md:px-6">
        <motion.div
          className="community-ui-section-head mb-14 text-center md:mb-20"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="odyssey-editorial-kicker mb-6 inline-flex">
            <span className="odyssey-editorial-dot" />
            <span className="font-tech text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-white/40">
              Editions
            </span>
            <span className="h-3.5 w-px bg-black/[0.07] dark:bg-white/[0.08]" />
            <span className="font-heading text-[13px] font-medium tracking-[-0.03em] text-[#4d6268] dark:text-[#b9c8cf]">
              Community first
            </span>
          </div>
          <h2 className="odyssey-display-title mx-auto mb-6 max-w-[12ch] text-[2.45rem] text-zinc-800 dark:text-white md:text-[3.25rem] lg:text-[4rem]">
            Community{' '}
            <span className="odyssey-display-accent bg-linear-to-r from-[#5B7B6F] via-[#4A7A68] to-[#6B8F80] bg-clip-text text-transparent dark:from-[#6EDAB0] dark:via-[#5EC9A0] dark:to-[#4AB890]">
              Release
            </span>
          </h2>
          <p className="odyssey-section-copy mx-auto max-w-xl text-[15.5px] md:text-[17px]">
            Start with the Apache-2.0 community build and operate it on infrastructure you control.
          </p>
        </motion.div>

        <div className="mx-auto grid max-w-[920px] grid-cols-1 gap-px rounded-[22px] border border-black/[0.06] bg-[rgba(244,246,248,0.88)] dark:border-white/[0.06] dark:bg-[rgba(13,12,10,0.84)] md:grid-cols-2">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: index * 0.07 }}
              className="community-ui-pricing-card silver-glass-pane group relative flex flex-col overflow-hidden border-0 bg-[rgba(244,246,248,0.9)] p-6 transition-colors duration-300 hover:bg-[rgba(250,251,252,0.97)] dark:bg-[rgba(13,12,10,0.88)] dark:hover:bg-[rgba(18,16,13,0.94)] sm:p-8 md:p-10"
            >
              <div className="mb-6 flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-[12px]"
                  style={{
                    background: `linear-gradient(145deg, ${plan.hex}12, ${plan.hex}06)`,
                    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.55), 0 0 0 1px ${plan.hex}10`,
                  }}
                >
                  <plan.icon
                    className="h-[18px] w-[18px]"
                    style={{ color: plan.hex }}
                    strokeWidth={1.7}
                  />
                </div>
                <h3 className="font-heading text-[18px] font-semibold tracking-[-0.02em] text-zinc-800 dark:text-white">
                  {plan.name}
                </h3>
              </div>

              <p className="mb-6 font-body text-[13px] leading-[1.5] tracking-[-0.01em] text-zinc-500 dark:text-white/[0.65]">
                {plan.description}
              </p>

              <div className="mb-8">
                <span className="font-heading text-[42px] font-medium leading-[1.0] tracking-[-0.035em] text-zinc-800 dark:text-white md:text-[48px]">
                  {plan.price}
                </span>
              </div>

              <a
                href={plan.href}
                target={isExternalHref(plan.href) ? '_blank' : undefined}
                rel={isExternalHref(plan.href) ? 'noopener noreferrer' : undefined}
                className="silver-glass-button mb-8 inline-flex w-full items-center justify-center gap-2 rounded-[12px] py-3 text-center font-tech text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-700 transition-all duration-200 hover:-translate-y-px hover:text-zinc-900 dark:text-white dark:hover:text-white"
              >
                {plan.cta}
                <ArrowRight className="h-3.5 w-3.5" />
              </a>

              <div className="mb-6 h-px bg-black/[0.05] dark:bg-white/[0.05]" />

              <div className="mt-auto space-y-3">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-center gap-2.5">
                    <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full">
                      <Check
                        className="h-2.5 w-2.5"
                        style={{ color: plan.hex }}
                        strokeWidth={2.5}
                      />
                    </div>
                    <span className="font-body text-[12.5px] tracking-[-0.01em] text-zinc-500 dark:text-white/[0.65]">
                      {feature}
                    </span>
                  </div>
                ))}
              </div>

              <div
                className="absolute inset-x-0 bottom-0 h-[2px] opacity-40 transition-opacity duration-300 group-hover:opacity-80"
                style={{
                  background: `linear-gradient(90deg, transparent, ${plan.hex}, transparent)`,
                }}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
