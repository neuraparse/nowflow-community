'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { ArrowRight, Play, Workflow } from 'lucide-react'
import { useSession } from '@/lib/auth-client'
import type { HeroWorkflowId } from '../hero-workflow'
import './hero-optimized.css'

const HeroWorkflowCanvas = dynamic(() => import('../hero-workflow'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[400px] w-full items-center justify-center border border-black/[0.08] bg-[#191a1e] sm:h-[450px] dark:border-white/[0.08] dark:bg-[#17181c]">
      <div className="text-center space-y-3">
        <Workflow className="w-10 h-10 text-zinc-300 dark:text-white/10 mx-auto animate-pulse" />
        <p className="font-tech text-[10px] font-semibold uppercase tracking-[0.14em] leading-[1.25] text-zinc-400 dark:text-white/24">
          Loading builder
        </p>
      </div>
    </div>
  ),
})

const heroWorkflows: {
  id: HeroWorkflowId
  label: string
  title: string
  accents: [string, string, string, string]
}[] = [
  {
    id: 'lead-enrichment',
    label: 'Lead Enrichment',
    title: 'Lead Enrichment Workflow',
    accents: ['#FF8B5C', '#F9C65C', '#DCFD38', '#74D4FF'],
  },
  {
    id: 'support-triage',
    label: 'Support Triage',
    title: 'Support Triage Workflow',
    accents: ['#FF7A59', '#F9C65C', '#64F2C5', '#74D4FF'],
  },
  {
    id: 'meeting-ops',
    label: 'Meeting Ops',
    title: 'Meeting Ops Workflow',
    accents: ['#74D4FF', '#9CB6FF', '#F9C65C', '#64F2C5'],
  },
  {
    id: 'crm-follow-up',
    label: 'CRM Follow-up',
    title: 'CRM Follow-up Workflow',
    accents: ['#64F2C5', '#DCFD38', '#F9C65C', '#74D4FF'],
  },
]

const hexToRgba = (hex: string, alpha: number) => {
  const normalized = hex.replace('#', '')
  const value =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => char + char)
          .join('')
      : normalized

  const r = parseInt(value.slice(0, 2), 16)
  const g = parseInt(value.slice(2, 4), 16)
  const b = parseInt(value.slice(4, 6), 16)

  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function subscribeToLoginHint(callback: () => void) {
  window.addEventListener('storage', callback)
  return () => window.removeEventListener('storage', callback)
}

const getLoginHintSnapshot = () => localStorage.getItem('has_logged_in_before') === 'true'
const getServerLoginHintSnapshot = () => false

