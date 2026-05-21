import { Check, Copy, Maximize2, RotateCcw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { QuickAddConnectionPopover } from './quick-add-connection-popover'

interface InputToolbarProps {
  charCount: number
  copied: boolean
  initialValue: string | null
  currentValue: string
  showClearConfirm: boolean
  setShowClearConfirm: (show: boolean) => void
  hasIncomingConnections: boolean
  incomingConnections: any[]
  onExpand: () => void
  onCopy: () => void
  onReset: () => void
  onClear: () => void
  onAddConnection: (connection: any, field?: any) => void
}

export function InputToolbar({
  charCount,
  copied,
  initialValue,
  currentValue,
  showClearConfirm,
  setShowClearConfirm,
  hasIncomingConnections,
  incomingConnections,
  onExpand,
  onCopy,
  onReset,
  onClear,
  onAddConnection,
}: InputToolbarProps) {
  return (
    <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 opacity-0 group-hover/input:opacity-100 transition-opacity duration-200 bg-background/90 backdrop-blur-sm rounded-md border border-border/50 shadow-sm px-0.5 py-0.5 z-10">
      {/* Expand Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-primary/10"
            onClick={onExpand}
          >
            <Maximize2 className="w-3 h-3 text-muted-foreground" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p>Expand editor</p>
          <span className="text-muted-foreground text-[10px]">Full screen editing</span>
        </TooltipContent>
      </Tooltip>

      {/* Copy Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-primary/10"
            onClick={onCopy}
            disabled={!charCount}
          >
            {copied ? (
              <Check className="w-3 h-3 text-green-500" />
            ) : (
              <Copy className="w-3 h-3 text-muted-foreground" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p>{copied ? 'Copied!' : 'Copy content'}</p>
        </TooltipContent>
      </Tooltip>

      {/* Reset Button */}
      {initialValue !== null && initialValue !== currentValue && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-orange-500/10"
              onClick={onReset}
            >
              <RotateCcw className="w-3 h-3 text-orange-500" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            <p>Reset to original</p>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Clear Button */}
      {charCount > 0 && (
        <Popover open={showClearConfirm} onOpenChange={setShowClearConfirm}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-red-500/10">
                  <Trash2 className="w-3 h-3 text-red-500/70" />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              <p>Clear content</p>
            </TooltipContent>
          </Tooltip>
          <PopoverContent className="w-auto p-3" align="end">
            <p className="text-sm mb-2">Clear all content?</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowClearConfirm(false)}>
                Cancel
              </Button>
              <Button size="sm" variant="destructive" onClick={onClear}>
                Clear
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Quick-add connection button */}
      {hasIncomingConnections && (
        <QuickAddConnectionPopover
          incomingConnections={incomingConnections}
          onAddConnection={onAddConnection}
        />
      )}
    </div>
  )
}
