'use client'

import React from 'react'
import { motion } from 'framer-motion'

const stats = [
  { value: 'OSS', label: 'Community Edition' },
  { value: 'BYOK', label: 'AI Provider Setup' },
  { value: 'API', label: 'Extensible Integrations' },
  { value: 'Local', label: 'Self-Hosted Runtime' },
]

export default function Stats() {
  return (
    <section className="py-16 md:py-20 bg-[#fafafa] dark:bg-slate-950 relative overflow-hidden">
      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <motion.div
          className="relative"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          {/* Rotating border glow */}
          <div
            className="absolute -inset-[1px] rounded-[25px]"
            style={{
              background:
                'conic-gradient(from var(--border-angle, 0deg), transparent 0%, rgba(74,122,104,0.10) 20%, transparent 45%, rgba(74,122,104,0.04) 70%, transparent 100%)',
              animation: 'border-spin 10s linear infinite',
            }}
          />

          <div className="relative rounded-[24px] border border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-white/[0.02] px-8 md:px-16 py-12 md:py-14">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
              {stats.map((stat, i) => (
                <motion.div
                  key={stat.label}
                  className="flex flex-col items-center text-center"
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                >
                  <span className="text-3xl md:text-4xl lg:text-[42px] font-sans font-light text-zinc-800 dark:text-white tracking-tight leading-none mb-2">
                    {stat.value}
                  </span>
                  <span className="text-[11px] md:text-[12px] font-medium tracking-[0.12em] text-zinc-400 dark:text-white/25 uppercase font-sans">
                    {stat.label}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Bottom note */}
        <motion.p
          className="text-center mt-6 text-[12px] text-zinc-300 dark:text-white/15 font-sans"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          Built for local-first automation, self-hosted teams, and community-maintained workflows
        </motion.p>
      </div>
    </section>
  )
}
