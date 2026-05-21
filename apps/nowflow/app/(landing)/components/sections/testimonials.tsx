'use client'

import { motion } from 'framer-motion'

const row1 = [
  {
    text: 'We automated our entire customer support workflow in just 2 hours. The AI agents handle 80% of our tickets automatically.',
    author: 'Sarah Chen',
    role: 'Head of Operations',
    company: 'TechFlow',
    initials: 'SC',
  },
  {
    text: 'The visual workflow builder is incredible. Our non-technical team members are now building complex automations independently.',
    author: 'Marcus Rodriguez',
    role: 'Product Manager',
    company: 'DataSync',
    initials: 'MR',
  },
  {
    text: 'From lead generation to sales follow-up, everything is automated. Our conversion rate increased by 40% in the first month.',
    author: 'Emily Watson',
    role: 'Sales Director',
    company: 'GrowthLab',
    initials: 'EW',
  },
]

const row2 = [
  {
    text: 'The integration capabilities are phenomenal. We connected 15+ tools in minutes and automated our entire data pipeline.',
    author: 'David Kim',
    role: 'DevOps Engineer',
    company: 'CloudTech',
    initials: 'DK',
  },
  {
    text: "Best AI workflow platform I've used. The visual approach makes complex logic simple and our team productivity skyrocketed.",
    author: 'Lisa Thompson',
    role: 'Data Scientist',
    company: 'AnalyticsPro',
    initials: 'LT',
  },
  {
    text: 'Incredible performance and reliability. We processed 10M+ documents automatically with zero downtime.',
    author: 'James Wilson',
    role: 'Engineering Manager',
    company: 'ScaleUp',
    initials: 'JW',
  },
]

function TestimonialCard({ t }: { t: (typeof row1)[0] }) {
  return (
    <div className="community-ui-testimonial-card silver-glass-pane relative w-[280px] shrink-0 rounded-[18px] border border-black/[0.05] bg-[rgba(244,246,248,0.88)] p-5 transition-all duration-300 hover:-translate-y-0.5 hover:bg-[rgba(250,251,252,0.96)] dark:border-white/[0.05] dark:bg-[rgba(13,12,10,0.84)] dark:hover:bg-[rgba(18,16,13,0.92)] sm:w-[340px] sm:p-6 md:w-[400px] md:p-7">
      <span className="pointer-events-none absolute right-5 top-4 font-serif text-[52px] italic leading-none text-[#d2d7de] dark:text-white/[0.06]">
        &rdquo;
      </span>
      <p className="mb-6 max-w-[30ch] font-body text-[13.5px] leading-[1.72] tracking-[-0.012em] text-zinc-500 dark:text-white/[0.64]">
        &ldquo;{t.text}&rdquo;
      </p>
      <div className="flex items-center gap-3">
        <div className="community-ui-testimonial-avatar silver-glass-chip flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-black/[0.04] dark:border-white/[0.05]">
          <span className="font-tech text-[9px] font-semibold tracking-[0.14em] text-zinc-500 dark:text-white/[0.55]">
            {t.initials}
          </span>
        </div>
        <div>
          <span className="block font-heading text-[13px] font-medium leading-tight tracking-[-0.02em] text-zinc-700 dark:text-white">
            {t.author}
          </span>
          <span className="font-tech text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400 dark:text-white/34">
            {t.role} · {t.company}
          </span>
        </div>
      </div>
    </div>
  )
}

export default function Testimonials() {
  // Duplicate arrays for seamless loop
  const marquee1 = [...row1, ...row1, ...row1, ...row1]
  const marquee2 = [...row2, ...row2, ...row2, ...row2]

  return (
    <section className="community-ui-section gb-testimonials relative overflow-hidden bg-[#f4f5f7] py-24 dark:bg-transparent md:py-32 lg:py-40">
      <div className="relative z-10">
        {/* Header */}
        <motion.div
          className="community-ui-section-head text-center mb-14 md:mb-20 px-4"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-6 inline-flex odyssey-editorial-kicker">
            <span className="odyssey-editorial-dot" />
            <span className="font-tech text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-white/40">
              Testimonials
            </span>
            <span className="h-3.5 w-px bg-black/[0.07] dark:bg-white/[0.08]" />
            <span className="font-heading text-[13px] font-medium tracking-[-0.03em] text-[#4d6268] dark:text-[#b9c8cf]">
              Product trust, not noise
            </span>
          </div>
          <h2 className="odyssey-display-title mx-auto mb-5 max-w-[11ch] text-[2.45rem] text-zinc-800 dark:text-white sm:text-[2.8rem] md:text-[3.3rem] lg:text-[4rem]">
            Trusted by Teams{' '}
            <span className="odyssey-display-accent bg-linear-to-r from-[#5B7B6F] via-[#4A7A68] to-[#6B8F80] dark:from-[#6EDAB0] dark:via-[#5EC9A0] dark:to-[#4AB890] bg-clip-text text-transparent">
              Worldwide
            </span>
          </h2>
          <p className="odyssey-section-copy mx-auto max-w-2xl text-[15px] md:text-[16px]">
            A calmer proof layer for a more premium landing. Real outcomes, expressed with more
            editorial restraint.
          </p>
        </motion.div>

        {/* Marquee rows */}
        <div className="relative">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 z-10 h-10 bg-linear-to-b from-[#f4f5f7] via-[#f4f5f7]/82 to-transparent dark:from-[#0A0A0A] dark:via-[#0A0A0A]/78"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-12 bg-linear-to-t from-[#f4f5f7] via-[#f4f5f7]/88 to-transparent dark:from-[#0A0A0A] dark:via-[#0A0A0A]/82"
          />
          <div
            className="community-ui-marquee-mask space-y-4 md:space-y-5 overflow-hidden"
            style={{
              maskImage:
                'linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)',
              WebkitMaskImage:
                'linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)',
            }}
          >
            {/* Row 1 — scroll left */}
            <motion.div
              className="flex gap-4 md:gap-5"
              animate={{ x: [0, -1680] }}
              transition={{ duration: 45, repeat: Infinity, ease: 'linear' }}
            >
              {marquee1.map((t, i) => (
                <TestimonialCard key={`r1-${i}`} t={t} />
              ))}
            </motion.div>

            {/* Row 2 — scroll right */}
            <motion.div
              className="flex gap-4 md:gap-5"
              animate={{ x: [-1680, 0] }}
              transition={{ duration: 50, repeat: Infinity, ease: 'linear' }}
            >
              {marquee2.map((t, i) => (
                <TestimonialCard key={`r2-${i}`} t={t} />
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}
