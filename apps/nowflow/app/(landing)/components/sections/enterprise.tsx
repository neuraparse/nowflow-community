'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Github, Lock, Shield } from 'lucide-react'
import { ENTERPRISE_REQUEST_LABEL, ENTERPRISE_URL } from '@/lib/community/enterprise'
import { cn } from '@/lib/utils'
import { Marquee } from '../magicui/marquee'

// --- Audit Trail Data ---
const auditRows = [
  {
    initials: 'A',
    color: '#A855F7',
    action: "Created workflow 'Lead Enrichment'",
    time: 'just now',
  },
  {
    initials: 'T',
    color: '#3B82F6',
    action: "Updated knowledge base 'Product Docs'",
    time: '10s ago',
  },
  { initials: 'S', color: '#F59E0B', action: 'Published workflow to runtime', time: '32s ago' },
  { initials: 'A', color: '#10B981', action: "Revoked API key 'Shared Key'", time: '1m ago' },
  { initials: 'T', color: '#EC4899', action: 'Invited member to workspace', time: '2m ago' },
  { initials: 'S', color: '#6366F1', action: 'Exported audit logs (CSV)', time: '5m ago' },
]

// --- Access Control Data ---
type PermissionStatus = 'enabled' | 'disabled'

interface PermissionItem {
  name: string
  dotColor: string
  status: PermissionStatus
}

interface PermissionGroup {
  label: string
  items: PermissionItem[]
}

const accessGroups: PermissionGroup[] = [
  {
    label: 'PROVIDERS',
    items: [
      { name: 'OpenAI', dotColor: '#10B981', status: 'enabled' },
      { name: 'Anthropic', dotColor: '#EC4899', status: 'enabled' },
      { name: 'Google', dotColor: '#6B7280', status: 'disabled' },
      { name: 'xAI', dotColor: '#EC4899', status: 'enabled' },
    ],
  },
  {
    label: 'WORKSPACE',
    items: [
      { name: 'Knowledge Base', dotColor: '#10B981', status: 'enabled' },
      { name: 'Tables', dotColor: '#10B981', status: 'enabled' },
      { name: 'Copilot', dotColor: '#6B7280', status: 'disabled' },
      { name: 'Environment', dotColor: '#6B7280', status: 'disabled' },
    ],
  },
  {
    label: 'TOOLS',
    items: [
      { name: 'Managed Tools', dotColor: '#6B7280', status: 'disabled' },
      { name: 'Custom Tools', dotColor: '#6B7280', status: 'disabled' },
      { name: 'Skills', dotColor: '#10B981', status: 'enabled' },
      { name: 'Invitations', dotColor: '#10B981', status: 'enabled' },
    ],
  },
]

// --- Trust Badges ---
const trustBadges = [
  { icon: Shield, label: 'Security Review' },
  { icon: Github, label: 'Open Source' },
  { icon: Lock, label: 'Managed Identity' },
]

// --- Marquee Features ---
const marqueeFeatures = [
  'Credential Sharing',
  'Custom Limits',
  'Management API',
  'White Labeling',
  'Dedicated Support',
  'Custom Support Plans',
  'On-Premise',
  'Organizations',
  'Workflow Versioning',
  'Workspace Export',
  'Audit Logs',
  'Access Control',
  'Self-Hosted',
]

