'use client'

import type { CSSProperties } from 'react'
import { Database, Eye, Grid3X3 } from 'lucide-react'
import {
  ModernAgentsIcon,
  ModernBlocksIcon,
  ModernIntegrationsIcon,
} from '@/components/modern-toolbar-icons'
import { cn } from '@/lib/utils'
import { workflowEditorTheme } from '@/lib/workflow-editor-theme'

export type ToolbarTab = 'core' | 'agents' | 'data' | 'integrations' | 'vision' | 'all'

interface ToolbarTabsProps {
  activeTab: ToolbarTab
  onTabChange: (tab: ToolbarTab) => void
}

const TABS = [
  // Group 1: Core building blocks
  {
    id: 'core' as const,
    icon: ModernBlocksIcon,
    label: 'Core Flow',
    hint: 'Starter, router, condition, loop, function…',
    accent: '#22d3ee',
  },
  {
    id: 'agents' as const,
    icon: ModernAgentsIcon,
    label: 'AI Agents',
    hint: 'Reasoning, retrieval, data analysis…',
    accent: '#a78bfa',
  },
  {
    id: 'data' as const,
    icon: Database,
    label: 'Data & Files',
    hint: 'Databases, S3, Airtable, file operations…',
    accent: '#34d399',
  },

  // Group 2: External & media
  {
    id: 'integrations' as const,
    icon: ModernIntegrationsIcon,
    label: 'Integrations',
    hint: 'Slack, Notion, Salesforce, Stripe and 100+ more…',
    accent: '#f59e0b',
  },
  {
    id: 'vision' as const,
    icon: Eye,
    label: 'Vision & Media',
    hint: 'Image generation, vision, speech, audio…',
    accent: '#fb7185',
  },
  // Group 3: All
  {
    id: 'all' as const,
    icon: Grid3X3,
    label: 'All Blocks',
    hint: 'Browse every available block',
    accent: '#94a3b8',
  },
] as const

// Separator positions (after which tab index)
const SEPARATORS_AFTER = [2, 4]

export function ToolbarTabs({ activeTab, onTabChange }: ToolbarTabsProps) {
  return (
    <div className="px-3 pb-2">
      <div
        className={cn(
          'workflow-editor-block-library-tab-rail smoky-glass-pane block-library-surface flex items-center gap-0.5 rounded-[12px] p-1.5',
          workflowEditorTheme.toolboxSurface
        )}
      >
        {TABS.map((tab, idx) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          const showSep = SEPARATORS_AFTER.includes(idx)

          return (
            <div key={tab.id} className="flex items-center">
              {/* Tab button */}
              <button
                onClick={() => onTabChange(tab.id)}
                title={`${tab.label} — ${tab.hint}`}
                data-toolbar-tab={tab.id}
                data-active={isActive ? 'true' : 'false'}
                style={{ '--workflow-library-tab-accent': tab.accent } as CSSProperties}
                className={cn(
                  'workflow-editor-block-library-tab smoky-glass-chip block-library-chip relative flex h-8 w-9 items-center justify-center rounded-[10px] transition-all duration-200',
                  workflowEditorTheme.toolboxChip,
                  workflowEditorTheme.tab,
                  isActive && workflowEditorTheme.tabActive
                )}
              >
                <Icon className="h-[15px] w-[15px]" />
                {/* Active indicator dot */}
                {isActive && (
                  <span className="absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-white/65" />
                )}
              </button>

              {/* Separator */}
              {showSep && (
                <div className="mx-0.5 h-5 w-px rounded-full bg-[color:var(--workflow-editor-border-soft)]" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
