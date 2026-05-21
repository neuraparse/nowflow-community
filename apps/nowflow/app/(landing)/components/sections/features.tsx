'use client'

import React, { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CodeXml, ShieldCheck, Users } from 'lucide-react'
import { AgentIcon, ConnectIcon, DatabaseIcon } from '@/components/icons'
import { cn } from '@/lib/utils'

// --- Types ---
type Feature = {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>> | typeof CodeXml
  color: string
  accent: string
  name: string
  feature: {
    icon: React.ReactNode
    title: string
    color: string
    bullets: string[]
  }
}
type FeaturesArray = Feature[]

// --- Features as Array ---
const features: FeaturesArray = [
  {
    icon: Users,
    color: 'bg-purple-500/5',
    accent: '#74D4FF',
    name: 'Agent Workflow Steps',
    feature: {
      icon: (
        <div
          className="w-12 h-12 flex items-center justify-center rounded-2xl relative overflow-hidden"
          style={{
            background:
              'linear-gradient(145deg, rgba(116,212,255,0.18) 0%, rgba(116,212,255,0.05) 100%)',
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,0.08), 0 0 0 1px rgba(116,212,255,0.12), 0 8px 20px rgba(116,212,255,0.08)',
          }}
        >
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{ background: 'linear-gradient(135deg, white 0%, transparent 50%)' }}
          />
          <AgentIcon className="w-5 h-5 relative" style={{ color: '#BDEEFF' }} />
        </div>
      ),
      title: 'Community Agent Steps',
      color: 'bg-purple-500/5',
      bullets: [
        'Build AI and human steps directly into Community workflows',
        'Bring your own model keys and keep local runtime defaults under your control',
        'Use templates and workspace conventions to keep agent behavior easy to inspect',
      ],
    },
  },
  {
    icon: ShieldCheck,
    color: 'bg-amber-500/5',
    accent: '#F9C65C',
    name: 'Human-in-the-Loop',
    feature: {
      icon: (
        <div
          className="w-12 h-12 flex items-center justify-center rounded-2xl relative overflow-hidden"
          style={{
            background:
              'linear-gradient(145deg, rgba(249,198,92,0.18) 0%, rgba(249,198,92,0.05) 100%)',
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,0.08), 0 0 0 1px rgba(249,198,92,0.12), 0 8px 20px rgba(249,198,92,0.08)',
          }}
        >
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{ background: 'linear-gradient(135deg, white 0%, transparent 50%)' }}
          />
          <ShieldCheck className="w-5 h-5 relative" style={{ color: '#FBE18C' }} />
        </div>
      ),
      title: 'Human-in-the-Loop',
      color: 'bg-amber-500/5',
      bullets: [
        'Pause workflows for human approval via in-app notifications, email, Slack, or Discord',
        'Review routing and reassignment controls for long-running approvals',
        'Send & Wait blocks for gathering human input mid-workflow with smart timeouts',
      ],
    },
  },
  {
    icon: ConnectIcon,
    color: 'bg-blue-500/5',
    accent: '#DCFD38',
    name: 'Data Tables & Deploy',
    feature: {
      icon: (
        <div
          className="w-12 h-12 flex items-center justify-center rounded-2xl relative overflow-hidden"
          style={{
            background:
              'linear-gradient(145deg, rgba(220,253,56,0.16) 0%, rgba(220,253,56,0.05) 100%)',
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,0.08), 0 0 0 1px rgba(220,253,56,0.12), 0 8px 20px rgba(220,253,56,0.08)',
          }}
        >
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{ background: 'linear-gradient(135deg, white 0%, transparent 50%)' }}
          />
          <DatabaseIcon className="w-5 h-5 relative" style={{ color: '#EDFFA1' }} />
        </div>
      ),
      title: 'Data Tables & Deployment',
      color: 'bg-blue-500/5',
      bullets: [
        'Built-in database with query, filter, bulk ops, smart insert, and auto-schema detection',
        'Deploy workflows as APIs, chat interfaces, embedded UIs, or dynamic forms',
        'Extensible integrations for common APIs, provider keys, and team-specific systems',
      ],
    },
  },
]