function AuditTrailCard() {
  return (
    <motion.div
      className="relative group"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: 0.1 }}
    >
      {/* Rotating border glow */}
      <div
        className="absolute -inset-[1px] rounded-[25px] opacity-0 group-hover:opacity-100 transition-opacity duration-700"
        style={{
          background:
            'conic-gradient(from var(--border-angle, 0deg), transparent 0%, rgba(74,122,104,0.15) 20%, transparent 45%, rgba(74,122,104,0.06) 70%, transparent 100%)',
          animation: 'border-spin 10s linear infinite',
        }}
      />

      <div className="relative bg-[#0b0b0f] border border-white/[0.06] rounded-[24px] overflow-hidden h-full">
        {/* Top accent line */}
        <div
          className="absolute top-0 left-[10%] right-[10%] h-px"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(74,122,104,0.25), transparent)',
          }}
        />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.04]">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, rgba(74,122,104,0.25), rgba(74,122,104,0.05))',
                boxShadow: '0 0 0 1px rgba(74,122,104,0.15)',
              }}
            >
              <Shield className="w-3.5 h-3.5" style={{ color: '#8CB09C' }} />
            </div>
            <div>
              <h3 className="font-heading text-[14px] font-semibold tracking-[-0.01em] text-white">
                Audit Trail
              </h3>
              <p className="font-tech mt-0.5 text-[10px] tracking-[0.08em] text-white/30">
                Real-time activity log
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/40 animate-pulse" />
            <span className="font-tech text-[9px] text-white/20 tabular-nums">6 events</span>
          </div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-white/[0.025]">
          {auditRows.map((row, idx) => (
            <motion.div
              key={`${row.initials}-${idx}`}
              className="flex items-center gap-3.5 px-6 py-3 relative"
              initial={{ opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: 0.15 + idx * 0.05 }}
            >
              {/* Left accent bar */}
              <div
                className="absolute left-0 top-2 bottom-2 w-[1.5px] rounded-full"
                style={{ background: row.color, opacity: 0.35 }}
              />

              {/* Avatar */}
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  background: `${row.color}18`,
                  border: `1px solid ${row.color}20`,
                }}
              >
                <span
                  className="font-tech text-[10px] font-bold tracking-wider"
                  style={{ color: `${row.color}90` }}
                >
                  {row.initials}
                </span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="font-body truncate text-[11px] font-medium leading-tight text-white/60">
                  {row.action}
                </p>
              </div>

              {/* Timestamp */}
              <span className="font-tech flex-shrink-0 text-[9px] text-white/20 tabular-nums">
                {row.time}
              </span>
            </motion.div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-2.5 bg-white/[0.015] border-t border-white/[0.03] flex items-center justify-between">
          <span className="font-tech text-[8px] text-white/15">Showing latest activity</span>
          <span className="font-tech text-[8px] text-white/10">Streaming</span>
        </div>
      </div>
    </motion.div>
  )
}

