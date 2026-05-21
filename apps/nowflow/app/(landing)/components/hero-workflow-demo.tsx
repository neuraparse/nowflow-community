'use client'

import { useEffect, useState } from 'react'
import {
  ArrowRight,
  Blocks,
  CheckCircle2,
  Code,
  Globe,
  Layers,
  MessageSquare,
  Sparkles,
} from 'lucide-react'

const buildSteps = [
  {
    id: 1,
    title: 'Model',
    description: 'Define triggers and intent',
    status: 'Mapping events...',
    icon: Blocks,
  },
  {
    id: 2,
    title: 'Compose',
    description: 'Assemble tools and logic',
    status: 'Wiring integrations...',
    icon: Sparkles,
  },
  {
    id: 3,
    title: 'Validate',
    description: 'Run safety checks',
    status: 'Simulating outcomes...',
    icon: CheckCircle2,
  },
]

const publishTargets = [
  {
    id: 1,
    title: 'API Endpoint',
    description: 'Ship a versioned API',
    endpoint: '/v1/workflow/orders',
    icon: Code,
  },
  {
    id: 2,
    title: 'Chat Interface',
    description: 'Deliver a branded assistant',
    endpoint: 'chat.yourapp.io',
    icon: MessageSquare,
  },
  {
    id: 3,
    title: 'Embedded UI',
    description: 'Drop-in widget',
    endpoint: '<script src="nowflow.js">',
    icon: Globe,
  },
]

const integrationLayers = [
  { id: 1, label: 'ERP & Finance' },
  { id: 2, label: 'Commerce & Retail' },
  { id: 3, label: 'Support & CRM' },
  { id: 4, label: 'IoT & Robotics' },
  { id: 5, label: 'Data & Analytics' },
  { id: 6, label: 'Security & Ops' },
]

