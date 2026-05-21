import { useCallback, useRef } from 'react'
import { Check, Copy, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { checkEnvVarTrigger, EnvVarDropdown } from '@/components/ui/env-var-dropdown'
import { formatDisplayText } from '@/components/ui/formatted-text'
import { checkTagTrigger, TagDropdown } from '@/components/ui/tag-dropdown'

interface ExpandedEditorModalProps {
  isOpen: boolean
  onClose: () => void
  value: string
  onLocalValueChange: (val: string) => void
  syncToStore: (val: string) => void
  setValue: (val: string) => void
  placeholder?: string
  configTitle?: string
  charCount: number
  wordCount: number
  lineCount: number
  copied: boolean
  onCopy: () => void
  onClear: () => void
  // Tag/env dropdown state
  showEnvVars: boolean
  setShowEnvVars: (show: boolean) => void
  showTags: boolean
  setShowTags: (show: boolean) => void
  searchTerm: string
  setSearchTerm: (term: string) => void
  cursorPosition: number
  setCursorPosition: (pos: number) => void
  blockId: string
  activeSourceBlockId: string | null
  setActiveSourceBlockId: (id: string | null) => void
  containerRef: React.RefObject<HTMLDivElement | null>
  onPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
}

export function ExpandedEditorModal({
  isOpen,
  onClose,
  value,
  onLocalValueChange,
  syncToStore,
  setValue,
  placeholder,
  configTitle,
  charCount,
  wordCount,
  lineCount,
  copied,
  onCopy,
  onClear,
  showEnvVars,
  setShowEnvVars,
  showTags,
  setShowTags,
  searchTerm,
  setSearchTerm,
  cursorPosition,
  setCursorPosition,
  blockId,
  activeSourceBlockId,
  setActiveSourceBlockId,
  containerRef,
  onPaste,
  onKeyDown,
}: ExpandedEditorModalProps) {
  const expandedTextareaRef = useRef<HTMLTextAreaElement>(null)
  const expandedOverlayRef = useRef<HTMLDivElement>(null)

  const handleExpandedScroll = useCallback((e: React.UIEvent<HTMLTextAreaElement>) => {
    if (expandedOverlayRef.current) {
      expandedOverlayRef.current.scrollTop = e.currentTarget.scrollTop
      expandedOverlayRef.current.scrollLeft = e.currentTarget.scrollLeft
    }
  }, [])

  const handleExpandedChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value
      const newCursorPosition = e.target.selectionStart ?? 0
      onLocalValueChange(newValue)
      syncToStore(newValue)
      setCursorPosition(newCursorPosition)

      const envVarTrigger = checkEnvVarTrigger(newValue, newCursorPosition)
      setShowEnvVars(envVarTrigger.show)
      setSearchTerm(envVarTrigger.show ? envVarTrigger.searchTerm : '')

      const tagTrigger = checkTagTrigger(newValue, newCursorPosition)
      setShowTags(tagTrigger.show)
    },
    [syncToStore, onLocalValueChange, setCursorPosition, setShowEnvVars, setSearchTerm, setShowTags]
  )

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 gap-0" data-right-sidebar>
        <DialogHeader className="px-6 py-4 border-b bg-muted/30 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-base font-semibold">
                {configTitle || 'Edit Content'}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {placeholder || 'Enter your content here'}
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>{charCount} characters</span>
              <span className="text-muted-foreground/40">•</span>
              <span>{wordCount} words</span>
              <span className="text-muted-foreground/40">•</span>
              <span>{lineCount} lines</span>
            </div>
          </div>
        </DialogHeader>

        <div
          className="flex-1 relative overflow-hidden"
          style={{ backgroundColor: 'var(--color-card)' }}
        >
          {/* Overlay FIRST in DOM = behind textarea */}
          <div
            ref={expandedOverlayRef}
            className="absolute inset-0 pointer-events-none overlay-text-container text-zinc-800 dark:text-zinc-100"
            style={{
              padding: '12px 16px',
              overflowY: 'auto',
              overflowX: 'hidden',
              whiteSpace: 'pre-wrap',
              overflowWrap: 'break-word',
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
              fontSize: '0.875rem',
              lineHeight: '1.6',
              letterSpacing: 'normal',
              color: '#f8fafc',
            }}
          >
            {formatDisplayText(value, true)}
          </div>

          {/* Textarea SECOND in DOM = on top */}
          <textarea
            ref={expandedTextareaRef}
            className="overlay-textarea unstyled-editor-field text-white caret-white"
            placeholder={placeholder ?? ''}
            value={value}
            onChange={handleExpandedChange}
            onScroll={handleExpandedScroll}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            spellCheck={false}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              padding: '12px 16px',
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
              fontSize: '0.875rem',
              lineHeight: '1.6',
              letterSpacing: 'normal',
              whiteSpace: 'pre-wrap',
              overflowWrap: 'break-word',
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              resize: 'none',
              color: '#f8fafc',
              WebkitTextFillColor: 'transparent',
              caretColor: '#f8fafc',
            }}
          />
        </div>

        {/* Expanded Modal Footer */}
        <div className="px-6 py-3 border-t bg-muted/20 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="px-2 py-1 bg-muted rounded text-[10px] font-mono">
              {'{{'} var {'}}'}
            </span>
            <span>for env vars</span>
            <span className="text-muted-foreground/40 mx-2">•</span>
            <span className="px-2 py-1 bg-muted rounded text-[10px] font-mono">
              {'<'}block{'>'}
            </span>
            <span>for block outputs</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onCopy}
              disabled={!charCount}
              className="h-8"
            >
              {copied ? (
                <Check className="w-4 h-4 mr-2 text-green-500" />
              ) : (
                <Copy className="w-4 h-4 mr-2" />
              )}
              {copied ? 'Copied' : 'Copy'}
            </Button>
            {charCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClear}
                className="h-8 text-red-500 hover:text-red-600 hover:bg-red-500/10"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear
              </Button>
            )}
            <Button variant="default" size="sm" onClick={onClose} className="h-8">
              Done
            </Button>
          </div>
        </div>

        {/* Env and Tag dropdowns in expanded mode */}
        <EnvVarDropdown
          visible={showEnvVars}
          onSelect={setValue}
          searchTerm={searchTerm}
          inputValue={value}
          cursorPosition={cursorPosition}
          onClose={() => {
            setShowEnvVars(false)
            setSearchTerm('')
          }}
        />
        <TagDropdown
          visible={showTags}
          onSelect={setValue}
          blockId={blockId}
          activeSourceBlockId={activeSourceBlockId}
          inputValue={value}
          cursorPosition={cursorPosition}
          parentRef={containerRef}
          onClose={() => {
            setShowTags(false)
            setActiveSourceBlockId(null)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
