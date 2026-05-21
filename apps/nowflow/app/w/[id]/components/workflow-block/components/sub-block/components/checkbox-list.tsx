import { useCallback, useMemo } from 'react'
import { Check, Minus } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useWorkflowRegistry } from '@/stores/workflows/registry/store'
import { useSubBlockStore } from '@/stores/workflows/subblock/store'
import { useSubBlockValue } from '../hooks/use-sub-block-value'

interface CheckboxListProps {
  blockId: string
  subBlockId: string
  title: string
  options: { label: string; id: string; description?: string }[]
  layout?: 'full' | 'half'
  showSelectAll?: boolean
}

// Individual checkbox item component
function CheckboxItem({
  blockId,
  option,
}: {
  blockId: string
  option: { label: string; id: string; description?: string }
}) {
  const [value, setValue] = useSubBlockValue(blockId, option.id)

  const hasDescription = !!option.description

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md cursor-pointer',
        hasDescription ? 'items-start p-2.5' : 'p-1.5',
        'hover:bg-muted/50 transition-colors duration-150',
        'group',
        Boolean(value) && 'bg-primary/5'
      )}
      onClick={() => setValue(!Boolean(value))}
    >
      <Checkbox
        id={`${blockId}-${option.id}`}
        checked={Boolean(value)}
        onCheckedChange={(checked) => setValue(checked as boolean)}
        className={cn(
          hasDescription && 'mt-0.5',
          'data-[state=checked]:bg-primary data-[state=checked]:border-primary',
          'transition-colors duration-150',
          'h-3.5 w-3.5'
        )}
        onClick={(e) => e.stopPropagation()}
      />
      <div className="flex-1 min-w-0">
        <Label
          htmlFor={`${blockId}-${option.id}`}
          className={cn(
            'font-medium leading-none cursor-pointer',
            hasDescription ? 'text-sm' : 'text-xs',
            'group-hover:text-foreground transition-colors'
          )}
        >
          {option.label}
        </Label>
        {option.description && (
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{option.description}</p>
        )}
      </div>
    </div>
  )
}

export function CheckboxList({
  blockId,
  subBlockId,
  title,
  options,
  layout,
  showSelectAll = true,
}: CheckboxListProps) {
  // Subscribe only to this block's data (not the entire store)
  const activeWorkflowId = useWorkflowRegistry((s) => s.activeWorkflowId)
  const optionIds = useMemo(() => options.map((o) => o.id), [options])
  const optionValues = useSubBlockStore(
    useShallow(
      useCallback(
        (s: any) => {
          if (!activeWorkflowId) return {}
          const blockData = s.workflowValues[activeWorkflowId]?.[blockId] || {}
          const result: Record<string, any> = {}
          for (const id of optionIds) {
            result[id] = blockData[id] ?? null
          }
          return result
        },
        [activeWorkflowId, blockId, optionIds]
      )
    )
  )

  // Calculate selection state from the narrow subscription
  const selectionState = useMemo(() => {
    const checkedCount = options.filter((option) => Boolean(optionValues[option.id])).length

    return {
      all: checkedCount === options.length,
      none: checkedCount === 0,
      some: checkedCount > 0 && checkedCount < options.length,
      count: checkedCount,
    }
  }, [options, optionValues])

  // Handle select all / deselect all
  const handleSelectAll = () => {
    const newValue = !selectionState.all
    const store = useSubBlockStore.getState()
    options.forEach((option) => {
      store.setValue(blockId, option.id, newValue)
    })
  }

  // Detect if any option has a description (affects spacing)
  const hasDescriptions = options.some((o) => !!o.description)

  return (
    <div className="space-y-1">
      {/* Select All Header */}
      {showSelectAll && options.length > 1 && (
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] text-muted-foreground">
            {selectionState.count}/{options.length}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSelectAll}
            className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
          >
            {selectionState.all ? (
              <>
                <Minus className="w-2.5 h-2.5 mr-0.5" />
                Deselect
              </>
            ) : (
              <>
                <Check className="w-2.5 h-2.5 mr-0.5" />
                All
              </>
            )}
          </Button>
        </div>
      )}

      {/* Options Grid */}
      <div
        className={cn(
          'grid',
          hasDescriptions ? 'gap-1' : 'gap-0.5',
          layout === 'half' ? 'grid-cols-2' : 'grid-cols-1',
          hasDescriptions ? 'p-1' : 'p-0.5',
          'rounded-md',
          'bg-muted/20 border border-border/30'
        )}
      >
        {options.map((option) => (
          <CheckboxItem key={option.id} blockId={blockId} option={option} />
        ))}
      </div>

      {/* Empty state */}
      {options.length === 0 && (
        <div className="py-4 text-center text-xs text-muted-foreground">No options available</div>
      )}
    </div>
  )
}
