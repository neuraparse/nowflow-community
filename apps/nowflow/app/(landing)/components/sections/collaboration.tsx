'use client'

import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import './hero-optimized.css'

function CursorIcon({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-start gap-0.5">
      <svg width="12" height="18" viewBox="0 0 12 18" fill="none" className="flex-shrink-0">
        <path
          d="M1 1L1 15.5L4.5 11.5L8.5 17L11 15.5L7 9.5L11.5 9L1 1Z"
          fill={color}
          stroke={color}
          strokeWidth="0.5"
          strokeLinejoin="round"
        />
      </svg>
      <span
        className="font-tech mt-2 rounded-md px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white"
        style={{ background: color }}
      >
        {label}
      </span>
    </div>
  )
}

export default function Collaboration() {
  return (
    <section className="py-24 md:py-36 lg:py-44 w-full px-4 sm:px-6 md:px-8 bg-[#f5f5f5] dark:bg-[#0d0d0d]">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex flex-col lg:flex-row gap-16 lg:gap-20 xl:gap-28 items-center">
          {/* LEFT — Content Column: single motion wrapper */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col gap-6 sm:gap-7 lg:w-[44%] xl:w-[40%]"
          >
            <CursorIcon color="#2ABBF8" label="You" />

            <div className="inline-flex items-center gap-2 rounded-full bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.06] px-4 py-1.5 backdrop-blur-sm w-fit">
              <span className="w-1.5 h-1.5 rounded-sm bg-[#2ABBF8]" />
              <span className="font-tech text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500 dark:text-white/40">
                Teams
              </span>
            </div>

            <h2 className="odyssey-display-title mt-1 text-[2rem] text-zinc-900 dark:text-white sm:text-4xl md:text-5xl">
              Realtime
              <br />
              collaboration
            </h2>

            <p className="odyssey-section-copy max-w-md text-[15px] md:text-base">
              Grab your team. Build workflows together in real-time inside your workspace.
            </p>

            <div className="pt-1">
              <button className="font-tech group inline-flex items-center gap-2 rounded-xl border border-black/[0.08] px-6 py-3 text-[13px] font-medium uppercase tracking-[0.12em] text-zinc-800 transition-all duration-300 hover:border-black/[0.15] hover:bg-black/[0.02] hover:text-zinc-900 dark:border-white/[0.08] dark:text-white/70 dark:hover:border-white/[0.15] dark:hover:bg-white/[0.03] dark:hover:text-white/90">
                Build together
                <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
              </button>
            </div>

            <a
              href="#"
              className="font-body group mt-4 inline-flex w-fit items-center gap-2 text-[12px] tracking-[-0.01em] text-zinc-400 transition-colors duration-300 hover:text-zinc-600 dark:text-white/25 dark:hover:text-white/45"
            >
              How we built realtime collaboration
              <ArrowRight className="w-3 h-3 transition-transform duration-300 group-hover:translate-x-0.5" />
            </a>
          </motion.div>

          {/* RIGHT — Workspace Preview */}
          <motion.div
            initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
            whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{
              duration: 0.7,
              delay: 0.15,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="flex-1 w-full lg:w-auto"
          >
            <div className="relative bg-[#0b0b0f] border border-white/[0.06] rounded-2xl overflow-hidden min-h-[400px] sm:min-h-[460px] md:min-h-[520px]">
              {/* Top bar */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.05]">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-[7px] h-[7px] rounded-full bg-white/[0.08]" />
                    <span className="w-[7px] h-[7px] rounded-full bg-white/[0.05]" />
                    <span className="w-[7px] h-[7px] rounded-full bg-white/[0.03]" />
                  </div>
                  <span className="font-tech text-[9px] font-medium uppercase tracking-[0.15em] text-white/20">
                    Workspace
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center -space-x-1.5">
                    <div className="w-5 h-5 rounded-full bg-[#2ABBF8]/20 border border-[#2ABBF8]/30 flex items-center justify-center">
                      <span className="font-tech text-[6px] font-bold text-[#2ABBF8]">V</span>
                    </div>
                    <div className="w-5 h-5 rounded-full bg-[#F59E0B]/20 border border-[#F59E0B]/30 flex items-center justify-center">
                      <span className="font-tech text-[6px] font-bold text-[#F59E0B]">A</span>
                    </div>
                  </div>
                  <span className="font-tech text-[8px] text-white/20">2 online</span>
                </div>
              </div>

              {/* Canvas area */}
              <div className="relative p-4 sm:p-8 md:p-10">
                {/* Dot grid */}
                <div
                  className="absolute inset-0 opacity-[0.04]"
                  style={{
                    backgroundImage: 'radial-gradient(circle, white 0.5px, transparent 0.5px)',
                    backgroundSize: '20px 20px',
                  }}
                />

                {/* Blocks layout */}
                <div className="relative z-10 flex flex-col items-start gap-0">
                  {/* START block */}
                  <div className="relative">
                    <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 sm:px-5 py-4 w-[200px] sm:w-[220px]">
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-[3px] bg-emerald-400/80" />
                        </div>
                        <span className="font-heading text-[11px] font-semibold tracking-[-0.01em] text-white/70">
                          Trigger
                        </span>
                        <span className="ml-auto text-[7px] font-bold uppercase tracking-wider text-emerald-400/60 bg-emerald-400/[0.08] px-1.5 py-0.5 rounded flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-emerald-400/80 animate-pulse" />
                          Live
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                          <span className="font-tech text-[9px] text-white/20">Event</span>
                          <span className="text-[9px] text-white/35 font-mono">on_message</span>
                        </div>
                      </div>
                    </div>

                    {/* Connection line */}
                    <div className="flex flex-col items-center ml-[100px] sm:ml-[110px]">
                      <div className="w-px h-10 bg-gradient-to-b from-white/[0.1] via-white/[0.06] to-white/[0.02]" />
                      <div className="w-1.5 h-1.5 rounded-full bg-white/[0.08] border border-white/[0.12] -mt-px" />
                      <div className="w-px h-4 bg-gradient-to-b from-white/[0.06] to-transparent" />
                    </div>
                  </div>

                  {/* AGENT block */}
                  <div className="relative ml-3 sm:ml-6 md:ml-10">
                    <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 sm:px-5 py-4 w-[220px] sm:w-[260px]">
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className="w-6 h-6 rounded-lg bg-purple-500/10 border border-purple-500/15 flex items-center justify-center">
                          <svg
                            className="w-3 h-3 text-purple-400/70"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
                            />
                          </svg>
                        </div>
                        <span className="font-heading text-[11px] font-semibold tracking-[-0.01em] text-white/70">
                          Agent
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                          <span className="font-tech text-[9px] text-white/20">Model</span>
                          <span className="text-[9px] text-white/35 font-mono">
                            claude-4-sonnet
                          </span>
                        </div>
                        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                          <span className="font-tech text-[9px] text-white/20">Temperature</span>
                          <span className="text-[9px] text-white/35 font-mono">0.7</span>
                        </div>
                        <div className="px-2.5 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                          <span className="font-tech text-[9px] text-white/20">System</span>
                          <p className="text-[8px] text-white/15 font-mono mt-1 leading-relaxed">
                            You are a helpful assistant that...
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Connection line from Agent */}
                    <div className="flex flex-col items-center ml-[130px]">
                      <div className="w-px h-10 bg-gradient-to-b from-white/[0.1] via-white/[0.06] to-white/[0.02]" />
                      <div className="w-1.5 h-1.5 rounded-full bg-white/[0.08] border border-white/[0.12] -mt-px" />
                      <div className="w-px h-4 bg-gradient-to-b from-white/[0.06] to-transparent" />
                    </div>
                  </div>

                  {/* OUTPUT block */}
                  <div className="relative ml-2 md:ml-4">
                    <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl px-5 py-4 w-[200px]">
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-lg bg-sky-500/10 border border-sky-500/15 flex items-center justify-center">
                          <svg
                            className="w-3 h-3 text-sky-400/70"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
                            />
                          </svg>
                        </div>
                        <span className="font-heading text-[11px] font-semibold tracking-[-0.01em] text-white/70">
                          Response
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Animated Cursor — Vikhyath */}
                <div className="absolute top-[14%] right-[10%] z-20 cursor-animate-1">
                  <CursorIcon color="#2ABBF8" label="Vikhyath" />
                </div>

                {/* Animated Cursor — Alexa */}
                <div className="absolute bottom-[20%] left-[50%] z-20 cursor-animate-2">
                  <CursorIcon color="#F59E0B" label="Alexa" />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
