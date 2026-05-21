import { useCallback, useState } from 'react'
import { PlusIcon, WrenchIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Toggle } from '@/components/ui/toggle'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { createLogger } from '@/lib/logs/console-logger'
import { OAuthProvider } from '@/lib/oauth'
import { cn } from '@/lib/utils'
import { useCustomToolsStore } from '@/stores/custom-tools/store'
import { useGeneralStore } from '@/stores/settings/general/store'
import { useSubBlockStore } from '@/stores/workflows/subblock/store'
import { useWorkflowStore } from '@/stores/workflows/workflow/store'
import { getAllBlocks } from '@/blocks'
import { supportsToolUsageControl } from '@/providers/model-capabilities'
import { getProviderFromModel } from '@/providers/utils'
import { useSubBlockValue } from '../../hooks/use-sub-block-value'
import { CredentialSelector } from '../credential-selector/credential-selector'
import { ShortInput } from '../short-input'
import { CustomTool, CustomToolModal } from './components/custom-tool-modal/custom-tool-modal'
import { ToolPickerContent } from './components/tool-picker-content'
import {
  formatParamId,
  getCustomToolParams,
  getOAuthConfig,
  getOperationOptions,
  getRequiredToolParams,
  getToolDisplayParams,
  getToolIdFromBlock,
  hasExpandableContent,
  hasMultipleOperations,
  initializeToolParams,
  StoredTool,
} from './utils'

const logger = createLogger('ToolInput')

interface ToolInputProps {
  blockId: string
  subBlockId: string
}

function IconComponent({ icon: Icon, className }: { icon: any; className?: string }) {
  if (!Icon) return null
  return <Icon className={className} />
}