export default function HeroWorkflowDemo() {
  const [phase, setPhase] = useState<'build' | 'publish' | 'live'>('build')
  const [buildStep, setBuildStep] = useState(0)
  const [activeTarget, setActiveTarget] = useState(0)
  const [activeLayer, setActiveLayer] = useState(0)
  const [isAnimating, setIsAnimating] = useState(true)

  useEffect(() => {
    if (!isAnimating) return

    const timer = setTimeout(
      () => {
        if (phase === 'build') {
          if (buildStep < buildSteps.length - 1) {
            setBuildStep((step) => step + 1)
          } else {
            setPhase('publish')
          }
        } else if (phase === 'publish') {
          if (activeTarget < publishTargets.length - 1) {
            setActiveTarget((target) => target + 1)
          } else {
            setPhase('live')
          }
        } else {
          setPhase('build')
          setBuildStep(0)
          setActiveTarget(0)
        }
      },
      phase === 'build' ? 1400 : 1200
    )

    return () => clearTimeout(timer)
  }, [phase, buildStep, activeTarget, isAnimating])

  useEffect(() => {
    if (!isAnimating) return
    const timer = setInterval(() => {
      setActiveLayer((layer) => (layer + 1) % integrationLayers.length)
    }, 1100)

    return () => clearInterval(timer)
  }, [isAnimating])

  return (
    <div className="w-full h-[450px] rounded-2xl bg-gradient-to-br from-white via-stone-50 to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 border border-slate-200/70 dark:border-white/[0.06] shadow-[0_24px_60px_rgba(15,23,42,0.12)] overflow-hidden relative">
      <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:28px_28px]"></div>
      </div>

      <div className="relative z-10 h-full flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 dark:border-white/[0.06] bg-white/80 dark:bg-slate-950/70 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 flex items-center justify-center shadow-lg">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-white font-display">
                NowFlow Builder
              </h3>
              <p className="text-xs text-zinc-500 dark:text-white/40">Application layer studio</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div
              className={`px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide ${
                phase === 'build'
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                  : phase === 'publish'
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200'
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200'
              }`}
            >
              {phase === 'build' ? 'BUILD' : phase === 'publish' ? 'PUBLISH' : 'LIVE'}
            </div>
            <button
              onClick={() => setIsAnimating(!isAnimating)}
              className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/[0.1] flex items-center justify-center transition-colors"
              aria-label={isAnimating ? 'Pause animation' : 'Play animation'}
            >
              {isAnimating ? (
                <svg
                  className="w-3.5 h-3.5 text-zinc-700 dark:text-white/70"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              ) : (
                <svg
                  className="w-3.5 h-3.5 text-zinc-700 dark:text-white/70"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <div className="flex-1 p-6">
          <div className="grid grid-cols-12 gap-4 h-full">
            <div className="col-span-12 md:col-span-7 h-full rounded-2xl border border-slate-200/80 dark:border-white/[0.06] bg-white/90 dark:bg-slate-900/70 p-5 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs text-zinc-500 dark:text-white/40 tracking-wide uppercase">
                    Builder Canvas
                  </p>
                  <h4 className="text-base font-semibold text-zinc-900 dark:text-white font-display">
                    Compose workflows visually
                  </h4>
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-white/40">
                  <Layers className="w-4 h-4" />
                  <span>Version 1.0 • Draft</span>
                </div>
              </div>

              <div className="space-y-3 flex-1">
                {buildSteps.map((step, index) => {
                  const StepIcon = step.icon
                  const isActive = index === buildStep && phase === 'build'
                  const isDone = index < buildStep || phase !== 'build'

                  return (
                    <div
                      key={step.id}
                      className={`rounded-xl border px-4 py-3 transition-all duration-500 ${
                        isActive
                          ? 'border-slate-900/80 bg-slate-900 text-white shadow-lg scale-[1.02]'
                          : isDone
                            ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-500/30 dark:bg-emerald-500/10'
                            : 'border-slate-200/70 bg-white dark:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            isActive
                              ? 'bg-white/10 text-white'
                              : isDone
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
                                : 'bg-slate-100 text-zinc-500 dark:bg-white/[0.06]'
                          }`}
                        >
                          <StepIcon className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-sm font-semibold ${
                                isActive ? 'text-white' : 'text-zinc-900 dark:text-white'
                              }`}
                            >
                              {step.title}
                            </span>
                            {isActive && (
                              <div className="flex gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-pulse"></span>
                                <span
                                  className="w-1.5 h-1.5 rounded-full bg-white/70 animate-pulse"
                                  style={{ animationDelay: '0.2s' }}
                                ></span>
                                <span
                                  className="w-1.5 h-1.5 rounded-full bg-white/70 animate-pulse"
                                  style={{ animationDelay: '0.4s' }}
                                ></span>
                              </div>
                            )}
                          </div>
                          <p
                            className={`text-xs ${
                              isActive ? 'text-white/70' : 'text-zinc-500 dark:text-white/40'
                            }`}
                          >
                            {isActive ? step.status : step.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-4 flex items-center justify-between text-xs text-zinc-500 dark:text-white/40">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-zinc-900 dark:text-white">
                    Extensible integrations
                  </span>
                  <span>connected</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Realtime preview</span>
                </div>
              </div>
            </div>

            <div className="col-span-12 md:col-span-5 grid grid-rows-2 gap-4 h-full">
              <div className="rounded-2xl border border-slate-200/80 dark:border-white/[0.06] bg-white/90 dark:bg-slate-900/70 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs text-zinc-500 dark:text-white/40 tracking-wide uppercase">
                      Publish
                    </p>
                    <h4 className="text-base font-semibold text-zinc-900 dark:text-white font-display">
                      Deploy anywhere
                    </h4>
                  </div>
                  <span className="text-xs text-zinc-500 dark:text-white/40">3 targets</span>
                </div>

                <div className="space-y-3">
                  {publishTargets.map((target, index) => {
                    const TargetIcon = target.icon
                    const isActive = index === activeTarget && phase !== 'build'
                    const isLive = phase === 'live' && index <= activeTarget

                    return (
                      <div
                        key={target.id}
                        className={`rounded-xl border px-4 py-3 transition-all duration-500 ${
                          isActive
                            ? 'border-amber-400 bg-amber-50/70 dark:border-amber-400/40 dark:bg-amber-500/10'
                            : isLive
                              ? 'border-emerald-300 bg-emerald-50/70 dark:border-emerald-500/30 dark:bg-emerald-500/10'
                              : 'border-slate-200/70 bg-white dark:bg-slate-900'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                              isActive
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200'
                                : isLive
                                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-200'
                                  : 'bg-slate-100 text-zinc-500 dark:bg-white/[0.06]'
                            }`}
                          >
                            <TargetIcon className="w-4 h-4" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                                {target.title}
                              </span>
                              {isLive && (
                                <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-200">
                                  LIVE
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-zinc-500 dark:text-white/40">
                              {target.description}
                            </p>
                            {isActive && (
                              <div className="mt-2 rounded bg-slate-100 dark:bg-white/[0.06] px-2 py-1">
                                <code className="text-[10px] text-zinc-600 dark:text-white/70 font-mono">
                                  {target.endpoint}
                                </code>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/80 dark:border-white/[0.06] bg-white/90 dark:bg-slate-900/70 p-5 flex flex-col justify-between">
                <div>
                  <p className="text-xs text-zinc-500 dark:text-white/40 tracking-wide uppercase">
                    Application Layer
                  </p>
                  <h4 className="text-base font-semibold text-zinc-900 dark:text-white font-display">
                    Integration layer ready
                  </h4>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  {integrationLayers.map((layer, index) => (
                    <div
                      key={layer.id}
                      className={`rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                        index === activeLayer
                          ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                          : 'bg-slate-100 text-zinc-600 dark:bg-white/[0.06] dark:text-white/70'
                      }`}
                    >
                      {layer.label}
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-zinc-500 dark:text-white/40">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                    <span>Layered orchestration</span>
                  </div>
                  <span className="font-semibold text-zinc-900 dark:text-white">NowFlow AI</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-3 border-t border-slate-200/80 dark:border-white/[0.06] bg-white/70 dark:bg-slate-950/70 backdrop-blur-sm">
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-white/40">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-zinc-900 dark:text-white">Build</span>
              <ArrowRight className="w-3 h-3" />
              <span className="font-semibold text-zinc-900 dark:text-white">Publish</span>
              <ArrowRight className="w-3 h-3" />
              <span className="font-semibold text-zinc-900 dark:text-white">Embed</span>
            </div>
            <span>Self-hosted automation across connected surfaces</span>
          </div>
        </div>
      </div>
    </div>
  )
}
