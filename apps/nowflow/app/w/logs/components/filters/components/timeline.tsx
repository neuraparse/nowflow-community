import { Check, ChevronDown } from 'lucide-react'
import { ModernClockIcon } from '@/components/modern-logs-icons'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useFilterStore } from '@/app/w/logs/stores/store'
import { TimeRange } from '@/app/w/logs/stores/types'

export default function Timeline() {
  const { timeRange, setTimeRange } = useFilterStore()
  const timeRanges: TimeRange[] = ['All time', 'Past 30 minutes', 'Past hour', 'Past 24 hours']

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-between text-sm font-normal bg-white/80 dark:bg-slate-900/80 border-black/[0.06] dark:border-white/[0.06] hover:bg-zinc-50 dark:hover:bg-white/[0.03] hover:border-zinc-300 dark:hover:border-white/20 transition-all duration-200"
        >
          <div className="flex items-center gap-1.5">
            <ModernClockIcon className="h-4 w-4 text-zinc-400 dark:text-white/40" />
            <span className="text-zinc-600 dark:text-white/60">{timeRange}</span>
          </div>
          <ChevronDown className="h-4 w-4 ml-2 text-zinc-400 dark:text-white/40" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-[220px] bg-transparent border-black/[0.06] dark:border-white/[0.06] shadow-md"
      >
        {timeRanges.map((range) => (
          <DropdownMenuItem
            key={range}
            onSelect={(e) => {
              e.preventDefault()
              setTimeRange(range)
            }}
            className="flex items-center justify-between p-2 cursor-pointer text-sm hover:bg-zinc-50 dark:hover:bg-white/[0.03] focus:bg-zinc-50 dark:focus:bg-white/[0.03] transition-all duration-200"
          >
            <div className="flex items-center">
              <div
                className={`flex items-center justify-center w-5 h-5 rounded-full mr-2 ${
                  range === timeRange
                    ? 'bg-zinc-100 dark:bg-white/[0.06]'
                    : 'bg-zinc-100/50 dark:bg-white/[0.04]'
                }`}
              >
                <ModernClockIcon
                  className={`h-3 w-3 ${
                    range === timeRange
                      ? 'text-zinc-800 dark:text-white'
                      : 'text-zinc-300 dark:text-white/30'
                  }`}
                />
              </div>
              <span
                className={range === timeRange ? 'text-zinc-800 dark:text-white font-medium' : ''}
              >
                {range}
              </span>
            </div>
            {timeRange === range && (
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
