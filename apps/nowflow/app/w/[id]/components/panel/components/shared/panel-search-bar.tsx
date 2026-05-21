'use client'

import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { workflowEditorTheme } from '@/lib/workflow-editor-theme'

interface PanelSearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function PanelSearchBar({
  value,
  onChange,
  placeholder = 'Search...',
  className,
}: PanelSearchBarProps) {
  return (
    <div className={cn('workflow-editor-panel-search relative', className)}>
      <Search
        className={cn(
          'pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2',
          workflowEditorTheme.soft
        )}
        strokeWidth={1.5}
      />
      <Input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          workflowEditorTheme.searchInput,
          'workflow-editor-panel-search-input silver-glass-pane smoky-glass-pane h-8 pl-8 pr-7 text-[12px] transition-all duration-200 placeholder:text-muted-foreground focus:ring-0'
        )}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className={cn(
            workflowEditorTheme.iconButton,
            'workflow-editor-panel-search-clear absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2 p-0 transition-colors duration-200'
          )}
        >
          <X className="h-3 w-3" strokeWidth={1.5} />
        </button>
      )}
    </div>
  )
}
