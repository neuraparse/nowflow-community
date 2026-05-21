import React, { memo } from 'react'
import { Handle, NodeProps, Position } from '@xyflow/react'
import { Bot, User } from 'lucide-react'
import { useTheme } from 'next-themes'
import {
  AgentIcon,
  ConditionalIcon,
  GmailIcon,
  GoogleCalendarIcon,
  OutlookIcon,
} from '@/components/icons'
import {
  getLiveCanvasGlassAppearance,
  getLiveCanvasShapeStyles,
  hexToRgba,
} from '@/components/workflow/live-canvas-block-style'
import { cn } from '@/lib/utils'

/**
 * Signal Odyssey shape types — matching the workflow editor's block-shapes.ts
 *
 *   starter   → arrow right      (Signal Beacon)
 *   agent     → top chamfers     (Command Bridge)
 *   condition → arrow left       (Signal Splitter)
 *   tool      → right notch      (Data Port Module)
 *   process   → bottom chamfers  (Engine Core)
 */
export type BlockType = 'starter' | 'agent' | 'condition' | 'calendar' | 'reply'
export type ShapeType = 'starter' | 'agent' | 'condition' | 'tool' | 'process'

interface BlockConfig {
  icon: React.ElementType
  bgColor: string
  name: string
  subtitle: string
  shape: ShapeType
  profile?: { name: string; type: 'ai' | 'human' }
  brandIcon?: boolean
  hasLeftAccent?: boolean
}

interface HeroBlockData extends Partial<BlockConfig> {
  type?: BlockType
  runState?: 'idle' | 'running' | 'done'
}

// Real system colors & icons from registry
const blockConfig: Record<BlockType, BlockConfig> = {
  starter: {
    icon: OutlookIcon,
    bgColor: '#0078D4',
    name: 'Email Received',
    subtitle: 'Outlook trigger',
    shape: 'starter',
    brandIcon: true,
  },
  agent: {
    icon: AgentIcon,
    bgColor: '#802FFF',
    name: 'Support Agent',
    subtitle: 'Analyze & respond',
    shape: 'agent',
    profile: { name: 'Sarah', type: 'human' },
  },
  condition: {
    icon: ConditionalIcon,
    bgColor: '#FF972F',
    name: 'Intent Router',
    subtitle: 'Check urgency',
    shape: 'condition',
  },
  calendar: {
    icon: GoogleCalendarIcon,
    bgColor: '#4285F4',
    name: 'Schedule Meeting',
    subtitle: 'Google Calendar',
    shape: 'tool',
    brandIcon: true,
    hasLeftAccent: true,
  },
  reply: {
    icon: GmailIcon,
    bgColor: '#28C43F',
    name: 'Auto-Reply',
    subtitle: 'Send email',
    shape: 'tool',
    brandIcon: true,
    hasLeftAccent: true,
  },
}

