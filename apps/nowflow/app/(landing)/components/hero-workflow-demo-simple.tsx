'use client'

import { useEffect, useState } from 'react'
import { Bot, CheckCircle2, Database, FileText, MessageSquare, Send } from 'lucide-react'

const steps = [
  {
    id: 1,
    icon: MessageSquare,
    label: 'Voice Input',
    description: 'User speaks command',
    status: 'Processing voice input...',
    color: '#3b82f6',
  },
  {
    id: 2,
    icon: Bot,
    label: 'AI Processing',
    description: 'NowFlow AI analyzes',
    status: 'Analyzing intent...',
    color: '#8b5cf6',
  },
  {
    id: 3,
    icon: Database,
    label: 'Data Fetch',
    description: 'Queries Salesforce',
    status: 'Fetching Q4 data...',
    color: '#10b981',
  },
  {
    id: 4,
    icon: FileText,
    label: 'Generate',
    description: 'Creates report',
    status: 'Generating report...',
    color: '#f59e0b',
  },
  {
    id: 5,
    icon: Send,
    label: 'Deliver',
    description: 'Sent to team',
    status: 'Sending to Slack...',
    color: '#06b6d4',
  },
]

export default function HeroWorkflowDemoSimple() {
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % steps.length)
    }, 2500)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="w-full h-[450px] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.06] shadow-xl overflow-hidden">
      {/* Header - Build Tool Style */}
      <div className="border-b border-slate-200 dark:border-white/[0.06] px-4 py-2.5 bg-slate-50 dark:bg-slate-950">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-700" />
              <div className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-700" />
              <div className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-700" />
            </div>
            <span className="text-xs font-mono text-zinc-600 dark:text-white/40">
              workflow-builder
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono">RUNNING</span>
          </div>
        </div>
      </div>

      {/* Main Content - Terminal Style */}
      <div className="h-[calc(100%-49px)] bg-slate-50 dark:bg-slate-950 p-4 overflow-hidden">
        <div className="h-full flex flex-col gap-3">
          {/* Build Steps */}
          <div className="flex-1 space-y-2">
            {steps.map((step, index) => {
              const Icon = step.icon
              const isActive = activeStep === index
              const isPassed = index < activeStep
              const isPending = index > activeStep

              return (
                <div
                  key={step.id}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg
                    transition-all duration-500 border
                    ${isActive ? 'bg-white dark:bg-slate-900 shadow-md scale-[1.02]' : 'bg-white/50 dark:bg-slate-900/50'}
                    ${isPassed ? 'border-emerald-200 dark:border-emerald-900/30' : isPending ? 'border-slate-200 dark:border-white/[0.06]' : 'border-slate-200 dark:border-slate-700'}
                  `}
                  style={{
                    borderColor: isActive ? step.color : undefined,
                  }}
                >
                  {/* Status Icon */}
                  <div className="flex-shrink-0">
                    {isPassed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : isActive ? (
                      <div
                        className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
                        style={{ borderColor: step.color, borderTopColor: 'transparent' }}
                      />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-700" />
                    )}
                  </div>

                  {/* Step Icon */}
                  <div
                    className={`
                      w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
                      transition-all duration-500
                      ${!(isActive || isPassed) ? 'bg-gray-200 dark:bg-slate-700' : ''}
                    `}
                    style={{
                      background:
                        isActive || isPassed
                          ? `linear-gradient(135deg, ${step.color} 0%, ${step.color}dd 100%)`
                          : undefined,
                    }}
                  >
                    <Icon
                      className={`w-4 h-4 ${isActive || isPassed ? 'text-white' : 'text-zinc-400'}`}
                    />
                  </div>

                  {/* Step Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-semibold ${
                          isActive
                            ? 'text-zinc-900 dark:text-white'
                            : isPassed
                              ? 'text-zinc-700 dark:text-white/70'
                              : 'text-zinc-500 dark:text-white/25'
                        }`}
                      >
                        {step.label}
                      </span>
                      {isActive && (
                        <span className="text-[10px] font-mono text-zinc-500 dark:text-white/40">
                          {step.status}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-white/25 truncate">
                      {step.description}
                    </p>
                  </div>

                  {/* Duration/Status */}
                  <div className="flex-shrink-0 text-right">
                    {isPassed ? (
                      <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                        DONE
                      </span>
                    ) : isActive ? (
                      <div className="flex items-center gap-1">
                        <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse" />
                        <div
                          className="w-1 h-1 rounded-full bg-blue-500 animate-pulse"
                          style={{ animationDelay: '0.2s' }}
                        />
                        <div
                          className="w-1 h-1 rounded-full bg-blue-500 animate-pulse"
                          style={{ animationDelay: '0.4s' }}
                        />
                      </div>
                    ) : (
                      <span className="text-[10px] font-mono text-zinc-400 dark:text-white/30">
                        WAITING
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Progress Footer */}
          <div className="border-t border-slate-200 dark:border-white/[0.06] pt-3 space-y-2">
            {/* Progress Bar */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 bg-slate-200 dark:bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className="h-full transition-all duration-500 relative"
                  style={{
                    width: `${((activeStep + 1) / steps.length) * 100}%`,
                    background: `linear-gradient(90deg, ${steps[0].color} 0%, ${steps[activeStep].color} 100%)`,
                  }}
                >
                  <div className="absolute inset-0 bg-white/20 animate-pulse" />
                </div>
              </div>
              <span className="text-xs font-mono font-semibold text-zinc-700 dark:text-white/70 w-12 text-right">
                {Math.round(((activeStep + 1) / steps.length) * 100)}%
              </span>
            </div>

            {/* Status Text */}
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-zinc-500 dark:text-white/25">
                Step {activeStep + 1} of {steps.length}
              </span>
              <span className="text-zinc-500 dark:text-white/25">
                {activeStep < steps.length - 1 ? 'Building workflow...' : 'Workflow complete!'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
