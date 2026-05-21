import { useEffect, useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import { useSubBlockValue } from '../hooks/use-sub-block-value'

interface SliderInputProps {
  min?: number
  max?: number
  defaultValue: number
  blockId: string
  subBlockId: string
  step?: number
  integer?: boolean
  showInput?: boolean
  label?: string
}

export function SliderInput({
  min = 0,
  max = 100,
  defaultValue,
  blockId,
  subBlockId,
  step = 0.1,
  integer = false,
  showInput = true,
  label,
}: SliderInputProps) {
  const [value, setValue] = useSubBlockValue<number>(blockId, subBlockId)
  const [inputValue, setInputValue] = useState<string>('')

  // Clamp the value within bounds while preserving relative position when possible
  const normalizedValue = useMemo(() => {
    if (value === null || value === undefined) return defaultValue

    // If value exceeds max, scale it down proportionally
    if (value > max) {
      const prevMax = Math.max(max * 2, value)
      const scaledValue = (value / prevMax) * max
      return integer ? Math.round(scaledValue) : scaledValue
    }

    // Otherwise just clamp it
    const clampedValue = Math.min(Math.max(value, min), max)
    return integer ? Math.round(clampedValue) : clampedValue
  }, [value, min, max, defaultValue, integer])

  // Sync input value with normalized value
  useEffect(() => {
    const displayValue = integer
      ? Math.round(normalizedValue).toString()
      : normalizedValue.toFixed(1)
    setInputValue(displayValue)
  }, [normalizedValue, integer])

  // Update the value if it needs normalization
  useEffect(() => {
    if (value !== null && value !== undefined && value !== normalizedValue) {
      setValue(normalizedValue)
    }
  }, [normalizedValue, value, setValue])

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
  }

  // Handle input blur - validate and apply value
  const handleInputBlur = () => {
    const parsed = parseFloat(inputValue)
    if (!isNaN(parsed)) {
      const clamped = Math.min(Math.max(parsed, min), max)
      const finalValue = integer ? Math.round(clamped) : clamped
      setValue(finalValue)
    } else {
      // Reset to current value if invalid
      const displayValue = integer
        ? Math.round(normalizedValue).toString()
        : normalizedValue.toFixed(1)
      setInputValue(displayValue)
    }
  }

  // Handle keyboard interactions
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleInputBlur()
      ;(e.target as HTMLInputElement).blur()
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      const currentVal = parseFloat(inputValue)
      if (isNaN(currentVal)) return

      const increment = e.shiftKey ? step * 10 : step
      const delta = e.key === 'ArrowUp' ? increment : -increment
      const newVal = Math.min(Math.max(currentVal + delta, min), max)
      const finalVal = integer ? Math.round(newVal) : parseFloat(newVal.toFixed(2))

      setValue(finalVal)
      setInputValue(integer ? finalVal.toString() : finalVal.toFixed(1))
    }
  }

  // Calculate percentage for visual indicators
  const percentage = ((normalizedValue - min) / (max - min)) * 100

  return (
    <div className="space-y-3">
      {/* Slider with track fill effect */}
      <div className="relative pt-1 pb-2 group">
        <Slider
          value={[normalizedValue]}
          min={min}
          max={max}
          step={integer ? 1 : step}
          onValueChange={(val) => setValue(integer ? Math.round(val[0]) : val[0])}
          className={cn(
            '[&_[role=slider]]:h-4 [&_[role=slider]]:w-4',
            '[&_[role=slider]]:border-2 [&_[role=slider]]:border-primary',
            '[&_[role=slider]]:bg-background [&_[role=slider]]:shadow-md',
            '[&_[role=slider]]:transition-transform [&_[role=slider]]:duration-150',
            '[&_[role=slider]]:hover:scale-110 [&_[role=slider]]:focus-visible:scale-110',
            '[&_[class*=SliderTrack]]:h-2 [&_[class*=SliderTrack]]:bg-muted/60',
            '[&_[class*=SliderRange]]:bg-primary/80'
          )}
        />

        {/* Value tooltip on hover */}
        <div
          className="absolute -top-6 text-xs font-medium bg-primary text-primary-foreground px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
          style={{
            left: `${percentage}%`,
            transform: 'translateX(-50%)',
          }}
        >
          {integer ? Math.round(normalizedValue) : normalizedValue.toFixed(1)}
        </div>
      </div>

      {/* Min/Max labels and Input */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground/70 tabular-nums min-w-[2rem]">
          {integer ? min : min.toFixed(1)}
        </span>

        {showInput ? (
          <div className="flex-1 flex justify-center">
            <Input
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onBlur={handleInputBlur}
              onKeyDown={handleInputKeyDown}
              className={cn(
                'w-20 h-7 text-center text-sm font-medium tabular-nums',
                'border-border/50 focus:border-primary/40',
                'bg-muted/30 hover:bg-muted/50 focus:bg-background',
                'focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:ring-offset-0',
                'transition-all duration-150'
              )}
            />
          </div>
        ) : (
          <span className="flex-1 text-center text-sm font-medium tabular-nums">
            {integer ? Math.round(normalizedValue) : normalizedValue.toFixed(1)}
          </span>
        )}

        <span className="text-xs text-muted-foreground/70 tabular-nums min-w-[2rem] text-right">
          {integer ? max : max.toFixed(1)}
        </span>
      </div>
    </div>
  )
}
