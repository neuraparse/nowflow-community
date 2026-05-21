import { Label } from '@/components/ui/label'
import { Switch as UISwitch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { useSubBlockValue } from '../hooks/use-sub-block-value'

interface SwitchProps {
  blockId: string
  subBlockId: string
  title: string
  description?: string
  disabled?: boolean
}

export function Switch({ blockId, subBlockId, title, description, disabled }: SwitchProps) {
  const [value, setValue] = useSubBlockValue(blockId, subBlockId)

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 p-3 rounded-lg',
        'bg-muted/30 hover:bg-muted/50',
        'border border-border/40 hover:border-border/60',
        'transition-all duration-200',
        'group cursor-pointer',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
      onClick={() => !disabled && setValue(!Boolean(value))}
    >
      <div className="flex-1 min-w-0">
        <Label
          className={cn(
            'text-sm font-medium leading-none cursor-pointer',
            'group-hover:text-foreground transition-colors',
            disabled && 'cursor-not-allowed'
          )}
        >
          {title}
        </Label>
        {description && (
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
        )}
      </div>
      <UISwitch
        checked={Boolean(value)}
        onCheckedChange={(checked) => !disabled && setValue(checked)}
        disabled={disabled}
        className={cn('data-[state=checked]:bg-primary', 'transition-colors duration-200')}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}
