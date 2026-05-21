'use client'

import { motion } from 'framer-motion'
import { BotMessageSquare, Globe, LayoutDashboard, Rocket, ShieldCheck } from 'lucide-react'
import { DatabaseIcon } from '@/components/icons'

const useCases = [
  {
    icon: LayoutDashboard,
    num: '01',
    title: 'Visual Workflow Builder',
    description:
      'Drag-and-drop editor with ready-made blocks. Build complex workflows in minutes with Conditions, Routers, Loops, Sub-workflows, and more.',
    features: ['Ready-made blocks', 'Drag & drop editor', 'Groups & loops', 'Real-time execution'],
    hex: '#74D4FF',
  },
  {
    icon: BotMessageSquare,
    num: '02',
    title: 'Agent Workflow Steps',
    description:
      'Define AI and human steps in inspectable workflows with bring-your-own-key model settings.',
    features: ['AI blocks', 'Human steps', 'BYOK settings', 'Inspectable runs'],
    hex: '#9CB6FF',
  },
  {
    icon: ShieldCheck,
    num: '03',
    title: 'Human-in-the-Loop',
    description:
      'Pause workflows at critical steps and request approval through the channels enabled in your workspace.',
    features: ['Approval blocks', 'Priority routing', 'Review queues', 'Send & Wait'],
    hex: '#F9C65C',
  },
  {
    icon: DatabaseIcon,
    num: '04',
    title: 'Data Tables & ETL',
    description:
      'Query, filter, bulk ops, and smart insert with the built-in database. Manage workflow data from one place with auto-schema detection.',
    features: ['Smart insert', 'Auto-schema', 'Bulk operations', 'Query & filter'],
    hex: '#64F2C5',
  },
  {
    icon: Rocket,
    num: '05',
    title: 'Multi-Surface Deploy',
    description:
      'Deploy your workflows as REST API, Chat interface, Client Portal, Ops Console, dynamic form, or embedded widget with a single click.',
    features: ['REST API', 'Chat interface', 'Client portal', 'Embedded widget'],
    hex: '#DCFD38',
  },
  {
    icon: Globe,
    num: '06',
    title: 'Integrations',
    description:
      'Connect common APIs and bring your own provider keys. Extend workflows with custom API calls and self-hosted connectors.',
    features: ['API connectors', 'CRM & sales', 'Cloud & DevOps', 'AI providers'],
    hex: '#BDEEFF',
  },
]

export default function UseCases() {
  return (
    <section className="community-ui-section gb-use-cases relative overflow-hidden bg-[#f4f5f7] py-24 dark:bg-transparent md:py-32 lg:py-40">
      <div className="container mx-auto px-4 sm:px-5 md:px-6 relative z-10">
        {/* Header */}
        <motion.div
          className="community-ui-section-head text-center mb-16 md:mb-24"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-6 inline-flex odyssey-editorial-kicker">
            <span className="odyssey-editorial-dot" />
            <span className="font-tech text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-white/40">
              Platform
            </span>
            <span className="h-3.5 w-px bg-black/[0.07] dark:bg-white/[0.08]" />
            <span className="font-heading text-[13px] font-medium tracking-[-0.03em] text-[#4d6268] dark:text-[#b9c8cf]">
              Deployment rhythm
            </span>
          </div>
          <h2 className="odyssey-display-title mx-auto mb-6 max-w-[11ch] text-[2.45rem] text-zinc-800 dark:text-white md:text-[3.2rem] lg:text-[4rem]">
            Build, Deploy, Scale
            <br />
            <span className="odyssey-display-accent bg-linear-to-r from-[#5B7B6F] via-[#4A7A68] to-[#6B8F80] dark:from-[#6EDAB0] dark:via-[#5EC9A0] dark:to-[#4AB890] bg-clip-text text-transparent">
              Intelligent Workflows
            </span>
          </h2>
          <p className="odyssey-section-copy mx-auto max-w-lg text-[15px] md:text-[17px]">
            Community blocks, extensible integrations, and infinite possibilities.
          </p>
        </motion.div>

        {/* Grid */}
        <div className="relative">
          {/* Rotating border glow */}
          <div
            className="absolute -inset-[1px] rounded-[29px]"
            style={{
              background:
                'conic-gradient(from var(--border-angle, 0deg), transparent 0%, rgba(74,122,104,0.12) 20%, transparent 45%, rgba(74,122,104,0.05) 70%, transparent 100%)',
              animation: 'border-spin 12s linear infinite',
            }}
          />
          <div className="community-ui-shell community-ui-usecase-shell silver-glass-panel relative grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px rounded-[28px]">
            {useCases.map((uc, i) => (
              <motion.div
                key={uc.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.07 }}
                className="community-ui-usecase-card silver-glass-pane group relative p-8 md:p-10 lg:p-11 transition-colors duration-300 hover:bg-white/80 dark:hover:bg-white/[0.03] overflow-hidden"
              >
                {/* Left accent bar — Sim.ai/Temporal style */}
                <div
                  className="absolute top-0 bottom-0 left-0 w-[2px] opacity-0 group-hover:opacity-75 transition-opacity duration-300 pointer-events-none"
                  style={{ background: uc.hex }}
                />

                {/* Hover accent glow */}
                <div
                  className="absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{ background: `radial-gradient(circle, ${uc.hex}0a, transparent 70%)` }}
                />

                {/* Number */}
                <span className="text-[40px] md:text-[48px] font-serif italic leading-none text-zinc-200/50 dark:text-white/[0.04] select-none pointer-events-none transition-colors duration-300 group-hover:text-zinc-200/70 dark:group-hover:text-white/[0.07]">
                  {uc.num}
                </span>

                {/* Icon */}
                <div className="mt-5 mb-6">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-105"
                    style={{
                      background: `linear-gradient(145deg, ${uc.hex}15, ${uc.hex}08)`,
                      boxShadow: `inset 0 1px 0 ${uc.hex}10, 0 0 0 1px ${uc.hex}0c`,
                    }}
                  >
                    <uc.icon className="w-5 h-5" style={{ color: uc.hex }} strokeWidth={1.7} />
                  </div>
                </div>

                {/* Title */}
                <h3 className="text-[18px] md:text-[20px] font-heading font-semibold text-zinc-800 dark:text-white tracking-[-0.02em] mb-3 leading-[1.1]">
                  {uc.title}
                </h3>

                {/* Description */}
                <p className="text-[13px] text-zinc-400 dark:text-white/[0.65] leading-[1.5] mb-7 font-body tracking-[-0.01em]">
                  {uc.description}
                </p>

                {/* Features */}
                <div className="community-ui-usecase-tags flex flex-wrap items-center gap-x-1.5 gap-y-1">
                  {uc.features.map((f, fi) => (
                    <span key={f} className="inline-flex items-center gap-1.5">
                      {fi > 0 && (
                        <span className="text-zinc-300 dark:text-white/10 text-[10px] select-none">
                          &middot;
                        </span>
                      )}
                      <span className="text-[12px] text-zinc-500 dark:text-white/28 font-tech font-medium tracking-[0.08em]">
                        {f}
                      </span>
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
