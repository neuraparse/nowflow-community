'use client'

import React, { useEffect, useState } from 'react'
import {
  BaseEdge,
  Edge,
  EdgeProps,
  EdgeTypes,
  getSmoothStepPath,
  Handle,
  Node,
  NodeProps,
  NodeTypes,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { motion } from 'framer-motion'
import { Bot, User } from 'lucide-react'
import { useTheme } from 'next-themes'
import {
  AgentIcon,
  AirtableIcon,
  ConditionalIcon,
  GithubIcon,
  GmailIcon,
  GoogleCalendarIcon,
  GoogleSheetsIcon,
  HubspotIcon,
  LinkedInIcon,
  NotionIcon,
  SalesforceIcon,
  SlackIcon,
  StartIcon,
  StripeIcon,
} from '@/components/icons'
import { cn } from '@/lib/utils'
import { useWindowSize } from '../use-window-size'

// ─── Shape system (from block-shapes.ts) ───
type ShapeType = 'starter' | 'agent' | 'condition' | 'tool'

const getShapeStyles = (shape: ShapeType): React.CSSProperties => {
  switch (shape) {
    case 'starter':
      return {
        clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%)',
        WebkitClipPath:
          'polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%)',
        paddingRight: '24px',
      }
    case 'agent':
      return {
        clipPath: 'polygon(0 10px, 10px 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%)',
        WebkitClipPath:
          'polygon(0 10px, 10px 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%)',
      }
    case 'condition':
      return {
        clipPath: 'polygon(0 50%, 14px 0, 100% 0, 100% 100%, 14px 100%)',
        WebkitClipPath: 'polygon(0 50%, 14px 0, 100% 0, 100% 100%, 14px 100%)',
        paddingLeft: '24px',
      }
    case 'tool':
      return {
        clipPath:
          'polygon(0 0, 100% 0, 100% 10px, calc(100% - 4px) 10px, calc(100% - 4px) calc(100% - 10px), 100% calc(100% - 10px), 100% 100%, 0 100%)',
        WebkitClipPath:
          'polygon(0 0, 100% 0, 100% 10px, calc(100% - 4px) 10px, calc(100% - 4px) calc(100% - 10px), 100% calc(100% - 10px), 100% 100%, 0 100%)',
      }
  }
}

const hexToRgba = (hex: string, a: number) => {
  const n = hex.replace('#', '')
  return `rgba(${parseInt(n.slice(0, 2), 16)}, ${parseInt(n.slice(2, 4), 16)}, ${parseInt(n.slice(4, 6), 16)}, ${a})`
}

