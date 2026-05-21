'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ConnectionLineType,
  Edge,
  EdgeTypes,
  Node,
  NodeTypes,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  Viewport,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  Bot,
  Check,
  Circle,
  Globe,
  Play,
  Rocket,
  Send,
  Shield,
  Smartphone,
  User,
  Zap,
} from 'lucide-react'
import {
  AgentIcon,
  ConditionalIcon,
  GmailIcon,
  GoogleCalendarIcon,
  HubspotIcon,
  OutlookIcon,
  SalesforceIcon,
  SlackIcon,
} from '@/components/icons'
import { APP_HOSTNAME } from '@/lib/config/app-urls'
import { type BlockType, HeroBlock, type ShapeType } from './hero-block'
import { HeroEdge } from './hero-edge'
import { useWindowSize } from './use-window-size'

const nodeTypesConfig: NodeTypes = { heroBlock: HeroBlock }
const edgeTypesConfig: EdgeTypes = { heroEdge: HeroEdge }

export type HeroWorkflowId = 'lead-enrichment' | 'support-triage' | 'meeting-ops' | 'crm-follow-up'

type Phase = 'workflow' | 'running' | 'building' | 'deployed'
type Message = { from: 'user' | 'bot'; text: string }
type IconComponent = React.ComponentType<{ className?: string; style?: React.CSSProperties }>

type HeroBlockData = {
  type: BlockType
  icon?: IconComponent
  bgColor?: string
  name?: string
  subtitle?: string
  shape?: ShapeType
  profile?: { name: string; type: 'ai' | 'human' }
  brandIcon?: boolean
  hasLeftAccent?: boolean
  runState?: 'idle' | 'running' | 'done'
}

type WorkflowPreview = {
  route: string
  agentName: string
  agentRole: string
  messages: Message[]
}

type WorkflowPreset = {
  id: HeroWorkflowId
  title: string
  desktopNodes: Node<HeroBlockData>[]
  desktopEdges: Edge[]
  runSequence: { nodeId: string; delay: number }[]
  preview: WorkflowPreview
}

const edge = { stroke: '#e2e8f0', strokeWidth: 1.5, strokeDasharray: '5,4' }
const branchA = { stroke: '#802FFF', strokeWidth: 1.5, strokeDasharray: '5,4', opacity: 0.5 }
const branchB = { stroke: '#28C43F', strokeWidth: 1.5, strokeDasharray: '5,4', opacity: 0.5 }

const desktopPositions = {
  n1: { x: 12, y: 116 },
  n2: { x: 206, y: 116 },
  n3: { x: 402, y: 116 },
  n4: { x: 602, y: 54 },
  n5: { x: 602, y: 178 },
} as const

const branchedRunSequence = [
  { nodeId: 'n1', delay: 0 },
  { nodeId: 'n2', delay: 800 },
  { nodeId: 'n3', delay: 1600 },
  { nodeId: 'n4', delay: 2300 },
  { nodeId: 'n5', delay: 2300 },
]

const makeNode = (id: keyof typeof desktopPositions, data: HeroBlockData): Node<HeroBlockData> => ({
  id,
  type: 'heroBlock',
  position: desktopPositions[id],
  data,
  sourcePosition: Position.Right,
  targetPosition: Position.Left,
})

const makeEdges = (): Edge[] => [
  {
    id: 'e1',
    source: 'n1',
    target: 'n2',
    sourceHandle: 'source',
    targetHandle: 'target',
    type: 'heroEdge',
    animated: true,
    style: edge,
  },
  {
    id: 'e2',
    source: 'n2',
    target: 'n3',
    sourceHandle: 'source',
    targetHandle: 'target',
    type: 'heroEdge',
    animated: true,
    style: edge,
  },
  {
    id: 'e3',
    source: 'n3',
    target: 'n4',
    sourceHandle: 'source',
    targetHandle: 'target',
    type: 'heroEdge',
    animated: true,
    style: branchA,
  },
  {
    id: 'e4',
    source: 'n3',
    target: 'n5',
    sourceHandle: 'source',
    targetHandle: 'target',
    type: 'heroEdge',
    animated: true,
    style: branchB,
  },
]

const cloneNodes = (nodes: Node<HeroBlockData>[]) =>
  nodes.map((node) => ({
    ...node,
    position: { ...node.position },
    data: {
      ...node.data,
      runState: 'idle' as const,
    },
  }))

const cloneEdges = (edges: Edge[]) =>
  edges.map((edgeItem) => ({
    ...edgeItem,
    style: edgeItem.style ? { ...edgeItem.style } : edgeItem.style,
  }))

