import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { createLogger } from '@/lib/logs/console-logger'
import { cn } from '@/lib/utils'
import { useVariablesStore } from '@/stores/panel/variables/store'
import { Variable } from '@/stores/panel/variables/types'
import { useWorkflowRegistry } from '@/stores/workflows/registry/store'
import { useSubBlockStore } from '@/stores/workflows/subblock/store'
import { useWorkflowStore } from '@/stores/workflows/workflow/store'
import { ConnectedBlock, useBlockConnections } from '@/app/w/[id]/hooks/use-block-connections'
import { getBlock } from '@/blocks'
import { TRIGGER_OUTPUT_FIELDS } from '@/blocks/blocks/starter'

const logger = createLogger('TagDropdown')

interface Field {
  name: string
  type: string
  description?: string
}

interface Metric {
  name: string
  description: string
  range: {
    min: number
    max: number
  }
}

interface TagDropdownProps {
  visible: boolean
  onSelect: (newValue: string) => void
  blockId: string
  activeSourceBlockId: string | null
  className?: string
  inputValue: string
  cursorPosition: number
  onClose?: () => void
  style?: React.CSSProperties
  parentRef?: React.RefObject<HTMLElement | null>
}

// Helper to extract fields from JSON Schema
const extractFieldsFromSchema = (responseFormat: any): Field[] => {
  if (!responseFormat) return []

  if (Array.isArray(responseFormat.fields)) {
    return responseFormat.fields
  }

  const schema = responseFormat.schema || responseFormat
  if (
    !schema ||
    typeof schema !== 'object' ||
    !('properties' in schema) ||
    typeof schema.properties !== 'object'
  ) {
    return []
  }

  return Object.entries(schema.properties).map(([name, prop]: [string, any]) => ({
    name,
    type: Array.isArray(prop) ? 'array' : prop.type || 'string',
    description: prop.description,
  }))
}

