'use client'

import { useEffect, useRef } from 'react'
import { ChevronDown, MoreVertical, Plus } from 'lucide-react'
import { highlight, languages } from 'prismjs'
import 'prismjs/components/prism-javascript'
import 'prismjs/themes/prism.css'
import Editor from 'react-simple-code-editor'
import {
  ModernDeleteIcon as DeleteIcon,
  ModernDuplicateIcon as DuplicateIcon,
} from '@/components/modern-control-icons'
import {
  ModernDuplicateIcon as CopyIcon,
  ModernDeleteIcon as TrashIcon,
} from '@/components/modern-control-icons'
import { ModernDeleteIcon, ModernDuplicateIcon } from '@/components/modern-control-icons'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { VariableManager } from '@/lib/variables/variable-manager'
import { useVariablesStore } from '@/stores/panel/variables/store'
import { Variable, VariableType } from '@/stores/panel/variables/types'
import { useWorkflowRegistry } from '@/stores/workflows/registry/store'

interface VariablesProps {
  panelWidth: number
}

export function Variables({ panelWidth }: VariablesProps) {
  const { activeWorkflowId, workflows } = useWorkflowRegistry()
  const {
    variables: storeVariables,
    addVariable,
    updateVariable,
    deleteVariable,
    duplicateVariable,
    getVariablesByWorkflowId,
    loadVariables,
  } = useVariablesStore()

  // Get variables for the current workflow
  const workflowVariables = activeWorkflowId ? getVariablesByWorkflowId(activeWorkflowId) : []

  // Load variables when workflow changes
  useEffect(() => {
    if (activeWorkflowId && workflows[activeWorkflowId]) {
      loadVariables(activeWorkflowId)
    }
  }, [activeWorkflowId, workflows, loadVariables])

  // Track editor references
  const editorRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // Auto-save when variables are added/edited
  const handleAddVariable = () => {
    if (!activeWorkflowId) return

    // Create a default variable - naming is handled in the store
    const id = addVariable({
      name: '', // Store will generate an appropriate name
      type: 'string',
      value: '',
      workflowId: activeWorkflowId,
    })

    return id
  }

  const getTypeIcon = (type: VariableType) => {
    switch (type) {
      case 'string':
        return 'Aa'
      case 'number':
        return '123'
      case 'boolean':
        return '0/1'
      case 'object':
        return '{}'
      case 'array':
        return '[]'
      case 'plain':
        return 'Abc'
      default:
        return '?'
    }
  }

  const getPlaceholder = (type: VariableType) => {
    switch (type) {
      case 'string':
        return '"Hello world"'
      case 'number':
        return '42'
      case 'boolean':
        return 'true'
      case 'object':
        return '{\n  "key": "value"\n}'
      case 'array':
        return '[\n  1,\n  2,\n  3\n]'
      case 'plain':
        return 'Plain text value'
      default:
        return ''
    }
  }

  const getEditorLanguage = (type: VariableType) => {
    switch (type) {
      case 'object':
      case 'array':
      case 'boolean':
      case 'number':
      case 'plain':
        return 'javascript'
      default:
        return 'javascript'
    }
  }

  const formatValue = (variable: Variable) => {
    if (variable.value === '') return ''

    try {
      // Use the VariableManager to format values consistently
      return VariableManager.formatForEditor(variable.value, variable.type)
    } catch (e) {
      console.error('Error formatting value:', e)
      // If formatting fails, return as is
      return typeof variable.value === 'string' ? variable.value : JSON.stringify(variable.value)
    }
  }

  // Clear editor refs when variables change
  useEffect(() => {
    // Clean up any references to deleted variables
    Object.keys(editorRefs.current).forEach((id) => {
      if (!workflowVariables.some((v) => v.id === id)) {
        delete editorRefs.current[id]
      }
    })
  }, [workflowVariables])

  // Handle editor value changes
  const handleEditorChange = (variable: Variable, newValue: string) => {
    try {
      // Use the VariableManager to consistently parse input values
      const processedValue = VariableManager.parseInputForStorage(newValue, variable.type)

      // Update the variable with the processed value
      updateVariable(variable.id, { value: processedValue })
    } catch (e) {
      // If processing fails, use the raw value
      updateVariable(variable.id, { value: newValue })
    }
  }

  return (
    <div className="h-full bg-white/30 dark:bg-slate-900/30">
      <ScrollArea className="h-full">
        <div className="p-4 space-y-4">
          {/* Variables List */}
          {workflowVariables.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-sm text-zinc-400 dark:text-white/40 px-6">
              <div className="bg-zinc-50 dark:bg-white/[0.03] rounded-2xl p-8 text-center max-w-sm border border-black/[0.06] dark:border-white/[0.06] shadow-sm">
                <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-white/[0.06] flex items-center justify-center mx-auto mb-4">
                  <div className="w-6 h-6 rounded bg-zinc-200 dark:bg-white/[0.08] flex items-center justify-center">
                    <span className="text-xs font-mono text-zinc-500 dark:text-white/50 font-bold">
                      x
                    </span>
                  </div>
                </div>
                <div className="font-medium font-logo text-zinc-800/80 dark:text-white/80 mb-2">
                  No variables yet
                </div>
                <div className="text-xs text-zinc-400 dark:text-white/40 mb-4 leading-relaxed">
                  Variables help you store and reuse values across your workflow
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-[13px] font-semibold font-logo tracking-[0.02em] bg-zinc-800 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-white/90 transition-all duration-200 shadow-sm hover:shadow-md rounded-xl"
                  onClick={handleAddVariable}
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Add your first variable
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {workflowVariables.map((variable) => (
                  <div
                    key={variable.id}
                    className="group flex flex-col space-y-0 rounded-xl border border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-slate-900 backdrop-blur-sm shadow-sm hover:shadow-lg hover:border-black/[0.10] dark:hover:border-white/[0.10] transition-all duration-200"
                  >
                    <div className="flex items-center justify-between p-4 border-b border-black/[0.06] dark:border-white/[0.06] bg-zinc-50/50 dark:bg-white/[0.02]">
                      <div className="flex-1 flex items-center gap-3">
                        <Input
                          className="h-10 bg-white dark:bg-slate-900 backdrop-blur-sm border-black/[0.06] dark:border-white/[0.06] focus-visible:ring-2 focus-visible:ring-zinc-400/40 focus-visible:border-zinc-400/40 max-w-44 text-sm font-medium font-logo rounded-xl shadow-sm hover:shadow-md transition-all duration-200"
                          placeholder="Variable name"
                          value={variable.name}
                          onChange={(e) => updateVariable(variable.id, { name: e.target.value })}
                        />

                        <DropdownMenu>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-10 gap-2 rounded-xl border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-slate-900 backdrop-blur-sm hover:bg-zinc-50 dark:hover:bg-white/[0.04] hover:border-black/[0.10] dark:hover:border-white/[0.10] transition-all duration-200 shadow-sm hover:shadow-md"
                                >
                                  <span className="text-sm font-mono font-semibold text-primary/80">
                                    {getTypeIcon(variable.type)}
                                  </span>
                                  <ChevronDown className="h-3.5 w-3.5 text-zinc-400 dark:text-white/40" />
                                </Button>
                              </DropdownMenuTrigger>
                            </TooltipTrigger>
                            <TooltipContent side="top">Set variable type</TooltipContent>
                          </Tooltip>
                          <DropdownMenuContent align="end" className="min-w-32">
                            <DropdownMenuItem
                              onClick={() => updateVariable(variable.id, { type: 'string' })}
                              className="cursor-pointer flex items-center"
                            >
                              <div className="w-5 text-center mr-2 font-mono text-sm">Aa</div>
                              <span>String</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => updateVariable(variable.id, { type: 'number' })}
                              className="cursor-pointer flex items-center"
                            >
                              <div className="w-5 text-center mr-2 font-mono text-sm">123</div>
                              <span>Number</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => updateVariable(variable.id, { type: 'boolean' })}
                              className="cursor-pointer flex items-center"
                            >
                              <div className="w-5 text-center mr-2 font-mono text-sm">0/1</div>
                              <span>Boolean</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => updateVariable(variable.id, { type: 'object' })}
                              className="cursor-pointer flex items-center"
                            >
                              <div className="w-5 text-center mr-2 font-mono text-sm">{'{}'}</div>
                              <span>Object</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => updateVariable(variable.id, { type: 'array' })}
                              className="cursor-pointer flex items-center"
                            >
                              <div className="w-5 text-center mr-2 font-mono text-sm">[]</div>
                              <span>Array</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => updateVariable(variable.id, { type: 'plain' })}
                              className="cursor-pointer flex items-center"
                            >
                              <div className="w-5 text-center mr-2 font-mono text-sm">Abc</div>
                              <span>Plain</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>

                        <div className="flex items-center gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 text-zinc-400 dark:text-white/40 rounded-xl hover:bg-gradient-to-r hover:from-primary/10 hover:to-primary/5 hover:text-primary hover:border-primary/20 border border-transparent transition-all duration-300 shadow-sm hover:shadow-md"
                                onClick={() => duplicateVariable(variable.id)}
                              >
                                <ModernDuplicateIcon className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">Duplicate</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 text-zinc-400 dark:text-white/40 rounded-xl hover:bg-gradient-to-r hover:from-red-50/50 hover:to-red-100/30 dark:hover:from-red-950/30 dark:hover:to-red-900/20 hover:text-red-500 hover:border-red-200/40 dark:hover:border-red-800/40 border border-transparent transition-all duration-300 shadow-sm hover:shadow-md"
                                onClick={() => deleteVariable(variable.id)}
                              >
                                <ModernDeleteIcon className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">Delete</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    </div>

                    <div
                      className="relative min-h-[44px] rounded-xl bg-zinc-50/50 dark:bg-white/[0.02] font-mono text-sm px-4 pt-3 pb-4 mx-4 mb-4 border border-black/[0.06] dark:border-white/[0.06] shadow-sm hover:shadow-md transition-all duration-200"
                      ref={(el) => {
                        editorRefs.current[variable.id] = el
                      }}
                    >
                      {variable.value === '' && (
                        <div className="absolute top-[12px] left-4 text-zinc-400/50 dark:text-white/30 pointer-events-none select-none font-medium">
                          {getPlaceholder(variable.type)}
                        </div>
                      )}
                      <Editor
                        key={`editor-${variable.id}-${variable.type}`}
                        value={formatValue(variable)}
                        onValueChange={handleEditorChange.bind(null, variable)}
                        highlight={(code) =>
                          highlight(
                            code,
                            languages[getEditorLanguage(variable.type)],
                            getEditorLanguage(variable.type)
                          )
                        }
                        padding={0}
                        style={{
                          fontFamily: 'inherit',
                          lineHeight: '22px',
                        }}
                        className="focus:outline-none w-full"
                        textareaClassName="focus:outline-none focus:ring-0 bg-transparent resize-none w-full overflow-hidden whitespace-pre-wrap"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Variable Button */}
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 text-[13px] font-semibold font-logo tracking-[0.02em] w-full justify-center text-zinc-800 dark:text-white bg-zinc-50 dark:bg-white/[0.04] hover:bg-zinc-100 dark:hover:bg-white/[0.06] rounded-xl border border-black/[0.06] dark:border-white/[0.06] hover:border-black/[0.10] dark:hover:border-white/[0.10] transition-all duration-200 shadow-sm hover:shadow-md"
                onClick={handleAddVariable}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add variable
              </Button>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
