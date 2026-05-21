'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { workflowEditorTheme } from '@/lib/workflow-editor-theme'

interface ThemeToggleProps {
  theme: string
  toggleTheme: () => void
}

function ThemeIcon({ theme }: { theme: string }) {
  if (theme === 'dark') {
    return <Sun className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
  } else if (theme === 'system') {
    return <Monitor className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
  } else {
    return <Moon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
  }
}

function getThemeLabel(theme: string) {
  if (theme === 'dark') return 'Switch to system theme'
  if (theme === 'system') return 'Switch to light theme'
  return 'Switch to dark theme'
}

export function ThemeToggle({ theme, toggleTheme }: ThemeToggleProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className={cn(
            workflowEditorTheme.iconButton,
            'silver-glass-chip h-8 w-8 min-h-8 min-w-8 rounded-[10px] text-foreground/70 transition-all duration-200 hover:bg-black/[0.04] hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-0 dark:hover:bg-white/[0.06]',
            theme !== 'light' && 'is-active'
          )}
          aria-label={getThemeLabel(theme)}
        >
          <ThemeIcon theme={theme} />
          <span className="sr-only">Toggle Theme</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-[11px] font-logo">
        {getThemeLabel(theme)}
      </TooltipContent>
    </Tooltip>
  )
}