function AccessControlCard() {
  return (
    <motion.div
      className="relative group"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      {/* Rotating border glow */}
      <div
        className="absolute -inset-[1px] rounded-[25px] opacity-0 group-hover:opacity-100 transition-opacity duration-700"
        style={{
          background:
            'conic-gradient(from var(--border-angle, 0deg), transparent 0%, rgba(74,122,104,0.15) 20%, transparent 45%, rgba(74,122,104,0.06) 70%, transparent 100%)',
          animation: 'border-spin 10s linear infinite',
        }}
      />

      <div className="relative bg-[#0b0b0f] border border-white/[0.06] rounded-[24px] overflow-hidden h-full">
        {/* Top accent line */}
        <div
          className="absolute top-0 left-[10%] right-[10%] h-px"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(74,122,104,0.25), transparent)',
          }}
        />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.04]">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, rgba(74,122,104,0.25), rgba(74,122,104,0.05))',
                boxShadow: '0 0 0 1px rgba(74,122,104,0.15)',
              }}
            >
              <Lock className="w-3.5 h-3.5" style={{ color: '#8CB09C' }} />
            </div>
            <div>
              <h3 className="font-heading text-[14px] font-semibold tracking-[-0.01em] text-white">
                Access Control
              </h3>
              <p className="font-tech mt-0.5 text-[10px] tracking-[0.08em] text-white/30">
                Permission matrix
              </p>
            </div>
          </div>
          <span className="font-tech text-[9px] text-white/20 tabular-nums">8 / 12</span>
        </div>

        {/* Permission Groups */}
        <div className="px-6 py-4 space-y-5">
          {accessGroups.map((group) => (
            <div key={group.label}>
              <span className="font-tech mb-2.5 block text-[8px] font-semibold uppercase tracking-[0.14em] text-white/25">
                {group.label}
              </span>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {group.items.map((item) => (
                  <div key={item.name} className="flex items-center gap-2.5">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{
                        background: item.dotColor,
                        opacity: item.status === 'enabled' ? 0.8 : 0.3,
                        boxShadow:
                          item.status === 'enabled' ? `0 0 6px ${item.dotColor}40` : 'none',
                      }}
                    />
                    <span
                      className={cn(
                        'font-body text-[11px] tracking-[-0.01em]',
                        item.status === 'enabled' ? 'text-white/55' : 'text-white/20'
                      )}
                    >
                      {item.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-2.5 bg-white/[0.015] border-t border-white/[0.03] flex items-center justify-between">
          <span className="font-tech text-[8px] text-white/15">8 of 12 enabled</span>
          <span className="font-tech text-[8px] text-white/10">Role: Owner</span>
        </div>
      </div>
    </motion.div>
  )
}

export default function Enterprise() {
  return (
    <section className="py-24 md:py-32 lg:py-40 bg-[#fafafa] dark:bg-slate-950 relative overflow-hidden">
      <div className="container mx-auto px-6 md:px-8 relative z-10">
        {/* Header */}
        <div className="flex flex-col gap-5 w-full items-center mb-16 md:mb-20">
          <motion.div
            className="inline-flex items-center gap-2 rounded-full bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.06] px-4 py-1.5 backdrop-blur-sm"
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
          >
            <span className="w-1.5 h-1.5 rounded-sm bg-[#4A7A68] dark:bg-[#8CB09C]" />
            <span className="font-tech text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500 dark:text-white/40">
              Enterprise
            </span>
          </motion.div>

          <motion.h2
            className="odyssey-display-title text-center text-4xl text-zinc-900 dark:text-white md:text-5xl lg:text-6xl"
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.05 }}
          >
            Enterprise features for
            <br className="hidden sm:block" />
            <span className="odyssey-display-accent bg-gradient-to-r from-[#5B7B6F] via-[#4A7A68] to-[#6B8F80] bg-clip-text text-transparent dark:from-[#94B8A6] dark:via-[#8CB09C] dark:to-[#A0C4B2]">
              {' '}
              fast, scalable workflows
            </span>
          </motion.h2>

          <motion.p
            className="odyssey-section-copy max-w-lg text-center text-[15px] md:text-base"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            Open source core with enterprise security, identity, and governance available on
            request.
          </motion.p>
        </div>

        {/* Two-column card layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-[1100px] mx-auto mb-16">
          <AuditTrailCard />
          <AccessControlCard />
        </div>

        {/* Trust Badges */}
        <motion.div
          className="flex flex-wrap items-center justify-center gap-6 md:gap-10 mb-16"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.25 }}
        >
          {trustBadges.map((badge) => (
            <div
              key={badge.label}
              className="flex items-center gap-3 px-6 py-3.5 rounded-xl border border-black/[0.04] dark:border-white/[0.05]"
              style={{
                background:
                  'linear-gradient(135deg, rgba(74,122,104,0.03), rgba(74,122,104,0.008))',
              }}
            >
              <badge.icon className="w-4.5 h-4.5 text-zinc-400 dark:text-white/35" />
              <span className="font-body text-[13px] font-medium tracking-[-0.01em] text-zinc-500 dark:text-white/45">
                {badge.label}
              </span>
            </div>
          ))}
        </motion.div>

        {/* Marquee */}
        <motion.div
          className="relative"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          {/* Fade edges */}
          <div className="absolute left-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-r from-[#fafafa] dark:from-slate-950 to-transparent pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-l from-[#fafafa] dark:from-slate-950 to-transparent pointer-events-none" />

          <Marquee className="[--duration:60s]" pauseOnHover>
            {marqueeFeatures.map((feature) => (
              <span
                key={feature}
                className="font-body inline-flex items-center gap-3 whitespace-nowrap px-1 text-[13px] tracking-[-0.01em] text-zinc-300 dark:text-white/15 md:text-[14px]"
              >
                {feature}
                <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-white/10" />
              </span>
            ))}
          </Marquee>
        </motion.div>

        <motion.div
          className="mt-12 flex justify-center"
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, delay: 0.35 }}
        >
          <a
            href={ENTERPRISE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-tech inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-5 py-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-white transition-all duration-200 hover:-translate-y-px hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-white/90"
          >
            {ENTERPRISE_REQUEST_LABEL}
            <ArrowRight className="h-4 w-4" />
          </a>
        </motion.div>
      </div>
    </section>
  )
}
