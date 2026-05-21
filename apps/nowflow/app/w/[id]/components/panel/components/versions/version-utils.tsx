import { Rocket } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { Version } from './types'

const CHANGE_TYPE_CONFIG: Record<string, { color: string; label: string; icon?: React.ReactNode }> =
  {
    create: { color: 'bg-green-500/10 text-green-600 dark:text-green-400', label: 'Created' },
    update: { color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400', label: 'Updated' },
    deploy: {
      color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
      label: 'Deployed',
      icon: <Rocket className="h-3 w-3 mr-1" />,
    },
    restore: { color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400', label: 'Restored' },
    auto_save: { color: 'bg-slate-500/10 text-zinc-600 dark:text-white/60', label: 'Auto-save' },
  }

const DEFAULT_CONFIG = { color: 'bg-slate-500/10 text-zinc-600 dark:text-white/60', label: '' }

export function getChangeTypeBadge(type: string) {
  const { color, label, icon } = CHANGE_TYPE_CONFIG[type] || { ...DEFAULT_CONFIG, label: type }
  return (
    <Badge className={`${color} border-0 flex items-center`}>
      {icon}
      {label}
    </Badge>
  )
}

const CHANGE_TYPE_BORDERS: Record<string, string> = {
  create: 'border-l-green-500',
  update: 'border-l-blue-500',
  deploy: 'border-l-purple-500',
  restore: 'border-l-orange-500',
  auto_save: 'border-l-slate-400',
}

export function getChangeTypeBorderColor(type: string) {
  return CHANGE_TYPE_BORDERS[type] || 'border-l-slate-400'
}

export function ChangeStats({ changeSummary }: { changeSummary: Version['changeSummary'] }) {
  if (!changeSummary) return null
  const { blocksAdded, blocksRemoved, blocksModified } = changeSummary
  if (!blocksAdded && !blocksRemoved && !blocksModified) return null
  return (
    <div className="flex items-center gap-1">
      {!!blocksAdded && blocksAdded > 0 && (
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400">
          +{blocksAdded}
        </span>
      )}
      {!!blocksRemoved && blocksRemoved > 0 && (
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400">
          -{blocksRemoved}
        </span>
      )}
      {!!blocksModified && blocksModified > 0 && (
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
          ~{blocksModified}
        </span>
      )}
    </div>
  )
}
