'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Play } from 'lucide-react'

export default function CTA() {
  return (
    <section className="py-24 md:py-32 lg:py-40 bg-[#fafafa] dark:bg-slate-950 relative overflow-hidden">
      {/* Ambient background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-3xl opacity-[0.06] dark:opacity-[0.03]"
          style={{ background: 'radial-gradient(circle, #4A7A68, transparent 65%)' }}
        />
        <div
          className="absolute top-1/3 right-[10%] w-[400px] h-[400px] rounded-full blur-3xl opacity-[0.04] dark:opacity-[0.02]"
          style={{ background: 'radial-gradient(circle, #3B82F6, transparent 65%)' }}
        />
      </div>

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="relative max-w-3xl mx-auto">
          {/* Rotating border glow */}
          <div
            className="absolute -inset-[1px] rounded-[29px]"
            style={{
              background:
                'conic-gradient(from var(--border-angle, 0deg), transparent 0%, rgba(74,122,104,0.14) 20%, transparent 45%, rgba(59,130,246,0.06) 70%, transparent 100%)',
              animation: 'border-spin 10s linear infinite',
            }}
          />

          <div className="signal-accent-frame relative rounded-[28px] border border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-white/[0.02] overflow-hidden px-5 sm:px-8 md:px-16 py-12 sm:py-16 md:py-24">
            {/* Subtle ambient inside card */}
            <div
              className="absolute top-0 right-0 w-[300px] h-[300px] rounded-full blur-3xl opacity-[0.05] pointer-events-none"
              style={{ background: 'radial-gradient(circle, #4A7A68, transparent 70%)' }}
            />

            <motion.div
              className="relative z-10 text-center"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              {/* Badge */}
              <div className="signal-accent-chip inline-flex items-center gap-2 border rounded-full px-4 py-1.5 mb-8 backdrop-blur-sm">
                <span className="w-1.5 h-1.5 rounded-sm bg-emerald-500 dark:bg-emerald-400" />
                <span className="font-tech text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500 dark:text-white/40">
                  Start Building Today
                </span>
              </div>

              {/* Heading */}
              <h2 className="odyssey-display-title mb-6 text-[2rem] text-zinc-800 dark:text-white sm:text-4xl md:text-5xl lg:text-6xl">
                Ready to Transform Your{' '}
                <span className="odyssey-display-accent bg-linear-to-r from-[#5B7B6F] via-[#4A7A68] to-[#6B8F80] bg-clip-text text-transparent dark:from-[#94B8A6] dark:via-[#8CB09C] dark:to-[#A0C4B2]">
                  Workflow?
                </span>
              </h2>

              {/* Description */}
              <p className="odyssey-section-copy mx-auto mb-8 max-w-xl text-[15px] sm:mb-10 sm:text-base md:text-lg">
                Run the Community build locally or self-host it on infrastructure you control.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 mb-8 sm:mb-10">
                {/* Primary */}
                <div className="group/cta relative rounded-xl">
                  <div
                    className="absolute -inset-[1px] rounded-[13px] opacity-40 group-hover/cta:opacity-70 transition-opacity duration-500"
                    style={{
                      background:
                        'conic-gradient(from var(--border-angle, 0deg), transparent 0%, #6EDAB0 20%, transparent 40%, #5EC9A080 70%, transparent 90%)',
                      animation: 'border-spin 4s linear infinite',
                    }}
                  />
                  <a
                    href="/login"
                    className="font-tech group relative z-10 inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-zinc-800 px-7 py-3.5 text-[13px] font-semibold uppercase tracking-[0.12em] text-white transition-all duration-200 hover:-translate-y-px hover:shadow-lg dark:bg-white dark:text-zinc-900 sm:w-auto"
                  >
                    <Play className="w-4 h-4" />
                    Open Workspace
                    <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </a>
                </div>

                {/* Secondary */}
                <div className="group/demo relative rounded-xl">
                  <div
                    className="absolute -inset-[1px] rounded-[13px] opacity-0 group-hover/demo:opacity-40 transition-opacity duration-500"
                    style={{
                      background:
                        'conic-gradient(from var(--border-angle, 0deg), transparent 0%, #4A7A68 20%, transparent 40%, #4A7A6880 70%, transparent 90%)',
                      animation: 'border-spin 3s linear infinite',
                    }}
                  />
                  <a
                    href="/docs"
                    className="font-tech relative z-10 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-black/[0.08] px-6 py-3.5 text-[13px] font-medium uppercase tracking-[0.12em] text-zinc-500 transition-all duration-200 hover:border-transparent hover:text-zinc-700 dark:border-white/[0.08] dark:text-white/40 dark:hover:text-white/60 sm:w-auto"
                  >
                    Read Docs
                  </a>
                </div>
              </div>

              {/* Trust indicators */}
              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
                {['Apache-2.0 source', 'Self-hosted runtime', 'Bring your own keys'].map(
                  (text, i) => (
                    <span key={text} className="inline-flex items-center gap-2">
                      {i > 0 && (
                        <span className="text-zinc-200 dark:text-white/8 text-[8px] select-none">
                          &middot;
                        </span>
                      )}
                      <span className="font-tech text-[12px] font-medium tracking-[0.08em] text-zinc-400 dark:text-white/25">
                        {text}
                      </span>
                    </span>
                  )
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}