const scaleNodesForTablet = (nodes: Node<HeroBlockData>[]) =>
  nodes.map((node) => ({
    ...node,
    position: {
      x: Math.round(node.position.x * 0.75),
      y: node.id === 'n4' || node.id === 'n5' ? node.position.y : 108,
    },
  }))

const stackNodesForMobile = (nodes: Node<HeroBlockData>[], width: number) => {
  const x = Math.max(12, width / 2 - 74)

  return nodes.map((node, index) => ({
    ...node,
    position: {
      x,
      y: 36 + index * 88,
    },
  }))
}

const workflowPresets: Record<HeroWorkflowId, WorkflowPreset> = {
  'lead-enrichment': {
    id: 'lead-enrichment',
    title: 'Lead Enrichment Workflow',
    desktopNodes: [
      makeNode('n1', {
        type: 'starter',
        icon: HubspotIcon,
        bgColor: '#FF7A59',
        name: 'New Lead',
        subtitle: 'HubSpot trigger',
        shape: 'starter',
        brandIcon: true,
      }),
      makeNode('n2', {
        type: 'agent',
        icon: AgentIcon,
        bgColor: '#802FFF',
        name: 'Research Agent',
        subtitle: 'Enrich company profile',
        shape: 'agent',
        profile: { name: 'Atlas', type: 'ai' },
      }),
      makeNode('n3', {
        type: 'condition',
        icon: ConditionalIcon,
        bgColor: '#FF972F',
        name: 'Fit Check',
        subtitle: 'Qualified lead?',
        shape: 'condition',
      }),
      makeNode('n4', {
        type: 'calendar',
        icon: SalesforceIcon,
        bgColor: '#00A1E0',
        name: 'CRM Sync',
        subtitle: 'Update account',
        shape: 'tool',
        brandIcon: true,
        hasLeftAccent: true,
      }),
      makeNode('n5', {
        type: 'reply',
        icon: SlackIcon,
        bgColor: '#4A154B',
        name: 'Sales Handoff',
        subtitle: 'Notify AE in Slack',
        shape: 'tool',
        brandIcon: true,
        hasLeftAccent: true,
      }),
    ],
    desktopEdges: makeEdges(),
    runSequence: branchedRunSequence,
    preview: {
      route: '/embedded/lead-enrichment',
      agentName: 'Research Agent',
      agentRole: 'Atlas · Lead qualification',
      messages: [
        {
          from: 'user',
          text: 'A new inbound lead from Acme just came in. Can you prep the account?',
        },
        {
          from: 'bot',
          text: "I enriched Acme's stack, funding, and buyer intent signals from HubSpot and public sources.",
        },
        {
          from: 'bot',
          text: 'The account is qualified, synced to Salesforce, and the assigned AE has been notified in Slack.',
        },
      ],
    },
  },
  'support-triage': {
    id: 'support-triage',
    title: 'Support Triage Workflow',
    desktopNodes: [
      makeNode('n1', {
        type: 'starter',
        icon: GmailIcon,
        bgColor: '#EA4335',
        name: 'Inbox Trigger',
        subtitle: 'Support mailbox',
        shape: 'starter',
        brandIcon: true,
      }),
      makeNode('n2', {
        type: 'agent',
        icon: AgentIcon,
        bgColor: '#802FFF',
        name: 'Support Agent',
        subtitle: 'Classify & draft',
        shape: 'agent',
        profile: { name: 'Sarah', type: 'human' },
      }),
      makeNode('n3', {
        type: 'condition',
        icon: ConditionalIcon,
        bgColor: '#FF972F',
        name: 'Priority Split',
        subtitle: 'Urgent issue?',
        shape: 'condition',
      }),
      makeNode('n4', {
        type: 'calendar',
        icon: SlackIcon,
        bgColor: '#4A154B',
        name: 'Escalate Team',
        subtitle: 'Slack handoff',
        shape: 'tool',
        brandIcon: true,
        hasLeftAccent: true,
      }),
      makeNode('n5', {
        type: 'reply',
        icon: GmailIcon,
        bgColor: '#EA4335',
        name: 'Auto-Reply',
        subtitle: 'Send update',
        shape: 'tool',
        brandIcon: true,
        hasLeftAccent: true,
      }),
    ],
    desktopEdges: makeEdges(),
    runSequence: branchedRunSequence,
    preview: {
      route: '/chat/support-triage',
      agentName: 'Support Agent',
      agentRole: 'Sarah · Customer Success',
      messages: [
        {
          from: 'user',
          text: 'Hi, I need to reschedule onboarding and I am still blocked on login setup.',
        },
        {
          from: 'bot',
          text: "I've classified the issue, drafted a reply, and escalated the login blocker to the support channel.",
        },
        {
          from: 'bot',
          text: 'Your onboarding has been rescheduled for Thursday at 2pm and the updated confirmation email is on the way.',
        },
      ],
    },
  },
  'meeting-ops': {
    id: 'meeting-ops',
    title: 'Meeting Ops Workflow',
    desktopNodes: [
      makeNode('n1', {
        type: 'starter',
        icon: OutlookIcon,
        bgColor: '#0078D4',
        name: 'Booking Request',
        subtitle: 'Calendar intake',
        shape: 'starter',
        brandIcon: true,
      }),
      makeNode('n2', {
        type: 'agent',
        icon: AgentIcon,
        bgColor: '#802FFF',
        name: 'Meeting Prep',
        subtitle: 'Build agenda',
        shape: 'agent',
        profile: { name: 'Atlas', type: 'ai' },
      }),
      makeNode('n3', {
        type: 'condition',
        icon: ConditionalIcon,
        bgColor: '#FF972F',
        name: 'Schedule Check',
        subtitle: 'Slot available?',
        shape: 'condition',
      }),
      makeNode('n4', {
        type: 'calendar',
        icon: GoogleCalendarIcon,
        bgColor: '#4285F4',
        name: 'Calendar Hold',
        subtitle: 'Create event',
        shape: 'tool',
        brandIcon: true,
        hasLeftAccent: true,
      }),
      makeNode('n5', {
        type: 'reply',
        icon: SlackIcon,
        bgColor: '#4A154B',
        name: 'Share Brief',
        subtitle: 'Post prep pack',
        shape: 'tool',
        brandIcon: true,
        hasLeftAccent: true,
      }),
    ],
    desktopEdges: makeEdges(),
    runSequence: branchedRunSequence,
    preview: {
      route: '/embedded/meeting-ops',
      agentName: 'Meeting Prep',
      agentRole: 'Atlas · Ops automation',
      messages: [
        {
          from: 'user',
          text: 'Please lock a slot for next week and prep a briefing for the intro call.',
        },
        {
          from: 'bot',
          text: 'I checked availability, generated a concise agenda, and created a proposed calendar hold.',
        },
        {
          from: 'bot',
          text: 'The prep brief is shared in Slack so the team can walk in with context before the meeting starts.',
        },
      ],
    },
  },
  'crm-follow-up': {
    id: 'crm-follow-up',
    title: 'CRM Follow-up Workflow',
    desktopNodes: [
      makeNode('n1', {
        type: 'starter',
        icon: SalesforceIcon,
        bgColor: '#00A1E0',
        name: 'Deal Updated',
        subtitle: 'CRM trigger',
        shape: 'starter',
        brandIcon: true,
      }),
      makeNode('n2', {
        type: 'agent',
        icon: AgentIcon,
        bgColor: '#802FFF',
        name: 'Follow-up Agent',
        subtitle: 'Draft outreach',
        shape: 'agent',
        profile: { name: 'Atlas', type: 'ai' },
      }),
      makeNode('n3', {
        type: 'condition',
        icon: ConditionalIcon,
        bgColor: '#FF972F',
        name: 'Engagement Check',
        subtitle: 'Needs follow-up?',
        shape: 'condition',
      }),
      makeNode('n4', {
        type: 'calendar',
        icon: GmailIcon,
        bgColor: '#EA4335',
        name: 'Send Sequence',
        subtitle: 'Email touchpoint',
        shape: 'tool',
        brandIcon: true,
        hasLeftAccent: true,
      }),
      makeNode('n5', {
        type: 'reply',
        icon: SlackIcon,
        bgColor: '#4A154B',
        name: 'Owner Notify',
        subtitle: 'Slack summary',
        shape: 'tool',
        brandIcon: true,
        hasLeftAccent: true,
      }),
    ],
    desktopEdges: makeEdges(),
    runSequence: branchedRunSequence,
    preview: {
      route: '/chat/crm-follow-up',
      agentName: 'Follow-up Agent',
      agentRole: 'Atlas · Revenue ops',
      messages: [
        {
          from: 'user',
          text: 'A deal just moved stages. Can you trigger the next follow-up and keep the owner informed?',
        },
        {
          from: 'bot',
          text: 'I drafted the next outreach based on recent CRM activity and queued the email sequence automatically.',
        },
        {
          from: 'bot',
          text: 'The account owner has a Slack summary with recommended next steps and current engagement status.',
        },
      ],
    },
  },
}

