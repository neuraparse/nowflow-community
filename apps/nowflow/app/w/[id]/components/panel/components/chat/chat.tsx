'use client'

import { KeyboardEvent, useEffect, useMemo, useRef } from 'react'
import { ModernSendIcon } from '@/components/modern-panel-content-icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { getDefaultModel } from '@/lib/ai/provider-config'
import { createLogger } from '@/lib/logs/console-logger'
import { buildTraceSpans } from '@/lib/logs/trace-spans'
import { useExecutionStore } from '@/stores/execution/store'
import { useChatStore } from '@/stores/panel/chat/store'
import { useConsoleStore } from '@/stores/panel/console/store'
import { useWorkflowRegistry } from '@/stores/workflows/registry/store'
import { BlockLog } from '@/executor/types'
import { calculateCost } from '@/providers/utils'
import { useWorkflowExecution } from '../../../../hooks/use-workflow-execution'
import { ChatMessage } from './components/chat-message/chat-message'
import { OutputSelect } from './components/output-select/output-select'

const logger = createLogger('Chat')

interface ChatProps {
  panelWidth: number
  chatMessage: string
  setChatMessage: (message: string) => void
}

export function Chat({ panelWidth, chatMessage, setChatMessage }: ChatProps) {
  const { activeWorkflowId } = useWorkflowRegistry()
  const {
    messages,
    addMessage,
    selectedWorkflowOutputs,
    setSelectedWorkflowOutput,
    appendMessageContent,
    finalizeMessageStream,
    clearChat,
  } = useChatStore()
  const { entries } = useConsoleStore()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Use the execution store state to track if a workflow is executing
  const { isExecuting, setIsExecuting } = useExecutionStore()

  // Get workflow execution functionality
  const { handleRunWorkflow } = useWorkflowExecution()

  // Get output entries from console for the dropdown
  const outputEntries = useMemo(() => {
    if (!activeWorkflowId) return []
    return entries.filter((entry) => entry.workflowId === activeWorkflowId && entry.output)
  }, [entries, activeWorkflowId])

  // Get filtered messages for current workflow
  const workflowMessages = useMemo(() => {
    if (!activeWorkflowId) return []
    return messages
      .filter((msg) => msg.workflowId === activeWorkflowId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  }, [messages, activeWorkflowId])

  // Get selected workflow outputs
  const selectedOutputs = useMemo(() => {
    if (!activeWorkflowId) return []
    const selected = selectedWorkflowOutputs[activeWorkflowId]

    if (!selected || selected.length === 0) {
      const defaultSelection = outputEntries.length > 0 ? [outputEntries[0].id] : []
      return defaultSelection
    }

    // Ensure we have no duplicates in the selection
    const dedupedSelection = [...new Set(selected)]

    // If deduplication removed items, update the store
    if (dedupedSelection.length !== selected.length) {
      setSelectedWorkflowOutput(activeWorkflowId, dedupedSelection)
      return dedupedSelection
    }

    return selected
  }, [selectedWorkflowOutputs, activeWorkflowId, outputEntries, setSelectedWorkflowOutput])

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [workflowMessages])

  // Handle send message
  const handleSendMessage = async () => {
    if (!chatMessage.trim() || !activeWorkflowId || isExecuting) return

    // Store the message being sent for reference
    const sentMessage = chatMessage.trim()

    // Add user message
    addMessage({
      content: sentMessage,
      workflowId: activeWorkflowId,
      type: 'user',
    })

    // Clear input
    setChatMessage('')

    // Execute the workflow to generate a response, passing the chat message as input
    const result = await handleRunWorkflow({ input: sentMessage })

    // Check if we got a streaming response
    if (result && 'stream' in result && result.stream instanceof ReadableStream) {
      // Generate a unique ID for the message
      const messageId = crypto.randomUUID()

      // Create a content buffer to collect initial content
      let initialContent = ''
      let fullContent = '' // Store the complete content for updating logs later
      let hasAddedMessage = false
      let executionResult = (result as any).execution // Store the execution result with type assertion

      try {
        // Process the stream
        const reader = result.stream.getReader()
        const decoder = new TextDecoder()

        logger.debug('Starting to read from stream')

        while (true) {
          try {
            const { done, value } = await reader.read()
            if (done) {
              logger.debug('Stream complete')
              break
            }

            // Decode and append chunk
            const chunk = decoder.decode(value, { stream: true }) // Use stream option

            if (chunk) {
              initialContent += chunk
              fullContent += chunk

              // Only add the message to UI once we have some actual content to show
              if (!hasAddedMessage && initialContent.trim().length > 0) {
                // Add message with initial content - cast to any to bypass type checking for id
                addMessage({
                  content: initialContent,
                  workflowId: activeWorkflowId,
                  type: 'workflow',
                  isStreaming: true,
                  id: messageId,
                } as any)
                hasAddedMessage = true
              } else if (hasAddedMessage) {
                // Append to existing message
                appendMessageContent(messageId, chunk)
              }
            }
          } catch (streamError) {
            logger.error('Error reading from stream:', streamError)
            // Break the loop on error
            break
          }
        }

        // If we never added a message (no content received), add it now
        if (!hasAddedMessage && initialContent.trim().length > 0) {
          addMessage({
            content: initialContent,
            workflowId: activeWorkflowId,
            type: 'workflow',
            id: messageId,
          } as any)
        }

        // Update logs with the full streaming content if available
        if (executionResult && fullContent.trim().length > 0) {
          try {
            // Format the final content properly to match what's shown for manual executions
            // Include all the markdown and formatting from the streamed response
            const formattedContent = fullContent

            // Calculate cost based on token usage if available
            let costData = undefined

            if (executionResult.output?.response?.tokens) {
              const tokens = executionResult.output.response.tokens
              const model = executionResult.output?.response?.model || getDefaultModel('openai')
              const cost = calculateCost(
                model,
                tokens.prompt || 0,
                tokens.completion || 0,
                false // Don't use cached input for chat responses
              )
              costData = { ...cost, model } as any
            }

            // Build trace spans and total duration before persisting
            const { traceSpans, totalDuration } = buildTraceSpans(executionResult as any)

            // Create a completed execution ID
            const completedExecutionId =
              executionResult.metadata?.executionId || crypto.randomUUID()

            // Import the workflow execution hook for direct access to the workflow service
            const workflowExecutionApi = await fetch(`/api/workflows/${activeWorkflowId}/log`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                executionId: completedExecutionId,
                result: {
                  ...executionResult,
                  output: {
                    ...executionResult.output,
                    response: {
                      ...executionResult.output?.response,
                      content: formattedContent,
                      model: executionResult.output?.response?.model,
                      tokens: executionResult.output?.response?.tokens,
                      toolCalls: executionResult.output?.response?.toolCalls,
                      providerTiming: executionResult.output?.response?.providerTiming,
                      cost: costData || executionResult.output?.response?.cost,
                    },
                  },
                  cost: costData,
                  // Update the message to include the formatted content
                  logs: (executionResult.logs || []).map((log: BlockLog) => {
                    // Check if this is the streaming block by comparing with the selected output IDs
                    // Selected output IDs typically include the block ID we are streaming from
                    const isStreamingBlock = selectedOutputs.some(
                      (outputId) =>
                        outputId === log.blockId || outputId.startsWith(`${log.blockId}_`)
                    )

                    if (isStreamingBlock && log.blockType === 'agent' && log.output?.response) {
                      return {
                        ...log,
                        output: {
                          ...log.output,
                          response: {
                            ...log.output.response,
                            content: formattedContent,
                            providerTiming: log.output.response.providerTiming,
                            cost: costData || log.output.response.cost,
                          },
                        },
                      }
                    }
                    return log
                  }),
                  metadata: {
                    ...executionResult.metadata,
                    source: 'chat',
                    completedAt: new Date().toISOString(),
                    isStreamingComplete: true,
                    cost: costData || executionResult.metadata?.cost,
                    providerTiming: executionResult.output?.response?.providerTiming,
                  },
                  traceSpans: traceSpans,
                  totalDuration: totalDuration,
                },
              }),
            })

            if (!workflowExecutionApi.ok) {
              logger.error('Failed to log complete streaming execution')
            }
          } catch (logError) {
            logger.error('Error logging complete streaming execution:', logError)
          }
        }
      } catch (error) {
        logger.error('Error processing stream:', error)

        // If there's an error and we haven't added a message yet, add an error message
        if (!hasAddedMessage) {
          addMessage({
            content: 'Error: Failed to process the streaming response.',
            workflowId: activeWorkflowId,
            type: 'workflow',
            id: messageId,
          } as any)
        } else {
          // Otherwise append the error to the existing message
          appendMessageContent(messageId, '\n\nError: Failed to process the streaming response.')
        }
      } finally {
        logger.debug('Finalizing stream')
        if (hasAddedMessage) {
          finalizeMessageStream(messageId)
        }
        // Reset execution state to allow next message
        setIsExecuting(false)
      }
    }
  }

  // Handle key press
  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // Handle output selection
  const handleOutputSelection = (values: string[]) => {
    // Ensure no duplicates in selection
    const dedupedValues = [...new Set(values)]

    if (activeWorkflowId) {
      // If array is empty, explicitly set to empty array to ensure complete reset
      if (dedupedValues.length === 0) {
        setSelectedWorkflowOutput(activeWorkflowId, [])
      } else {
        setSelectedWorkflowOutput(activeWorkflowId, dedupedValues)
      }
    }
  }

  return (
    <div className="flex h-full flex-col bg-[linear-gradient(180deg,rgba(255,255,255,0.32),rgba(255,255,255,0.12))] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))]">
      {/* Output Source Dropdown - Enhanced */}
      <div className="relative z-40 flex-none border-b border-black/[0.06] bg-white/28 px-4 py-3 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.02]">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-white/50">
              <div className="h-2 w-2 rounded-full bg-[#4A7A68] dark:bg-[#94B8A6]"></div>
              <span className="font-logo uppercase tracking-[0.14em]">Output Sources</span>
            </div>
            {workflowMessages.length > 0 && (
              <button
                onClick={() => clearChat(activeWorkflowId)}
                className="silver-glass-chip rounded-[10px] px-2.5 py-1 text-[11px] font-logo text-zinc-500 transition-all duration-200 hover:text-red-500 dark:text-white/45 dark:hover:text-red-400"
              >
                Clear Chat
              </button>
            )}
          </div>
          <OutputSelect
            workflowId={activeWorkflowId}
            selectedOutputs={selectedOutputs}
            onOutputSelect={handleOutputSelection}
            disabled={!activeWorkflowId}
            placeholder="Select output sources"
          />
        </div>
      </div>

      {/* Main layout with fixed heights to ensure input stays visible */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Chat messages section - Scrollable area */}
        <div className="flex-1 overflow-hidden relative">
          <ScrollArea className="h-full">
            <div className="relative">
              {workflowMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-sm text-muted-foreground/70 px-6">
                  <div className="silver-glass-pane max-w-sm rounded-[12px] border-black/[0.06] p-8 text-center dark:border-white/[0.08]">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-[12px] bg-[#4A7A68]/10 dark:bg-[#94B8A6]/10">
                      <ModernSendIcon className="h-6 w-6 text-[#4A7A68] dark:text-[#94B8A6]" />
                    </div>
                    <div className="mb-2 font-logo text-[14px] font-semibold text-zinc-800 dark:text-white">
                      Start a conversation
                    </div>
                    <div className="font-logo text-xs leading-relaxed text-zinc-500 dark:text-white/38">
                      Send a message to interact with your workflow and see the results here
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  {workflowMessages.map((message) => (
                    <ChatMessage key={message.id} message={message} containerWidth={panelWidth} />
                  ))}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Gradient overlay for better visual separation */}
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-[#f3f4f2] to-transparent dark:from-[#18191d]" />
        </div>

        {/* Input section - Enhanced */}
        <div className="relative flex-none border-t border-black/[0.06] bg-white/24 px-4 py-4 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.02]">
          <div className="flex gap-3 items-end">
            <div className="relative flex-1">
              <Input
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Type your message..."
                className="silver-glass-pane h-11 flex-1 rounded-[12px] border-black/[0.06] pr-12 text-sm font-logo font-medium text-zinc-800 transition-all duration-300 placeholder:text-zinc-400 focus-visible:ring-2 focus-visible:ring-[#4A7A68]/20 focus-visible:ring-offset-0 dark:border-white/[0.08] dark:text-white dark:placeholder:text-white/30"
                disabled={!activeWorkflowId || isExecuting}
              />
              <Button
                onClick={handleSendMessage}
                size="icon"
                disabled={!chatMessage.trim() || !activeWorkflowId || isExecuting}
                className="silver-glass-button-strong absolute right-1 top-1 h-9 w-9 rounded-[10px] text-black shadow-[0_14px_28px_rgba(24,24,24,0.10)] transition-all duration-300 hover:text-black disabled:cursor-not-allowed disabled:opacity-50 dark:text-white dark:hover:text-white dark:shadow-[0_18px_34px_rgba(0,0,0,0.28)]"
              >
                <ModernSendIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Status indicator */}
          {isExecuting && (
            <div className="absolute right-4 top-2 flex items-center gap-2 text-xs text-[#4A7A68] dark:text-[#94B8A6]">
              <div className="h-2 w-2 rounded-full bg-[#4A7A68] animate-pulse dark:bg-[#94B8A6]"></div>
              <span className="font-logo font-medium">Processing...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