export function ToolInput({ blockId, subBlockId }: ToolInputProps) {
  const [value, setValue] = useSubBlockValue(blockId, subBlockId)
  const [open, setOpen] = useState(false)
  const [customToolModalOpen, setCustomToolModalOpen] = useState(false)
  const [editingToolIndex, setEditingToolIndex] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const isWide = useWorkflowStore((state) => state.blocks[blockId]?.isWide)
  const customTools = useCustomToolsStore((state) => state.getAllTools())
  const isAutoFillEnvVarsEnabled = useGeneralStore((state) => state.isAutoFillEnvVarsEnabled)

  // Get the current model from the 'model' subblock
  const modelValue = useSubBlockStore.getState().getValue(blockId, 'model')
  const model = typeof modelValue === 'string' ? modelValue : ''
  const provider = model ? getProviderFromModel(model) : ''
  const supportsToolControl = provider ? supportsToolUsageControl(provider) : false

  const toolBlocks = getAllBlocks().filter((block) => block.category === 'tools')

  // Custom filter function for the Command component
  const customFilter = useCallback((value: string, search: string) => {
    if (!search.trim()) return 1

    const normalizedValue = value.toLowerCase()
    const normalizedSearch = search.toLowerCase()

    // Exact match gets highest priority
    if (normalizedValue === normalizedSearch) return 1

    // Starts with search term gets high priority
    if (normalizedValue.startsWith(normalizedSearch)) return 0.8

    // Contains search term gets medium priority
    if (normalizedValue.includes(normalizedSearch)) return 0.6

    // No match
    return 0
  }, [])

  const selectedTools: StoredTool[] =
    Array.isArray(value) && value.length > 0 && typeof value[0] === 'object'
      ? (value as unknown as StoredTool[])
      : []

  const addToolToSelection = (newTool: StoredTool) => {
    if (isWide) {
      setValue([
        ...selectedTools.map((tool, index) => ({
          ...tool,
          isExpanded: Math.floor(selectedTools.length / 2) === Math.floor(index / 2),
        })),
        newTool,
      ])
    } else {
      setValue([...selectedTools.map((tool) => ({ ...tool, isExpanded: false })), newTool])
    }
  }

  const handleSelectTool = (toolBlock: (typeof toolBlocks)[0]) => {
    const hasOperations = hasMultipleOperations(toolBlock.type)
    const operationOptions = hasOperations ? getOperationOptions(toolBlock.type) : []
    const defaultOperation = operationOptions.length > 0 ? operationOptions[0].id : undefined

    const toolId = getToolIdFromBlock(toolBlock.type) || toolBlock.type
    const displayParams = toolId ? getToolDisplayParams(toolId) : []

    const initialParams = initializeToolParams(
      toolId,
      displayParams,
      useSubBlockStore.getState(),
      isAutoFillEnvVarsEnabled,
      blockId
    )

    const newTool: StoredTool = {
      type: toolBlock.type,
      title: toolBlock.name,
      params: initialParams,
      isExpanded: true,
      operation: defaultOperation,
      usageControl: 'auto',
    }

    addToolToSelection(newTool)
    setOpen(false)
  }

  const handleAddCustomTool = (customTool: CustomTool) => {
    // Check if a tool with the same name already exists
    if (
      selectedTools.some(
        (tool) =>
          tool.type === 'custom-tool' &&
          tool.schema?.function?.name === customTool.schema.function.name
      )
    ) {
      return
    }

    const toolParams = getCustomToolParams(customTool.schema)
    const toolId = `custom-${customTool.schema.function.name}`

    const initialParams = initializeToolParams(
      toolId,
      toolParams,
      useSubBlockStore.getState(),
      isAutoFillEnvVarsEnabled,
      blockId
    )

    const newTool: StoredTool = {
      type: 'custom-tool',
      title: customTool.title,
      params: initialParams,
      isExpanded: true,
      schema: customTool.schema,
      code: customTool.code || '',
      usageControl: 'auto',
    }

    addToolToSelection(newTool)
  }

  const handleSelectStoredCustomTool = (customTool: {
    id: string
    title: string
    schema: any
    code?: string
  }) => {
    const newTool: StoredTool = {
      type: 'custom-tool',
      title: customTool.title,
      params: {},
      isExpanded: true,
      schema: customTool.schema,
      code: customTool.code,
      usageControl: 'auto',
    }

    addToolToSelection(newTool)
  }

  const handleEditCustomTool = (toolIndex: number) => {
    const tool = selectedTools[toolIndex]
    if (tool.type !== 'custom-tool' || !tool.schema) return

    setEditingToolIndex(toolIndex)
    setCustomToolModalOpen(true)
  }

  const handleSaveCustomTool = (customTool: CustomTool) => {
    if (editingToolIndex !== null) {
      setValue(
        selectedTools.map((tool, index) =>
          index === editingToolIndex
            ? {
                ...tool,
                title: customTool.title,
                schema: customTool.schema,
                code: customTool.code || '',
              }
            : tool
        )
      )
      setEditingToolIndex(null)
    } else {
      handleAddCustomTool(customTool)
    }
  }

  const handleRemoveTool = (toolType: string, toolIndex: number) => {
    setValue(selectedTools.filter((_, index) => index !== toolIndex))
  }

  const handleDeleteTool = (toolId: string) => {
    const updatedTools = selectedTools.filter((tool) => {
      if (
        tool.type === 'custom-tool' &&
        tool.schema?.function?.name &&
        customTools.some(
          (customTool) =>
            customTool.id === toolId &&
            customTool.schema.function.name === tool.schema.function.name
        )
      ) {
        return false
      }
      return true
    })

    if (updatedTools.length !== selectedTools.length) {
      setValue(updatedTools)
    }
  }

  const handleParamChange = (toolIndex: number, paramId: string, paramValue: string) => {
    const tool = selectedTools[toolIndex]
    const toolId =
      tool.type === 'custom-tool'
        ? `custom-${tool.schema?.function?.name || 'tool'}`
        : getToolIdFromBlock(tool.type) || tool.type

    if (paramValue.trim()) {
      useSubBlockStore.getState().setToolParam(toolId, paramId, paramValue)
    }

    setValue(
      selectedTools.map((tool, index) =>
        index === toolIndex
          ? {
              ...tool,
              params: {
                ...tool.params,
                [paramId]: paramValue,
              },
            }
          : tool
      )
    )
  }

  const handleOperationChange = (toolIndex: number, operation: string) => {
    const tool = selectedTools[toolIndex]
    const store = useSubBlockStore.getState()

    // Clear fields when operation changes for Jira
    if (tool.type === 'jira') {
      store.setValue(blockId, 'summary', '')
      store.setValue(blockId, 'description', '')
      store.setValue(blockId, 'issueKey', '')
      store.setValue(blockId, 'projectId', '')
      store.setValue(blockId, 'parentIssue', '')
    }

    setValue(
      selectedTools.map((tool, index) =>
        index === toolIndex
          ? {
              ...tool,
              operation,
              params: {},
            }
          : tool
      )
    )
  }

  const handleCredentialChange = (toolIndex: number, credentialId: string) => {
    setValue(
      selectedTools.map((tool, index) =>
        index === toolIndex
          ? {
              ...tool,
              params: {
                ...tool.params,
                credential: credentialId,
              },
            }
          : tool
      )
    )
  }

  const handleUsageControlChange = (toolIndex: number, usageControl: string) => {
    setValue(
      selectedTools.map((tool, index) =>
        index === toolIndex
          ? {
              ...tool,
              usageControl: usageControl as 'auto' | 'force' | 'none',
            }
          : tool
      )
    )
  }

  const toggleToolExpansion = (toolIndex: number) => {
    setValue(
      selectedTools.map((tool, index) =>
        index === toolIndex ? { ...tool, isExpanded: !tool.isExpanded } : tool
      )
    )
  }

  return (
    <div className="w-full">
      {selectedTools.length === 0 ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <div className="flex h-10 w-full items-center justify-center rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer">
              <div className="flex items-center text-base text-muted-foreground/50 md:text-sm">
                <PlusIcon className="w-4 h-4 mr-2" />
                Add Tool
              </div>
            </div>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-[200px]" align="start">
            <ToolPickerContent
              customFilter={customFilter}
              setSearchQuery={setSearchQuery}
              customTools={customTools}
              toolBlocks={toolBlocks}
              searchQuery={searchQuery}
              selectedTools={selectedTools}
              isWide={isWide}
              onSelectTool={handleSelectTool}
              onSelectCustomTool={handleSelectStoredCustomTool}
              onCreateTool={() => setCustomToolModalOpen(true)}
              onClose={() => setOpen(false)}
            />
          </PopoverContent>
        </Popover>
      ) : (
        <div className="flex flex-wrap gap-2 min-h-[2.5rem] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background">
          {selectedTools.map((tool, toolIndex) => {
            const isCustomTool = tool.type === 'custom-tool'
            const toolBlock = !isCustomTool
              ? toolBlocks.find((block) => block.type === tool.type)
              : null
            const toolId = !isCustomTool ? getToolIdFromBlock(tool.type) : null
            const hasOperations = !isCustomTool && hasMultipleOperations(tool.type)
            const operationOptions = hasOperations ? getOperationOptions(tool.type) : []

            const requiredParams = isCustomTool
              ? getCustomToolParams(tool.schema)
              : toolId
                ? getRequiredToolParams(toolId)
                : []

            const isExpandable = hasExpandableContent(
              isCustomTool,
              hasOperations,
              operationOptions,
              toolId,
              requiredParams
            )

            return (
              <div
                key={`${tool.type}-${toolIndex}`}
                className={cn('group flex flex-col', isWide ? 'w-[calc(50%-0.25rem)]' : 'w-full')}
              >
                <div className="flex flex-col rounded-md border bg-card overflow-visible">
                  <div
                    className={cn(
                      'flex items-center justify-between p-2 bg-accent/50',
                      isExpandable ? 'cursor-pointer' : 'cursor-default'
                    )}
                    onClick={() => {
                      if (isCustomTool) {
                        handleEditCustomTool(toolIndex)
                      } else if (isExpandable) {
                        toggleToolExpansion(toolIndex)
                      }
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-shrink-1 overflow-hidden">
                      <div
                        className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded"
                        style={{
                          backgroundColor: isCustomTool ? '#3B82F6' : toolBlock?.bgColor,
                        }}
                      >
                        {isCustomTool ? (
                          <WrenchIcon className="w-3 h-3 text-white" />
                        ) : (
                          <IconComponent icon={toolBlock?.icon} className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <span className="text-sm font-medium truncate">{tool.title}</span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                      {supportsToolControl && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Toggle
                              className="group h-6 px-2 py-0 rounded-sm data-[state=on]:bg-transparent hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 flex items-center justify-center"
                              pressed={true}
                              onPressedChange={() => {}}
                              onClick={(e: React.MouseEvent) => {
                                e.stopPropagation()
                                const currentState = tool.usageControl || 'auto'
                                const nextState =
                                  currentState === 'auto'
                                    ? 'force'
                                    : currentState === 'force'
                                      ? 'none'
                                      : 'auto'
                                handleUsageControlChange(toolIndex, nextState)
                              }}
                              aria-label="Toggle tool usage control"
                            >
                              <span
                                className={`text-xs font-medium ${
                                  tool.usageControl === 'auto'
                                    ? 'block text-muted-foreground'
                                    : 'hidden'
                                }`}
                              >
                                Auto
                              </span>
                              <span
                                className={`text-xs font-medium ${
                                  tool.usageControl === 'force'
                                    ? 'block text-muted-foreground'
                                    : 'hidden'
                                }`}
                              >
                                Force
                              </span>
                              <span
                                className={`text-xs font-medium ${
                                  tool.usageControl === 'none'
                                    ? 'block text-muted-foreground'
                                    : 'hidden'
                                }`}
                              >
                                Deny
                              </span>
                            </Toggle>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="p-2 max-w-[240px]">
                            <p className="text-xs">
                              {tool.usageControl === 'auto' && (
                                <span>
                                  <span className="font-medium">Auto:</span> Let the agent decide
                                  when to use the tool
                                </span>
                              )}
                              {tool.usageControl === 'force' && (
                                <span>
                                  <span className="font-medium">Force:</span> Always use this tool
                                  in the response
                                </span>
                              )}
                              {tool.usageControl === 'none' && (
                                <span>
                                  <span className="font-medium">Deny:</span> Never use this tool
                                </span>
                              )}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveTool(tool.type, toolIndex)
                        }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <XIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {tool.isExpanded && !isCustomTool && isExpandable && (
                    <div
                      className="p-3 space-y-3"
                      onClick={(e) => {
                        if (e.target === e.currentTarget) {
                          toggleToolExpansion(toolIndex)
                        }
                      }}
                    >
                      {hasOperations && operationOptions.length > 0 && (
                        <div className="space-y-1.5 relative">
                          <div className="text-xs font-medium text-muted-foreground">Operation</div>
                          <Select
                            value={tool.operation || operationOptions[0].id}
                            onValueChange={(value) => handleOperationChange(toolIndex, value)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select operation" />
                            </SelectTrigger>
                            <SelectContent>
                              {operationOptions.map((option) => (
                                <SelectItem key={option.id} value={option.id}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {toolId &&
                        (() => {
                          const oauthConfig = getOAuthConfig(toolId)
                          if (oauthConfig?.required) {
                            return (
                              <div className="space-y-1.5 relative">
                                <div className="text-xs font-medium text-muted-foreground">
                                  Account
                                </div>
                                <CredentialSelector
                                  value={tool.params.credential || ''}
                                  onChange={(value) => handleCredentialChange(toolIndex, value)}
                                  provider={oauthConfig.provider as OAuthProvider}
                                  requiredScopes={oauthConfig.additionalScopes || []}
                                  label={`Select ${oauthConfig.provider} account`}
                                  serviceId={oauthConfig.provider}
                                />
                              </div>
                            )
                          }
                          return null
                        })()}

                      {requiredParams.map((param) => (
                        <div key={param.id} className="space-y-1.5 relative">
                          <div className="text-xs font-medium text-muted-foreground flex items-center">
                            {formatParamId(param.id)}
                            {param.optionalToolInput && !param.requiredForToolCall && (
                              <span className="ml-1 text-xs text-muted-foreground/60">
                                (Optional)
                              </span>
                            )}
                          </div>
                          <div className="relative">
                            <ShortInput
                              blockId={blockId}
                              subBlockId={`${subBlockId}-param`}
                              placeholder={param.description}
                              password={param.id.toLowerCase().replace(/\s+/g, '') === 'apikey'}
                              isConnecting={false}
                              config={{
                                id: `${subBlockId}-param`,
                                type: 'short-input',
                                title: param.id,
                              }}
                              value={tool.params[param.id] || ''}
                              onChange={(value) => handleParamChange(toolIndex, param.id, value)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <PlusIcon className="w-3 h-3" />
                Add Tool
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[200px]" align="start">
              <ToolPickerContent
                customFilter={customFilter}
                setSearchQuery={setSearchQuery}
                customTools={customTools}
                toolBlocks={toolBlocks}
                searchQuery={searchQuery}
                selectedTools={selectedTools}
                isWide={isWide}
                onSelectTool={handleSelectTool}
                onSelectCustomTool={handleSelectStoredCustomTool}
                onCreateTool={() => setCustomToolModalOpen(true)}
                onClose={() => setOpen(false)}
              />
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Custom Tool Modal */}
      <CustomToolModal
        open={customToolModalOpen}
        onOpenChange={(open) => {
          setCustomToolModalOpen(open)
          if (!open) setEditingToolIndex(null)
        }}
        onSave={editingToolIndex !== null ? handleSaveCustomTool : handleAddCustomTool}
        onDelete={handleDeleteTool}
        initialValues={
          editingToolIndex !== null && selectedTools[editingToolIndex]?.type === 'custom-tool'
            ? {
                id: customTools.find(
                  (tool) =>
                    tool.schema.function.name ===
                    selectedTools[editingToolIndex].schema.function.name
                )?.id,
                schema: selectedTools[editingToolIndex].schema,
                code: selectedTools[editingToolIndex].code || '',
              }
            : undefined
        }
      />
    </div>
  )
}
