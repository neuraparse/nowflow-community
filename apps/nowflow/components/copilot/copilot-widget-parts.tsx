'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import {
  Activity,
  Check,
  Copy,
  Link2,
  Minus,
  Move,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  Sparkles,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import type { ActionSummary } from './copilot-types'
import { getThinkingInsights, springGentle } from './copilot-utils'

// ─── Action Summary Card ────────────────────────────────────────────────────────

const ACTION_ACCENT_CLASSES = {
  added: 'border-emerald-300/22 bg-emerald-300/6 text-emerald-200',
  inserted: 'border-sky-300/22 bg-sky-300/6 text-sky-200',
  removed: 'border-red-300/22 bg-red-300/6 text-red-200',
  configured: 'border-violet-300/22 bg-violet-300/6 text-violet-200',
  connections: 'border-amber-300/22 bg-amber-300/6 text-amber-200',
  repositioned: 'border-white/12 bg-white/[0.03] text-white/62',
} as const

export function ActionSummaryCard({ summary }: { summary: NonNullable<ActionSummary> }) {
  const items: { icon: React.ReactNode; label: string; accent: string }[] = []

  if (summary.added && summary.added.length > 0) {
    items.push({
      icon: <Plus className="h-3 w-3" />,
      label: summary.added.join(', '),
      accent: ACTION_ACCENT_CLASSES.added,
    })
  }
  if (summary.inserted && summary.inserted.length > 0) {
    items.push({
      icon: <Plus className="h-3 w-3" />,
      label: summary.inserted.join(', '),
      accent: ACTION_ACCENT_CLASSES.inserted,
    })
  }
  if (summary.removed && summary.removed > 0) {
    items.push({
      icon: <Minus className="h-3 w-3" />,
      label: `${summary.removed} block${summary.removed > 1 ? 's' : ''} removed`,
      accent: ACTION_ACCENT_CLASSES.removed,
    })
  }
  if (summary.configured && summary.configured > 0) {
    items.push({
      icon: <Settings2 className="h-3 w-3" />,
      label: `${summary.configured} block${summary.configured > 1 ? 's' : ''} configured`,
      accent: ACTION_ACCENT_CLASSES.configured,
    })
  }
  if (summary.connections && summary.connections > 0) {
    items.push({
      icon: <Link2 className="h-3 w-3" />,
      label: `${summary.connections} connection${summary.connections > 1 ? 's' : ''}`,
      accent: ACTION_ACCENT_CLASSES.connections,
    })
  }
  if (summary.repositioned && summary.repositioned > 0) {
    items.push({
      icon: <Move className="h-3 w-3" />,
      label: `${summary.repositioned} repositioned`,
      accent: ACTION_ACCENT_CLASSES.repositioned,
    })
  }

  if (items.length === 0) return null

  return (
    <m.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.2 }}
      className="flex flex-wrap gap-1 mt-1.5"
    >
      {items.map((item, i) => (
        <span
          key={i}
          className={`inline-flex items-center gap-1 border px-2 py-0.5 text-[10px] ${item.accent}`}
        >
          {item.icon}
          {item.label}
        </span>
      ))}
    </m.div>
  )
}

// ─── Copy Button Component ─────────────────────────────────────────────────────

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [text])

  return (
    <button
      onClick={handleCopy}
      className="absolute right-2 top-2 border border-white/12 bg-black/90 p-1 text-white/46 opacity-0 transition-all duration-200 group-hover/code:opacity-100 hover:border-lime-300/24 hover:text-white/88"
      aria-label="Copy code"
    >
      <AnimatePresence mode="wait">
        {copied ? (
          <m.div key="check" initial={{ scale: 0.5 }} animate={{ scale: 1 }} exit={{ scale: 0.5 }}>
            <Check className="h-3 w-3 text-emerald-500" />
          </m.div>
        ) : (
          <m.div key="copy" initial={{ scale: 0.5 }} animate={{ scale: 1 }} exit={{ scale: 0.5 }}>
            <Copy className="h-3 w-3" />
          </m.div>
        )}
      </AnimatePresence>
    </button>
  )
}

// ─── Message Copy Button ────────────────────────────────────────────────────────