function ModernWorkflowPreview({ selectedFeature }: { selectedFeature: Feature }) {
  const getFeaturePreview = () => {
    switch (selectedFeature.name) {
      case 'Agent Workflow Steps': {
        const agents = [
          {
            name: 'Sarah Kim',
            type: 'Human',
            role: 'Customer Success Lead',
            initials: 'SK',
            online: true,
            tasks: 1284,
            successRate: 97,
          },
          {
            name: 'Atlas v2.1',
            type: 'AI',
            role: 'Research & RAG Agent',
            initials: 'AT',
            online: true,
            tasks: 12847,
            successRate: 99,
          },
          {
            name: 'Nova',
            type: 'Hybrid',
            role: 'Sales Outreach',
            initials: 'NV',
            online: false,
            tasks: 3891,
            successRate: 94,
          },
        ]

        return (
          <div className="flex w-full items-center justify-center">
            <div className="bg-black/[0.02] dark:bg-white/[0.05] backdrop-blur-md border border-black/[0.05] dark:border-white/[0.06] rounded-[20px] sm:rounded-[22px] overflow-hidden w-full max-w-[31.5rem]">
              <div className="flex items-center justify-between px-3.5 sm:px-5 py-3 sm:py-3.5 border-b border-black/[0.04] dark:border-white/[0.04] gap-2">
                <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                  <div
                    className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      background:
                        'linear-gradient(135deg, rgba(168,85,247,0.15), rgba(168,85,247,0.04))',
                      boxShadow: '0 0 0 1px rgba(168,85,247,0.1)',
                    }}
                  >
                    <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-purple-500 dark:text-[#C4B5FD]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-zinc-800 dark:text-white font-semibold font-sans tracking-[-0.02em] text-[12px] sm:text-[14px] truncate">
                      Team Agents
                    </h3>
                    <p className="text-zinc-400 dark:text-white/[0.65] text-[9px] sm:text-[10px] mt-0.5 tracking-[0.04em] font-sans truncate">
                      3 profiles · 2 online
                    </p>
                  </div>
                </div>
                <span
                  className="text-[7px] sm:text-[8px] font-semibold px-1.5 sm:px-2 py-1 rounded-md uppercase tracking-wider font-sans shrink-0"
                  style={{ background: 'rgba(168,85,247,0.06)', color: 'rgba(168,85,247,0.6)' }}
                >
                  + Add
                </span>
              </div>
              <div>
                {agents.map((a, idx) => (
                  <div
                    key={a.name}
                    className={cn(
                      'flex items-center gap-2.5 sm:gap-3.5 px-3.5 sm:px-5 py-3 sm:py-3.5',
                      idx < agents.length - 1 &&
                        'border-b border-black/[0.03] dark:border-white/[0.03]'
                    )}
                  >
                    <div className="relative flex-shrink-0">
                      <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-zinc-100 dark:bg-white/[0.07] border border-black/[0.04] dark:border-white/[0.06] flex items-center justify-center">
                        <span className="text-[9px] sm:text-[10px] font-bold text-zinc-400 dark:text-white/[0.65] tracking-[0.08em] font-sans">
                          {a.initials}
                        </span>
                      </div>
                      <span
                        className={cn(
                          'absolute -bottom-px -right-px w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900',
                          a.online ? 'bg-emerald-400' : 'bg-zinc-300 dark:bg-white/15'
                        )}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                        <span className="text-[11px] sm:text-[12px] text-zinc-700 dark:text-white/90 font-semibold font-sans tracking-[-0.01em] truncate">
                          {a.name}
                        </span>
                        <span className="text-[7px] font-bold px-1.5 py-[2px] rounded bg-zinc-100 dark:bg-white/[0.06] text-zinc-400 dark:text-white/35 uppercase tracking-wider">
                          {a.type}
                        </span>
                      </div>
                      <span className="text-[9px] sm:text-[10px] text-zinc-400 dark:text-white/[0.65] tracking-[0.04em] font-sans truncate block">
                        {a.role}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                      <div className="hidden sm:flex flex-col items-end">
                        <span className="text-[9px] sm:text-[10px] text-zinc-500 dark:text-white/[0.65] font-mono tabular-nums">
                          {a.tasks.toLocaleString()}
                        </span>
                        <span className="text-[7px] sm:text-[8px] text-zinc-300 dark:text-white/20 font-sans">
                          runs
                        </span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[9px] sm:text-[10px] text-zinc-500 dark:text-white/[0.65] font-mono tabular-nums">
                          {a.successRate}%
                        </span>
                        <span className="text-[7px] sm:text-[8px] text-zinc-300 dark:text-white/20 font-sans">
                          success
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-3.5 sm:px-5 py-2.5 bg-black/[0.01] dark:bg-white/[0.02] flex items-center justify-between border-t border-black/[0.03] dark:border-white/[0.03] gap-3">
                <span className="text-[8px] text-zinc-400 dark:text-white/20 font-sans">
                  17,022 total runs
                </span>
                <span className="text-[8px] text-zinc-300 dark:text-white/15 font-sans">
                  Updated 2m ago
                </span>
              </div>
            </div>
          </div>
        )
      }

      case 'Human-in-the-Loop': {
        const approvals = [
          {
            task: 'Refund $2,400 — Order #8291',
            status: 'pending',
            via: 'Slack',
            priority: 'High',
            time: '2m ago',
          },
          {
            task: 'Escalate login issue to Tier 2',
            status: 'approved',
            via: 'Email',
            priority: 'Med',
            time: '8m ago',
          },
          {
            task: 'Schedule VIP onboarding call',
            status: 'approved',
            via: 'In-app',
            priority: 'Low',
            time: '14m ago',
          },
        ]
        const prioStyle: Record<string, string> = {
          High: 'text-rose-400 bg-rose-400/10',
          Med: 'text-amber-400 bg-amber-400/10',
          Low: 'text-slate-400 bg-slate-400/10',
        }
        return (
          <div className="flex flex-col items-center gap-6 w-full">
            <div className="bg-black/[0.02] dark:bg-white/[0.04] backdrop-blur-sm border border-black/[0.05] dark:border-white/[0.08] rounded-2xl p-3.5 sm:p-5 w-full">
              <div className="flex items-center justify-between mb-4 sm:mb-5 gap-2">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <div
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      background:
                        'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.03))',
                      boxShadow: '0 0 0 1px rgba(245,158,11,0.1)',
                    }}
                  >
                    <ShieldCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500 dark:text-amber-300/80" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-zinc-800 dark:text-white font-semibold font-sans tracking-[-0.01em] text-[12px] sm:text-[13px] truncate">
                      Approval Queue
                    </h3>
                    <p className="text-zinc-400 dark:text-white/[0.65] text-[9px] sm:text-[10px] mt-0.5 tracking-[0.04em] font-sans truncate">
                      1 pending review
                    </p>
                  </div>
                </div>
                <span className="text-[7px] sm:text-[8px] uppercase tracking-[0.12em] text-amber-600 dark:text-amber-300/70 font-semibold px-2 py-1 rounded-full bg-amber-400/8 border border-amber-400/10 flex items-center gap-1 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  Waiting
                </span>
              </div>
              <div className="space-y-2.5">
                {approvals.map((item) => (
                  <div
                    key={item.task}
                    className={cn(
                      'rounded-xl border p-3 sm:p-3.5 transition-all',
                      item.status === 'pending'
                        ? 'bg-amber-400/[0.04] border-amber-400/12'
                        : 'bg-black/[0.01] dark:bg-white/[0.015] border-black/[0.04] dark:border-white/[0.04]'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] sm:text-[11px] text-zinc-700 dark:text-white/80 font-medium font-sans truncate leading-tight">
                          {item.task}
                        </p>
                        <div className="flex items-center gap-1.5 sm:gap-2 mt-1.5 flex-wrap">
                          <span
                            className={cn(
                              'text-[7px] font-bold px-1.5 py-[2px] rounded-full uppercase tracking-wider',
                              prioStyle[item.priority]
                            )}
                          >
                            {item.priority}
                          </span>
                          <span className="text-[8px] text-zinc-400 dark:text-white/40 font-sans">
                            {item.via}
                          </span>
                          <span className="text-[8px] text-zinc-300 dark:text-white/15 font-sans">
                            {item.time}
                          </span>
                        </div>
                      </div>
                      <span
                        className={cn(
                          'text-[8px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider flex-shrink-0',
                          item.status === 'pending'
                            ? 'text-amber-600 dark:text-amber-300 bg-amber-400/10 border border-amber-400/12'
                            : 'text-emerald-600 dark:text-emerald-400 bg-emerald-400/8 border border-emerald-400/10'
                        )}
                      >
                        {item.status === 'pending' ? 'Review' : 'Done'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      }

      case 'Data Tables & Deploy': {
        const rows = [
          { id: '1024', customer: 'Acme Corp', status: 'Active', arr: '$48K' },
          { id: '1025', customer: 'TechStart Inc', status: 'Trial', arr: '$12K' },
          { id: '1026', customer: 'GlobalBank', status: 'Active', arr: '$96K' },
          { id: '1027', customer: 'HealthFirst', status: 'Pending', arr: '$24K' },
        ]
        const statusStyle: Record<string, string> = {
          Active: 'text-emerald-400 bg-emerald-400/10',
          Trial: 'text-blue-400 bg-blue-400/10',
          Pending: 'text-amber-400 bg-amber-400/10',
        }
        return (
          <div className="flex flex-col items-center gap-6 w-full">
            <div className="bg-black/[0.02] dark:bg-white/[0.04] backdrop-blur-sm border border-black/[0.05] dark:border-white/[0.08] rounded-2xl overflow-hidden w-full">
              <div className="flex items-start sm:items-center justify-between px-3.5 sm:px-5 py-3 sm:py-3.5 border-b border-black/[0.04] dark:border-white/[0.04] gap-2">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <div
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      background:
                        'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(59,130,246,0.03))',
                      boxShadow: '0 0 0 1px rgba(59,130,246,0.1)',
                    }}
                  >
                    <DatabaseIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-500 dark:text-blue-300/80" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-zinc-800 dark:text-white font-semibold font-sans tracking-[-0.01em] text-[12px] sm:text-[13px] truncate">
                      customers_table
                    </h3>
                    <p className="text-zinc-400 dark:text-white/[0.65] text-[9px] sm:text-[10px] mt-0.5 tracking-[0.04em] font-sans truncate">
                      4 rows · Auto-synced
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-wrap justify-end shrink-0">
                  <span className="text-[7px] sm:text-[8px] px-1.5 sm:px-2 py-0.5 rounded-full bg-blue-400/10 text-blue-600 dark:text-blue-300/80 border border-blue-400/10 font-semibold uppercase tracking-wider">
                    Smart Insert
                  </span>
                  <span className="text-[7px] sm:text-[8px] px-1.5 sm:px-2 py-0.5 rounded-full bg-black/[0.02] dark:bg-white/[0.03] text-zinc-400 dark:text-white/[0.65] border border-black/[0.04] dark:border-white/[0.06] font-semibold uppercase tracking-wider">
                    API
                  </span>
                </div>
              </div>
              <div className="px-3.5 sm:px-5 py-2.5 border-b border-black/[0.03] dark:border-white/[0.03]">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.04]">
                  <svg
                    className="w-3 h-3 text-zinc-300 dark:text-white/15"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <span className="text-[9px] text-zinc-300 dark:text-white/15 font-sans">
                    Filter rows...
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-[32px_minmax(0,1fr)_54px_42px] sm:grid-cols-[40px_1fr_70px_55px] px-3.5 sm:px-5 py-2 border-b border-black/[0.04] dark:border-white/[0.04] bg-black/[0.01] dark:bg-white/[0.015]">
                {['ID', 'Customer', 'Status', 'ARR'].map((h) => (
                  <span
                    key={h}
                    className={cn(
                      'text-[8px] sm:text-[9px] text-zinc-400 dark:text-white/40 uppercase tracking-[0.1em] font-semibold font-sans',
                      h === 'ARR' && 'text-right'
                    )}
                  >
                    {h}
                  </span>
                ))}
              </div>
              {rows.map((row) => (
                <div
                  key={row.id}
                  className="grid grid-cols-[32px_minmax(0,1fr)_54px_42px] sm:grid-cols-[40px_1fr_70px_55px] px-3.5 sm:px-5 py-2.5 border-b border-black/[0.02] dark:border-white/[0.025] hover:bg-black/[0.01] dark:hover:bg-white/[0.02] transition-colors items-center"
                >
                  <span className="text-[9px] sm:text-[10px] text-zinc-400 dark:text-white/40 font-mono tabular-nums">
                    {row.id}
                  </span>
                  <span className="text-[9px] sm:text-[10px] text-zinc-700 dark:text-white/70 font-medium font-sans tracking-[-0.01em] truncate">
                    {row.customer}
                  </span>
                  <span className="flex items-center gap-1">
                    <span
                      className={cn(
                        'w-1.5 h-1.5 rounded-full',
                        row.status === 'Active'
                          ? 'bg-emerald-400/70'
                          : row.status === 'Trial'
                            ? 'bg-blue-400/70'
                            : 'bg-amber-400/70'
                      )}
                    />
                    <span
                      className={cn(
                        'text-[7px] sm:text-[8px] font-bold uppercase tracking-wider truncate',
                        statusStyle[row.status]
                      )}
                    >
                      {row.status}
                    </span>
                  </span>
                  <span className="text-[9px] sm:text-[10px] text-zinc-500 dark:text-white/45 font-mono text-right tabular-nums">
                    {row.arr}
                  </span>
                </div>
              ))}
              <div className="px-3.5 sm:px-5 py-2.5 flex items-center justify-between gap-3 bg-black/[0.01] dark:bg-white/[0.01]">
                <span className="text-[8px] text-zinc-400 dark:text-white/20 font-mono tabular-nums">
                  $180K total ARR
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-[8px] text-emerald-600 dark:text-emerald-400/50 flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-emerald-400/60" />
                    Synced
                  </span>
                </div>
              </div>
            </div>
          </div>
        )
      }

      default:
        return null
    }
  }

  return (
    <div className="w-full h-full flex items-center justify-center" key={selectedFeature.name}>
      <div
        className="relative w-full max-w-[20.5rem] sm:max-w-[28rem] lg:max-w-[38rem] rounded-[24px] sm:rounded-[30px] overflow-hidden"
        style={{
          background: 'rgba(255, 255, 255, 0.45)',
          backdropFilter: 'blur(20px) saturate(150%)',
          WebkitBackdropFilter: 'blur(20px) saturate(150%)',
          border: '1px solid rgba(255, 255, 255, 0.4)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), 0 8px 32px rgba(0,0,0,0.08)',
        }}
      >
        {/* Dark mode override */}
        <div
          className="hidden dark:block absolute inset-0 rounded-[24px] sm:rounded-2xl"
          style={{ background: 'rgba(20,20,22,0.9)', border: '1px solid rgba(255,255,255,0.05)' }}
        />
        <div>
          <div className="relative">
            <div
              className="absolute top-0 left-0 right-0 h-[1px]"
              style={{
                background: `linear-gradient(90deg, transparent 0%, ${selectedFeature.accent}25 50%, transparent 100%)`,
              }}
            />
            <div className="flex items-center justify-between px-3.5 sm:px-5 py-2 border-b border-black/[0.04] dark:border-white/[0.05]">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <span
                    className="w-[7px] h-[7px] rounded-full"
                    style={{ background: `${selectedFeature.accent}50` }}
                  />
                  <span className="w-[7px] h-[7px] rounded-full bg-black/[0.04] dark:bg-white/[0.05]" />
                  <span className="w-[7px] h-[7px] rounded-full bg-black/[0.03] dark:bg-white/[0.03]" />
                </div>
                <span className="text-[9px] uppercase tracking-[0.15em] text-zinc-400 dark:text-white/40 font-medium font-sans ml-1">
                  {selectedFeature.name}
                </span>
              </div>
            </div>
          </div>
          <div className="silver-glass-pane rounded-[20px] sm:rounded-[26px] px-3 sm:px-5 lg:px-6 py-3 sm:py-5 flex items-center justify-center">
            {getFeaturePreview()}
          </div>
        </div>
      </div>
    </div>
  )
}

function Features() {
  const [open, setOpen] = useState(0)
  const selectedFeature = features[open]

  return (
    <section className="community-ui-section gb-features relative flex w-full flex-col overflow-hidden bg-[#f4f5f7] px-4 py-24 dark:bg-transparent sm:px-6 md:px-8 md:py-40 lg:py-48">
      {/* Header */}
      <div className="community-ui-section-head flex w-full flex-col items-center gap-6 mb-16 md:mb-20">
        <div className="odyssey-editorial-kicker inline-flex">
          <span className="odyssey-editorial-dot" />
          <span className="font-tech text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-white/40">
            Platform
          </span>
          <span className="h-3.5 w-px bg-black/[0.07] dark:bg-white/[0.08]" />
          <span className="font-heading text-[13px] font-medium tracking-[-0.03em] text-[#4d6268] dark:text-[#b9c8cf]">
            Core capabilities
          </span>
        </div>
        <h2 className="odyssey-display-title max-w-[11ch] text-center text-[2.45rem] text-zinc-800 dark:text-white sm:max-w-[15ch] sm:text-[2.8rem] md:text-[3.35rem] lg:text-[4.2rem]">
          Everything you need for
          <br className="hidden sm:block" />
          <span className="odyssey-display-accent bg-linear-to-r from-[#5B7B6F] via-[#4A7A68] to-[#6B8F80] dark:from-[#6EDAB0] dark:via-[#5EC9A0] dark:to-[#4AB890] bg-clip-text text-transparent sm:inline-block sm:whitespace-nowrap sm:text-[0.72em]">
            {' '}
            intelligent automation
          </span>
        </h2>
        <p className="odyssey-section-copy max-w-[520px] text-center text-[15px] md:text-[16px]">
          Agent profiles, human-in-the-loop approvals, built-in data tables, and extensible
          integrations.
        </p>
      </div>

      {/* Pills + Container */}
      <div className="flex flex-col gap-6 sm:gap-8 w-full max-w-[1400px] mx-auto">
        {/* Feature Selector */}
        <div className="flex items-center justify-center">
          <div
            className="community-ui-selector-shell silver-glass-pane relative flex w-full sm:w-auto flex-col sm:inline-flex sm:flex-row max-w-full items-stretch sm:items-center gap-1 sm:gap-0.5 rounded-2xl p-[5px]"
            style={{
              maskImage: 'none',
              WebkitMaskImage: 'none',
            }}
          >
            {features.map((f, i) => (
              <button
                key={f.name}
                onClick={() => setOpen(i)}
                className={cn(
                  'community-ui-selector-button relative w-full sm:w-auto shrink-0 px-4 sm:px-7 py-2.5 sm:py-3 text-[12px] sm:text-[13px] font-medium font-sans cursor-pointer focus:outline-none z-10 transition-colors duration-300',
                  open === i
                    ? 'text-zinc-900 dark:text-white'
                    : 'text-zinc-400 dark:text-white/[0.65] hover:text-zinc-500 dark:hover:text-[#F3F5F7]'
                )}
              >
                {open === i && (
                  <>
                    {/* Rotating accent border */}
                    <motion.div
                      layoutId="feature-glow"
                      className="absolute -inset-[1px] rounded-[13px] overflow-hidden"
                      transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
                    >
                      <div
                        className="absolute inset-[-8px] opacity-50 dark:opacity-40"
                        style={{
                          background: `conic-gradient(from var(--border-angle, 0deg), transparent 0%, ${f.accent} 20%, transparent 40%, ${f.accent}80 70%, transparent 90%)`,
                          animation: 'border-spin 4s linear infinite',
                        }}
                      />
                    </motion.div>
                    {/* Solid pill bg */}
                    <motion.div
                      layoutId="feature-selector"
                      className="silver-glass-chip absolute inset-0 rounded-xl"
                      transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
                    />
                  </>
                )}
                <span className="relative flex items-center gap-2">
                  <span
                    className="w-[5px] h-[5px] rounded-full transition-all duration-500 flex-shrink-0"
                    style={{
                      background: open === i ? f.accent : 'currentColor',
                      opacity: open === i ? 1 : 0.3,
                      boxShadow: open === i ? `0 0 8px ${f.accent}50` : 'none',
                    }}
                  />
                  {f.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Main Container — Silver Gray */}
        <div className="relative">
          <div className="community-ui-shell community-ui-feature-shell silver-glass-panel signal-accent-frame relative rounded-[32px]">
            <div className="pointer-events-none absolute inset-0 rounded-[32px] border border-white/90 dark:border-white/[0.22] bg-[linear-gradient(180deg,rgba(255,255,255,0.4),rgba(255,255,255,0.13)_24%,rgba(255,255,255,0.05)_58%,rgba(113,113,122,0.12)_100%)] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.05)_24%,rgba(255,255,255,0.025)_58%,rgba(255,255,255,0.06)_100%)] backdrop-blur-[16px] shadow-[inset_0_1px_0_rgba(255,255,255,0.96),inset_0_-1px_0_rgba(113,113,122,0.22),0_0_0_1px_rgba(255,255,255,0.32),0_18px_38px_rgba(255,255,255,0.12)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.24),inset_0_-1px_0_rgba(255,255,255,0.1),0_0_0_1px_rgba(255,255,255,0.1)]" />
            <div className="pointer-events-none absolute inset-[6px] rounded-[27px] border border-white/65 dark:border-white/[0.12] bg-[linear-gradient(180deg,rgba(255,255,255,0.28),transparent_28%,rgba(255,255,255,0.07)_100%)] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.07),transparent_28%,rgba(255,255,255,0.035)_100%)] backdrop-blur-[9px]" />

            {/* Two-column layout */}
            <div className="flex flex-col lg:flex-row relative min-h-[unset] lg:min-h-[560px]">
              {/* Left — Feature Content */}
              <div className="community-ui-feature-copy-panel relative flex flex-col justify-center px-5 sm:px-8 lg:px-14 xl:px-16 py-8 sm:py-10 lg:py-16 lg:w-[42%] xl:w-[40%] z-[2]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={selectedFeature.name}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 16 }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {/* Watermark number */}
                    <span
                      className="block text-[56px] sm:text-[72px] lg:text-[88px] xl:text-[100px] font-serif italic leading-none tracking-[-0.04em] mb-5 sm:mb-6 select-none relative z-[1]"
                      style={{ color: `${selectedFeature.accent}22` }}
                    >
                      {String(open + 1).padStart(2, '0')}
                    </span>

                    {/* Icon + Title */}
                    <div className="flex items-center gap-3 sm:gap-3.5 mb-5 sm:mb-6">
                      <div className="scale-[0.85] origin-left">{selectedFeature.feature.icon}</div>
                      <h3 className="text-[17px] lg:text-[20px] font-medium font-sans text-zinc-900 dark:text-white tracking-[-0.02em] leading-[1.1] relative z-[1]">
                        {selectedFeature.feature.title}
                      </h3>
                    </div>

                    {/* Bullets */}
                    <ul className="flex flex-col gap-3 sm:gap-3.5">
                      {selectedFeature.feature.bullets.map((b, j) => (
                        <motion.li
                          key={`${selectedFeature.name}-${j}`}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            duration: 0.35,
                            delay: 0.15 + j * 0.07,
                            ease: [0.22, 1, 0.36, 1],
                          }}
                          className="flex items-start gap-3"
                        >
                          <span
                            className="w-[4px] h-[4px] rounded-sm mt-[7px] flex-shrink-0"
                            style={{ background: selectedFeature.accent, opacity: 0.5 }}
                          />
                          <span className="text-[12px] sm:text-[13px] text-zinc-600 dark:text-white/[0.65] leading-[1.55] tracking-[0.01em] font-sans relative z-[1]">
                            {b}
                          </span>
                        </motion.li>
                      ))}
                    </ul>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Separator */}
              <div className="hidden lg:block absolute left-[42%] xl:left-[40%] top-14 bottom-14 w-px bg-linear-to-b from-transparent via-white/70 dark:via-white/[0.14] to-transparent z-[2]" />

              {/* Right — Preview */}
              <div className="community-ui-feature-preview-panel flex-1 relative flex items-center justify-center p-4 sm:p-8 lg:p-9 xl:p-10 overflow-hidden z-[1]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={selectedFeature.name}
                    initial={{ opacity: 0, y: 24, filter: 'blur(12px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
                    transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                    className="w-full max-w-[20.5rem] sm:max-w-[28rem] lg:max-w-[38rem] relative z-10"
                  >
                    <ModernWorkflowPreview selectedFeature={selectedFeature} />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Features