// ── Build steps for the ultra-modern deploy UI ──
const buildSteps = [
  { label: 'Validating workflow', icon: Shield, duration: 600 },
  { label: 'Building containers', icon: Zap, duration: 800 },
  { label: 'Running tests', icon: Play, duration: 700 },
  { label: 'Deploying to edge', icon: Rocket, duration: 900 },
]

// ── Ultra-modern Build Overlay ──
function BuildOverlay({ onComplete }: { onComplete: () => void }) {
  const [currentStep, setCurrentStep] = useState(0)
  const [stepProgress, setStepProgress] = useState(0)

  useEffect(() => {
    let stepIdx = 0
    const timers: ReturnType<typeof setTimeout>[] = []

    const runStep = () => {
      if (stepIdx >= buildSteps.length) {
        timers.push(setTimeout(onComplete, 400))
        return
      }
      setCurrentStep(stepIdx)
      setStepProgress(0)

      // Animate progress in 3 stages
      const dur = buildSteps[stepIdx].duration
      timers.push(setTimeout(() => setStepProgress(40), dur * 0.15))
      timers.push(setTimeout(() => setStepProgress(75), dur * 0.45))
      timers.push(setTimeout(() => setStepProgress(100), dur * 0.85))
      timers.push(
        setTimeout(() => {
          stepIdx++
          runStep()
        }, dur)
      )
    }

    timers.push(setTimeout(runStep, 300))
    return () => timers.forEach(clearTimeout)
  }, [onComplete])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/40"
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="w-[260px] border border-white/[0.08] bg-[#17181c] shadow-[0_16px_40px_rgba(0,0,0,0.28)]"
      >
        {/* Header */}
        <div className="border-b border-white/[0.06] px-4 pt-4 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center bg-gradient-to-br from-slate-700 to-slate-900">
              <Rocket className="w-2.5 h-2.5 text-white" />
            </div>
            <span className="text-[11px] font-semibold text-white">Deploying Workflow</span>
          </div>
        </div>

        {/* Steps */}
        <div className="px-4 py-3 space-y-2.5">
          {buildSteps.map((step, i) => {
            const StepIcon = step.icon
            const isDone = i < currentStep
            const isActive = i === currentStep

            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.08 }}
                className="flex items-center gap-2.5"
              >
                {/* Step indicator */}
                <div className="relative flex-shrink-0">
                  {isDone ? (
                    <motion.div
                      initial={{ scale: 0.5 }}
                      animate={{ scale: 1 }}
                      className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center"
                    >
                      <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                    </motion.div>
                  ) : isActive ? (
                    <div className="w-4 h-4 rounded-full border-2 border-slate-800 dark:border-white flex items-center justify-center">
                      <motion.div
                        className="w-1.5 h-1.5 rounded-full bg-slate-800 dark:bg-white"
                        animate={{ scale: [1, 0.6, 1] }}
                        transition={{ duration: 0.8, repeat: Infinity }}
                      />
                    </div>
                  ) : (
                    <Circle className="w-4 h-4 text-zinc-200 dark:text-white/15" strokeWidth={2} />
                  )}
                </div>

                {/* Label + progress */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <StepIcon
                      className={`w-3 h-3 ${isDone ? 'text-emerald-500' : isActive ? 'text-zinc-700 dark:text-white' : 'text-zinc-300 dark:text-white/15'}`}
                    />
                    <span
                      className={`text-[10px] font-medium ${isDone ? 'text-emerald-600 dark:text-emerald-400' : isActive ? 'text-zinc-700 dark:text-white' : 'text-zinc-400 dark:text-white/25'}`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {isActive && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-1"
                    >
                      <div className="h-[3px] bg-slate-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-slate-700 to-slate-900 dark:from-white/60 dark:to-white rounded-full"
                          animate={{ width: `${stepProgress}%` }}
                          transition={{ duration: 0.2, ease: 'easeOut' }}
                        />
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Timing */}
                {isDone && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-[8px] text-emerald-500 font-mono"
                  >
                    {(step.duration / 1000).toFixed(1)}s
                  </motion.span>
                )}
              </motion.div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="border-t border-white/[0.06] bg-[#141519] px-4 py-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-zinc-400 dark:text-white/30 font-mono">
              {currentStep < buildSteps.length
                ? `Step ${currentStep + 1} of ${buildSteps.length}`
                : 'Complete'}
            </span>
            <div className="flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[8px] text-zinc-400 dark:text-white/25">us-east-1</span>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Execution Panel (compact bottom-left card) ──
function RunPanel({
  activeNode,
  completedNodes,
  runNodes,
}: {
  activeNode: string | null
  completedNodes: string[]
  runNodes: { id: string; label: string; color: string; dataLabel: string }[]
}) {
  const doneCount = completedNodes.length
  const total = runNodes.length

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="absolute bottom-2.5 left-2.5 z-50 pointer-events-none"
    >
      <div className="w-[175px] border border-white/[0.08] bg-[#17181c] shadow-[0_16px_34px_rgba(0,0,0,0.24)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-2.5 py-1.5">
          <div className="flex items-center gap-1.5">
            <motion.div
              className="flex h-4 w-4 items-center justify-center bg-gradient-to-br from-purple-500 to-purple-600"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <Play className="w-2 h-2 text-white fill-white" />
            </motion.div>
            <span className="text-[9px] font-semibold text-zinc-700 dark:text-white">
              Execution
            </span>
          </div>
          <span className="text-[8px] font-mono text-zinc-400 dark:text-white/30">
            {doneCount}/{total}
          </span>
        </div>

        {/* Steps */}
        <div className="px-2.5 py-2 space-y-0.5">
          {runNodes.map((node, i) => {
            const isDone = completedNodes.includes(node.id)
            const isActive = activeNode === node.id

            return (
              <motion.div
                key={node.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <div className="flex items-center gap-1.5 py-[3px]">
                  {/* Indicator */}
                  {isDone ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-3 h-3 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: node.color }}
                    >
                      <Check className="w-2 h-2 text-white" strokeWidth={3} />
                    </motion.div>
                  ) : isActive ? (
                    <div className="w-3 h-3 flex-shrink-0 relative">
                      <motion.div
                        className="absolute inset-0 rounded-full"
                        style={{ border: `1.5px solid ${node.color}` }}
                        animate={{ scale: [1, 1.3, 1], opacity: [1, 0.3, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                      />
                      <div
                        className="absolute inset-[3px] rounded-full"
                        style={{ background: node.color }}
                      />
                    </div>
                  ) : (
                    <div className="w-3 h-3 rounded-full border border-slate-200 dark:border-white/15 flex-shrink-0" />
                  )}

                  {/* Label */}
                  <span
                    className={`text-[8px] leading-none truncate ${
                      isDone
                        ? 'text-zinc-600 dark:text-white/60 font-medium'
                        : isActive
                          ? 'text-zinc-800 dark:text-white font-semibold'
                          : 'text-zinc-300 dark:text-white/15'
                    }`}
                  >
                    {node.label}
                  </span>
                </div>

                {/* Data flow label — only for active node */}
                {isActive && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.15 }}
                    className="ml-[18px] mb-0.5"
                  >
                    <span
                      className="text-[7px] font-mono leading-none"
                      style={{ color: node.color }}
                    >
                      {node.dataLabel}
                    </span>
                  </motion.div>
                )}
              </motion.div>
            )
          })}
        </div>

        {/* Progress bar */}
        <div className="px-2.5 pb-2">
          <div className="h-[2px] overflow-hidden bg-white/[0.06]">
            <motion.div
              className="h-full bg-gradient-to-r from-purple-500 to-emerald-500"
              animate={{ width: `${(doneCount / total) * 100}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ── Deployed Chat Preview ──
function DeployedPreview({ onBack, preview }: { onBack: () => void; preview: WorkflowPreview }) {
  const [tab, setTab] = useState<'web' | 'mobile'>('web')
  const [messageReveal, setMessageReveal] = useState(() => ({
    messages: preview.messages,
    count: 0,
  }))
  const msgCount = messageReveal.messages === preview.messages ? messageReveal.count : 0

  useEffect(() => {
    const timers = preview.messages.map((_, i) =>
      setTimeout(
        () => setMessageReveal({ messages: preview.messages, count: i + 1 }),
        500 + i * 900
      )
    )
    return () => timers.forEach(clearTimeout)
  }, [preview.messages])

  const Msg = ({ msg }: { msg: Message }) => (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start gap-1.5'}`}
    >
      {msg.from === 'bot' && (
        <div className="w-4 h-4 rounded-full bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bot className="w-2.5 h-2.5 text-purple-500" />
        </div>
      )}
      <div
        className={`max-w-[80%] px-2.5 py-1.5 text-[9px] leading-[1.5] ${
          msg.from === 'user'
            ? 'silver-glass-chip text-zinc-800 dark:text-white rounded-xl rounded-br-sm'
            : 'silver-glass-pane text-zinc-600 dark:text-white/50 rounded-xl rounded-bl-sm'
        }`}
      >
        {msg.text}
      </div>
    </motion.div>
  )

  const MobileMsg = ({ msg }: { msg: Message }) => (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[88%] px-2 py-1 text-[7px] leading-[1.4] ${
          msg.from === 'user'
            ? 'silver-glass-chip text-zinc-800 dark:text-white rounded-lg rounded-br-sm'
            : 'silver-glass-pane text-zinc-600 dark:text-white/50 rounded-lg rounded-bl-sm'
        }`}
      >
        {msg.text}
      </div>
    </motion.div>
  )

  return (
    <div className="absolute inset-0 flex flex-col bg-white dark:bg-slate-950">
      {/* Controls */}
      <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#17181c] px-3 py-1.5">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-[10px] text-zinc-400 dark:text-white/30 hover:text-zinc-600 dark:hover:text-white/60 transition-colors"
        >
          <ArrowLeft className="w-3 h-3" />
          <span className="font-medium">Editor</span>
        </button>

        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span className="text-[9px] font-medium text-emerald-600 dark:text-emerald-400">
            Live
          </span>
        </div>

        <div className="flex border border-white/[0.08] bg-[#1d1f24] p-0.5">
          {(['web', 'mobile'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-1 px-2 py-0.5 text-[9px] font-medium transition-all ${
                tab === t ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-400 dark:text-white/30'
              }`}
            >
              {t === 'web' ? (
                <Globe className="w-2.5 h-2.5" />
              ) : (
                <Smartphone className="w-2.5 h-2.5" />
              )}
              {t === 'web' ? 'Web' : 'Mobile'}
            </button>
          ))}
        </div>
      </div>

      {/* Preview */}
      <div className="flex-1 flex items-center justify-center p-3 bg-slate-50/50 dark:bg-white/[0.01]">
        <AnimatePresence mode="wait">
          {tab === 'web' ? (
            <motion.div
              key="web"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="flex w-full max-w-[360px] flex-col border border-white/[0.08] bg-[#17181c] shadow-[0_12px_30px_rgba(0,0,0,0.24)]"
              style={{ height: 'min(295px, 100%)' }}
            >
              {/* Browser */}
              <div className="flex items-center gap-2 border-b border-white/[0.06] bg-[#141519] px-3 py-1.5">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-white/[0.06]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-white/[0.06]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-white/[0.06]" />
                </div>
                <div className="flex-1 border border-white/[0.06] bg-[#1d1f24] px-2 py-0.5 text-[7px] text-zinc-400 dark:text-white/30 font-mono truncate">
                  {`app.${APP_HOSTNAME}${preview.route}`}
                </div>
              </div>

              {/* Header with agent profile */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 dark:border-white/[0.06]">
                <div className="relative">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                    <Bot className="w-3 h-3 text-white" />
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-amber-100 border border-white flex items-center justify-center">
                    <User className="w-1.5 h-1.5 text-amber-600" />
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-medium text-zinc-700 dark:text-white">
                    {preview.agentName}
                  </p>
                  <p className="text-[7px] text-zinc-400 dark:text-white/30">{preview.agentRole}</p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 px-3 py-2.5 space-y-2.5 overflow-hidden">
                {preview.messages.slice(0, msgCount).map((msg, i) => (
                  <Msg key={i} msg={msg} />
                ))}
              </div>

              {/* Input */}
              <div className="px-3 py-2 border-t border-slate-100 dark:border-white/[0.06]">
                <div className="flex items-center gap-2 border border-white/[0.06] bg-[#1d1f24] px-2.5 py-1.5">
                  <span className="text-[8px] text-zinc-400 dark:text-white/25 flex-1">
                    Type a message...
                  </span>
                  <Send className="w-3 h-3 text-zinc-300 dark:text-white/15" />
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="mobile"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="silver-glass-pane w-[150px] rounded-[20px] border-[2.5px] shadow-sm flex flex-col"
              style={{ height: 'min(285px, 100%)' }}
            >
              {/* Notch */}
              <div className="flex justify-center pt-1.5 pb-0.5">
                <div className="w-10 h-1 rounded-full bg-slate-200 dark:bg-white/[0.08]" />
              </div>

              {/* Mobile header */}
              <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-slate-100 dark:border-white/[0.06]">
                <div className="relative">
                  <div className="w-4 h-4 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                    <Bot className="w-2 h-2 text-white" />
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-100 border border-white flex items-center justify-center">
                    <User className="w-1 h-1 text-amber-600" />
                  </div>
                </div>
                <div>
                  <p className="text-[8px] font-medium text-zinc-700 dark:text-white">
                    {preview.agentName}
                  </p>
                  <p className="text-[6px] text-zinc-400 dark:text-white/30">{preview.agentRole}</p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 px-2 py-1.5 space-y-1.5 overflow-hidden">
                {preview.messages.slice(0, msgCount).map((msg, i) => (
                  <MobileMsg key={i} msg={msg} />
                ))}
              </div>

              {/* Input */}
              <div className="px-2 py-1.5 border-t border-slate-100 dark:border-white/[0.06]">
                <div className="silver-glass-pane flex items-center gap-1 rounded-full px-2 py-1">
                  <span className="text-[6px] text-zinc-400 dark:text-white/25 flex-1">
                    Message...
                  </span>
                  <Send className="w-2.5 h-2.5 text-zinc-300 dark:text-white/15" />
                </div>
              </div>

              {/* Home */}
              <div className="flex justify-center py-1">
                <div className="w-8 h-0.5 rounded-full bg-slate-200 dark:bg-white/[0.08]" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ── Main ──
export function HeroWorkflow({
  activeWorkflowId = 'lead-enrichment',
}: {
  activeWorkflowId?: HeroWorkflowId
}) {
  const { width = 0, height = 0 } = useWindowSize()
  const isMobile = width < 768
  const isTablet = width >= 768 && width < 1024
  const activePreset = workflowPresets[activeWorkflowId]

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const { fitView, getViewport, setViewport } = useReactFlow()
  const hasFitView = useRef(false)

  const [phase, setPhase] = useState<Phase>('workflow')
  const [activeRunNode, setActiveRunNode] = useState<string | null>(null)
  const [completedRunNodes, setCompletedRunNodes] = useState<string[]>([])
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const nodeTypes = useMemo(() => nodeTypesConfig, [])
  const edgeTypes = useMemo(() => edgeTypesConfig, [])
  const defaultViewport: Viewport = useMemo(() => ({ x: 0, y: 0, zoom: 0.72 }), [])
  const clear = useCallback(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }, [])
  const runNodes = useMemo(
    () =>
      activePreset.runSequence.map(({ nodeId }) => {
        const node = activePreset.desktopNodes.find((item) => item.id === nodeId)
        const data = node?.data

        return {
          id: nodeId,
          label: data?.name ?? 'Workflow Step',
          color: data?.bgColor ?? '#802FFF',
          dataLabel: data?.subtitle ?? 'Running action',
        }
      }),
    [activePreset]
  )

  useEffect(() => {
    clear()
    const resetTimer = setTimeout(() => {
      setPhase('workflow')
      setActiveRunNode(null)
      setCompletedRunNodes([])

      if (isMobile) {
        setNodes(cloneNodes(stackNodesForMobile(activePreset.desktopNodes, width)))
      } else if (isTablet) {
        setNodes(cloneNodes(scaleNodesForTablet(activePreset.desktopNodes)))
      } else {
        setNodes(cloneNodes(activePreset.desktopNodes))
      }

      setEdges(cloneEdges(activePreset.desktopEdges))
      hasFitView.current = false
    }, 0)

    return () => clearTimeout(resetTimer)
  }, [activePreset, clear, height, isMobile, isTablet, setEdges, setNodes, width])

  useEffect(() => {
    if (nodes.length && !hasFitView.current) {
      const frameCanvas = async () => {
        await fitView({ padding: isMobile ? 0.24 : isTablet ? 0.11 : 0.08, duration: 350 })
        const viewport = getViewport()
        const upwardShift = isMobile ? 10 : isTablet ? 18 : 26
        setViewport({ ...viewport, y: viewport.y - upwardShift }, { duration: 220 })
        hasFitView.current = true
      }

      void frameCanvas()
    }
  }, [nodes, edges, fitView, getViewport, isMobile, isTablet, setViewport])

  // Update node run states
  const setNodeRunState = useCallback(
    (nodeId: string, runState: 'idle' | 'running' | 'done') => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, runState } } : n))
      )
    },
    [setNodes]
  )

  const resetAllRunStates = useCallback(() => {
    setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, runState: 'idle' } })))
    setActiveRunNode(null)
    setCompletedRunNodes([])
  }, [setNodes])

  // ── Run workflow ──
  const handleRun = useCallback(() => {
    if (phase !== 'workflow') return
    clear()
    resetAllRunStates()
    setPhase('running')

    // Sequentially activate each node
    activePreset.runSequence.forEach(({ nodeId, delay }) => {
      // Start running
      timers.current.push(
        setTimeout(() => {
          setNodeRunState(nodeId, 'running')
          setActiveRunNode(nodeId)
        }, delay)
      )

      // Complete after processing time
      const doneDelay = delay + 600
      timers.current.push(
        setTimeout(() => {
          setNodeRunState(nodeId, 'done')
          setCompletedRunNodes((prev) => [...prev, nodeId])
        }, doneDelay)
      )
    })

    // Finish run — back to workflow after all done
    const totalDuration =
      activePreset.runSequence.reduce((max, step) => Math.max(max, step.delay), 0) + 600 + 500
    timers.current.push(
      setTimeout(() => {
        setPhase('workflow')
        setActiveRunNode(null)
        // Keep done states for 2s then reset
        timers.current.push(setTimeout(() => resetAllRunStates(), 2000))
      }, totalDuration)
    )
  }, [activePreset, phase, clear, resetAllRunStates, setNodeRunState])

  // ── Deploy ──
  const handleDeploy = useCallback(() => {
    if (phase !== 'workflow') return
    clear()
    setPhase('building')
  }, [phase, clear])

  const handleBuildComplete = useCallback(() => {
    setPhase('deployed')
  }, [])

  const handleBack = useCallback(() => {
    clear()
    setPhase('workflow')
    resetAllRunStates()
  }, [clear, resetAllRunStates])

  useEffect(() => clear, [clear])

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Canvas — always mounted so viewport is preserved */}
      <div
        className="absolute inset-0 pointer-events-auto transition-opacity duration-300"
        style={{
          opacity: phase === 'deployed' ? 0 : 1,
          pointerEvents: phase === 'deployed' ? 'none' : 'auto',
        }}
      >
        <style jsx global>{`
          .react-flow__edge-path {
            animation: hero-dash 2s linear infinite;
          }
          :is(.dark) .react-flow__edge-path {
            stroke: rgba(255, 255, 255, 0.12) !important;
          }
          @keyframes hero-dash {
            to {
              stroke-dashoffset: -10;
            }
          }
          .react-flow__handle {
            opacity: 1 !important;
            z-index: 1000 !important;
            cursor: default !important;
          }
          .react-flow__edge {
            z-index: 5 !important;
          }
          .react-flow__node {
            z-index: 10 !important;
          }
        `}</style>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={{ type: 'heroEdge', animated: true }}
          connectionLineType={ConnectionLineType.SmoothStep}
          minZoom={isMobile ? 0.38 : 0.45}
          maxZoom={1.2}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={phase === 'workflow' && !isMobile}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnScroll={false}
          zoomOnScroll={!isMobile}
          zoomOnPinch={!isMobile}
          zoomOnDoubleClick={false}
          panOnDrag={phase === 'workflow' && !isMobile}
          selectionOnDrag={false}
          preventScrolling={true}
          defaultViewport={defaultViewport}
        />
      </div>

      {/* Execution panel */}
      <AnimatePresence>
        {phase === 'running' && (
          <RunPanel
            activeNode={activeRunNode}
            completedNodes={completedRunNodes}
            runNodes={runNodes}
          />
        )}
      </AnimatePresence>

      {/* Build overlay */}
      <AnimatePresence>
        {phase === 'building' && <BuildOverlay onComplete={handleBuildComplete} />}
      </AnimatePresence>

      {/* Deployed */}
      <AnimatePresence>
        {phase === 'deployed' && (
          <motion.div
            className="absolute inset-0 pointer-events-auto z-30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <DeployedPreview onBack={handleBack} preview={activePreset.preview} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action buttons */}
      {phase === 'workflow' && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.3 }}
          className="absolute top-3 right-3 z-50 flex items-start gap-3 pointer-events-none"
        >
          <div className="pointer-events-auto flex items-center gap-1.5 border border-white/[0.08] bg-[#23252b] p-1.5 shadow-[0_12px_26px_rgba(0,0,0,0.22)] dark:border-white/[0.08] dark:bg-[#23252b]">
            {/* Run */}
            <button
              onClick={handleRun}
              className="flex items-center gap-1.5 border border-white/[0.08] bg-white px-2.5 py-1.5 text-[10px] font-medium text-zinc-900 transition-colors duration-150 hover:bg-zinc-100"
            >
              <Play className="w-3 h-3 fill-current" />
              Run
            </button>

            {/* Deploy */}
            <button
              onClick={handleDeploy}
              className="flex items-center gap-1.5 border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-[10px] font-medium text-white/82 transition-colors duration-150 hover:bg-white/[0.08]"
            >
              <Rocket className="w-3 h-3" />
              Deploy
            </button>
          </div>
        </motion.div>
      )}
    </div>
  )
}

export default function HeroWorkflowProvider({
  activeWorkflowId = 'lead-enrichment',
}: {
  activeWorkflowId?: HeroWorkflowId
}) {
  return (
    <ReactFlowProvider>
      <HeroWorkflow activeWorkflowId={activeWorkflowId} />
    </ReactFlowProvider>
  )
}
