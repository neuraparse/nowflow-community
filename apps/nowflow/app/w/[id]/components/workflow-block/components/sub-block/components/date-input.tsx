'use client'

import * as React from 'react'
import { addDays, format, startOfDay } from 'date-fns'
import { Calendar as CalendarIcon, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useNotificationStore } from '@/stores/notifications/store'
import { useSubBlockValue } from '../hooks/use-sub-block-value'

interface DateInputProps {
  blockId: string
  subBlockId: string
  placeholder?: string
  allowPastDates?: boolean
}

const DATE_PRESETS = [
  { label: 'Today', getValue: () => startOfDay(new Date()) },
  { label: 'Tomorrow', getValue: () => addDays(startOfDay(new Date()), 1) },
  { label: 'In 3 days', getValue: () => addDays(startOfDay(new Date()), 3) },
  { label: 'In a week', getValue: () => addDays(startOfDay(new Date()), 7) },
  { label: 'In 2 weeks', getValue: () => addDays(startOfDay(new Date()), 14) },
]

export function DateInput({
  blockId,
  subBlockId,
  placeholder,
  allowPastDates = false,
}: DateInputProps) {
  const [value, setValue] = useSubBlockValue<string>(blockId, subBlockId, true)
  const [isOpen, setIsOpen] = React.useState(false)
  const addNotification = useNotificationStore((state) => state.addNotification)
  const date = value ? new Date(value) : undefined

  const isPastDate = React.useMemo(() => {
    if (!date || allowPastDates) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return date < today
  }, [date, allowPastDates])

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      if (!allowPastDates && selectedDate < today) {
        addNotification('error', 'Cannot select a date in the past', blockId)
        return
      }
    }
    setValue(selectedDate?.toISOString() || '')
    setIsOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    setValue('')
  }

  const handlePresetClick = (preset: (typeof DATE_PRESETS)[0]) => {
    const presetDate = preset.getValue()
    setValue(presetDate.toISOString())
    setIsOpen(false)
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-full justify-start text-left font-normal',
            'bg-background/50 hover:bg-background/80',
            'border-border/60 hover:border-border',
            'transition-all duration-200',
            'shadow-sm hover:shadow',
            'group',
            !date && 'text-muted-foreground',
            isPastDate && 'border-red-500/50 bg-red-500/5'
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
          <span className="flex-1">
            {date ? format(date, 'PPP') : placeholder || 'Pick a date'}
          </span>
          {date && (
            <X
              className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity"
              onClick={handleClear}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn('w-auto p-0', 'border-border/60 shadow-lg', 'bg-popover/95 backdrop-blur-sm')}
        align="start"
      >
        <div className="flex">
          {/* Presets */}
          <div className="border-r border-border/40 p-2 space-y-1">
            <p className="text-xs font-medium text-muted-foreground px-2 py-1">Quick Select</p>
            {DATE_PRESETS.map((preset) => (
              <Button
                key={preset.label}
                variant="ghost"
                size="sm"
                className={cn(
                  'w-full justify-start text-sm font-normal',
                  'hover:bg-primary/10 hover:text-primary'
                )}
                onClick={() => handlePresetClick(preset)}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          {/* Calendar */}
          <div className="p-2">
            <Calendar
              mode="single"
              selected={date}
              onSelect={handleDateSelect}
              disabled={allowPastDates ? undefined : (date) => date < startOfDay(new Date())}
              initialFocus
              className="rounded-md"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
