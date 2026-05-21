import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import { ChevronsUpDown } from 'lucide-react'
import { checkEnvVarTrigger, EnvVarDropdown } from '@/components/ui/env-var-dropdown'
import { formatDisplayText } from '@/components/ui/formatted-text'
import { checkTagTrigger, TagDropdown } from '@/components/ui/tag-dropdown'
import { createLogger } from '@/lib/logs/console-logger'
import { cn } from '@/lib/utils'
import { useBlockConnections } from '@/app/w/[id]/hooks/use-block-connections'
import { SubBlockConfig } from '@/blocks/types'
import { useDebouncedValue } from '../../hooks/use-debounced-value'
import { useSubBlockValue } from '../../hooks/use-sub-block-value'
import { ExpandedEditorModal } from './expanded-editor-modal'
import { InputToolbar } from './input-toolbar'

const logger = createLogger('LongInput')

interface LongInputProps {
  placeholder?: string
  blockId: string
  subBlockId: string
  isConnecting: boolean
  config: SubBlockConfig
  rows?: number
}

// Constants
const DEFAULT_ROWS = 4
const ROW_HEIGHT_PX = 24
const MIN_HEIGHT_PX = 80

export function LongInput({
  placeholder,
  blockId,
  subBlockId,
  isConnecting,
  config,
  rows,
}: LongInputProps) {
  const [storeValue, setStoreValue] = useSubBlockValue(blockId, subBlockId)
  const [showEnvVars, setShowEnvVars] = useState(false)
  const [showTags, setShowTags] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [cursorPosition, setCursorPosition] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const [activeSourceBlockId, setActiveSourceBlockId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Debounced local value -- decoupled from store roundtrip
  const {
    localValue,
    setLocalValue,
    localValueRef,
    isFocused,
    setIsFocused,
    syncToStore,
    flushToStore,
    setValue,
  } = useDebouncedValue(storeValue, setStoreValue)

  // Overlay always shows current localValue
  const deferredDisplayValue = localValue

  // Alias for rest of component
  const value = localValue

  // Enhanced feature state
  const [isExpanded, setIsExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [initialValue, setInitialValue] = useState<string | null>(null)

  // Get available connections for quick-add
  const { incomingConnections, hasIncomingConnections } = useBlockConnections(blockId)

  // Calculate initial height based on rows prop
  const getInitialHeight = () => {
    const rowCount = rows || DEFAULT_ROWS
    return Math.max(rowCount * ROW_HEIGHT_PX, MIN_HEIGHT_PX)
  }

  const [height, setHeight] = useState(getInitialHeight())
  const isResizing = useRef(false)

  // Get ReactFlow instance for zoom control
  const reactFlowInstance = useReactFlow()

  // Store initial value when component mounts for reset functionality
  useEffect(() => {
    if (initialValue === null && value !== undefined) {
      setInitialValue(value?.toString() ?? '')
    }
  }, [value, initialValue])

  // Copy to clipboard handler
  const handleCopy = useCallback(async () => {
    const textToCopy = value?.toString() ?? ''
    if (!textToCopy) return

    try {
      await navigator.clipboard.writeText(textToCopy)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      logger.error('Failed to copy:', err)
    }
  }, [value])

  // Clear content handler
  const handleClear = useCallback(() => {
    setValue('')
    setShowClearConfirm(false)
    textareaRef.current?.focus()
  }, [setValue])

  // Reset to initial value handler
  const handleReset = useCallback(() => {
    if (initialValue !== null) {
      setValue(initialValue)
      textareaRef.current?.focus()
    }
  }, [initialValue, setValue])

  // Character count
  const charCount = value?.toString().length ?? 0
  const wordCount = value?.toString().trim() ? value.toString().trim().split(/\s+/).length : 0
  const lineCount = value?.toString().split('\n').length ?? 0

  // Set initial height on first render
  useLayoutEffect(() => {
    setHeight(getInitialHeight())
  }, [rows])

  // Handle input changes -- local state updates instantly, store is debounced
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    const newCursorPosition = e.target.selectionStart ?? 0
    setLocalValue(newValue)
    syncToStore(newValue)
    setCursorPosition(newCursorPosition)

    const envVarTrigger = checkEnvVarTrigger(newValue, newCursorPosition)
    setShowEnvVars(envVarTrigger.show)
    setSearchTerm(envVarTrigger.show ? envVarTrigger.searchTerm : '')

    const tagTrigger = checkTagTrigger(newValue, newCursorPosition)
    setShowTags(tagTrigger.show)
  }

  // Sync scroll position between textarea and overlay
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (overlayRef.current) {
      overlayRef.current.scrollTop = e.currentTarget.scrollTop
      overlayRef.current.scrollLeft = e.currentTarget.scrollLeft
    }
  }

  // Ensure overlay scroll stays in sync when content changes
  useEffect(() => {
    requestAnimationFrame(() => {
      if (textareaRef.current && overlayRef.current) {
        overlayRef.current.scrollTop = textareaRef.current.scrollTop
        overlayRef.current.scrollLeft = textareaRef.current.scrollLeft
      }
    })
  }, [value])

  // Handle resize functionality
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault()
    isResizing.current = true

    const startY = e.clientY
    const startHeight = height

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizing.current) return

      const deltaY = moveEvent.clientY - startY
      const newHeight = Math.max(MIN_HEIGHT_PX, startHeight + deltaY)
      if (containerRef.current) {
        containerRef.current.style.height = `${newHeight}px`
      }
    }

    const handleMouseUp = () => {
      if (containerRef.current) {
        const finalHeight = parseInt(containerRef.current.style.height, 10) || height
        setHeight(finalHeight)
      }

      isResizing.current = false
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent<HTMLTextAreaElement>) => {
    if (config?.connectionDroppable === false) return
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
    if (config?.connectionDroppable === false) return
    e.preventDefault()

    try {
      const raw = e.dataTransfer.getData('application/json')
      if (!raw) return
      const data = JSON.parse(raw)
      if (data.type !== 'connectionBlock') return

      const dropPosition = textareaRef.current?.selectionStart ?? value?.toString().length ?? 0
      const currentValue = value?.toString() ?? ''
      const newValue = currentValue.slice(0, dropPosition) + '<' + currentValue.slice(dropPosition)

      textareaRef.current?.focus()

      Promise.resolve().then(() => {
        setValue(newValue)
        setCursorPosition(dropPosition + 1)
        setShowTags(true)

        if (data.connectionData?.sourceBlockId) {
          setActiveSourceBlockId(data.connectionData.sourceBlockId)
        }

        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.selectionStart = dropPosition + 1
            textareaRef.current.selectionEnd = dropPosition + 1
          }
        }, 0)
      })
    } catch (error) {
      logger.error('Failed to parse drop data:', { error })
    }
  }

  // Handle paste events - strip ALL rich text formatting
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault()
    const plainText = e.clipboardData.getData('text/plain')
    const target = e.currentTarget

    const start = target.selectionStart ?? 0
    const end = target.selectionEnd ?? 0
    const newValue = localValue.slice(0, start) + plainText + localValue.slice(end)
    const newCursorPos = start + plainText.length

    setValue(newValue)
    setCursorPosition(newCursorPos)

    requestAnimationFrame(() => {
      target.selectionStart = newCursorPos
      target.selectionEnd = newCursorPos
      requestAnimationFrame(() => {
        if (target === textareaRef.current && overlayRef.current) {
          overlayRef.current.scrollTop = target.scrollTop
          overlayRef.current.scrollLeft = target.scrollLeft
        }
      })
    })
  }

  // Handle key combinations
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      setShowEnvVars(false)
      setShowTags(false)
    }
  }

  // Handle wheel events to control ReactFlow zoom
  const handleWheel = (e: React.WheelEvent<HTMLTextAreaElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      e.stopPropagation()

      const currentZoom = reactFlowInstance.getZoom()
      const { x: viewportX, y: viewportY } = reactFlowInstance.getViewport()
      const delta = e.deltaY > 0 ? 1 : -1
      const zoomFactor = Math.pow(0.96, delta)
      const newZoom = Math.min(Math.max(currentZoom * zoomFactor, 0.1), 1)

      const { x: pointerX, y: pointerY } = reactFlowInstance.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      })

      const newViewportX = viewportX + (pointerX * currentZoom - pointerX * newZoom)
      const newViewportY = viewportY + (pointerY * currentZoom - pointerY * newZoom)

      reactFlowInstance.setViewport(
        { x: newViewportX, y: newViewportY, zoom: newZoom },
        { duration: 0 }
      )

      return false
    }

    if (overlayRef.current) {
      overlayRef.current.scrollTop = e.currentTarget.scrollTop
      overlayRef.current.scrollLeft = e.currentTarget.scrollLeft
    }
  }

  // Quick-add connection handler
  const handleQuickAddConnection = (connection: any, field?: any) => {
    const currentValue = value?.toString() ?? ''
    const normalizeBlockName = (name: string) =>
      name
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[^a-z0-9]/g, '')
    const blockRef = connection.name ? normalizeBlockName(connection.name) : connection.id
    const connectionTag = field
      ? field.name === 'response'
        ? `<${blockRef}.response>`
        : `<${blockRef}.response.${field.name}>`
      : `<${blockRef}.response>`

    if (!currentValue.trim()) {
      setValue(connectionTag)
    } else {
      setValue(currentValue + ' ' + connectionTag)
    }

    textareaRef.current?.focus()
  }

  return (
    <>
      <div className="relative w-full group/input">
        {/* Main Input Container */}
        <div
          ref={containerRef}
          className={cn(
            'relative w-full rounded-md border overflow-hidden',
            'focus-within:ring-1 focus-within:ring-primary/30',
            isConnecting &&
              config?.connectionDroppable !== false &&
              'ring-2 ring-blue-500 ring-offset-2'
          )}
          style={{
            height: `${height}px`,
            backgroundColor: 'var(--color-card)',
            borderColor: 'var(--color-border)',
          }}
        >
          {/* Overlay: FIRST in DOM = behind textarea */}
          <div
            ref={overlayRef}
            className="absolute inset-0 pointer-events-none overlay-text-container text-white"
            style={{
              padding: '8px 12px',
              overflowY: 'auto',
              overflowX: 'hidden',
              whiteSpace: 'pre-wrap',
              overflowWrap: 'break-word',
              fontFamily: 'inherit',
              fontSize: '0.875rem',
              lineHeight: '1.25rem',
              letterSpacing: 'normal',
              color: '#f8fafc !important',
            }}
          >
            {formatDisplayText(deferredDisplayValue, true)}
          </div>

          {/* Textarea: SECOND in DOM = on top */}
          <textarea
            ref={textareaRef}
            className="overlay-textarea unstyled-editor-field text-white caret-white"
            placeholder={placeholder ?? ''}
            value={value?.toString() ?? ''}
            onChange={handleChange}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onScroll={handleScroll}
            onWheel={handleWheel}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            spellCheck={false}
            onFocus={() => {
              setIsFocused(true)
              setShowEnvVars(false)
              setShowTags(false)
              setSearchTerm('')
            }}
            onBlur={() => {
              flushToStore(localValueRef.current)
              setIsFocused(false)
            }}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              padding: '8px 12px',
              fontFamily: 'inherit',
              fontSize: '0.875rem',
              lineHeight: '1.25rem',
              letterSpacing: 'normal',
              whiteSpace: 'pre-wrap',
              overflowWrap: 'break-word',
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              resize: 'none',
              color: '#f8fafc !important',
              WebkitTextFillColor: 'transparent',
              caretColor: '#f8fafc !important',
            }}
          />

          {/* Quick Action Toolbar */}
          <InputToolbar
            charCount={charCount}
            copied={copied}
            initialValue={initialValue}
            currentValue={value?.toString() ?? ''}
            showClearConfirm={showClearConfirm}
            setShowClearConfirm={setShowClearConfirm}
            hasIncomingConnections={hasIncomingConnections}
            incomingConnections={incomingConnections}
            onExpand={() => setIsExpanded(true)}
            onCopy={handleCopy}
            onReset={handleReset}
            onClear={handleClear}
            onAddConnection={handleQuickAddConnection}
          />

          {/* Custom resize handle */}
          <div
            className="absolute bottom-1 right-1 w-4 h-4 cursor-s-resize flex items-center justify-center bg-background rounded-sm z-10"
            onMouseDown={startResize}
          >
            <ChevronsUpDown className="h-3 w-3 text-muted-foreground/70" />
          </div>
        </div>

        {/* Character Count Footer */}
        <div className="flex items-center justify-between px-1 mt-1 opacity-0 group-hover/input:opacity-100 transition-opacity duration-200">
          <div className="text-[10px] text-muted-foreground/60 flex items-center gap-2">
            <span>{charCount} chars</span>
            <span className="text-muted-foreground/40">•</span>
            <span>{wordCount} words</span>
            <span className="text-muted-foreground/40">•</span>
            <span>{lineCount} lines</span>
          </div>
        </div>

        <EnvVarDropdown
          visible={showEnvVars}
          onSelect={setValue}
          searchTerm={searchTerm}
          inputValue={value?.toString() ?? ''}
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
          inputValue={value?.toString() ?? ''}
          cursorPosition={cursorPosition}
          parentRef={containerRef}
          onClose={() => {
            setShowTags(false)
            setActiveSourceBlockId(null)
          }}
        />
      </div>

      {/* Expanded Editor Modal */}
      <ExpandedEditorModal
        isOpen={isExpanded}
        onClose={() => setIsExpanded(false)}
        value={value?.toString() ?? ''}
        onLocalValueChange={setLocalValue}
        syncToStore={syncToStore}
        setValue={setValue}
        placeholder={placeholder}
        configTitle={config?.title}
        charCount={charCount}
        wordCount={wordCount}
        lineCount={lineCount}
        copied={copied}
        onCopy={handleCopy}
        onClear={handleClear}
        showEnvVars={showEnvVars}
        setShowEnvVars={setShowEnvVars}
        showTags={showTags}
        setShowTags={setShowTags}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        cursorPosition={cursorPosition}
        setCursorPosition={setCursorPosition}
        blockId={blockId}
        activeSourceBlockId={activeSourceBlockId}
        setActiveSourceBlockId={setActiveSourceBlockId}
        containerRef={containerRef}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
      />
    </>
  )
}