export default function Hero() {
  const router = useRouter()
  const { data: session, isPending } = useSession()
  const hasLoggedInBefore = useSyncExternalStore(
    subscribeToLoginHint,
    getLoginHintSnapshot,
    getServerLoginHintSnapshot
  )
  const [shouldLoadWorkflow, setShouldLoadWorkflow] = useState(false)
  const [activeWorkflowId, setActiveWorkflowId] = useState<HeroWorkflowId>('lead-enrichment')

  const isAuthenticated = !!session?.user && !isPending
  const activeWorkflow =
    heroWorkflows.find((workflow) => workflow.id === activeWorkflowId) ?? heroWorkflows[0]
  const [accentA, accentB, accentC, accentD] = activeWorkflow.accents

  useEffect(() => {
    const timer = setTimeout(() => setShouldLoadWorkflow(true), 100)
    return () => clearTimeout(timer)
  }, [])

  const handleStartNowClick = () => {
    if (isAuthenticated) {
      router.push('/w')
    } else {
      router.push('/login')
    }
  }

  // 3D tilt for dashboard
  const dashRef = useRef<HTMLDivElement>(null)
  const handleDashMouse = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = dashRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    el.style.transform = `perspective(1200px) rotateY(${x * 5}deg) rotateX(${-y * 3.5}deg) scale(1.006)`
  }, [])
  const handleDashLeave = useCallback(() => {
    const el = dashRef.current
    if (el) el.style.transform = 'perspective(1200px) rotateY(0deg) rotateX(0deg) scale(1)'
  }, [])

  return (
    <section className="community-ui-section community-ui-hero relative min-h-screen overflow-hidden pt-28 pb-20 sm:pt-32">
      <div aria-hidden="true" className="community-ui-hero-backdrop absolute inset-0" />
      <div className="container mx-auto px-4 sm:px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-10 sm:gap-12 lg:gap-16 items-center min-h-[calc(100dvh-12rem)]">
          {/* Left — Content */}
          <div className="animate-fade-in-up stagger-fade-in flex flex-col justify-center min-h-[360px] sm:min-h-[420px] lg:min-h-[450px]">
            {/* Community badge */}
            <div className="mb-10">
              <div className="community-ui-chip silver-glass-chip inline-flex cursor-default items-center gap-3 rounded-[10px] px-3.5 py-2">
                <span
                  className="h-2 w-2 rounded-[2px]"
                  style={{
                    background:
                      'linear-gradient(135deg, var(--ody-signal-coral, #ff7a59) 0%, var(--ody-signal-violet, #802fff) 52%, var(--ody-signal-cyan, #00a1e0) 100%)',
                  }}
                />
                <span className="font-tech text-[10px] font-semibold uppercase tracking-[0.16em] leading-none text-zinc-600 dark:text-white/50">
                  Community Edition
                </span>
                <span className="h-3.5 w-px bg-black/[0.07] dark:bg-white/[0.08]" />
                <span className="font-tech text-[10px] font-semibold uppercase tracking-[0.16em] leading-none text-zinc-400 dark:text-white/34">
                  Self-host ready
                </span>
              </div>
            </div>

            {/* Headline */}
            <h1 className="odyssey-display-title mb-7 max-w-[10ch] text-[3rem] text-zinc-800 dark:text-white md:max-w-[15ch] md:text-[4.15rem] lg:text-[5rem] xl:text-[5.8rem]">
              Build agentic workflows,
              <br className="hidden md:block" />{' '}
              <span className="text-white/78 md:inline-block md:whitespace-nowrap md:text-[0.68em]">
                run them yourself.
              </span>
            </h1>

            {/* Subtitle */}
            <p className="odyssey-section-copy mb-12 max-w-[35rem] text-[15.5px] md:text-[17.5px]">
              NowFlow Community lets teams build and run self-hosted workflow automations with BYOK
              model settings, local execution, and{' '}
              <span className="font-tech text-[0.78em] font-semibold uppercase tracking-[0.16em] text-zinc-700 dark:text-white/82">
                extensible integrations
              </span>
              {'. '}Your deployment, credentials, and workflow data stay under your control.
            </p>

            {/* CTA */}
            <div className="flex w-full flex-col sm:flex-row items-stretch sm:items-start gap-3 sm:gap-4 max-w-xl">
              {isAuthenticated || hasLoggedInBefore ? (
                <div className="group/cta relative rounded-[10px]">
                  <div className="pointer-events-none absolute inset-0 rounded-[10px] border border-black/[0.07] transition-colors duration-300 group-hover/cta:border-black/[0.12] dark:border-white/[0.08] dark:group-hover/cta:border-white/[0.14]" />
                  <button
                    onClick={handleStartNowClick}
                    className="silver-glass-button-strong group relative z-10 inline-flex w-full items-center justify-center gap-2.5 rounded-[10px] px-6 py-3.5 text-[11px] font-semibold font-tech uppercase tracking-[0.16em] leading-[1.25] transition-all duration-200 hover:-translate-y-px hover:shadow-lg sm:w-auto sm:px-7"
                  >
                    <Play className="w-4 h-4" />
                    Launch Studio
                    <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="group/cta relative rounded-[10px]">
                    <div className="pointer-events-none absolute inset-0 rounded-[10px] border border-black/[0.07] transition-colors duration-300 group-hover/cta:border-black/[0.12] dark:border-white/[0.08] dark:group-hover/cta:border-white/[0.14]" />
                    <button
                      onClick={handleStartNowClick}
                      className="silver-glass-button-strong group relative z-10 inline-flex w-full items-center justify-center gap-2 rounded-[10px] px-6 py-3.5 text-[11px] font-semibold font-tech uppercase tracking-[0.16em] leading-[1.25] transition-all duration-200 hover:-translate-y-px hover:shadow-lg sm:w-auto sm:px-7"
                    >
                      Open Local Workspace
                      <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                    </button>
                  </div>
                  <div className="group/demo relative rounded-[10px]">
                    <div className="pointer-events-none absolute inset-0 rounded-[10px] border border-black/[0.07] transition-colors duration-300 group-hover/demo:border-black/[0.12] dark:border-white/[0.08] dark:group-hover/demo:border-white/[0.14]" />
                    <a
                      href="/docs"
                      className="silver-glass-button relative z-10 inline-flex w-full items-center justify-center gap-2 rounded-[10px] px-5 py-3.5 text-[11px] font-semibold font-tech uppercase tracking-[0.16em] leading-[1.25] text-zinc-700 transition-all duration-200 hover:-translate-y-px hover:text-zinc-900 dark:text-white/72 dark:hover:text-white/88 sm:w-auto sm:px-6"
                    >
                      Read Docs
                    </a>
                  </div>
                </>
              )}
            </div>

            {/* Micro features */}
            <div className="mt-12 grid max-w-2xl gap-4 sm:grid-cols-3">
              {[
                { label: 'Workflow Blocks', value: 'Community-ready blocks' },
                { label: 'Integration Estate', value: 'BYOK and local runtime' },
                { label: 'Deployment Path', value: 'Local and self-hosted' },
              ].map((f) => (
                <div key={f.label} className="odyssey-editorial-stat community-ui-stat">
                  <span className="font-tech text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400 dark:text-white/30">
                    {f.label}
                  </span>
                  <span className="mt-2 block text-[15px] font-heading font-medium tracking-[-0.03em] text-zinc-700 dark:text-white/82">
                    {f.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right — Workflow Demo with 3D tilt */}
          <div className="relative animate-fade-in">
            <div
              ref={dashRef}
              className="relative group transition-transform duration-300 ease-out will-change-transform"
              onMouseMove={handleDashMouse}
              onMouseLeave={handleDashLeave}
            >
              {/* Subtle ambient glow behind canvas */}
              <div
                className="absolute -inset-4 rounded-[18px] blur-3xl opacity-[0.08] transition-opacity duration-500 group-hover:opacity-[0.1] dark:opacity-[0.032] dark:group-hover:opacity-[0.04]"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(98,120,144,0.5) 0%, rgba(74,122,104,0.38) 100%)',
                }}
              />

              {/* Canvas */}
              <div className="relative z-10">
                {shouldLoadWorkflow ? (
                  <div className="hero-canvas-shell hero-canvas-shine community-ui-hero-shell relative flex h-[440px] w-full flex-col overflow-hidden border border-black/[0.08] bg-[#18191d] shadow-[0_18px_42px_rgba(0,0,0,0.18)] dark:border-white/[0.08] dark:bg-[#18191d] sm:h-[540px]">
                    {/* Canvas toolbar — rebuilt as a single solid frame */}
                    <div className="hero-canvas-navbar community-ui-hero-navbar relative flex-shrink-0 overflow-hidden border-b border-black/[0.06] bg-[#17181b] dark:border-white/[0.06] dark:bg-[#16171a]">
                      <div
                        className="pointer-events-none absolute inset-x-0 top-0 h-px"
                        style={{
                          background: `linear-gradient(90deg, ${accentA} 0%, ${accentB} 34%, ${accentC} 67%, ${accentD} 100%)`,
                          opacity: 0.9,
                        }}
                      />
                      <div
                        className="pointer-events-none absolute inset-0"
                        style={{
                          background: `radial-gradient(circle at 18% 0%, ${hexToRgba(accentA, 0.18)}, transparent 28%), radial-gradient(circle at 82% 0%, ${hexToRgba(accentD, 0.14)}, transparent 26%)`,
                        }}
                      />
                      <div className="relative flex h-[54px] items-center justify-between gap-4 px-4 sm:px-5">
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className="flex h-7 w-7 flex-shrink-0 items-center justify-center border"
                            style={{
                              borderColor: hexToRgba(accentA, 0.26),
                              background: `linear-gradient(135deg, ${hexToRgba(accentA, 0.18)}, ${hexToRgba(accentB, 0.12)})`,
                            }}
                          >
                            <div
                              className="h-2.5 w-2.5"
                              style={{
                                background: `linear-gradient(135deg, ${accentA}, ${accentB})`,
                              }}
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-[12px] font-medium text-white/86">
                              {activeWorkflow.title}
                            </p>
                            <div className="mt-0.5 flex items-center gap-2">
                              <span
                                className="font-tech text-[9px] font-semibold uppercase tracking-[0.16em] leading-[1.25]"
                                style={{ color: hexToRgba(accentA, 0.9) }}
                              >
                                Studio Preview
                              </span>
                              <span
                                className="h-2.5 w-px"
                                style={{
                                  background: `linear-gradient(to bottom, ${hexToRgba(accentA, 0.08)}, ${hexToRgba(accentB, 0.36)}, ${hexToRgba(accentC, 0.08)})`,
                                }}
                              />
                              <span
                                className="font-tech text-[9px] font-semibold uppercase tracking-[0.16em] leading-[1.25]"
                                style={{ color: hexToRgba(accentB, 0.72) }}
                              >
                                Builder Canvas
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="hidden items-center gap-3 sm:flex">
                          <div
                            className="flex items-center gap-1.5 font-tech text-[9px] font-semibold uppercase tracking-[0.16em] leading-[1.25]"
                            style={{ color: hexToRgba(accentC, 0.72) }}
                          >
                            <span className="h-1.5 w-1.5" style={{ background: accentC }} />
                            Draft
                          </div>
                          <span className="h-3 w-px bg-white/[0.08]" />
                          <div
                            className="flex items-center gap-1.5 font-tech text-[9px] font-semibold uppercase tracking-[0.16em] leading-[1.25]"
                            style={{ color: hexToRgba(accentD, 0.8) }}
                          >
                            <span className="h-1.5 w-1.5" style={{ background: accentD }} />
                            Beta
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Main content area with side list + canvas */}
                    <div className="relative flex min-h-0 flex-1">
                      {/* Section sidebar */}
                      <div className="community-ui-hero-sidebar flex w-[138px] flex-shrink-0 flex-col overflow-hidden border-r border-white/[0.06] bg-[#17181c] dark:border-white/[0.06] dark:bg-[#17181c] sm:w-[176px]">
                        <div className="border-b border-white/[0.06] px-3 py-3">
                          <p className="font-tech text-[9px] font-semibold uppercase tracking-[0.16em] leading-[1.25] text-white/26">
                            Launch Paths
                          </p>
                          <p className="mt-1 hidden text-[11px] leading-[1.45] text-white/32 sm:block">
                            Switch workflows and inspect the orchestration live.
                          </p>
                        </div>

                        <div className="flex-1 py-2">
                          {heroWorkflows.map((item) => {
                            const isActive = item.id === activeWorkflowId

                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => setActiveWorkflowId(item.id)}
                                className={`community-ui-hero-sidebar-item flex w-full items-center gap-2.5 border-b border-l px-3 py-2.5 text-left transition-colors ${
                                  isActive
                                    ? 'bg-white/[0.05] text-white/88'
                                    : 'text-white/34 hover:bg-white/[0.02] hover:text-white/58'
                                }`}
                                style={{
                                  borderLeftColor: isActive
                                    ? hexToRgba(accentA, 0.92)
                                    : 'transparent',
                                  borderBottomColor: 'rgba(255,255,255,0.05)',
                                }}
                              >
                                <span
                                  className="h-2.5 w-2.5 flex-shrink-0"
                                  style={{
                                    background: isActive
                                      ? hexToRgba(accentA, 0.92)
                                      : 'rgba(255,255,255,0.12)',
                                  }}
                                />
                                <span className="truncate text-[11px]">{item.label}</span>
                              </button>
                            )
                          })}
                        </div>

                        <div className="mt-auto border-t border-white/[0.06] bg-[#17181c] px-3 py-2.5">
                          <div className="flex items-center gap-2 font-tech text-[9px] font-semibold uppercase tracking-[0.16em] leading-[1.25] text-white/32">
                            <span className="h-1.5 w-1.5 bg-emerald-400/80" />
                            Runtime Ready
                          </div>
                        </div>
                      </div>

                      {/* Canvas area */}
                      <div className="community-ui-hero-canvas relative flex-1 overflow-hidden bg-[linear-gradient(180deg,#33363d_0%,#292b31_100%)] dark:bg-[linear-gradient(180deg,#33363d_0%,#292b31_100%)]">
                        <div
                          className="pointer-events-none absolute inset-0 opacity-[0.16] dark:opacity-[0.16]"
                          style={{
                            backgroundImage:
                              'linear-gradient(rgba(113,113,122,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(113,113,122,0.07) 1px, transparent 1px)',
                            backgroundSize: '22px 22px',
                          }}
                        />
                        <HeroWorkflowCanvas activeWorkflowId={activeWorkflowId} />
                      </div>
                    </div>

                    {/* Bottom status bar */}
                    <div className="community-ui-hero-status flex h-[30px] flex-shrink-0 items-center justify-between border-t border-white/[0.06] bg-[#202228] px-3.5 dark:border-white/[0.06] dark:bg-[#202228]">
                      <span className="text-[10px] font-sans font-medium text-zinc-400 dark:text-white/32 tracking-[0.08em] leading-[1.25]">
                        API · Chat · Embedded UI
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-[2px] bg-emerald-400/70" />
                        <span className="text-[10px] font-sans font-medium text-zinc-400 dark:text-white/32 tracking-[0.08em] leading-[1.25]">
                          Autosave on
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-[430px] w-full border border-black/[0.08] bg-[#18191d] shadow-[0_12px_28px_rgba(0,0,0,0.14)] sm:h-[520px]" />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