// ─── TemplateBlock: same rendering as HeroBlock but configurable ───
const TemplateBlock = React.memo(({ data }: NodeProps) => {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const {
    icon: Icon,
    bgColor,
    name,
    subtitle,
    shape,
    brandIcon,
    hasLeftAccent,
    profile,
  } = data as {
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
    bgColor: string
    name: string
    subtitle: string
    shape: ShapeType
    brandIcon?: boolean
    hasLeftAccent?: boolean
    profile?: { name: string; type: 'ai' | 'human' }
  }

  const isFirst = shape === 'starter'
  const isLast = shape === 'tool'
  const shapeStyles = getShapeStyles(shape)
  const glassSurface = isDark
    ? 'linear-gradient(155deg, rgba(70,70,77,0.78) 0%, rgba(42,42,48,0.72) 44%, rgba(25,25,30,0.66) 100%)'
    : 'linear-gradient(155deg, rgba(255,255,255,0.86) 0%, rgba(243,245,248,0.74) 42%, rgba(229,232,237,0.62) 100%)'
  const glassFallback = isDark ? 'rgba(43,43,49,0.88)' : 'rgba(248,250,253,0.94)'
  const glassOverlay = isDark
    ? 'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.06) 18%, rgba(255,255,255,0) 48%), radial-gradient(circle at top left, rgba(255,255,255,0.15), transparent 40%)'
    : 'linear-gradient(180deg, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.2) 24%, rgba(255,255,255,0) 52%), radial-gradient(circle at top left, rgba(255,255,255,0.52), transparent 42%)'
  const glassInsetShadow = isDark
    ? 'inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(255,255,255,0.06), inset 0 0 0 1px rgba(255,255,255,0.14)'
    : 'inset 0 1px 0 rgba(255,255,255,0.94), inset 0 -1px 0 rgba(113,113,122,0.12), inset 0 0 0 1px rgba(255,255,255,0.72)'
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
            background: `linear-gradient(to bottom, ${hexToRgba(bgColor, 0.5)}, ${bgColor})`,
            border: 'none',
          }}
          isConnectable={false}
        />
      )}

      <div
        className="relative transition-all duration-300"
        style={{
          filter: isDark
            ? `drop-shadow(0 0 0.5px ${hexToRgba(bgColor, 0.3)}) drop-shadow(0 1px 3px rgba(0,0,0,0.3)) drop-shadow(0 2px 8px rgba(0,0,0,0.2))`
            : `drop-shadow(0 0 0.5px ${hexToRgba(bgColor, 0.18)}) drop-shadow(0 1px 3px rgba(0,0,0,0.04)) drop-shadow(0 2px 8px rgba(0,0,0,0.03))`,
        }}
      >
        <div
          className="relative overflow-hidden flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2.5 min-w-[108px] sm:min-w-[150px] max-w-[138px] sm:max-w-[190px] transition-all duration-300"
          style={{
            ...shapeStyles,
            backgroundColor: glassFallback,
            border: isDark
              ? '1px solid rgba(255,255,255,0.16)'
              : '1px solid rgba(255,255,255,0.78)',
            boxShadow: `${hasLeftAccent ? `inset 3px 0 0 ${bgColor}, ` : ''}${glassInsetShadow}${isDark ? ', 0 16px 32px rgba(0,0,0,0.28)' : ', 0 16px 32px rgba(24,24,27,0.12)'}`,
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
          <div
            className="relative z-10 w-5.5 h-5.5 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              background: brandIcon
                ? isDark
                  ? 'linear-gradient(165deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%)'
                  : 'linear-gradient(165deg, rgba(255,255,255,0.9) 0%, rgba(241,244,248,0.8) 100%)'
                : `linear-gradient(135deg, ${bgColor}, ${hexToRgba(bgColor, 0.85)})`,
              boxShadow: brandIcon
                ? isDark
                  ? '0 6px 14px rgba(0,0,0,0.22)'
                  : '0 6px 14px rgba(24,24,27,0.08)'
                : `0 8px 18px ${hexToRgba(bgColor, 0.26)}, inset 0 1px 0 rgba(255,255,255,0.24)`,
              border: brandIcon
                ? isDark
                  ? '1px solid rgba(255,255,255,0.08)'
                  : '1px solid rgba(255,255,255,0.72)'
                : 'none',
            }}
          >
            <Icon
              className="w-3 h-3 sm:w-4 sm:h-4"
              style={{ color: brandIcon ? bgColor : 'white' }}
            />
          </div>
          <div className="relative z-10 flex flex-col gap-0.5 min-w-0">
            <span
              className={cn(
                'font-heading truncate text-[9px] font-semibold leading-none sm:text-[11px]',
                isDark ? 'text-white/92' : 'text-zinc-700'
              )}
            >
              {name}
            </span>
            <span
              className={cn(
                'font-body truncate text-[7px] leading-none sm:text-[9px]',
                isDark ? 'text-white/42' : 'text-zinc-400'
              )}
            >
              {subtitle}
            </span>
          </div>
        </div>

        {profile && (
          <div
            className="absolute -top-2.5 -right-2.5 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-white dark:border-slate-900 shadow-sm"
            style={{
              background:
                profile.type === 'human'
                  ? isDark
                    ? '#78350f'
                    : '#fef3c7'
                  : isDark
                    ? '#4c1d95'
                    : '#ede9fe',
            }}
          >
            {profile.type === 'human' ? (
              <User className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" strokeWidth={2.5} />
            ) : (
              <Bot className="w-2.5 h-2.5 text-purple-600 dark:text-purple-400" strokeWidth={2.5} />
            )}
            <span
              className="text-[8px] font-semibold leading-none"
              style={{
                color:
                  profile.type === 'human'
                    ? isDark
                      ? '#fbbf24'
                      : '#92400e'
                    : isDark
                      ? '#c4b5fd'
                      : '#6b21a8',
              }}
            >
              {profile.name}
            </span>
          </div>
        )}

        {!profile && (
          <span
            className="absolute -top-0.5 -right-0.5 z-10 w-2 h-2 rounded-full border border-white dark:border-slate-900"
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
            background: `linear-gradient(to bottom, ${hexToRgba(bgColor, 0.5)}, ${bgColor})`,
            border: 'none',
          }}
          isConnectable={false}
        />
      )}
    </div>
  )
})
TemplateBlock.displayName = 'TemplateBlock'

