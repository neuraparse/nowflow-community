import { Check, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useFilterStore } from '@/app/w/logs/stores/store'
import { LogLevel } from '@/app/w/logs/stores/types'

export default function Level() {
  const { level, setLevel } = useFilterStore()
  const levels: {
    value: LogLevel
    label: string
    color?: string
    bgColor?: string
    borderColor?: string
  }[] = [
    { value: 'all', label: 'Any status' },
    {
      value: 'error',
      label: 'Error',
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      borderColor: 'border-destructive/20',
    },
    {
      value: 'warn',
      label: 'Warning',
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      borderColor: 'border-warning/20',
    },
    {
      value: 'info',
      label: 'Info',
      color: 'text-zinc-800 dark:text-white',
      bgColor: 'bg-zinc-100 dark:bg-white/[0.06]',
      borderColor: 'border-primary/20',
    },
  ]

  const getDisplayLabel = () => {
    const selected = levels.find((l) => l.value === level)
    return selected ? selected.label : 'Any status'
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-between text-sm font-normal bg-white/80 dark:bg-slate-900/80 border-black/[0.06] dark:border-white/[0.06] hover:bg-zinc-50 dark:hover:bg-white/[0.03] hover:border-zinc-300 dark:hover:border-white/20 transition-all duration-200"
        >
          <div className="flex items-center">
            {level !== 'all' && (
              <div
                className={`w-2 h-2 rounded-full mr-2 ${levels.find((l) => l.value === level)?.bgColor || ''}`}
              />
            )}
            <span className={level !== 'all' ? levels.find((l) => l.value === level)?.color : ''}>
              {getDisplayLabel()}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 ml-2 text-zinc-400 dark:text-white/40" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-[220px] bg-transparent border-black/[0.06] dark:border-white/[0.06] shadow-md"
      >
        {levels.map((levelItem) => (
          <DropdownMenuItem
            key={levelItem.value}
            onSelect={(e) => {
              e.preventDefault()
              setLevel(levelItem.value)
            }}
            className="flex items-center justify-between p-2 cursor-pointer text-sm hover:bg-zinc-50 dark:hover:bg-white/[0.03] focus:bg-zinc-50 dark:focus:bg-white/[0.03] transition-all duration-200"
          >
            <div className="flex items-center">
              {levelItem.value !== 'all' ? (
                <div
                  className={`flex items-center justify-center w-5 h-5 rounded-full mr-2 ${levelItem.bgColor}`}
                >
                  <div
                    className={`w-2 h-2 rounded-full ${levelItem.color?.replace('text-', 'bg-')}`}
                  />
                </div>
              ) : (
                <div className="w-5 h-5 flex items-center justify-center mr-2">
                  <div className="w-3 h-3 rounded-full bg-zinc-300/40 dark:bg-white/20" />
                </div>
              )}
              <span className={levelItem.value !== 'all' ? levelItem.color : ''}>
                {levelItem.label}
              </span>
            </div>
            {level === levelItem.value && (
              <div className="bg-zinc-100 dark:bg-white/[0.06] p-1 rounded-full">
                <Check className="h-3 w-3 text-zinc-800 dark:text-white" />
              </div>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