export function MessageActions({
  content,
  onRegenerate,
}: {
  content: string
  onRegenerate?: () => void
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [content])

  return (
    <m.div
      initial={{ opacity: 0, y: 2 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-1.5 flex items-center gap-1"
    >
      <button
        onClick={handleCopy}
        className="copilot-terminal-secondary-button flex items-center gap-1 px-2 py-1 text-[10px]"
      >
        {copied ? <Check className="h-2.5 w-2.5" /> : <Copy className="h-2.5 w-2.5" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
      {onRegenerate && (
        <button
          onClick={onRegenerate}
          className="copilot-terminal-secondary-button flex items-center gap-1 px-2 py-1 text-[10px]"
        >
          <RotateCcw className="h-2.5 w-2.5" />
          Retry
        </button>
      )}
    </m.div>
  )
}

// ─── Markdown Renderer with Code Blocks ─────────────────────────────────────────

export function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        pre({ children }) {
          return <div className="relative group/code my-2 first:mt-0 last:mb-0">{children}</div>
        },
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '')
          const codeString = String(children).replace(/\n$/, '')
          const isInline = !match && !codeString.includes('\n')

          if (isInline) {
            return (
              <code
                className="border border-white/10 bg-black/70 px-1.5 py-0.5 text-[12px] font-mono font-medium text-lime-100"
                {...props}
              >
                {children}
              </code>
            )
          }

          return (
            <>
              {match && (
                <div className="flex items-center justify-between border border-b-0 border-white/10 bg-black/92 px-3 py-1.5">
                  <span className="copilot-terminal-kicker text-[10px] text-white/44">
                    {match[1]}
                  </span>
                  <CopyButton text={codeString} />
                </div>
              )}
              <pre
                className={`overflow-x-auto border border-white/10 bg-black/88 p-3 text-[12px] font-mono leading-relaxed text-white/82 ${
                  match ? 'border-t-0' : ''
                }`}
              >
                <code className={className} {...props}>
                  {children}
                </code>
                {!match && <CopyButton text={codeString} />}
              </pre>
            </>
          )
        },
        p({ children }) {
          return <p className="mb-2 last:mb-0 leading-[1.7]">{children}</p>
        },
        ul({ children }) {
          return (
            <ul className="my-1.5 list-disc space-y-0.5 pl-4 marker:text-white/24">{children}</ul>
          )
        },
        ol({ children }) {
          return (
            <ol className="my-1.5 list-decimal space-y-0.5 pl-4 marker:text-white/24">
              {children}
            </ol>
          )
        },
        li({ children }) {
          return <li className="leading-[1.65] pl-0.5">{children}</li>
        },
        a({ href, children }) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-lime-200 underline decoration-white/18 underline-offset-[3px] transition-colors hover:decoration-lime-200/52"
            >
              {children}
            </a>
          )
        },
        strong({ children }) {
          return <strong className="font-semibold text-white">{children}</strong>
        },
        h1({ children }) {
          return (
            <h1 className="mt-3 mb-1.5 text-base font-semibold text-white first:mt-0">
              {children}
            </h1>
          )
        },
        h2({ children }) {
          return (
            <h2 className="mt-2.5 mb-1 text-sm font-semibold text-white first:mt-0">{children}</h2>
          )
        },
        h3({ children }) {
          return (
            <h3 className="mt-2 mb-1 text-[13px] font-semibold text-white first:mt-0">
              {children}
            </h3>
          )
        },
        blockquote({ children }) {
          return (
            <blockquote className="my-2 border-l-2 border-white/12 pl-3 italic text-white/52">
              {children}
            </blockquote>
          )
        },
        hr() {
          return <hr className="my-3 border-white/8" />
        },
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

// ─── Thinking Indicator ─────────────────────────────────────────────────────────

const THINKING_ICONS = [
  <Search key="s" className="h-3 w-3" />,
  <Activity key="a" className="h-3 w-3" />,
  <Sparkles key="sp" className="h-3 w-3" />,
  <Sparkles key="z" className="h-3 w-3" />,
]

export function ThinkingIndicator({
  currentContext,
  elapsed,
}: {
  currentContext: string
  elapsed: number
}) {
  const [step, setStep] = useState(0)
  const insights = useMemo(() => getThinkingInsights(currentContext), [currentContext])
  const safeStep = step % insights.length

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((prev) => (prev + 1) % insights.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [insights.length])

  return (
    <m.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springGentle}
      className="w-full"
    >
      <div className="copilot-terminal-message-box copilot-terminal-message-box--assistant max-w-[88%] px-3.5 py-3">
        <div className="copilot-terminal-log-label mb-2 flex items-center gap-2 text-[10px] leading-none">
          <span>[SYSTEM]</span>
          <span>THINKING:</span>
        </div>
        <div className="mb-2 flex items-center gap-2">
          <AnimatePresence mode="wait">
            <m.div
              key={step}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="flex items-center gap-2"
            >
              <span className="text-lime-200">
                {THINKING_ICONS[safeStep % THINKING_ICONS.length]}
              </span>
              <span className="text-[12px] text-white/64">{insights[safeStep]}</span>
            </m.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-2">
          <div className="h-[2px] flex-1 overflow-hidden bg-white/10">
            <m.div
              className="h-full bg-lime-300"
              animate={{ x: ['-100%', '100%'] }}
              transition={{
                duration: 1.8,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              style={{ width: '35%' }}
            />
          </div>
          {elapsed > 0 && (
            <span className="copilot-terminal-kicker flex-shrink-0 text-[9px] tabular-nums text-white/34">
              {elapsed}s
            </span>
          )}
        </div>
      </div>
    </m.div>
  )
}