// ─── TemplateEdge: same as HeroEdge ───
const TemplateEdge = ({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
}: EdgeProps) => {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
    offset: 30,
  })
  return (
    <BaseEdge
      path={edgePath}
      style={{
        strokeWidth: 1.5,
        stroke: '#e2e8f0',
        strokeDasharray: '5,4',
        ...(style && typeof style === 'object' && !Array.isArray(style) ? style : {}),
      }}
    />
  )
}

const nodeTypes: NodeTypes = { tplBlock: TemplateBlock }
const edgeTypes: EdgeTypes = { tplEdge: TemplateEdge }

// ─── Template data ───
type TemplateDef = {
  name: string
  description: string
  nodes: Node[]
  edges: Edge[]
}

const edge = { stroke: '#e2e8f0', strokeWidth: 1.5, strokeDasharray: '5,4' }
const greenEdge = { stroke: '#22c55e', strokeWidth: 1.5, strokeDasharray: '5,4', opacity: 0.7 }
const purpleEdge = { stroke: '#802FFF', strokeWidth: 1.5, strokeDasharray: '5,4', opacity: 0.5 }

const tpls: TemplateDef[] = [
  {
    name: 'Prospect Researcher',
    description: "Replaces your SDR's manual research",
    nodes: [
      {
        id: 't1',
        type: 'tplBlock',
        position: { x: 0, y: 80 },
        data: {
          icon: HubspotIcon,
          bgColor: '#FF7A59',
          name: 'New Lead',
          subtitle: 'HubSpot trigger',
          shape: 'starter',
          brandIcon: true,
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      },
      {
        id: 't2',
        type: 'tplBlock',
        position: { x: 200, y: 80 },
        data: {
          icon: AgentIcon,
          bgColor: '#802FFF',
          name: 'Research Agent',
          subtitle: 'Deep-dive company',
          shape: 'agent',
          profile: { name: 'Atlas', type: 'ai' },
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      },
      {
        id: 't3',
        type: 'tplBlock',
        position: { x: 400, y: 80 },
        data: {
          icon: ConditionalIcon,
          bgColor: '#FF972F',
          name: 'Score Check',
          subtitle: 'Qualified?',
          shape: 'condition',
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      },
      {
        id: 't4',
        type: 'tplBlock',
        position: { x: 600, y: 80 },
        data: {
          icon: SalesforceIcon,
          bgColor: '#00A1E0',
          name: 'Salesforce Sync',
          subtitle: 'Update record',
          shape: 'tool',
          brandIcon: true,
          hasLeftAccent: true,
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      },
    ],
    edges: [
      {
        id: 'te1',
        source: 't1',
        target: 't2',
        type: 'tplEdge',
        style: edge,
        sourceHandle: 'source',
        targetHandle: 'target',
      },
      {
        id: 'te2',
        source: 't2',
        target: 't3',
        type: 'tplEdge',
        style: edge,
        sourceHandle: 'source',
        targetHandle: 'target',
      },
      {
        id: 'te3',
        source: 't3',
        target: 't4',
        type: 'tplEdge',
        style: greenEdge,
        sourceHandle: 'source',
        targetHandle: 'target',
      },
    ],
  },
  {
    name: 'Email Follow-up Autopilot',
    description: 'Never miss a warm lead again',
    nodes: [
      {
        id: 't1',
        type: 'tplBlock',
        position: { x: 0, y: 80 },
        data: {
          icon: GmailIcon,
          bgColor: '#EA4335',
          name: 'Email Received',
          subtitle: 'Gmail watch',
          shape: 'starter',
          brandIcon: true,
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      },
      {
        id: 't2',
        type: 'tplBlock',
        position: { x: 200, y: 80 },
        data: {
          icon: AgentIcon,
          bgColor: '#802FFF',
          name: 'Intent Analyzer',
          subtitle: 'Classify intent',
          shape: 'agent',
          profile: { name: 'Nova', type: 'ai' },
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      },
      {
        id: 't3',
        type: 'tplBlock',
        position: { x: 400, y: 80 },
        data: {
          icon: ConditionalIcon,
          bgColor: '#FF972F',
          name: 'Needs Reply?',
          subtitle: 'Priority filter',
          shape: 'condition',
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      },
      {
        id: 't4',
        type: 'tplBlock',
        position: { x: 600, y: 80 },
        data: {
          icon: GmailIcon,
          bgColor: '#EA4335',
          name: 'Auto-Reply',
          subtitle: 'Draft & send',
          shape: 'tool',
          brandIcon: true,
          hasLeftAccent: true,
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      },
    ],
    edges: [
      {
        id: 'te1',
        source: 't1',
        target: 't2',
        type: 'tplEdge',
        style: edge,
        sourceHandle: 'source',
        targetHandle: 'target',
      },
      {
        id: 'te2',
        source: 't2',
        target: 't3',
        type: 'tplEdge',
        style: edge,
        sourceHandle: 'source',
        targetHandle: 'target',
      },
      {
        id: 'te3',
        source: 't3',
        target: 't4',
        type: 'tplEdge',
        style: purpleEdge,
        sourceHandle: 'source',
        targetHandle: 'target',
      },
    ],
  },
  {
    name: 'Competitive Intel Agent',
    description: 'Monitors competitors 24/7',
    nodes: [
      {
        id: 't1',
        type: 'tplBlock',
        position: { x: 0, y: 80 },
        data: {
          icon: StartIcon,
          bgColor: '#4A7A68',
          name: 'Scheduled Crawl',
          subtitle: 'Every 4 hours',
          shape: 'starter',
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      },
      {
        id: 't2',
        type: 'tplBlock',
        position: { x: 200, y: 80 },
        data: {
          icon: AgentIcon,
          bgColor: '#802FFF',
          name: 'Web Researcher',
          subtitle: 'Crawl & compare',
          shape: 'agent',
          profile: { name: 'Scout', type: 'ai' },
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      },
      {
        id: 't3',
        type: 'tplBlock',
        position: { x: 400, y: 80 },
        data: {
          icon: NotionIcon,
          bgColor: '#000000',
          name: 'Notion Report',
          subtitle: 'Intel dashboard',
          shape: 'tool',
          brandIcon: true,
          hasLeftAccent: true,
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      },
    ],
    edges: [
      {
        id: 'te1',
        source: 't1',
        target: 't2',
        type: 'tplEdge',
        style: edge,
        sourceHandle: 'source',
        targetHandle: 'target',
      },
      {
        id: 'te2',
        source: 't2',
        target: 't3',
        type: 'tplEdge',
        style: edge,
        sourceHandle: 'source',
        targetHandle: 'target',
      },
    ],
  },
  {
    name: 'Customer Onboarding',
    description: 'Personalized onboarding on autopilot',
    nodes: [
      {
        id: 't1',
        type: 'tplBlock',
        position: { x: 0, y: 80 },
        data: {
          icon: StripeIcon,
          bgColor: '#635BFF',
          name: 'Stripe Payment',
          subtitle: 'New subscription',
          shape: 'starter',
          brandIcon: true,
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      },
      {
        id: 't2',
        type: 'tplBlock',
        position: { x: 200, y: 80 },
        data: {
          icon: AgentIcon,
          bgColor: '#802FFF',
          name: 'Onboarding Agent',
          subtitle: 'Personalize plan',
          shape: 'agent',
          profile: { name: 'Sarah', type: 'human' },
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      },
      {
        id: 't3',
        type: 'tplBlock',
        position: { x: 400, y: 80 },
        data: {
          icon: GoogleCalendarIcon,
          bgColor: '#4285F4',
          name: 'Calendar Invite',
          subtitle: 'Schedule kickoff',
          shape: 'tool',
          brandIcon: true,
          hasLeftAccent: true,
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      },
    ],
    edges: [
      {
        id: 'te1',
        source: 't1',
        target: 't2',
        type: 'tplEdge',
        style: edge,
        sourceHandle: 'source',
        targetHandle: 'target',
      },
      {
        id: 'te2',
        source: 't2',
        target: 't3',
        type: 'tplEdge',
        style: edge,
        sourceHandle: 'source',
        targetHandle: 'target',
      },
    ],
  },
  {
    name: 'LinkedIn Lead Scraper',
    description: 'Finds and qualifies prospects',
    nodes: [
      {
        id: 't1',
        type: 'tplBlock',
        position: { x: 0, y: 80 },
        data: {
          icon: LinkedInIcon,
          bgColor: '#0A66C2',
          name: 'Profile Found',
          subtitle: 'LinkedIn webhook',
          shape: 'starter',
          brandIcon: true,
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      },
      {
        id: 't2',
        type: 'tplBlock',
        position: { x: 200, y: 80 },
        data: {
          icon: AgentIcon,
          bgColor: '#802FFF',
          name: 'Qualifier Agent',
          subtitle: 'Score & segment',
          shape: 'agent',
          profile: { name: 'Aria', type: 'ai' },
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      },
      {
        id: 't3',
        type: 'tplBlock',
        position: { x: 400, y: 80 },
        data: {
          icon: AirtableIcon,
          bgColor: '#18BFFF',
          name: 'Airtable CRM',
          subtitle: 'Pipeline entry',
          shape: 'tool',
          brandIcon: true,
          hasLeftAccent: true,
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      },
    ],
    edges: [
      {
        id: 'te1',
        source: 't1',
        target: 't2',
        type: 'tplEdge',
        style: edge,
        sourceHandle: 'source',
        targetHandle: 'target',
      },
      {
        id: 'te2',
        source: 't2',
        target: 't3',
        type: 'tplEdge',
        style: edge,
        sourceHandle: 'source',
        targetHandle: 'target',
      },
    ],
  },
  {
    name: 'Meeting Notes to Actions',
    description: 'Transcribes, summarizes, assigns',
    nodes: [
      {
        id: 't1',
        type: 'tplBlock',
        position: { x: 0, y: 80 },
        data: {
          icon: GoogleCalendarIcon,
          bgColor: '#4285F4',
          name: 'Meeting Ended',
          subtitle: 'Calendar trigger',
          shape: 'starter',
          brandIcon: true,
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      },
      {
        id: 't2',
        type: 'tplBlock',
        position: { x: 200, y: 80 },
        data: {
          icon: AgentIcon,
          bgColor: '#802FFF',
          name: 'Summarizer Agent',
          subtitle: 'Extract action items',
          shape: 'agent',
          profile: { name: 'Max', type: 'ai' },
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      },
      {
        id: 't3',
        type: 'tplBlock',
        position: { x: 400, y: 80 },
        data: {
          icon: SlackIcon,
          bgColor: '#4A154B',
          name: 'Slack Digest',
          subtitle: '#team-standup',
          shape: 'tool',
          brandIcon: true,
          hasLeftAccent: true,
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      },
    ],
    edges: [
      {
        id: 'te1',
        source: 't1',
        target: 't2',
        type: 'tplEdge',
        style: edge,
        sourceHandle: 'source',
        targetHandle: 'target',
      },
      {
        id: 'te2',
        source: 't2',
        target: 't3',
        type: 'tplEdge',
        style: edge,
        sourceHandle: 'source',
        targetHandle: 'target',
      },
    ],
  },
  {
    name: 'Invoice OCR Pipeline',
    description: 'Extracts, validates, stores invoices',
    nodes: [
      {
        id: 't1',
        type: 'tplBlock',
        position: { x: 0, y: 80 },
        data: {
          icon: StartIcon,
          bgColor: '#4A7A68',
          name: 'File Upload',
          subtitle: 'PDF endpoint',
          shape: 'starter',
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      },
      {
        id: 't2',
        type: 'tplBlock',
        position: { x: 200, y: 80 },
        data: {
          icon: AgentIcon,
          bgColor: '#802FFF',
          name: 'OCR Agent',
          subtitle: 'Extract fields',
          shape: 'agent',
          profile: { name: 'Fin', type: 'ai' },
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      },
      {
        id: 't3',
        type: 'tplBlock',
        position: { x: 400, y: 80 },
        data: {
          icon: ConditionalIcon,
          bgColor: '#FF972F',
          name: 'Validated?',
          subtitle: 'Check accuracy',
          shape: 'condition',
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      },
      {
        id: 't4',
        type: 'tplBlock',
        position: { x: 600, y: 80 },
        data: {
          icon: GoogleSheetsIcon,
          bgColor: '#0F9D58',
          name: 'Google Sheets',
          subtitle: 'Append row',
          shape: 'tool',
          brandIcon: true,
          hasLeftAccent: true,
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      },
    ],
    edges: [
      {
        id: 'te1',
        source: 't1',
        target: 't2',
        type: 'tplEdge',
        style: edge,
        sourceHandle: 'source',
        targetHandle: 'target',
      },
      {
        id: 'te2',
        source: 't2',
        target: 't3',
        type: 'tplEdge',
        style: edge,
        sourceHandle: 'source',
        targetHandle: 'target',
      },
      {
        id: 'te3',
        source: 't3',
        target: 't4',
        type: 'tplEdge',
        style: greenEdge,
        sourceHandle: 'source',
        targetHandle: 'target',
      },
    ],
  },
  {
    name: 'GitHub PR Reviewer',
    description: 'Reviews PRs and posts feedback',
    nodes: [
      {
        id: 't1',
        type: 'tplBlock',
        position: { x: 0, y: 80 },
        data: {
          icon: GithubIcon,
          bgColor: '#181717',
          name: 'PR Opened',
          subtitle: 'GitHub webhook',
          shape: 'starter',
          brandIcon: true,
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      },
      {
        id: 't2',
        type: 'tplBlock',
        position: { x: 200, y: 80 },
        data: {
          icon: AgentIcon,
          bgColor: '#802FFF',
          name: 'Review Agent',
          subtitle: 'Analyze code',
          shape: 'agent',
          profile: { name: 'Rex', type: 'ai' },
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      },
      {
        id: 't3',
        type: 'tplBlock',
        position: { x: 400, y: 80 },
        data: {
          icon: GithubIcon,
          bgColor: '#181717',
          name: 'GitHub Comment',
          subtitle: 'Post review',
          shape: 'tool',
          brandIcon: true,
          hasLeftAccent: true,
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      },
    ],
    edges: [
      {
        id: 'te1',
        source: 't1',
        target: 't2',
        type: 'tplEdge',
        style: edge,
        sourceHandle: 'source',
        targetHandle: 'target',
      },
      {
        id: 'te2',
        source: 't2',
        target: 't3',
        type: 'tplEdge',
        style: edge,
        sourceHandle: 'source',
        targetHandle: 'target',
      },
    ],
  },
]

function TemplateCanvas({ tpl }: { tpl: TemplateDef }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(tpl.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(tpl.edges)
  const { fitView } = useReactFlow()
  const { width = 0 } = useWindowSize()
  const isMobile = width > 0 && width < 640
  const isTablet = width >= 640 && width < 1024
  const fitPadding = isMobile ? 0.38 : isTablet ? 0.24 : 0.18
  const minZoom = isMobile ? 0.42 : isTablet ? 0.54 : 0.62

  // Sync nodes/edges when template changes
  useEffect(() => {
    setNodes(tpl.nodes)
    setEdges(tpl.edges)
    // Small delay for ReactFlow to process new nodes before fitting
    const t = setTimeout(() => fitView({ padding: fitPadding, duration: 300 }), 50)
    return () => clearTimeout(t)
  }, [tpl.name, tpl.nodes, tpl.edges, setNodes, setEdges, fitView, fitPadding])

  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={!isMobile}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        panOnScroll={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        preventScrolling={false}
        selectNodesOnDrag={false}
        fitView
        fitViewOptions={{ padding: fitPadding }}
        minZoom={minZoom}
        maxZoom={1.2}
        proOptions={{ hideAttribution: true }}
        className="!bg-transparent"
      />
      {/* Edge animation + node layering like hero-workflow */}
      <style jsx global>{`
        .react-flow__edge-path {
          animation: hero-dash 2s linear infinite;
        }
        .react-flow__handle {
          opacity: 1 !important;
          cursor: default !important;
        }
        .react-flow__node {
          cursor: grab !important;
        }
        .react-flow__node.dragging {
          cursor: grabbing !important;
        }
      `}</style>
    </>
  )
}

export default function Templates() {
  const [active, setActive] = useState(0)
  const tpl = tpls[active]
  const templateNodeMeta = tpl.nodes.map(
    (node) =>
      node.data as {
        brandIcon?: boolean
        profile?: { name: string; type: 'ai' | 'human' }
      }
  )
  const activeProfile = templateNodeMeta.find((node) => node.profile)?.profile
  const templateIndexLabel = `${String(active + 1).padStart(2, '0')}/${String(tpls.length).padStart(2, '0')}`

  return (
    <section className="community-ui-section gb-templates relative overflow-hidden bg-[#f4f5f7] py-24 dark:bg-transparent md:py-32 lg:py-40">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div
          className="absolute top-[8%] left-[8%] h-[260px] w-[260px] rounded-full blur-3xl opacity-[0.14] dark:opacity-[0.08]"
          style={{
            background: 'radial-gradient(circle, rgba(91,123,111,0.28) 0%, transparent 68%)',
          }}
        />
        <div
          className="absolute bottom-[10%] right-[6%] h-[300px] w-[300px] rounded-full blur-3xl opacity-[0.12] dark:opacity-[0.07]"
          style={{
            background: 'radial-gradient(circle, rgba(59,130,246,0.2) 0%, transparent 70%)',
          }}
        />
      </div>
      <div className="container mx-auto px-4 sm:px-5 md:px-6 relative z-10">
        <motion.div
          className="community-ui-section-head text-center mb-16 md:mb-20"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
        >
          <div className="mb-6 inline-flex odyssey-editorial-kicker">
            <span className="odyssey-editorial-dot" />
            <span className="font-tech text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-white/40">
              Templates
            </span>
            <span className="h-3.5 w-px bg-black/[0.07] dark:bg-white/[0.08]" />
            <span className="font-heading text-[13px] font-medium tracking-[-0.03em] text-[#4d6268] dark:text-[#b9c8cf]">
              Ready-made launches
            </span>
          </div>
          <h2 className="odyssey-display-title mx-auto mb-5 max-w-[10ch] text-[2.45rem] text-zinc-900 dark:text-white sm:text-[3rem] md:text-[3.8rem] lg:text-[4.8rem]">
            Ship your workflow{' '}
            <span className="odyssey-display-accent bg-linear-to-r from-[#5B7B6F] via-[#4A7A68] to-[#6B8F80] dark:from-[#6EDAB0] dark:via-[#5EC9A0] dark:to-[#4AB890] bg-clip-text text-transparent">
              in minutes
            </span>
          </h2>
          <p className="odyssey-section-copy mx-auto max-w-lg text-[15px] md:text-base">
            Pick a role, connect tools, deploy.
          </p>
        </motion.div>

        <div className="relative mx-auto max-w-[1220px]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-[12%] top-8 h-28 rounded-full blur-3xl opacity-80 dark:opacity-60"
            style={{
              background:
                'radial-gradient(circle, rgba(91,123,111,0.2) 0%, rgba(74,122,104,0.08) 42%, transparent 74%)',
            }}
          />

          <motion.div
            className="community-ui-shell community-ui-template-shell signal-accent-frame relative overflow-hidden rounded-[18px] border border-black/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(245,247,250,0.82)_32%,rgba(236,239,244,0.74)_100%)] shadow-[0_28px_90px_rgba(17,24,39,0.12)] dark:border-white/[0.08] dark:bg-[linear-gradient(180deg,rgba(20,21,26,0.96),rgba(14,15,19,0.94)_38%,rgba(10,11,14,0.98)_100%)] dark:shadow-[0_34px_100px_rgba(0,0,0,0.34)] sm:rounded-[22px]"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.5),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.08),transparent_24%,rgba(96,113,129,0.08)_100%)] dark:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_18%,rgba(0,0,0,0.16)_100%)]" />
            <div className="relative border-b border-black/[0.06] px-4 py-5 dark:border-white/[0.06] sm:px-6 lg:px-8">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <div className="signal-accent-chip inline-flex items-center gap-2 rounded-[10px] border px-3 py-1 dark:bg-white/[0.03]">
                    <span className="h-1.5 w-1.5 rounded-[2px] bg-[#dcfd38]" />
                    <span className="font-tech text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-white/40">
                      Template Studio
                    </span>
                  </div>

                  <h3 className="mt-4 font-heading text-[1.35rem] font-medium tracking-[-0.04em] text-zinc-900 dark:text-white sm:text-[1.65rem]">
                    {tpl.name}
                  </h3>
                  <p className="mt-2 max-w-xl font-body text-[13px] leading-[1.65] text-[#5f6670] dark:text-white/55 sm:text-[14px]">
                    {tpl.description}.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <span className="community-ui-template-meta inline-flex items-center rounded-[10px] border border-black/[0.06] bg-white/66 px-3 py-1.5 font-tech text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white/40">
                    Template {templateIndexLabel}
                  </span>
                  <span className="community-ui-template-meta inline-flex items-center rounded-[10px] border border-black/[0.06] bg-white/66 px-3 py-1.5 font-tech text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white/40">
                    {tpl.nodes.length} blocks
                  </span>
                  {activeProfile && (
                    <span className="community-ui-template-meta inline-flex items-center gap-1.5 rounded-[10px] border border-black/[0.06] bg-white/66 px-3 py-1.5 font-tech text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white/40">
                      {activeProfile.type === 'human' ? (
                        <User
                          className="h-3 w-3 text-amber-600 dark:text-amber-400"
                          strokeWidth={2.2}
                        />
                      ) : (
                        <Bot
                          className="h-3 w-3 text-violet-600 dark:text-violet-400"
                          strokeWidth={2.2}
                        />
                      )}
                      {activeProfile.name}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="relative grid lg:grid-cols-[300px_minmax(0,1fr)]">
              <aside className="relative border-b border-black/[0.05] dark:border-white/[0.05] lg:border-b-0 lg:border-r">
                <div className="border-b border-black/[0.05] px-4 py-4 dark:border-white/[0.05] sm:px-5">
                  <p className="font-tech text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-white/35">
                    Template list
                  </p>
                </div>

                <div
                  className="grid grid-cols-1 gap-1.5 p-2.5 sm:grid-cols-2 sm:p-3 lg:grid-cols-1 lg:p-4"
                  style={{ maskImage: 'none', WebkitMaskImage: 'none' }}
                >
                  {tpls.map((t, i) => (
                    <button
                      key={t.name}
                      onClick={() => setActive(i)}
                      className={cn(
                        'community-ui-template-item font-body relative flex w-full min-w-0 flex-col gap-1 rounded-[12px] border px-4 py-3.5 text-left transition-all duration-300 sm:min-w-[220px] lg:min-w-0',
                        active === i
                          ? 'silver-glass-chip border-[#74D4FF]/18 bg-white/78 shadow-[0_14px_30px_rgba(24,24,27,0.08)] dark:border-[#74D4FF]/18 dark:bg-white/[0.06] dark:shadow-[0_14px_30px_rgba(0,0,0,0.22)]'
                          : 'border-transparent bg-transparent hover:border-black/[0.05] hover:bg-white/46 dark:hover:border-white/[0.04] dark:hover:bg-white/[0.02]'
                      )}
                    >
                      {active === i && (
                        <motion.div
                          layoutId="tpl-bar"
                          className="absolute inset-y-3 left-0 w-[2px] rounded-full"
                          style={{ background: '#74D4FF' }}
                          transition={{ type: 'spring', bounce: 0.15, duration: 0.35 }}
                        />
                      )}

                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'font-tech text-[10px] font-semibold uppercase tracking-[0.14em]',
                            active === i
                              ? 'text-[#74D4FF] dark:text-[#BDEEFF]'
                              : 'text-zinc-400 dark:text-white/28'
                          )}
                        >
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <span
                          className={cn(
                            'font-heading text-[11px] leading-[1.2] tracking-[-0.01em] sm:text-[13px]',
                            active === i
                              ? 'font-medium text-zinc-800 dark:text-white/90'
                              : 'text-zinc-500 dark:text-white/[0.7]'
                          )}
                        >
                          {t.name}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </aside>

              <div className="relative p-3 sm:p-4 lg:p-6">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="font-tech text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-white/35">
                      Live preview
                    </p>
                    <p className="mt-2 max-w-[34rem] font-body text-[13px] leading-[1.6] text-[#6c727c] dark:text-white/46">
                      Switch templates to preview the flow.
                    </p>
                  </div>

                  <div className="community-ui-template-meta inline-flex items-center gap-2 rounded-[10px] border border-black/[0.06] bg-white/66 px-3 py-1.5 dark:border-white/[0.08] dark:bg-white/[0.03]">
                    <span
                      className="h-1.5 w-1.5 rounded-[2px] bg-emerald-400"
                      style={{ boxShadow: '0 0 6px rgba(52,211,153,0.4)' }}
                    />
                    <span className="font-tech text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-white/40">
                      Live canvas
                    </span>
                  </div>
                </div>

                <div className="community-ui-template-canvas relative overflow-hidden rounded-[14px] border border-black/[0.07] bg-[#15171c] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_22px_54px_rgba(15,23,42,0.18)] dark:border-white/[0.06] dark:bg-[#0f1116] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_28px_64px_rgba(0,0,0,0.28)] sm:rounded-[16px]">
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_34%),radial-gradient(circle_at_50%_100%,rgba(74,122,104,0.12),transparent_34%),linear-gradient(180deg,rgba(32,34,41,0.98),rgba(20,22,28,0.98))] dark:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_30%),radial-gradient(circle_at_50%_100%,rgba(74,122,104,0.1),transparent_32%),linear-gradient(180deg,rgba(18,19,24,0.98),rgba(10,11,15,0.99))]" />
                  <div
                    className="pointer-events-none absolute inset-0 opacity-[0.22]"
                    style={{
                      backgroundImage:
                        'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
                      backgroundSize: '26px 26px',
                    }}
                  />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-black/18 to-transparent" />

                  <div className="relative flex items-center justify-between border-b border-white/[0.08] px-4 py-3 sm:px-5">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="h-1.5 w-1.5 rounded-[2px] bg-[#dcfd38]"
                        style={{ boxShadow: '0 0 8px rgba(220,253,56,0.45)' }}
                      />
                      <span className="font-heading truncate text-[10px] font-semibold tracking-[-0.01em] text-white/68 sm:text-[12px]">
                        {tpl.name}
                      </span>
                    </div>
                    <span className="shrink-0 font-tech text-[8px] tracking-[0.12em] text-white/28 sm:text-[10px]">
                      {tpl.nodes.length} blocks
                    </span>
                  </div>

                  <div className="relative min-h-[320px] sm:min-h-[380px] lg:min-h-[470px]">
                    <ReactFlowProvider>
                      <div className="absolute inset-0">
                        <TemplateCanvas tpl={tpl} />
                      </div>
                    </ReactFlowProvider>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