export const TagDropdown = ({
  visible,
  onSelect,
  blockId,
  activeSourceBlockId,
  className,
  inputValue,
  cursorPosition,
  onClose,
  style,
  parentRef,
}: TagDropdownProps) => {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(
    null
  )
  const dropdownRef = useRef<HTMLDivElement>(null)

  const blocks = useWorkflowStore((state) => state.blocks)
  const workflowId = useWorkflowRegistry((state) => state.activeWorkflowId)
  const loops = useWorkflowStore((state) => state.loops)

  const getVariablesByWorkflowId = useVariablesStore((state) => state.getVariablesByWorkflowId)
  const loadVariables = useVariablesStore((state) => state.loadVariables)
  const variables = useVariablesStore((state) => state.variables)
  const workflowVariables = useMemo(
    () => (workflowId ? getVariablesByWorkflowId(workflowId) : []),
    [workflowId, getVariablesByWorkflowId]
  )

  const { incomingConnections } = useBlockConnections(blockId)

  useEffect(() => {
    if (workflowId) {
      loadVariables(workflowId)
    }
  }, [workflowId, loadVariables])

  // Close on outside click (for Portal-rendered dropdown)
  useEffect(() => {
    if (!visible || !parentRef) return

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        parentRef.current &&
        !parentRef.current.contains(target)
      ) {
        onClose?.()
      }
    }

    // Delay to avoid closing on the same click that opens
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 0)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [visible, parentRef, onClose])

  // Position calculation
  useLayoutEffect(() => {
    if (!visible || !parentRef?.current) {
      setPosition(null)
      return
    }

    const updatePosition = () => {
      const rect = parentRef.current?.getBoundingClientRect()
      if (!rect) return

      const dropdownHeight = dropdownRef.current?.offsetHeight || 300
      const spaceBelow = window.innerHeight - rect.bottom
      const showAbove = spaceBelow < dropdownHeight && rect.top > spaceBelow

      setPosition({
        top: showAbove ? rect.top - 4 : rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      })
    }

    updatePosition()

    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [visible, parentRef])

  // Search term from input
  const searchTerm = useMemo(() => {
    const textBeforeCursor = inputValue.slice(0, cursorPosition)
    const match = textBeforeCursor.match(/<([^>]*)$/)
    return match ? match[1].toLowerCase() : ''
  }, [inputValue, cursorPosition])

  // Build field info map: fieldName -> { type, description } from all sources
  const fieldInfoMap = useMemo(() => {
    const map: Record<string, { type: string; description?: string }> = {}

    const addFromTrigger = (blockIdToCheck: string) => {
      try {
        const val = useSubBlockStore.getState().getValue(blockIdToCheck, 'startWorkflow')
        if (val && val !== 'manual') {
          const fields = TRIGGER_OUTPUT_FIELDS[val as string]
          if (fields) {
            fields.forEach((f) => {
              map[f.name] = { type: f.type, description: f.description }
            })
          }
        }
      } catch {}
    }

    for (const conn of incomingConnections) {
      if (conn.type === 'starter') addFromTrigger(conn.id)
      if (conn.responseFormat) {
        extractFieldsFromSchema(conn.responseFormat).forEach((f) => {
          map[f.name] = { type: f.type, description: f.description }
        })
      }
    }
    if (activeSourceBlockId) {
      const src = blocks[activeSourceBlockId]
      if (src?.type === 'starter') addFromTrigger(activeSourceBlockId)
      try {
        const rfv = useSubBlockStore.getState().getValue(activeSourceBlockId, 'responseFormat')
        if (rfv) {
          const rf = typeof rfv === 'string' ? JSON.parse(rfv) : rfv
          extractFieldsFromSchema(rf).forEach((f) => {
            map[f.name] = { type: f.type, description: f.description }
          })
        }
      } catch {}
    }
    return map
  }, [incomingConnections, activeSourceBlockId, blocks])

  // Compute tags
  const { tags, variableInfoMap = {} } = useMemo(() => {
    const getOutputPaths = (obj: any, prefix = '', isStarterBlock = false): string[] => {
      if (typeof obj !== 'object' || obj === null) {
        return prefix ? [prefix] : []
      }

      if (isStarterBlock && prefix === 'response') {
        const starterBlockId = activeSourceBlockId || blockId

        try {
          const startWorkflowValue = useSubBlockStore
            .getState()
            .getValue(starterBlockId, 'startWorkflow')

          if (startWorkflowValue && startWorkflowValue !== 'manual') {
            const triggerFields = TRIGGER_OUTPUT_FIELDS[startWorkflowValue as string]
            if (triggerFields) {
              return triggerFields.map((f) => `response.${f.name}`)
            }
          }
        } catch (e) {
          logger.error('Error checking trigger type:', { e })
        }

        try {
          const inputFormatValue = useSubBlockStore
            .getState()
            .getValue(starterBlockId, 'inputFormat')
          if (inputFormatValue && Array.isArray(inputFormatValue) && inputFormatValue.length > 0) {
            const hasConfiguredFields = inputFormatValue.some(
              (field: any) => field.name && field.name.trim() !== ''
            )

            if (!hasConfiguredFields) {
              return ['response.input']
            }

            const fields = inputFormatValue
              .filter((field: any) => field.name && field.name.trim() !== '')
              .map((field: any) => `response.${field.name}`)

            return ['response.input', ...fields]
          }
        } catch (e) {
          logger.error('Error parsing input format:', { e })
        }

        return ['response.input']
      }

      if ('type' in obj && typeof obj.type === 'string') {
        return [prefix]
      }

      return Object.entries(obj).flatMap(([key, value]) => {
        const newPrefix = prefix ? `${prefix}.${key}` : key
        return getOutputPaths(value, newPrefix, isStarterBlock)
      })
    }

    const variableTags = workflowVariables.map(
      (variable: Variable) => `variable.${variable.name.replace(/\s+/g, '')}`
    )

    const variableInfoMap = workflowVariables.reduce(
      (acc, variable) => {
        const tagName = `variable.${variable.name.replace(/\s+/g, '')}`
        acc[tagName] = { type: variable.type, id: variable.id }
        return acc
      },
      {} as Record<string, { type: string; id: string }>
    )

    const loopTags: string[] = []
    const containingLoop = Object.entries(loops).find(([, loop]) => loop.nodes.includes(blockId))

    if (containingLoop) {
      const [, loop] = containingLoop
      const loopType = loop.loopType || 'for'
      loopTags.push('loop.index')
      if (loopType === 'forEach') {
        loopTags.push('loop.currentItem')
        loopTags.push('loop.items')
      }
    }

    if (activeSourceBlockId) {
      const sourceBlock = blocks[activeSourceBlockId]
      if (!sourceBlock) return { tags: [...variableTags] }

      const blockName = sourceBlock.name || sourceBlock.type
      const normalizedBlockName = blockName
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[^a-z0-9]/g, '')

      if (sourceBlock.type === 'evaluator') {
        try {
          const metricsValue = useSubBlockStore
            .getState()
            .getValue(activeSourceBlockId, 'metrics') as unknown as Metric[]
          if (Array.isArray(metricsValue)) {
            return {
              tags: [
                ...variableTags,
                ...metricsValue.map(
                  (metric) => `${normalizedBlockName}.response.${metric.name.toLowerCase()}`
                ),
              ],
            }
          }
        } catch (e) {
          logger.error('Error parsing metrics:', { e })
        }
      }

      try {
        const responseFormatValue = useSubBlockStore
          .getState()
          .getValue(activeSourceBlockId, 'responseFormat')
        if (responseFormatValue) {
          const responseFormat =
            typeof responseFormatValue === 'string'
              ? JSON.parse(responseFormatValue)
              : responseFormatValue

          if (responseFormat) {
            const fields = extractFieldsFromSchema(responseFormat)
            if (fields.length > 0) {
              return {
                tags: [
                  ...variableTags,
                  ...fields.map((field: Field) => `${normalizedBlockName}.response.${field.name}`),
                ],
              }
            }
          }
        }
      } catch (e) {
        logger.error('Error parsing response format:', { e })
      }

      const outputPaths = getOutputPaths(sourceBlock.outputs, '', sourceBlock.type === 'starter')
      return {
        tags: [...variableTags, ...outputPaths.map((path) => `${normalizedBlockName}.${path}`)],
      }
    }

    const sourceTags = incomingConnections.flatMap((connection: ConnectedBlock) => {
      const blockName = connection.name || connection.type
      const normalizedBlockName = blockName
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[^a-z0-9]/g, '')

      if (connection.type === 'starter') {
        try {
          const startWorkflowValue = useSubBlockStore
            .getState()
            .getValue(connection.id, 'startWorkflow')

          if (startWorkflowValue && startWorkflowValue !== 'manual') {
            const triggerFields = TRIGGER_OUTPUT_FIELDS[startWorkflowValue as string]
            if (triggerFields) {
              return triggerFields.map((f) => `${normalizedBlockName}.response.${f.name}`)
            }
          }
        } catch (e) {
          logger.error('Error checking starter trigger type:', { e })
        }
      }

      if (connection.responseFormat) {
        const fields = extractFieldsFromSchema(connection.responseFormat)
        if (fields.length > 0) {
          return fields.map((field: Field) => `${normalizedBlockName}.response.${field.name}`)
        }
      }

      if (connection.type === 'evaluator') {
        try {
          const metricsValue = useSubBlockStore
            .getState()
            .getValue(connection.id, 'metrics') as unknown as Metric[]
          if (Array.isArray(metricsValue)) {
            return metricsValue.map(
              (metric) => `${normalizedBlockName}.response.${metric.name.toLowerCase()}`
            )
          }
        } catch (e) {
          logger.error('Error parsing metrics:', { e })
          return []
        }
      }

      const sourceBlock = blocks[connection.id]
      if (!sourceBlock) return []

      const outputPaths = getOutputPaths(sourceBlock.outputs, '', sourceBlock.type === 'starter')
      return outputPaths.map((path) => `${normalizedBlockName}.${path}`)
    })

    return { tags: [...variableTags, ...loopTags, ...sourceTags], variableInfoMap }
  }, [blocks, incomingConnections, blockId, activeSourceBlockId, workflowVariables, loops])

  const filteredTags = useMemo(() => {
    if (!searchTerm) return tags
    return tags.filter((tag: string) => tag.toLowerCase().includes(searchTerm))
  }, [tags, searchTerm])

  const { variableTags, loopTags, blockTags } = useMemo(() => {
    const varTags: string[] = []
    const loopTags: string[] = []
    const blkTags: string[] = []

    filteredTags.forEach((tag) => {
      if (tag.startsWith('variable.')) varTags.push(tag)
      else if (tag.startsWith('loop.')) loopTags.push(tag)
      else blkTags.push(tag)
    })

    return { variableTags: varTags, loopTags, blockTags: blkTags }
  }, [filteredTags])

  useEffect(() => {
    setSelectedIndex(0)
  }, [searchTerm])

  const handleTagSelect = useCallback(
    (tag: string) => {
      const textBeforeCursor = inputValue.slice(0, cursorPosition)
      const textAfterCursor = inputValue.slice(cursorPosition)

      const lastOpenBracket = textBeforeCursor.lastIndexOf('<')
      if (lastOpenBracket === -1) return

      let processedTag = tag
      if (tag.startsWith('variable.')) {
        const variableName = tag.substring('variable.'.length)
        const variableObj = Object.values(variables).find(
          (v) => v.name.replace(/\s+/g, '') === variableName
        )
        if (variableObj) processedTag = tag
      }

      const newValue =
        textBeforeCursor.slice(0, lastOpenBracket) + '<' + processedTag + '>' + textAfterCursor

      onSelect(newValue)
      onClose?.()
    },
    [inputValue, cursorPosition, variables, onSelect, onClose]
  )

  // Keyboard navigation
  useEffect(() => {
    if (!visible) return

    const handleKeyboardEvent = (e: KeyboardEvent) => {
      if (!filteredTags.length) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          e.stopPropagation()
          setSelectedIndex((prev) => (prev < filteredTags.length - 1 ? prev + 1 : prev))
          break
        case 'ArrowUp':
          e.preventDefault()
          e.stopPropagation()
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev))
          break
        case 'Enter':
          e.preventDefault()
          e.stopPropagation()
          handleTagSelect(filteredTags[selectedIndex])
          break
        case 'Escape':
          e.preventDefault()
          e.stopPropagation()
          onClose?.()
          break
      }
    }

    window.addEventListener('keydown', handleKeyboardEvent, true)
    return () => window.removeEventListener('keydown', handleKeyboardEvent, true)
  }, [visible, selectedIndex, filteredTags, handleTagSelect, onClose])

  // Auto-scroll selected item into view
  useEffect(() => {
    if (!visible || !dropdownRef.current) return
    const selected = dropdownRef.current.querySelector('[data-selected="true"]')
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex, visible])

  if (!visible || tags.length === 0 || filteredTags.length === 0) return null

  const showAbove = position ? position.top > window.innerHeight / 2 : false

  const dropdownContent = (
    <div
      ref={dropdownRef}
      className={cn(
        'workflow-editor-tag-dropdown workflow-editor-menu-content workflow-editor-portal-surface bg-popover/95 rounded-xl border border-border/50',
        'shadow-[0_8px_30px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)]',
        'animate-in fade-in-0 zoom-in-[0.98] duration-100',
        !parentRef && 'absolute z-[99999] w-full mt-1',
        className
      )}
      style={
        parentRef && position
          ? {
              position: 'fixed',
              zIndex: 999999,
              top: showAbove ? undefined : position.top,
              bottom: showAbove ? window.innerHeight - position.top + 4 : undefined,
              left: position.left,
              width: Math.max(position.width, 280),
              ...style,
            }
          : { ...style, zIndex: 999999 }
      }
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* Search indicator */}
      {searchTerm && (
        <div className="workflow-editor-tag-dropdown-header px-3 py-2 border-b border-border/30 flex items-center gap-2">
          <svg
            className="w-3.5 h-3.5 text-muted-foreground/50"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <span className="text-xs text-muted-foreground/70 font-mono">{searchTerm}</span>
          <span className="text-[10px] text-muted-foreground/40 ml-auto">
            {filteredTags.length} results
          </span>
        </div>
      )}

      <div className="workflow-editor-tag-dropdown-scroll max-h-[300px] overflow-y-auto py-1 scroll-smooth">
        {/* Variables */}
        {variableTags.length > 0 && (
          <>
            <div className="workflow-editor-menu-label px-3 pt-2 pb-1 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">
              Variables
            </div>
            {variableTags.map((tag: string) => {
              const variableInfo = variableInfoMap?.[tag] || null
              const tagIndex = filteredTags.indexOf(tag)
              const variableName = tag.startsWith('variable.')
                ? tag.substring('variable.'.length)
                : tag

              return (
                <button
                  key={tag}
                  data-selected={tagIndex === selectedIndex}
                  className={cn(
                    'workflow-editor-menu-item w-full px-3 py-1.5 text-left flex items-center gap-2.5',
                    'hover:bg-accent/60 transition-colors duration-75',
                    tagIndex === selectedIndex && 'bg-accent/80 text-accent-foreground'
                  )}
                  onMouseEnter={() => setSelectedIndex(tagIndex)}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    handleTagSelect(tag)
                  }}
                >
                  <div className="flex items-center justify-center w-5 h-5 rounded bg-gradient-to-br from-purple-500 to-purple-600 shrink-0">
                    <svg
                      className="w-3 h-3 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                      />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-foreground truncate">
                    {variableName}
                  </span>
                  {variableInfo && (
                    <span className="text-[10px] text-muted-foreground/50 ml-auto shrink-0 font-mono">
                      {variableInfo.type}
                    </span>
                  )}
                </button>
              )
            })}
          </>
        )}

        {/* Loop */}
        {loopTags.length > 0 && (
          <>
            {variableTags.length > 0 && (
              <div className="workflow-editor-menu-separator border-t border-border/20 my-1" />
            )}
            <div className="workflow-editor-menu-label px-3 pt-2 pb-1 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">
              Loop
            </div>
            {loopTags.map((tag: string) => {
              const tagIndex = filteredTags.indexOf(tag)
              const loopProperty = tag.split('.')[1]

              let tagIcon = 'L'
              let tagDescription = ''

              if (loopProperty === 'currentItem') {
                tagIcon = 'i'
                tagDescription = 'Current item'
              } else if (loopProperty === 'items') {
                tagIcon = '[]'
                tagDescription = 'All items'
              } else if (loopProperty === 'index') {
                tagIcon = '#'
                tagDescription = 'Index'
              }

              return (
                <button
                  key={tag}
                  data-selected={tagIndex === selectedIndex}
                  className={cn(
                    'workflow-editor-menu-item w-full px-3 py-1.5 text-left flex items-center gap-2.5',
                    'hover:bg-accent/60 transition-colors duration-75',
                    tagIndex === selectedIndex && 'bg-accent/80 text-accent-foreground'
                  )}
                  onMouseEnter={() => setSelectedIndex(tagIndex)}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    handleTagSelect(tag)
                  }}
                >
                  <div className="flex items-center justify-center w-5 h-5 rounded bg-violet-500 shrink-0">
                    <span className="text-white font-bold text-[10px]">{tagIcon}</span>
                  </div>
                  <span className="text-sm font-medium truncate">{tag}</span>
                  <span className="text-[10px] text-muted-foreground/50 ml-auto shrink-0">
                    {tagDescription}
                  </span>
                </button>
              )
            })}
          </>
        )}

        {/* Block Outputs */}
        {blockTags.length > 0 && (
          <>
            {(variableTags.length > 0 || loopTags.length > 0) && (
              <div className="workflow-editor-menu-separator border-t border-border/20 my-1" />
            )}
            <div className="workflow-editor-menu-label px-3 pt-2 pb-1 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">
              Block Outputs
            </div>
            {blockTags.map((tag: string) => {
              const tagIndex = filteredTags.indexOf(tag)
              const [blockName, ...pathParts] = tag.split('.')
              const fieldName = pathParts[pathParts.length - 1]

              // Get block info for icon
              const sourceBlock = Object.values(blocks).find(
                (block) =>
                  (block.name || block.type || '')
                    .toLowerCase()
                    .replace(/\s+/g, '')
                    .replace(/[^a-z0-9]/g, '') === blockName
              )
              const blockType = sourceBlock?.type || 'unknown'
              const blockConfig = getBlock(blockType)
              const BlockIcon = blockConfig?.icon
              const blockColor = blockConfig?.bgColor || '#2F55FF'

              // Get type + description from fieldInfoMap
              const info = fieldInfoMap[fieldName]
              const fieldType = info?.type || 'any'
              const fieldDesc = info?.description || ''

              // Type badge color
              const typeBadgeColor =
                fieldType === 'string'
                  ? 'text-emerald-500'
                  : fieldType === 'object'
                    ? 'text-blue-500'
                    : fieldType === 'array'
                      ? 'text-amber-500'
                      : fieldType === 'boolean'
                        ? 'text-pink-500'
                        : fieldType === 'number'
                          ? 'text-cyan-500'
                          : 'text-muted-foreground/50'

              return (
                <button
                  key={tag}
                  data-selected={tagIndex === selectedIndex}
                  className={cn(
                    'workflow-editor-menu-item w-full px-3 py-1.5 text-left flex items-center gap-2.5',
                    'hover:bg-accent/60 transition-colors duration-75',
                    tagIndex === selectedIndex && 'bg-accent/80 text-accent-foreground'
                  )}
                  onMouseEnter={() => setSelectedIndex(tagIndex)}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    handleTagSelect(tag)
                  }}
                >
                  <div
                    className="flex items-center justify-center w-5 h-5 rounded shrink-0"
                    style={{ backgroundColor: blockColor }}
                  >
                    {BlockIcon ? (
                      <BlockIcon className="w-3 h-3 text-white" />
                    ) : (
                      <span className="text-white font-bold text-[10px]">
                        {blockName.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] font-medium text-foreground">{fieldName}</span>
                      {fieldType !== 'any' && (
                        <span className={cn('text-[10px] font-mono', typeBadgeColor)}>
                          {fieldType}
                        </span>
                      )}
                    </div>
                    {fieldDesc && (
                      <p className="text-[10px] text-muted-foreground/50 truncate leading-tight">
                        {fieldDesc}
                      </p>
                    )}
                  </div>
                  <span className="text-[9px] font-mono text-muted-foreground/30 shrink-0 hidden sm:block">
                    {blockName}
                  </span>
                </button>
              )
            })}
          </>
        )}
      </div>

      {/* Footer hint */}
      <div className="workflow-editor-tag-dropdown-footer px-3 py-1.5 border-t border-border/20 flex items-center gap-3 text-[10px] text-muted-foreground/40">
        <span className="flex items-center gap-1">
          <kbd className="workflow-editor-kbd px-1 py-0.5 rounded bg-muted/50 font-mono text-[9px]">
            ↑↓
          </kbd>{' '}
          navigate
        </span>
        <span className="flex items-center gap-1">
          <kbd className="workflow-editor-kbd px-1 py-0.5 rounded bg-muted/50 font-mono text-[9px]">
            ↵
          </kbd>{' '}
          select
        </span>
        <span className="flex items-center gap-1">
          <kbd className="workflow-editor-kbd px-1 py-0.5 rounded bg-muted/50 font-mono text-[9px]">
            esc
          </kbd>{' '}
          close
        </span>
      </div>
    </div>
  )

  if (parentRef && typeof document !== 'undefined') {
    return createPortal(dropdownContent, document.body)
  }

  return dropdownContent
}

// Helper function to check for '<' trigger
export const checkTagTrigger = (text: string, cursorPosition: number): { show: boolean } => {
  if (cursorPosition >= 1) {
    const textBeforeCursor = text.slice(0, cursorPosition)
    const lastOpenBracket = textBeforeCursor.lastIndexOf('<')
    const lastCloseBracket = textBeforeCursor.lastIndexOf('>')

    if (lastOpenBracket !== -1 && (lastCloseBracket === -1 || lastCloseBracket < lastOpenBracket)) {
      return { show: true }
    }
  }
  return { show: false }
}
