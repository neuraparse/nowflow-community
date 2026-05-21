import React from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Check, ChevronRight, Clock, Download, Lock, Pin, RotateCcw, User } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { SemanticVersionBadge } from './semantic-version-badge'
import type { Version, VersionTag } from './types'
import { ChangeStats, getChangeTypeBadge, getChangeTypeBorderColor } from './version-utils'

interface VersionListItemProps {
  version: Version
  index: number
  isSelected: boolean
  isCompareMode: boolean
  isCompareSelected: boolean
  availableTags: VersionTag[]
  onTogglePin: (version: Version, e: React.MouseEvent) => void
  onExport: (version: Version, e: React.MouseEvent) => void
  onRestore: (version: Version) => void
  onSelect: (version: Version) => void
  onCompareToggle: (versionNumber: number) => void
}

export const VersionListItem = React.memo(function VersionListItem({
  version,
  index,
  isSelected,
  isCompareMode,
  isCompareSelected,
  availableTags,
  onTogglePin,
  onExport,
  onRestore,
  onSelect,
  onCompareToggle,
}: VersionListItemProps) {
  return (
    <div
      className={`p-3 rounded-[8px] border border-l-2 transition-all cursor-pointer ${getChangeTypeBorderColor(version.changeType)} ${
        isSelected
          ? 'border-white/[0.10] bg-white/[0.06]'
          : 'border-white/[0.06] hover:border-white/[0.10] hover:bg-white/[0.04]'
      } ${isCompareMode && isCompareSelected ? 'ring-2 ring-white/[0.12]' : ''}`}
      onClick={() => {
        if (isCompareMode) {
          onCompareToggle(version.versionNumber)
        } else {
          onSelect(version)
        }
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white/92">v{version.versionNumber}</span>
            {version.semanticVersion && <SemanticVersionBadge version={version.semanticVersion} />}
            {getChangeTypeBadge(version.changeType)}
            {index === 0 && (
              <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-0">
                Current
              </Badge>
            )}
            {version.isPinned && <Pin className="h-3 w-3 text-amber-500" />}
            {version.isLocked && <Lock className="h-3 w-3 text-zinc-500 dark:text-white/50" />}
          </div>

          {version.name && <p className="mt-1 truncate text-sm text-white/68">{version.name}</p>}

          {version.tags && version.tags.length > 0 && (
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              {version.tags.slice(0, 3).map((tag) => {
                const tagInfo = availableTags.find((t) => t.name === tag || t.slug === tag)
                return (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="text-xs h-5"
                    style={{ borderColor: tagInfo?.color, color: tagInfo?.color }}
                  >
                    {tag}
                  </Badge>
                )
              })}
              {version.tags.length > 3 && (
                <span className="text-xs text-white/44">+{version.tags.length - 3}</span>
              )}
            </div>
          )}

          {version.changeSummary?.summary && (
            <p className="mt-1 text-xs text-white/44">{version.changeSummary.summary}</p>
          )}

          <ChangeStats changeSummary={version.changeSummary} />

          <div className="mt-2 flex items-center gap-3 text-xs text-white/44">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(new Date(version.createdAt), { addSuffix: true })}
            </span>
            {version.createdBy && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {version.createdBy.slice(0, 8)}...
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {isCompareMode ? (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onCompareToggle(version.versionNumber)
              }}
              className={`flex h-6 w-6 items-center justify-center rounded-[4px] border transition-colors ${
                isCompareSelected
                  ? 'border-white/[0.12] bg-white/[0.12] text-white'
                  : 'border-white/[0.10] text-white/46 hover:border-white/[0.16] hover:bg-white/[0.04]'
              }`}
            >
              {isCompareSelected && <Check className="h-4 w-4" />}
            </button>
          ) : (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-8 w-8 rounded-[4px] p-0 text-white/52 hover:bg-white/[0.05] hover:text-white/84 ${version.isPinned ? 'text-amber-400 hover:text-amber-300' : ''}`}
                    onClick={(e) => onTogglePin(version, e)}
                  >
                    <Pin className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{version.isPinned ? 'Unpin' : 'Pin'}</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 rounded-[4px] p-0 text-white/52 hover:bg-white/[0.05] hover:text-white/84"
                    onClick={(e) => onExport(version, e)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Export</TooltipContent>
              </Tooltip>

              {index !== 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 rounded-[4px] p-0 text-white/52 hover:bg-white/[0.05] hover:text-white/84"
                      onClick={(e) => {
                        e.stopPropagation()
                        onRestore(version)
                      }}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Restore</TooltipContent>
                </Tooltip>
              )}
              <ChevronRight className="h-4 w-4 text-white/36" />
            </>
          )}
        </div>
      </div>
    </div>
  )
})
