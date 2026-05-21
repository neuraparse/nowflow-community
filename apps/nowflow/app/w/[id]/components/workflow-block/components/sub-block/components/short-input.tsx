import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import { Check, Copy, Maximize2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { checkEnvVarTrigger, EnvVarDropdown } from '@/components/ui/env-var-dropdown'
import { formatDisplayText } from '@/components/ui/formatted-text'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { checkTagTrigger, TagDropdown } from '@/components/ui/tag-dropdown'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { createLogger } from '@/lib/logs/console-logger'
import { cn } from '@/lib/utils'
import { useSubBlockStore } from '@/stores/workflows/subblock/store'
import { useBlockConnections } from '@/app/w/[id]/hooks/use-block-connections'
import { TRIGGER_OUTPUT_FIELDS } from '@/blocks/blocks/starter'
import { SubBlockConfig } from '@/blocks/types'
import { useSubBlockValue } from '../hooks/use-sub-block-value'

const logger = createLogger('ShortInput')

interface ShortInputProps {
  placeholder?: string
  password?: boolean
  blockId: string
  subBlockId: string
  isConnecting: boolean
  config: SubBlockConfig
  value?: string
  onChange?: (value: string) => void
}

export function ShortInput({
  blockId,
  subBlockId,
  placeholder,
  password,
  isConnecting,
  config,
  value: propValue,
  onChange,
}: ShortInputProps) {
  const [isFocused, setIsFocused] = useState(false)
  const [showEnvVars, setShowEnvVars] = useState(false)
  const [showTags, setShowTags] = useState(false)
  const [storeValue, setStoreValue] = useSubBlockValue(blockId, subBlockId)
  const [searchTerm, setSearchTerm] = useState('')
  const [cursorPosition, setCursorPosition] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [activeSourceBlockId, setActiveSourceBlockId] = useState<string | null>(null)
  const [showQuickAdd, setShowQuickAdd] = useState(false)

  // Get ReactFlow instance for zoom control
  const reactFlowInstance = useReactFlow()

  // Get available connections for quick-add
  const { incomingConnections, hasIncomingConnections } = useBlockConnections(blockId)

  // Use either controlled or uncontrolled value
  const externalValue = propValue !== undefined ? propValue : storeValue

  // Local state for instant input response — decoupled from store roundtrip.
  // Store updates are debounced so Zustand set() doesn't fire on every keystroke.
  const [localValue, setLocalValue] = useState(externalValue?.toString() ?? '')
  const storeTimerRef = useRef<NodeJS.Timeout | null>(null)
  const localValueRef = useRef(localValue)
  localValueRef.current = localValue

  // Debounced store sync — only writes to Zustand after user pauses typing
  const syncToStore = useCallback(
    (val: string) => {
      if (storeTimerRef.current) clearTimeout(storeTimerRef.current)
      storeTimerRef.current = setTimeout(() => {
        if (onChange) {
          onChange(val)
        } else {
          setStoreValue(val)
        }
      }, 300)
    },
    [onChange, setStoreValue]
  )

  // Flush pending store update immediately (used on blur, paste, drop, etc.)
  const flushToStore = useCallback(
    (val: string) => {
      if (storeTimerRef.current) clearTimeout(storeTimerRef.current)
      storeTimerRef.current = null
      if (onChange) {
        onChange(val)
      } else {
        setStoreValue(val)
      }
    },
    [onChange, setStoreValue]
  )

  // Sync external → local when store/prop changes (e.g. from API key auto-fill, undo, etc.)
  useEffect(() => {
    const ext = externalValue?.toString() ?? ''
    // Only sync from external if user is NOT typing (to avoid overwriting local edits)
    if (!isFocused && ext !== localValueRef.current) {
      setLocalValue(ext)
    }
  }, [externalValue, isFocused])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (storeTimerRef.current) clearTimeout(storeTimerRef.current)
    }
  }, [])

  // Overlay display value: strip newlines since <input type="text"> sanitizes them out.
  // Without this, overlay shows spaces where newlines were → character positions mismatch.
  const deferredDisplayValue = localValue.replace(/[\r\n]+/g, ' ')

  // Use localValue as the canonical value for the component
  const value = localValue

  // New state for enhanced features
  const [copied, setCopied] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [expandedValue, setExpandedValue] = useState('')

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
    setLocalValue('')
    if (onChange) {
      onChange('')
    } else {
      setStoreValue('')
    }
    inputRef.current?.focus()
  }, [onChange, setStoreValue])

  // Character count
  const charCount = value?.toString().length ?? 0

  // Expand modal handlers
  const handleOpenExpand = useCallback(() => {
    setExpandedValue(value?.toString() ?? '')
    setIsExpanded(true)
  }, [value])

  const handleSaveExpanded = useCallback(() => {
    setLocalValue(expandedValue)
    if (onChange) {
      onChange(expandedValue)
    } else {
      setStoreValue(expandedValue)
    }
    setIsExpanded(false)
  }, [expandedValue, onChange, setStoreValue])

  // Check if this input is API key related
  const isApiKeyField = useMemo(() => {
    const normalizedId = config?.id?.replace(/\s+/g, '').toLowerCase() || ''
    const normalizedTitle = config?.title?.replace(/\s+/g, '').toLowerCase() || ''

    // Check for common API key naming patterns
    const apiKeyPatterns = [
      'apikey',
      'api_key',
      'api-key',
      'secretkey',
      'secret_key',
      'secret-key',
      'token',
      'access_token',
      'auth_token',
      'secret',
      'password',
    ]

    return apiKeyPatterns.some(
      (pattern) =>
        normalizedId === pattern ||
        normalizedTitle === pattern ||
        normalizedId.includes(pattern) ||
        normalizedTitle.includes(pattern)
    )
  }, [config?.id, config?.title])

  // Handle input changes — local state updates instantly, store update is deferred
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    const newCursorPosition = e.target.selectionStart ?? 0

    // Update local state IMMEDIATELY — input reflects the character instantly
    setLocalValue(newValue)
    setCursorPosition(newCursorPosition)

    // Debounced store update — Zustand set() only fires after user pauses typing
    syncToStore(newValue)

    // Check for environment variables trigger
    const envVarTrigger = checkEnvVarTrigger(newValue, newCursorPosition)

    // For API key fields, always show dropdown when typing (without requiring {{ trigger)
    if (isApiKeyField && isFocused) {
      // Only show dropdown if there's text to filter by or the field is empty
      const shouldShowDropdown = newValue.trim() !== '' || newValue === ''
      setShowEnvVars(shouldShowDropdown)
      // Use the entire input value as search term for API key fields,
      // but if {{ is detected, use the standard search term extraction
      setSearchTerm(envVarTrigger.show ? envVarTrigger.searchTerm : newValue)
    } else {
      // Normal behavior for non-API key fields
      setShowEnvVars(envVarTrigger.show)
      setSearchTerm(envVarTrigger.show ? envVarTrigger.searchTerm : '')
    }

    // Check for tag trigger
    const tagTrigger = checkTagTrigger(newValue, newCursorPosition)
    setShowTags(tagTrigger.show)
  }

  // Sync scroll position between input and overlay (direct DOM for performance)
  const handleScroll = (e: React.UIEvent<HTMLInputElement>) => {
    if (overlayRef.current) {
      overlayRef.current.scrollLeft = e.currentTarget.scrollLeft
    }
  }

  // Sync scroll on value change — rAF waits for browser layout after content change
  useEffect(() => {
    requestAnimationFrame(() => {
      if (inputRef.current && overlayRef.current) {
        overlayRef.current.scrollLeft = inputRef.current.scrollLeft
      }
    })
  }, [value])

  // Handle paste events - strip rich text AND newlines (input is single-line).
  // <input type="text"> sanitization strips \n, but the overlay would render them as spaces → mismatch.
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const plainText = e.clipboardData.getData('text/plain').replace(/[\r\n]+/g, ' ')
    const target = e.currentTarget

    const start = target.selectionStart ?? 0
    const end = target.selectionEnd ?? 0
    const newValue = localValue.slice(0, start) + plainText + localValue.slice(end)
    const newCursorPos = start + plainText.length

    setLocalValue(newValue)
    setCursorPosition(newCursorPos)
    flushToStore(newValue)

    // Double rAF: 1st sets cursor → browser scrolls input, 2nd reads final scroll.
    requestAnimationFrame(() => {
      target.selectionStart = newCursorPos
      target.selectionEnd = newCursorPos
      requestAnimationFrame(() => {
        if (overlayRef.current) {
          overlayRef.current.scrollLeft = target.scrollLeft
        }
      })
    })
  }

  // Handle wheel events to control ReactFlow zoom
  const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
    // Only handle zoom when Ctrl/Cmd key is pressed
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      e.stopPropagation()

      // Get current zoom level and viewport
      const currentZoom = reactFlowInstance.getZoom()
      const { x: viewportX, y: viewportY } = reactFlowInstance.getViewport()

      // Calculate zoom factor based on wheel delta
      // Use a smaller factor for smoother zooming that matches ReactFlow's native behavior
      const delta = e.deltaY > 0 ? 1 : -1
      // Using 0.98 instead of 0.95 makes the zoom much slower and more gradual
      const zoomFactor = Math.pow(0.96, delta)

      // Calculate new zoom level with min/max constraints
      const newZoom = Math.min(Math.max(currentZoom * zoomFactor, 0.1), 1)

      // Get the position of the cursor in the page
      const { x: pointerX, y: pointerY } = reactFlowInstance.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      })

      // Calculate the new viewport position to keep the cursor position fixed
      const newViewportX = viewportX + (pointerX * currentZoom - pointerX * newZoom)
      const newViewportY = viewportY + (pointerY * currentZoom - pointerY * newZoom)

      // Set the new viewport with the calculated position and zoom
      reactFlowInstance.setViewport(
        {
          x: newViewportX,
          y: newViewportY,
          zoom: newZoom,
        },
        { duration: 0 }
      )

      return false
    }

    // For regular scrolling (without Ctrl/Cmd), let the default behavior happen
    // Don't interfere with normal scrolling
    return true
  }

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent<HTMLInputElement>) => {
    if (config?.connectionDroppable === false) return
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent<HTMLInputElement>) => {
    if (config?.connectionDroppable === false) return
    e.preventDefault()

    try {
      const raw = e.dataTransfer.getData('application/json')
      if (!raw) return
      const data = JSON.parse(raw)
      if (data.type !== 'connectionBlock') return

      // Get current cursor position or append to end
      const dropPosition = inputRef.current?.selectionStart ?? localValue.length

      // Insert '<' at drop position to trigger the dropdown
      const currentValue = localValue
      const newValue = currentValue.slice(0, dropPosition) + '<' + currentValue.slice(dropPosition)

      // Focus the input first
      inputRef.current?.focus()

      // Update all state in a single batch
      Promise.resolve().then(() => {
        setLocalValue(newValue)
        flushToStore(newValue)
        setCursorPosition(dropPosition + 1)
        setShowTags(true)

        // Pass the source block ID from the dropped connection
        if (data.connectionData?.sourceBlockId) {
          setActiveSourceBlockId(data.connectionData.sourceBlockId)
        }

        // Set cursor position after state updates
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.selectionStart = dropPosition + 1
            inputRef.current.selectionEnd = dropPosition + 1
          }
        }, 0)
      })
    } catch (error) {
      logger.error('Failed to parse drop data:', { error })
    }
  }

  // Handle key combinations
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setShowEnvVars(false)
      setShowTags(false)
      return
    }

    // For API key fields, show env vars when clearing with keyboard shortcuts
    if (
      isApiKeyField &&
      (e.key === 'Delete' || e.key === 'Backspace') &&
      inputRef.current?.selectionStart === 0 &&
      inputRef.current?.selectionEnd === value?.toString().length
    ) {
      setTimeout(() => setShowEnvVars(true), 0)
    }
  }

  // Explicitly mark environment variable references with '{{' and '}}' when inserting
  const handleEnvVarSelect = (newValue: string) => {
    // For API keys, ensure we're using the full value with {{ }} format
    if (isApiKeyField && !newValue.startsWith('{{')) {
      newValue = `{{${newValue}}}`
    }

    if (onChange) {
      onChange(newValue)
    } else {
      setStoreValue(newValue)
    }
  }

  // Quick-add connection handler
  const handleQuickAddConnection = (connection: any, field?: any) => {
    const currentValue = localValue
    // Normalize block name to lowercase and remove spaces/special chars
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

    const newValue = !currentValue.trim() ? connectionTag : currentValue + ' ' + connectionTag
    setLocalValue(newValue)
    flushToStore(newValue)

    setShowQuickAdd(false)
    inputRef.current?.focus()
  }

  return (
    <div ref={containerRef} className="relative w-full group/input">
      <div className="flex items-center gap-2">
        {/* Container owns border + background; overlay and input are absolute inside */}
        <div
          className={cn(
            'relative flex-1 h-10 rounded-lg border overflow-hidden',
            'focus-within:ring-1 focus-within:ring-primary/30 focus-within:border-primary/30',
            'transition-[border-color,box-shadow] duration-200',
            isConnecting &&
              config?.connectionDroppable !== false &&
              'ring-2 ring-blue-500 ring-offset-2'
          )}
          style={{
            backgroundColor: isApiKeyField
              ? 'color-mix(in oklch, var(--color-muted) 5%, transparent)'
              : 'var(--color-card)',
            borderColor: 'var(--color-border)',
          }}
        >
          {/* Overlay FIRST in DOM = behind input (DOM stacking order, no z-index). */}
          <div
            ref={overlayRef}
            className="absolute inset-0 pointer-events-none overlay-text-container text-white"
            style={{
              padding: '0 14px',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              fontFamily: 'inherit',
              fontSize: '0.875rem',
              lineHeight: '2.5rem',
              letterSpacing: 'normal',
              color: '#f8fafc !important',
            }}
          >
            {password && !isFocused
              ? '•'.repeat(deferredDisplayValue.length)
              : formatDisplayText(deferredDisplayValue, true)}
          </div>

          {/* Input SECOND in DOM = on top. Text transparent via WebkitTextFillColor;
              caret visible via color; selection styled by .overlay-input::selection in globals.css */}
          <input
            ref={inputRef}
            className="overlay-input unstyled-editor-field text-white caret-white"
            placeholder={placeholder ?? ''}
            type="text"
            value={value?.toString() ?? ''}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              padding: '0 14px',
              fontFamily: 'inherit',
              fontSize: '0.875rem',
              lineHeight: '1.25rem',
              letterSpacing: 'normal',
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              borderRadius: 'inherit',
              color: '#f8fafc !important',
              WebkitTextFillColor: 'transparent',
              caretColor: '#f8fafc !important',
            }}
            onChange={handleChange}
            onFocus={() => {
              setIsFocused(true)
              if (isApiKeyField) {
                setShowEnvVars(true)
                setSearchTerm('')
                const inputLength = value?.toString().length ?? 0
                setCursorPosition(inputLength)
              } else {
                setShowEnvVars(false)
                setShowTags(false)
                setSearchTerm('')
              }
            }}
            onBlur={() => {
              flushToStore(localValueRef.current)
              setIsFocused(false)
              setShowEnvVars(false)
            }}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onScroll={handleScroll}
            onPaste={handlePaste}
            onWheel={handleWheel}
            onKeyDown={handleKeyDown}
          />
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover/input:opacity-100 transition-opacity duration-200">
          {/* Expand Button - show for API key fields or long content */}
          {(isApiKeyField || charCount > 20) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 hover:bg-primary/10"
                  onClick={handleOpenExpand}
                >
                  <Maximize2 className="w-3.5 h-3.5 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <p>Expand</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Copy Button */}
          {charCount > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 hover:bg-primary/10"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-green-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <p>{copied ? 'Copied!' : 'Copy'}</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Clear Button */}
          {charCount > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 hover:bg-red-500/10"
                  onClick={handleClear}
                >
                  <X className="w-3.5 h-3.5 text-muted-foreground hover:text-red-500" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <p>Clear</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Quick-add connection button with popover */}
          {hasIncomingConnections && (
            <Popover open={showQuickAdd} onOpenChange={setShowQuickAdd}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-primary/10">
                      <svg
                        className="w-3.5 h-3.5 text-primary"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                        />
                      </svg>
                    </Button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <p>Insert block output</p>
                </TooltipContent>
              </Tooltip>
              <PopoverContent
                className="w-96 p-0 z-[99999]"
                align="end"
                side="bottom"
                style={{ zIndex: 99999 }}
              >
                <div className="p-4 border-b bg-muted/20">
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-4 h-4 text-primary"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                      />
                    </svg>
                    <h4 className="text-sm font-semibold">Connect Data Sources</h4>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Select data from connected blocks to use in this field
                  </p>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {incomingConnections.map((connection) => {
                    // Extract fields using the same logic as connection-blocks component
                    const extractFieldsFromSchema = (responseFormat: any): any[] => {
                      if (!responseFormat || typeof responseFormat !== 'object') {
                        return []
                      }

                      // Skip invalid formats like {"e": {}}
                      if (responseFormat.e && Object.keys(responseFormat).length === 1) {
                        return []
                      }

                      // Handle legacy format with fields array
                      if (Array.isArray(responseFormat.fields)) {
                        return responseFormat.fields
                      }

                      // Handle new JSON Schema format
                      const schema = responseFormat.schema || responseFormat
                      if (!schema || !schema.properties || typeof schema.properties !== 'object') {
                        return []
                      }

                      // Extract fields from schema properties
                      return Object.entries(schema.properties).map(
                        ([name, prop]: [string, any]) => ({
                          name,
                          type: prop.type || 'string',
                          description: prop.description,
                        })
                      )
                    }

                    // Extract fields from starter block based on trigger type or input format
                    const extractFieldsFromStarterInput = (connection: any): any[] => {
                      // Only process for starter blocks
                      if (connection.type !== 'starter') return []

                      try {
                        // Check if starter is configured as a trigger (email, webhook, form, etc.)
                        const startWorkflowValue = useSubBlockStore
                          .getState()
                          .getValue(connection.id, 'startWorkflow')

                        if (startWorkflowValue && startWorkflowValue !== 'manual') {
                          const triggerFields = TRIGGER_OUTPUT_FIELDS[startWorkflowValue as string]
                          if (triggerFields) {
                            return [...triggerFields]
                          }
                        }

                        // Manual trigger: use input format
                        const inputFormatValue = useSubBlockStore
                          .getState()
                          .getValue(connection.id, 'inputFormat')

                        if (!inputFormatValue) return []

                        const inputFormat =
                          typeof inputFormatValue === 'string'
                            ? JSON.parse(inputFormatValue)
                            : inputFormatValue

                        if (!Array.isArray(inputFormat)) return []

                        // Map input fields to response fields
                        // Note: Executor spreads input fields directly at response level (...inputData)
                        // So fields are accessible as fieldName, not input.fieldName
                        const fields = inputFormat
                          .filter((field: any) => field.name && field.name.trim() !== '')
                          .map((field: any) => ({
                            name: field.name, // Direct field name, not input.fieldName
                            type: field.type || 'string',
                            description: field.description,
                          }))

                        // Also add the complete input object
                        return [
                          { name: 'input', type: 'object', description: 'Complete input data' },
                          ...fields,
                        ]
                      } catch (e) {
                        logger.error('Error extracting fields from starter input format:', e)
                        return [{ name: 'input', type: 'any' }]
                      }
                    }

                    // Get fields from execution results first, then fall back to schema
                    let fields: any[] = []

                    // Use available fields from execution if present
                    if (connection.availableFields && connection.availableFields.length > 0) {
                      fields = connection.availableFields
                      logger.debug('Quick Add Connection - Using execution fields:', {
                        connectionId: connection.id,
                        connectionName: connection.name,
                        fields: fields,
                        fieldCount: fields.length,
                      })
                    } else {
                      logger.debug(
                        'Quick Add Connection - No execution fields, using schema fallback:',
                        {
                          connectionId: connection.id,
                          connectionName: connection.name,
                          hasAvailableFields: !!connection.availableFields,
                          availableFieldsLength: connection.availableFields?.length || 0,
                          hasExecutionResult: !!connection.executionResult,
                          executionResultKeys: connection.executionResult
                            ? Object.keys(connection.executionResult)
                            : [],
                        }
                      )
                      // Fall back to schema extraction
                      if (connection.type === 'starter') {
                        fields = extractFieldsFromStarterInput(connection)
                      } else {
                        fields = extractFieldsFromSchema(connection.responseFormat)
                      }

                      // If no fields from response format, use outputType array
                      if (fields.length === 0 && Array.isArray(connection.outputType)) {
                        fields = connection.outputType.map((fieldName: string) => ({
                          name: fieldName,
                          type: 'string',
                        }))
                      }
                      logger.debug('Quick Add Connection - Using schema fields:', fields)
                    }

                    return (
                      <div
                        key={connection.id}
                        className="p-3 border-b border-border/50 last:border-b-0"
                      >
                        {/* Connection header with execution status */}
                        <div className="flex items-center gap-2 mb-3">
                          <div
                            className={`w-3 h-3 rounded-full border-2 ${
                              connection.executionResult
                                ? 'bg-green-500/20 border-green-500/60'
                                : 'bg-primary/20 border-primary/40'
                            }`}
                          ></div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-medium text-foreground">
                                {connection.name || `Block ${connection.id}`}
                              </div>
                              {connection.executionResult && (
                                <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded">
                                  executed
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {connection.type || 'Unknown Type'}
                              {connection.availableFields &&
                                connection.availableFields.length > 0 && (
                                  <span className="ml-2 text-green-600 dark:text-green-400">
                                    • {connection.availableFields.length} live fields
                                  </span>
                                )}
                            </div>
                          </div>
                        </div>

                        {/* Main output with improved naming */}
                        <button
                          className="w-full text-left p-3 rounded-lg hover:bg-accent/50 transition-all duration-200 mb-2 border border-border/30 hover:border-border/60"
                          onClick={() => handleQuickAddConnection(connection)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm"></div>
                            <div className="flex-1">
                              <span className="text-sm font-medium">Complete Output</span>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                Full response from {connection.name || connection.id}
                              </div>
                            </div>
                            <span className="text-xs font-mono bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded border">
                              &lt;
                              {connection.name
                                ? connection.name
                                    .toLowerCase()
                                    .replace(/\s+/g, '')
                                    .replace(/[^a-z0-9]/g, '')
                                : connection.id}
                              .response&gt;
                            </span>
                          </div>
                        </button>

                        {/* Response format fields with better descriptions */}
                        {fields.map((field) => {
                          const normalizeBlockName = (name: string) =>
                            name
                              .toLowerCase()
                              .replace(/\s+/g, '')
                              .replace(/[^a-z0-9]/g, '')
                          const blockRef = connection.name
                            ? normalizeBlockName(connection.name)
                            : connection.id
                          const displayTag =
                            field.name === 'response'
                              ? `<${blockRef}.response>`
                              : `<${blockRef}.response.${field.name}>`

                          return (
                            <button
                              key={field.name}
                              className="w-full text-left p-3 rounded-lg hover:bg-accent/50 transition-all duration-200 mb-2 border border-border/30 hover:border-border/60"
                              onClick={() => handleQuickAddConnection(connection, field)}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-sm"></div>
                                <div className="flex-1">
                                  <span className="text-sm font-medium capitalize">
                                    {field.name}
                                  </span>
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    {field.type} field from {connection.name || connection.id}
                                  </div>
                                </div>
                                <span className="text-xs font-mono bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 px-2 py-1 rounded border">
                                  {displayTag}
                                </span>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      <EnvVarDropdown
        visible={showEnvVars}
        onSelect={handleEnvVarSelect}
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
        onSelect={handleEnvVarSelect}
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

      {/* Expand Modal */}
      <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
        <DialogContent className="max-w-lg" data-right-sidebar>
          <DialogHeader>
            <DialogTitle className="text-sm font-medium">
              {config?.title || 'Edit Value'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={expandedValue}
              onChange={(e) => setExpandedValue(e.target.value)}
              onPaste={(e) => {
                e.preventDefault()
                const plainText = e.clipboardData.getData('text/plain')
                const ta = e.currentTarget
                const start = ta.selectionStart ?? 0
                const end = ta.selectionEnd ?? 0
                const newVal = expandedValue.slice(0, start) + plainText + expandedValue.slice(end)
                setExpandedValue(newVal)
                const pos = start + plainText.length
                requestAnimationFrame(() => {
                  ta.selectionStart = pos
                  ta.selectionEnd = pos
                })
              }}
              placeholder={placeholder}
              className="min-h-[120px] font-mono text-sm"
              autoFocus
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {expandedValue.length} characters
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsExpanded(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveExpanded}>
                  Save
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
