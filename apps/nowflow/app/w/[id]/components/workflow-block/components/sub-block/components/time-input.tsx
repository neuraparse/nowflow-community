'use client'

import * as React from 'react'
import { ChevronDown, ChevronUp, Clock, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useSubBlockValue } from '../hooks/use-sub-block-value'

interface TimeInputProps {
  blockId: string
  subBlockId: string
  placeholder?: string
  className?: string
}

const TIME_PRESETS = [
  { label: 'Morning', time: '09:00' },
  { label: 'Noon', time: '12:00' },
  { label: 'Afternoon', time: '14:00' },
  { label: 'Evening', time: '18:00' },
  { label: 'Night', time: '21:00' },
]

export function TimeInput({ blockId, subBlockId, placeholder, className }: TimeInputProps) {
  const [value, setValue] = useSubBlockValue<string>(blockId, subBlockId, true)
  const [isOpen, setIsOpen] = React.useState(false)

  // Convert 24h time string to display format (12h with AM/PM)
  const formatDisplayTime = (time: string) => {
    if (!time) return ''
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours, 10)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes} ${ampm}`
  }

  // Convert display time to 24h format for storage
  const formatStorageTime = (hour: number, minute: number, ampm: string) => {
    const hours24 = ampm === 'PM' ? (hour === 12 ? 12 : hour + 12) : hour === 12 ? 0 : hour
    return `${hours24.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
  }

  const [hour, setHour] = React.useState<number>(12)
  const [minute, setMinute] = React.useState<number>(0)
  const [ampm, setAmpm] = React.useState<'AM' | 'PM'>('AM')

  // Update the time when any component changes
  const updateTime = (newHour?: number, newMinute?: number, newAmpm?: 'AM' | 'PM') => {
    const h = newHour ?? hour
    const m = newMinute ?? minute
    const p = newAmpm ?? ampm
    setValue(formatStorageTime(h, m, p))
  }

  // Initialize from existing value
  React.useEffect(() => {
    if (value) {
      const [hours, minutes] = value.split(':')
      const hour24 = parseInt(hours, 10)
      const min = parseInt(minutes, 10)
      const isAM = hour24 < 12
      setHour(hour24 % 12 || 12)
      setMinute(min)
      setAmpm(isAM ? 'AM' : 'PM')
    }
  }, [value])

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    setValue('')
  }

  const handlePresetClick = (preset: (typeof TIME_PRESETS)[0]) => {
    setValue(preset.time)
    setIsOpen(false)
  }

  const incrementHour = () => {
    const newHour = hour === 12 ? 1 : hour + 1
    setHour(newHour)
    updateTime(newHour)
  }

  const decrementHour = () => {
    const newHour = hour === 1 ? 12 : hour - 1
    setHour(newHour)
    updateTime(newHour)
  }

  const incrementMinute = () => {
    const newMinute = minute === 59 ? 0 : minute + 1
    setMinute(newMinute)
    updateTime(undefined, newMinute)
  }

  const decrementMinute = () => {
    const newMinute = minute === 0 ? 59 : minute - 1
    setMinute(newMinute)
    updateTime(undefined, newMinute)
  }

  const toggleAmPm = () => {
    const newAmpm = ampm === 'AM' ? 'PM' : 'AM'
    setAmpm(newAmpm)
    updateTime(undefined, undefined, newAmpm)
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
            !value && 'text-muted-foreground',
            className
          )}
        >
          <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
          <span className="flex-1">
            {value ? formatDisplayTime(value) : placeholder || 'Select time'}
          </span>
          {value && (
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
            {TIME_PRESETS.map((preset) => (
              <Button
                key={preset.label}
                variant="ghost"
                size="sm"
                className={cn(
                  'w-full justify-start text-sm font-normal',
                  'hover:bg-primary/10 hover:text-primary',
                  value === preset.time && 'bg-primary/10 text-primary'
                )}
                onClick={() => handlePresetClick(preset)}
              >
                <span className="flex-1">{preset.label}</span>
                <span className="text-xs text-muted-foreground ml-2">
                  {formatDisplayTime(preset.time)}
                </span>
              </Button>
            ))}
          </div>

          {/* Time Picker */}
          <div className="p-4">
            <p className="text-xs font-medium text-muted-foreground mb-3 text-center">
              Custom Time
            </p>
            <div className="flex items-center gap-2">
              {/* Hour */}
              <div className="flex flex-col items-center">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-muted"
                  onClick={incrementHour}
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <input
                  type="text"
                  value={hour.toString().padStart(2, '0')}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10)
                    if (!isNaN(val) && val >= 1 && val <= 12) {
                      setHour(val)
                      updateTime(val)
                    } else if (e.target.value === '') {
                      setHour(12)
                      updateTime(12)
                    }
                  }}
                  onFocus={(e) => e.target.select()}
                  className={cn(
                    'w-14 h-12 text-center',
                    'text-2xl font-semibold tabular-nums',
                    'bg-muted/50 rounded-lg',
                    'border-0 focus:ring-2 focus:ring-primary/50',
                    'outline-none transition-all'
                  )}
                  maxLength={2}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-muted"
                  onClick={decrementHour}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>

              <span className="text-2xl font-semibold text-muted-foreground">:</span>

              {/* Minute */}
              <div className="flex flex-col items-center">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-muted"
                  onClick={incrementMinute}
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <input
                  type="text"
                  value={minute.toString().padStart(2, '0')}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10)
                    if (!isNaN(val) && val >= 0 && val <= 59) {
                      setMinute(val)
                      updateTime(undefined, val)
                    } else if (e.target.value === '') {
                      setMinute(0)
                      updateTime(undefined, 0)
                    }
                  }}
                  onFocus={(e) => e.target.select()}
                  className={cn(
                    'w-14 h-12 text-center',
                    'text-2xl font-semibold tabular-nums',
                    'bg-muted/50 rounded-lg',
                    'border-0 focus:ring-2 focus:ring-primary/50',
                    'outline-none transition-all'
                  )}
                  maxLength={2}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-muted"
                  onClick={decrementMinute}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>

              {/* AM/PM */}
              <div className="flex flex-col items-center ml-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-muted"
                  onClick={toggleAmPm}
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <div
                  className={cn(
                    'w-14 h-12 flex items-center justify-center',
                    'text-lg font-semibold',
                    'bg-primary/10 text-primary rounded-lg',
                    'cursor-pointer hover:bg-primary/20 transition-colors'
                  )}
                  onClick={toggleAmPm}
                >
                  {ampm}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-muted"
                  onClick={toggleAmPm}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