export const HeroBlock = memo(({ data }: NodeProps) => {
  const { type = 'starter', runState = 'idle', ...overrides } = (data as HeroBlockData) || {}
  const baseConfig = blockConfig[type] || blockConfig.starter
  const config: BlockConfig = {
    icon: overrides.icon ?? baseConfig.icon,
    bgColor: overrides.bgColor ?? baseConfig.bgColor,
    name: overrides.name ?? baseConfig.name,
    subtitle: overrides.subtitle ?? baseConfig.subtitle,
    shape: overrides.shape ?? baseConfig.shape,
    profile: overrides.profile ?? baseConfig.profile,
    brandIcon: overrides.brandIcon ?? baseConfig.brandIcon,
    hasLeftAccent: overrides.hasLeftAccent ?? baseConfig.hasLeftAccent,
  }
  const Icon = config.icon
  const isFirst = type === 'starter'
  const isLast = type === 'calendar' || type === 'reply'
  const shapeStyles = getLiveCanvasShapeStyles(config.shape)
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const { glassFallback, glassSurface, glassOverlay, glassInsetShadow } =
    getLiveCanvasGlassAppearance(isDark)

  return (
    <div className="flex flex-col items-center group relative">
      {!isFirst && (
        <Handle
          type="target"
          position={Position.Left}
          id="target"
          className={cn('!w-[4px] !h-[4px] !rounded-full', '!z-50 !-left-[5px]')}
          style={{
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'auto',
            background: `linear-gradient(to bottom, ${hexToRgba(config.bgColor, 0.5)}, ${config.bgColor})`,
            border: 'none',
          }}
          isConnectable={false}
        />
      )}

      {/* Running glow ring */}
      {runState === 'running' && (
        <div
          className="absolute inset-0 -m-1.5 rounded-xl animate-pulse"
          style={{
            background: `radial-gradient(ellipse, ${hexToRgba(config.bgColor, 0.15)}, transparent 70%)`,
            zIndex: -1,
          }}
        />
      )}

      {/* Shadow wrapper — filter: drop-shadow follows clip-path contour.
           relative so overlay badges (profile, checkmark, dot) position against this. */}
      <div
        className={cn(
          'relative transition-all duration-300',
          runState === 'done' && 'ring-1 ring-emerald-400/50 rounded-lg'
        )}
        style={{
          filter:
            runState === 'running'
              ? `drop-shadow(0 0 1px ${hexToRgba(config.bgColor, 0.4)}) drop-shadow(0 0 10px ${hexToRgba(config.bgColor, 0.2)})`
              : runState === 'done'
                ? `drop-shadow(0 0 0.5px rgba(34,197,94,0.3)) drop-shadow(0 0 6px rgba(34,197,94,0.1))`
                : isDark
                  ? `drop-shadow(0 0 0.5px ${hexToRgba(config.bgColor, 0.3)}) drop-shadow(0 1px 3px rgba(0,0,0,0.3)) drop-shadow(0 2px 8px rgba(0,0,0,0.2))`
                  : `drop-shadow(0 0 0.5px ${hexToRgba(config.bgColor, 0.18)}) drop-shadow(0 1px 3px rgba(0,0,0,0.04)) drop-shadow(0 2px 8px rgba(0,0,0,0.03))`,
        }}
      >
        {/* Clipped shape body */}
        <div
          className="relative overflow-hidden flex items-center gap-1.5 sm:gap-2.5 px-2 sm:px-3 py-1.5 sm:py-2.5 min-w-[112px] sm:min-w-[150px] max-w-[138px] sm:max-w-[190px] transition-all duration-300"
          style={{
            ...shapeStyles,
            backgroundColor: glassFallback,
            border: isDark
              ? '1px solid rgba(255,255,255,0.16)'
              : '1px solid rgba(255,255,255,0.78)',
            boxShadow: `${config.hasLeftAccent ? `inset 3px 0 0 ${config.bgColor}, ` : ''}${glassInsetShadow}${isDark ? ', 0 16px 32px rgba(0,0,0,0.28)' : ', 0 16px 32px rgba(24,24,27,0.12)'}`,
            isolation: 'isolate',
          }}
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: glassSurface,
              backdropFilter: 'blur(24px) saturate(145%)',
              WebkitBackdropFilter: 'blur(24px) saturate(145%)',
              transform: 'translateZ(0)',
            }}
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: glassOverlay }}
          />
          {/* Icon badge */}
          <div
            className="relative z-10 w-5.5 h-5.5 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              background: config.brandIcon
                ? isDark
                  ? 'linear-gradient(165deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%)'
                  : 'linear-gradient(165deg, rgba(255,255,255,0.9) 0%, rgba(241,244,248,0.8) 100%)'
                : `linear-gradient(135deg, ${config.bgColor}, ${hexToRgba(config.bgColor, 0.85)})`,
              boxShadow: config.brandIcon
                ? isDark
                  ? '0 6px 14px rgba(0,0,0,0.22)'
                  : '0 6px 14px rgba(24,24,27,0.08)'
                : `0 8px 18px ${hexToRgba(config.bgColor, 0.26)}, inset 0 1px 0 rgba(255,255,255,0.24)`,
              border: config.brandIcon
                ? isDark
                  ? '1px solid rgba(255,255,255,0.08)'
                  : '1px solid rgba(255,255,255,0.72)'
                : 'none',
            }}
          >
            <Icon
              className="w-3 h-3 sm:w-4 sm:h-4"
              style={{ color: config.brandIcon ? config.bgColor : 'white' }}
            />
          </div>

          {/* Text */}
          <div className="relative z-10 flex flex-col gap-0.5 min-w-0">
            <span
              className={cn(
                'text-[9px] sm:text-[11px] font-semibold truncate leading-none',
                isDark ? 'text-white/92' : 'text-zinc-700'
              )}
            >
              {config.name}
            </span>
            <span
              className={cn(
                'text-[7px] sm:text-[9px] truncate leading-none transition-colors duration-300',
                runState === 'running'
                  ? 'text-purple-500 font-medium'
                  : runState === 'done'
                    ? 'text-emerald-500 font-medium'
                    : isDark
                      ? 'text-white/42'
                      : 'text-zinc-400'
              )}
            >
              {runState === 'running'
                ? 'Processing...'
                : runState === 'done'
                  ? 'Completed'
                  : config.subtitle}
            </span>
          </div>
        </div>

        {/* Overlay badges — OUTSIDE clip-path, INSIDE shadow wrapper (relative) */}

        {/* Agent profile badge */}
        {config.profile && runState === 'idle' && (
          <div
            className="absolute -top-1.5 sm:-top-2.5 -right-1.5 sm:-right-2.5 z-10 flex items-center gap-1 px-1 sm:px-1.5 py-0.5 rounded-full border border-white dark:border-slate-900 shadow-sm"
            style={{
              background:
                config.profile.type === 'human'
                  ? isDark
                    ? '#78350f'
                    : '#fef3c7'
                  : isDark
                    ? '#4c1d95'
                    : '#ede9fe',
            }}
          >
            {config.profile.type === 'human' ? (
              <User className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" strokeWidth={2.5} />
            ) : (
              <Bot className="w-2.5 h-2.5 text-purple-600 dark:text-purple-400" strokeWidth={2.5} />
            )}
            <span
              className="text-[6.5px] sm:text-[8px] font-semibold leading-none"
              style={{
                color:
                  config.profile.type === 'human'
                    ? isDark
                      ? '#fbbf24'
                      : '#92400e'
                    : isDark
                      ? '#c4b5fd'
                      : '#6b21a8',
              }}
            >
              {config.profile.name}
            </span>
          </div>
        )}

        {/* Done checkmark */}
        {runState === 'done' && (
          <div className="absolute -top-1 -right-1 z-10 w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 flex items-center justify-center">
            <svg className="w-1.5 h-1.5 sm:w-2 sm:h-2 text-white" viewBox="0 0 12 12" fill="none">
              <path
                d="M2 6L5 9L10 3"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}

        {/* Active dot (only in idle for non-profile non-done blocks) */}
        {!config.profile && runState === 'idle' && (
          <span
            className="absolute top-0 right-0 z-10 w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full border border-white dark:border-slate-900"
            style={{ background: '#22c55e' }}
          />
        )}
      </div>

      {!isLast && (
        <Handle
          type="source"
          position={Position.Right}
          id="source"
          className={cn('!w-[4px] !h-[4px] !rounded-full', '!z-50 !-right-[5px]')}
          style={{
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'auto',
            background: `linear-gradient(to bottom, ${hexToRgba(config.bgColor, 0.5)}, ${config.bgColor})`,
            border: 'none',
          }}
          isConnectable={false}
        />
      )}
    </div>
  )
})

HeroBlock.displayName = 'HeroBlock'
