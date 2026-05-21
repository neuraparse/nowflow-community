import { v4 as uuidv4 } from 'uuid'
import { captureSnapshot, checkBreakpoint } from '@/lib/debug/snapshot-service'
import {
  applyVariantToWorkflow,
  ExperimentData,
  ExperimentVariant,
  getActiveExperiment,
  selectVariant,
} from '@/lib/experiments/experiment-service'
import { savePausedExecutionState } from '@/lib/hitl/execution-state'
import { createLogger } from '@/lib/logs/console-logger'
import { withSpan } from '@/lib/observability'
import { useExecutionStore } from '@/stores/execution/store'
import { useConsoleStore } from '@/stores/panel/console/store'
import { useGeneralStore } from '@/stores/settings/general/store'
import { BlockOutput } from '@/blocks/types'
import { SerializedBlock, SerializedWorkflow } from '@/serializer/types'
import { extractErrorMessage, sanitizeError } from './error-utils'
import {
  AgentBlockHandler,
  ApiBlockHandler,
  ApprovalBlockHandler,
  buildPersonaSystemPrompt,
  ConditionBlockHandler,
  EvaluatorBlockHandler,
  FunctionBlockHandler,
  GenericBlockHandler,
  HITLPauseError,
  HumanAgentBlockHandler,
  RouterBlockHandler,
  SubWorkflowBlockHandler,
} from './handlers/index'
import { LoopManager } from './loops'
import { createBlockLog, normalizeBlockOutput } from './normalization'
import { sendCompletionNotification, sendFailureNotification } from './notifications'
import { PathTracker } from './path'
import { InputResolver } from './resolver'
import { isStreamingExecution, processStreamingOutput } from './streaming'
import {
  BlockHandler,
  ExecutionContext,
  ExecutionResult,
  NormalizedBlockOutput,
  StreamingExecution,
} from './types'
import { formatValidationErrors, validateBlockInputs } from './validation'

const logger = createLogger('Executor')

/**
 * Core execution engine that runs workflow blocks in topological order.
 *
 * Handles block execution, state management, and error handling.
 * Optimized with caching and parallel execution.
 */
export class Executor {
  // Core components are initialized once and remain immutable
  private resolver: InputResolver
  private loopManager: LoopManager
  private pathTracker: PathTracker
  private blockHandlers: BlockHandler[]
  private workflowInput: any
  private isDebugging: boolean = false
  private contextExtensions: any = {}
  private actualWorkflow: SerializedWorkflow
  private workflowState: Record<string, any> | null = null

  // Performance optimizations
  private blockLookupCache: Map<string, SerializedBlock> = new Map()
  private starterBlockCache: SerializedBlock | null = null

  // Experiment/A/B testing state
  private activeExperiment: ExperimentData | null = null
  private selectedVariant: ExperimentVariant | null = null

  constructor(
    private workflowParam:
      | SerializedWorkflow
      | {
          workflow: SerializedWorkflow
          currentBlockStates?: Record<string, BlockOutput>
          envVarValues?: Record<string, string>
          workflowInput?: any
          workflowVariables?: Record<string, any>
          workflowState?: Record<string, any> // Full workflow state for experiment overrides
          contextExtensions?: {
            stream?: boolean
            selectedOutputIds?: string[]
            edges?: Array<{ source: string; target: string }>
            userId?: string
            sessionId?: string
            sessionToken?: string
            memoryEnabled?: boolean
            sessionMetadata?: Record<string, any>
            apiBaseUrl?: string
            executionId?: string // Unique ID for this execution (for HITL)
            executedBlocks?: string[] // Blocks already executed (for HITL resume)
            activeExecutionPath?: string[] // Active execution path (for HITL resume)
            // Experiment/A/B testing support
            experimentId?: string // Active experiment ID (if pre-selected)
            variantId?: string // Selected variant ID (if pre-selected)
            skipExperimentSelection?: boolean // Skip auto experiment selection
          }
        },
    private initialBlockStates: Record<string, BlockOutput> = {},
    private environmentVariables: Record<string, string> = {},
    workflowInput?: any,
    private workflowVariables: Record<string, any> = {}
  ) {
    // Handle new constructor format with options object
    if (typeof workflowParam === 'object' && 'workflow' in workflowParam) {
      const options = workflowParam
      this.actualWorkflow = options.workflow
      this.initialBlockStates = options.currentBlockStates || {}
      this.environmentVariables = options.envVarValues || {}
      this.workflowInput = options.workflowInput || {}
      this.workflowVariables = options.workflowVariables || {}
      this.workflowState = options.workflowState || null

      // Store context extensions for streaming and output selection
      if (options.contextExtensions) {
        this.contextExtensions = options.contextExtensions

        if (this.contextExtensions.stream) {
          logger.info('Executor initialized with streaming enabled', {
            hasSelectedOutputIds: Array.isArray(this.contextExtensions.selectedOutputIds),
            selectedOutputCount: Array.isArray(this.contextExtensions.selectedOutputIds)
              ? this.contextExtensions.selectedOutputIds.length
              : 0,
            selectedOutputIds: this.contextExtensions.selectedOutputIds || [],
          })
        }
      }
    } else {
      this.actualWorkflow = workflowParam

      if (workflowInput) {
        this.workflowInput = workflowInput
        logger.info('[Executor] Using workflow input:', JSON.stringify(this.workflowInput, null, 2))
      } else {
        this.workflowInput = {}
      }
    }

    // Initialize block lookup cache FIRST for O(1) access
    this.initializeBlockCache()

    // Now validate workflow (uses cache)
    this.validateWorkflow()

    this.loopManager = new LoopManager(this.actualWorkflow.loops || {})
    this.resolver = new InputResolver(
      this.actualWorkflow,
      this.environmentVariables,
      this.workflowVariables,
      this.loopManager
    )
    this.pathTracker = new PathTracker(this.actualWorkflow)

    this.blockHandlers = [
      new AgentBlockHandler(),
      new HumanAgentBlockHandler(),
      new RouterBlockHandler(this.pathTracker),
      new ConditionBlockHandler(this.pathTracker, this.resolver),
      new EvaluatorBlockHandler(),
      new FunctionBlockHandler(),
      new ApiBlockHandler(),
      new ApprovalBlockHandler(),
      new SubWorkflowBlockHandler(),
      new GenericBlockHandler(),
    ]

    this.isDebugging = useGeneralStore.getState().isDebugModeEnabled
  }

  /**
   * Initialize block lookup cache for performance
   * Converts O(n) array search to O(1) Map lookup
   */
  private initializeBlockCache(): void {
    this.actualWorkflow.blocks.forEach((block) => {
      this.blockLookupCache.set(block.id, block)

      // Cache starter block for frequent access
      if (block.metadata?.id === 'starter') {
        this.starterBlockCache = block
      }
    })

    logger.debug(`Block cache initialized with ${this.blockLookupCache.size} blocks`)
  }

  /**
   * Applies variant block overrides to the actual workflow blocks
   * Modifies block parameters based on experiment variant configuration
   */
  private applyVariantOverridesToBlocks(variant: ExperimentVariant): void {
    if (!variant.blockOverrides || variant.blockOverrides.length === 0) {
      return
    }

    for (const override of variant.blockOverrides) {
      const block = this.blockLookupCache.get(override.blockId)
      if (!block) {
        logger.warn('A/B Experiment: Block not found for override', {
          blockId: override.blockId,
          variantId: variant.id,
        })
        continue
      }

      // Apply enabled/disabled state
      if (override.enabled !== undefined) {
        block.enabled = override.enabled
        logger.debug('A/B Experiment: Applied enabled state override', {
          blockId: override.blockId,
          enabled: override.enabled,
        })
      }

      // Apply parameter overrides
      if (override.params && block.config?.params) {
        for (const [paramId, value] of Object.entries(override.params)) {
          if (block.config.params[paramId] !== undefined) {
            const originalValue = block.config.params[paramId]
            block.config.params[paramId] = value
            logger.debug('A/B Experiment: Applied parameter override', {
              blockId: override.blockId,
              paramId,
              originalValue:
                typeof originalValue === 'string' ? originalValue.substring(0, 50) : originalValue,
              newValue: typeof value === 'string' ? value.substring(0, 50) : value,
            })
          }
        }
      }
    }
  }

  /**
   * Get block by ID with O(1) cache lookup
   */
  private getBlock(blockId: string): SerializedBlock | undefined {
    return this.blockLookupCache.get(blockId)
  }

  /**
   * Get starter block with cached access
   */
  private getStarterBlock(): SerializedBlock | null {
    return this.starterBlockCache
  }

  /**
   * Executes the workflow and returns the result.
   *
   * @param workflowId - Unique identifier for the workflow execution
   * @returns Execution result containing output, logs, and metadata, or a stream, or combined execution and stream
   */
  async execute(workflowId: string): Promise<ExecutionResult | StreamingExecution> {
    return withSpan('executor.workflow.execute', async () => this.executeInternal(workflowId), {
      workflowId,
    })
  }

  private async executeInternal(workflowId: string): Promise<ExecutionResult | StreamingExecution> {
    const {
      setIsExecuting,
      setIsDebugging,
      setPendingBlocks,
      setExecutionTiming,
      setExecutionStatus,
      setCompletedBlocks,
      setErrorBlocks,
      reset,
    } = useExecutionStore.getState()

    const startTime = new Date()
    let finalOutput: NormalizedBlockOutput = { response: {} }

    // Initialize execution state
    setExecutionTiming(startTime.toISOString(), null, null)
    setExecutionStatus(null, null)
    setCompletedBlocks(new Set())
    setErrorBlocks(new Set())

    this.validateWorkflow()

    // Check for active A/B experiments and select variant BEFORE execution
    // This ensures consistent variant assignment and config application
    if (!this.contextExtensions.skipExperimentSelection) {
      try {
        // Use pre-selected experiment/variant if provided
        if (this.contextExtensions.experimentId && this.contextExtensions.variantId) {
          logger.info('Using pre-selected experiment variant', {
            experimentId: this.contextExtensions.experimentId,
            variantId: this.contextExtensions.variantId,
          })
        } else {
          // Auto-detect active experiment for this workflow
          const experiment = await getActiveExperiment(workflowId)
          if (experiment) {
            this.activeExperiment = experiment
            this.selectedVariant = selectVariant(experiment)

            if (this.selectedVariant) {
              logger.info('A/B Experiment: Selected variant for execution', {
                experimentId: experiment.id,
                experimentName: experiment.name,
                variantId: this.selectedVariant.id,
                variantName: this.selectedVariant.name,
                hasBlockOverrides: (this.selectedVariant.blockOverrides?.length || 0) > 0,
              })

              // Apply variant block overrides to the workflow
              if (this.workflowState && this.selectedVariant.blockOverrides?.length) {
                const modifiedState = applyVariantToWorkflow(
                  this.workflowState,
                  this.selectedVariant
                )

                // Re-serialize the modified workflow state
                // Note: We need to update the block configs in actualWorkflow
                this.applyVariantOverridesToBlocks(this.selectedVariant)

                logger.info('A/B Experiment: Applied variant block overrides', {
                  variantId: this.selectedVariant.id,
                  overridesCount: this.selectedVariant.blockOverrides.length,
                })
              }
            }
          }
        }
      } catch (experimentError) {
        // Don't fail execution if experiment selection fails
        logger.warn('Failed to select experiment variant, continuing without experiment', {
          error:
            experimentError instanceof Error ? experimentError.message : String(experimentError),
        })
      }
    }

    const context = this.createExecutionContext(workflowId, startTime)

    try {
      setIsExecuting(true)

      if (this.isDebugging) {
        setIsDebugging(true)
      }

      let hasMoreLayers = true
      let iteration = 0
      const maxIterations = 100 // Safety limit for infinite loops

      while (hasMoreLayers && iteration < maxIterations) {
        const nextLayer = this.getNextExecutionLayer(context)

        if (this.isDebugging) {
          // In debug mode, update the pending blocks and wait for user interaction
          setPendingBlocks(nextLayer)

          // If there are no more blocks, we're done
          if (nextLayer.length === 0) {
            hasMoreLayers = false
          } else {
            // Return early to wait for manual stepping
            // The caller (useWorkflowExecution) will handle resumption
            return {
              success: true,
              output: finalOutput,
              metadata: {
                duration: Date.now() - startTime.getTime(),
                startTime: context.metadata.startTime!,
                pendingBlocks: nextLayer,
                isDebugSession: true,
                context: context, // Include context for resumption
                workflowConnections: this.actualWorkflow.connections.map((conn: any) => ({
                  source: conn.source,
                  target: conn.target,
                })),
              },
              logs: context.blockLogs,
            }
          }
        } else {
          // Normal execution without debug mode
          if (nextLayer.length === 0) {
            hasMoreLayers = false
          } else {
            const outputs = await this.executeLayer(nextLayer, context)

            // Check if we got a StreamingExecution response from any block
            const streamingOutput = outputs.find(isStreamingExecution)

            if (streamingOutput) {
              // This is a combined response with both stream and execution data
              logger.info('Found combined stream+execution response from block')

              const workflowConnections = this.actualWorkflow.connections.map((conn: any) => ({
                source: conn.source,
                target: conn.target,
              }))

              return processStreamingOutput(
                streamingOutput as unknown as StreamingExecution,
                context,
                startTime,
                workflowConnections
              )
            }

            if (outputs.length > 0) {
              // Filter out StreamingExecution objects (already handled above)
              const normalizedOutputs = outputs.filter((output) => !isStreamingExecution(output))
              if (normalizedOutputs.length > 0) {
                finalOutput = normalizedOutputs[
                  normalizedOutputs.length - 1
                ] as NormalizedBlockOutput
              }
            }

            // Process loop iterations - this will activate external paths when loops complete
            await this.loopManager.processLoopIterations(context)

            // Continue execution for any newly activated paths
            // Only stop execution if there are no more blocks to execute
            const updatedNextLayer = this.getNextExecutionLayer(context)
            if (updatedNextLayer.length === 0) {
              hasMoreLayers = false
            }
          }
        }

        iteration++
      }

      const endTime = new Date()
      context.metadata.endTime = endTime.toISOString()
      const duration = endTime.getTime() - startTime.getTime()

      // Update execution state with success
      useExecutionStore
        .getState()
        .setExecutionTiming(startTime.toISOString(), endTime.toISOString(), duration)
      useExecutionStore.getState().setExecutionStatus(true, null)

      // Update completed blocks
      useExecutionStore.getState().setCompletedBlocks(context.executedBlocks)

      // Send workflow completion notification (non-blocking)
      sendCompletionNotification({
        workflowId: context.workflowId,
        executionId: context.executionId,
        executionTime: duration,
        result: finalOutput,
      })

      return {
        success: true,
        output: finalOutput,
        metadata: {
          duration: duration,
          startTime: context.metadata.startTime!,
          endTime: context.metadata.endTime!,
          workflowConnections: this.actualWorkflow.connections.map((conn: any) => ({
            source: conn.source,
            target: conn.target,
          })),
          // A/B Experiment tracking
          experimentId: this.activeExperiment?.id,
          variantId: this.selectedVariant?.id,
          variantName: this.selectedVariant?.name,
        },
        logs: context.blockLogs,
      }
    } catch (error: any) {
      // Handle HITL Pause - workflow is waiting for human approval
      if (error instanceof HITLPauseError) {
        logger.info('Workflow paused for HITL approval', {
          workflowId: context.workflowId,
          requestId: error.requestId,
          blockId: error.blockId,
        })

        const endTime = new Date()
        const duration = endTime.getTime() - startTime.getTime()

        // Don't reset execution state - we want to show it's paused
        useExecutionStore
          .getState()
          .setExecutionTiming(startTime.toISOString(), endTime.toISOString(), duration)

        // Save execution state for resume
        try {
          const executionId = context.executionId || context.workflowId
          await savePausedExecutionState(
            error.requestId,
            context.workflowId,
            executionId,
            context,
            context.apiBaseUrl
          )
          logger.info('Execution state saved for HITL resume', {
            hitlRequestId: error.requestId,
            workflowId: context.workflowId,
            executionId,
          })
        } catch (saveError) {
          logger.error('Failed to save execution state for HITL resume', {
            hitlRequestId: error.requestId,
            error: saveError instanceof Error ? saveError.message : String(saveError),
          })
          // Continue even if save fails - the workflow is still paused
        }

        // Return a paused result - success is true because this is expected behavior
        return {
          success: true,
          output: {
            response: {
              hitlStatus: 'paused',
              message: 'Workflow paused for human approval',
              requestId: error.requestId,
              blockId: error.blockId,
              _hitlPause: true,
            },
          },
          metadata: {
            duration,
            startTime: context.metadata.startTime!,
            endTime: endTime.toISOString(),
            hitlPaused: true,
            hitlRequestId: error.requestId,
            hitlBlockId: error.blockId,
            workflowConnections: this.actualWorkflow.connections.map((conn: any) => ({
              source: conn.source,
              target: conn.target,
            })),
          },
          logs: context.blockLogs,
        }
      }

      logger.error('Workflow execution failed:', sanitizeError(error))

      const endTime = new Date()
      const duration = endTime.getTime() - startTime.getTime()
      const errorMessage = extractErrorMessage(error)

      // Update execution state with error
      useExecutionStore
        .getState()
        .setExecutionTiming(startTime.toISOString(), endTime.toISOString(), duration)
      useExecutionStore.getState().setExecutionStatus(false, errorMessage)

      // Update completed and error blocks
      useExecutionStore.getState().setCompletedBlocks(context.executedBlocks)

      // If we have error information in the context, use it to set error blocks
      const errorBlocks = new Set<string>()
      context.blockLogs.forEach((log) => {
        if (!log.success && log.blockId) {
          errorBlocks.add(log.blockId)
        }
      })
      useExecutionStore.getState().setErrorBlocks(errorBlocks)

      // Find failed block ID from error blocks
      const failedBlockId = Array.from(errorBlocks)[0] || undefined

      // Send workflow failure notification (non-blocking)
      sendFailureNotification({
        workflowId: context.workflowId,
        executionId: context.executionId,
        error: errorMessage,
        executionTime: duration,
        failedBlockId,
      })

      return {
        success: false,
        output: finalOutput,
        error: errorMessage,
        logs: context.blockLogs,
      }
    } finally {
      if (!this.isDebugging) {
        reset()
      }
    }
  }

  /**
   * Continues execution in debug mode from the current state.
   *
   * @param blockIds - Block IDs to execute in this step
   * @param context - The current execution context
   * @returns Updated execution result
   */
  async continueExecution(blockIds: string[], context: ExecutionContext): Promise<ExecutionResult> {
    const { setPendingBlocks } = useExecutionStore.getState()
    let finalOutput: NormalizedBlockOutput = { response: {} }

    try {
      // Execute the current layer - using the original context, not a clone
      const outputs = await this.executeLayer(blockIds, context)

      if (outputs.length > 0) {
        finalOutput = outputs[outputs.length - 1]
      }
      await this.loopManager.processLoopIterations(context)
      const nextLayer = this.getNextExecutionLayer(context)
      setPendingBlocks(nextLayer)

      // Check if we've completed execution
      const isComplete = nextLayer.length === 0

      if (isComplete) {
        const endTime = new Date()
        context.metadata.endTime = endTime.toISOString()
        const duration = endTime.getTime() - new Date(context.metadata.startTime!).getTime()

        // Send workflow completion notification (non-blocking)
        sendCompletionNotification({
          workflowId: context.workflowId,
          executionId: context.executionId,
          executionTime: duration,
          result: finalOutput,
          debugMode: true,
        })

        return {
          success: true,
          output: finalOutput,
          metadata: {
            duration,
            startTime: context.metadata.startTime!,
            endTime: context.metadata.endTime!,
            pendingBlocks: [],
            isDebugSession: false,
            workflowConnections: this.actualWorkflow.connections.map((conn) => ({
              source: conn.source,
              target: conn.target,
            })),
          },
          logs: context.blockLogs,
        }
      }

      // Return the updated state for the next step
      return {
        success: true,
        output: finalOutput,
        metadata: {
          duration: Date.now() - new Date(context.metadata.startTime!).getTime(),
          startTime: context.metadata.startTime!,
          pendingBlocks: nextLayer,
          isDebugSession: true,
          context: context, // Return the same context object for continuity
        },
        logs: context.blockLogs,
      }
    } catch (error: any) {
      logger.error('Debug step execution failed:', sanitizeError(error))

      const errorMessage = extractErrorMessage(error)

      // Send workflow failure notification (non-blocking)
      const duration = Date.now() - new Date(context.metadata.startTime!).getTime()
      sendFailureNotification({
        workflowId: context.workflowId,
        executionId: context.executionId,
        error: errorMessage,
        executionTime: duration,
        debugMode: true,
      })

      return {
        success: false,
        output: finalOutput,
        error: errorMessage,
        logs: context.blockLogs,
      }
    }
  }

  /**
   * Validates that the workflow meets requirements for execution.
   * Checks for starter block, connections, and loop configurations.
   *
   * @throws Error if workflow validation fails
   */
  private validateWorkflow(): void {
    // Use cached starter block for O(1) access
    const starterBlock = this.getStarterBlock()
    if (!starterBlock || !starterBlock.enabled) {
      throw new Error('Workflow must have an enabled starter block')
    }

    const incomingToStarter = this.actualWorkflow.connections.filter(
      (conn) => conn.target === starterBlock.id
    )
    if (incomingToStarter.length > 0) {
      throw new Error('Starter block cannot have incoming connections')
    }

    const outgoingFromStarter = this.actualWorkflow.connections.filter(
      (conn) => conn.source === starterBlock.id
    )
    if (outgoingFromStarter.length === 0) {
      throw new Error('Starter block must have at least one outgoing connection')
    }

    const blockIds = new Set(this.actualWorkflow.blocks.map((block) => block.id))
    for (const conn of this.actualWorkflow.connections) {
      if (!blockIds.has(conn.source)) {
        throw new Error(`Connection references non-existent source block: ${conn.source}`)
      }
      if (!blockIds.has(conn.target)) {
        throw new Error(`Connection references non-existent target block: ${conn.target}`)
      }
    }

    for (const [loopId, loop] of Object.entries(this.actualWorkflow.loops || {})) {
      for (const nodeId of loop.nodes) {
        if (!blockIds.has(nodeId)) {
          throw new Error(`Loop ${loopId} references non-existent block: ${nodeId}`)
        }
      }

      if (loop.iterations <= 0) {
        throw new Error(`Loop ${loopId} must have a positive iterations value`)
      }
    }
  }

  /**
   * Creates the initial execution context with predefined states.
   * Sets up the starter block and its connections in the active execution path.
   *
   * @param workflowId - Unique identifier for the workflow execution
   * @param startTime - Execution start time
   * @returns Initialized execution context
   */
  private createExecutionContext(workflowId: string, startTime: Date): ExecutionContext {
    // Generate a unique executionId for each execution
    // This is critical for HITL to distinguish between different runs of the same workflow
    const executionId = this.contextExtensions.executionId || uuidv4()

    const context: ExecutionContext = {
      workflowId,
      executionId, // Unique ID for this specific execution
      blockStates: new Map(),
      blockLogs: [],
      metadata: {
        startTime: startTime.toISOString(),
        duration: 0, // Initialize with zero, will be updated throughout execution
      },
      environmentVariables: this.environmentVariables,
      decisions: {
        router: new Map(),
        condition: new Map(),
      },
      loopIterations: new Map(),
      loopItems: new Map(),
      completedLoops: new Set(),
      // Use executedBlocks from contextExtensions if provided (for HITL resume)
      executedBlocks: this.contextExtensions.executedBlocks
        ? new Set(this.contextExtensions.executedBlocks)
        : new Set(),
      // Use activeExecutionPath from contextExtensions if provided (for HITL resume)
      activeExecutionPath: this.contextExtensions.activeExecutionPath
        ? new Set(this.contextExtensions.activeExecutionPath)
        : new Set(),
      workflow: this.actualWorkflow,
      // Add streaming context from contextExtensions
      stream: this.contextExtensions.stream || false,
      selectedOutputIds: this.contextExtensions.selectedOutputIds || [],
      edges: this.contextExtensions.edges || [],
      userId: this.contextExtensions.userId,
      sessionId: this.contextExtensions.sessionId,
      sessionToken: this.contextExtensions.sessionToken,
      // Add memory configuration from contextExtensions (for deployment mode)
      memoryEnabled: this.contextExtensions.memoryEnabled,
      sessionMetadata: this.contextExtensions.sessionMetadata,
      // Add API configuration from contextExtensions (for deployment subdomains)
      apiBaseUrl: this.contextExtensions.apiBaseUrl,
    } as ExecutionContext

    Object.entries(this.initialBlockStates).forEach(([blockId, output]) => {
      context.blockStates.set(blockId, {
        output: output as NormalizedBlockOutput,
        executed: true,
        executionTime: 0,
      })
    })

    // Initialize loop iterations
    if (this.actualWorkflow.loops) {
      for (const loopId of Object.keys(this.actualWorkflow.loops)) {
        // Start all loops at iteration 0
        context.loopIterations.set(loopId, 0)
      }
    }

    // Use cached starter block for O(1) access
    const starterBlock = this.getStarterBlock()
    if (starterBlock) {
      // Initialize the starter block with the workflow input
      try {
        const blockParams = starterBlock.config.params
        /* Commenting out input format handling
        const inputFormat = blockParams?.inputFormat

        // If input format is defined, structure the input according to the schema
        if (inputFormat && Array.isArray(inputFormat) && inputFormat.length > 0) {
          // Create structured input based on input format
          const structuredInput: Record<string, any> = {}

          // Process each field in the input format
          for (const field of inputFormat) {
            if (field.name && field.type) {
              // Get the field value from workflow input if available
              // First try to access via input.field, then directly from field
              // This handles both input formats: { input: { field: value } } and { field: value }
              const inputValue = this.workflowInput?.input?.[field.name] !== undefined
                ? this.workflowInput.input[field.name]  // Try to get from input.field
                : this.workflowInput?.[field.name]     // Fallback to direct field access

              logger.info(`[Executor] Processing input field ${field.name} (${field.type}):`,
                inputValue !== undefined ? JSON.stringify(inputValue) : 'undefined')

              // Convert the value to the appropriate type
              let typedValue = inputValue
              if (inputValue !== undefined) {
                if (field.type === 'number' && typeof inputValue !== 'number') {
                  typedValue = Number(inputValue)
                } else if (field.type === 'boolean' && typeof inputValue !== 'boolean') {
                  typedValue = inputValue === 'true' || inputValue === true
                } else if (
                  (field.type === 'object' || field.type === 'array') &&
                  typeof inputValue === 'string'
                ) {
                  try {
                    typedValue = JSON.parse(inputValue)
                  } catch (e) {
                    logger.warn(`Failed to parse ${field.type} input for field ${field.name}:`, e)
                  }
                }
              }

              // Add the field to structured input
              structuredInput[field.name] = typedValue
            }
          }

          // Check if we managed to process any fields - if not, use the raw input
          const hasProcessedFields = Object.keys(structuredInput).length > 0

          // If no fields matched the input format, extract the raw input to use instead
          const rawInputData = this.workflowInput?.input !== undefined
            ? this.workflowInput.input  // Use the nested input data
            : this.workflowInput       // Fallback to direct input

          // Use the structured input if we processed fields, otherwise use raw input
          const finalInput = hasProcessedFields ? structuredInput : rawInputData

          // Initialize the starter block with structured input
          // Ensure both input and direct fields are available
          const starterOutput = {
            response: {
              input: finalInput,
              ...finalInput, // Add input fields directly at response level too
            },
          }

          logger.info(`[Executor] Starter output:`, JSON.stringify(starterOutput, null, 2))

          context.blockStates.set(starterBlock.id, {
            output: starterOutput,
            executed: true,
            executionTime: 0,
          })
        } else {
        */
        // No input format defined or not an array,
        // Handle API call - prioritize using the input as-is
        if (this.workflowInput && typeof this.workflowInput === 'object') {
          // For API calls, extract input from the nested structure if it exists
          const inputData =
            this.workflowInput.input !== undefined
              ? this.workflowInput.input // Use the nested input data
              : this.workflowInput // Fallback to direct input

          // Create starter output with both formats for maximum compatibility
          // Only spread inputData if it's a non-null object (not a string/number/etc.)
          const starterOutput = {
            response: {
              input: inputData,
              ...(typeof inputData === 'object' && inputData !== null ? inputData : {}),
            },
          }

          context.blockStates.set(starterBlock.id, {
            output: starterOutput,
            executed: true,
            executionTime: 0,
          })
        } else {
          // Fallback for other cases
          const starterOutput = {
            response: {
              input: this.workflowInput,
            },
          }

          context.blockStates.set(starterBlock.id, {
            output: starterOutput,
            executed: true,
            executionTime: 0,
          })
        }
        //} // End of inputFormat conditional
      } catch (e) {
        logger.warn('Error processing starter block input format:', e)

        // Fallback to raw input with both paths accessible
        // Ensure we handle both input formats
        const inputData =
          this.workflowInput?.input !== undefined
            ? this.workflowInput.input // Use nested input if available
            : this.workflowInput // Fallback to direct input

        const starterOutput = {
          response: {
            input: inputData,
            ...(typeof inputData === 'object' && inputData !== null ? inputData : {}),
          },
        }

        logger.info(`[Executor] Fallback starter output:`, JSON.stringify(starterOutput, null, 2))

        context.blockStates.set(starterBlock.id, {
          output: starterOutput,
          executed: true,
          executionTime: 0,
        })
      }
      // Ensure the starter block is in the active execution path
      context.activeExecutionPath.add(starterBlock.id)
      // Mark the starter block as executed
      context.executedBlocks.add(starterBlock.id)

      // Add all blocks connected to the starter to the active execution path
      const connectedToStarter = this.actualWorkflow.connections
        .filter((conn) => conn.source === starterBlock.id)
        .map((conn) => conn.target)

      connectedToStarter.forEach((blockId) => {
        context.activeExecutionPath.add(blockId)
        // Also add utility blocks connected to this block via utility-target handle.
        // Utility edges flow: utility_block (utility-source) → host_block (utility-target).
        // When the host block enters the active path, its utility dependencies must too.
        this.actualWorkflow.connections
          .filter((c) => c.target === blockId && c.targetHandle === 'utility-target')
          .forEach((c) => context.activeExecutionPath.add(c.source))
      })
    }

    return context
  }

  /**
   * Determines the next layer of blocks to execute based on dependencies and execution path.
   * Handles special cases for blocks in loops, condition blocks, and router blocks.
   *
   * @param context - Current execution context
   * @returns Array of block IDs that are ready to be executed
   */
  private getNextExecutionLayer(context: ExecutionContext): string[] {
    const executedBlocks = context.executedBlocks
    const pendingBlocks = new Set<string>()

    for (const block of this.actualWorkflow.blocks) {
      if (executedBlocks.has(block.id) || block.enabled === false) {
        continue
      }

      // Only consider blocks in the active execution path
      if (!context.activeExecutionPath.has(block.id)) {
        continue
      }

      const incomingConnections = this.actualWorkflow.connections.filter(
        (conn) => conn.target === block.id
      )

      // Find all loops that this block is a part of
      const containingLoops = Object.values(this.actualWorkflow.loops || {}).filter((loop) =>
        loop.nodes.includes(block.id)
      )

      const isInLoop = containingLoops.length > 0

      if (isInLoop) {
        // Check if this block is part of a self-loop (single-node loop)
        const isInSelfLoop = containingLoops.some(
          (loop) => loop.nodes.length === 1 && loop.nodes[0] === block.id
        )

        // Check if there's a direct self-connection
        const hasSelfConnection = this.actualWorkflow.connections.some(
          (conn) => conn.source === block.id && conn.target === block.id
        )

        if (isInSelfLoop || hasSelfConnection) {
          // For self-loops, we only need the node to be in the active execution path
          // It will be reset after each iteration by the loop manager
          pendingBlocks.add(block.id)
          continue
        }

        // For regular multi-node loops
        const hasValidPath = incomingConnections.some((conn) => {
          return executedBlocks.has(conn.source)
        })

        if (hasValidPath) {
          pendingBlocks.add(block.id)
        }
      } else {
        // Regular non-loop block handling (unchanged)
        const allDependenciesMet = incomingConnections.every((conn) => {
          const sourceExecuted = executedBlocks.has(conn.source)
          // Use cached block lookup for O(1) access
          const sourceBlock = this.getBlock(conn.source)
          const sourceBlockState = context.blockStates.get(conn.source)
          const hasSourceError =
            sourceBlockState?.output?.error !== undefined ||
            sourceBlockState?.output?.response?.error !== undefined

          // For condition blocks, check if this is the selected path
          if (conn.sourceHandle?.startsWith('condition-')) {
            // Reuse already fetched sourceBlock
            if (sourceBlock?.metadata?.id === 'condition') {
              const conditionId = conn.sourceHandle.replace('condition-', '')
              const selectedCondition = context.decisions.condition.get(conn.source)

              // If source is executed and this is not the selected path, consider it met
              if (sourceExecuted && selectedCondition && conditionId !== selectedCondition) {
                return true
              }

              // Otherwise, this dependency is met only if source is executed and this is the selected path
              return sourceExecuted && conditionId === selectedCondition
            }
          }

          // For router blocks, check if this is the selected target
          if (sourceBlock?.metadata?.id === 'router') {
            const selectedTarget = context.decisions.router.get(conn.source)

            // If source is executed and this is not the selected target, consider it met
            if (sourceExecuted && selectedTarget && conn.target !== selectedTarget) {
              return true
            }

            // Otherwise, this dependency is met only if source is executed and this is the selected target
            return sourceExecuted && conn.target === selectedTarget
          }

          // For error connections, check if the source had an error
          if (conn.sourceHandle === 'error') {
            return sourceExecuted && hasSourceError
          }

          // For regular connections and utility connections, require source executed without error.
          // utility-source is the outgoing handle of utility blocks (data_table, variable, etc.)
          if (
            conn.sourceHandle === 'source' ||
            !conn.sourceHandle ||
            conn.sourceHandle === 'utility-source'
          ) {
            return sourceExecuted && !hasSourceError
          }

          // If source is not in active path, consider this dependency met
          // This allows blocks with multiple inputs to execute even if some inputs are from inactive paths
          if (!context.activeExecutionPath.has(conn.source)) {
            return true
          }

          // For regular blocks, dependency is met if source is executed
          return sourceExecuted
        })

        if (allDependenciesMet) {
          pendingBlocks.add(block.id)
        }
      }
    }

    return Array.from(pendingBlocks)
  }

  /**
   * Executes a layer of blocks in parallel.
   * Updates execution paths based on router and condition decisions.
   *
   * @param blockIds - IDs of blocks to execute
   * @param context - Current execution context
   * @returns Array of block outputs
   */
  private async executeLayer(
    blockIds: string[],
    context: ExecutionContext
  ): Promise<NormalizedBlockOutput[]> {
    const { setActiveBlocks } = useExecutionStore.getState()

    try {
      // Set all blocks in this layer as active
      useExecutionStore.setState({ activeBlockIds: new Set(blockIds) })

      const results = await Promise.all(
        blockIds.map((blockId) => this.executeBlock(blockId, context))
      )

      blockIds.forEach((blockId) => {
        context.executedBlocks.add(blockId)
      })

      await withSpan(
        'executor.path.resolve',
        async () => this.pathTracker.updateExecutionPaths(blockIds, context),
        { workflowId: context.workflowId, blockCount: blockIds.length }
      )

      return results
    } catch (error) {
      // If there's an uncaught error, clear all active blocks as a safety measure
      useExecutionStore.setState({ activeBlockIds: new Set() })
      throw error
    }
  }

  /**
   * Executes a single block with error handling and logging.
   *
   * @param blockId - ID of the block to execute
   * @param context - Current execution context
   * @returns Normalized block output
   * @throws Error if block execution fails
   */
  private async executeBlock(
    blockId: string,
    context: ExecutionContext
  ): Promise<NormalizedBlockOutput> {
    // Use cached block lookup for O(1) access
    const block = this.getBlock(blockId)
    if (!block) {
      throw new Error(`Block ${blockId} not found in cache`)
    }

    // Special case for starter block - it's already been initialized in createExecutionContext
    // This ensures we don't re-execute the starter block and just return its existing state
    if (block.metadata?.id === 'starter') {
      const starterState = context.blockStates.get(blockId)
      if (starterState) {
        return starterState.output as NormalizedBlockOutput
      }
    }

    const blockLog = createBlockLog(block)
    const addConsole = useConsoleStore.getState().addConsole
    const { setActiveBlocks } = useExecutionStore.getState()

    try {
      // Early validation for disabled blocks
      if (block.enabled === false) {
        throw new Error(`Cannot execute disabled block: ${block.metadata?.name || block.id}`)
      }

      // Use cached starter block lookup
      const starterBlock = this.getStarterBlock()
      if (starterBlock) {
        const starterState = context.blockStates.get(starterBlock.id)
        if (!starterState) {
          logger.warn(
            `Starter block state not found when executing ${block.metadata?.name || blockId}. This may cause reference errors.`
          )
        }
      }

      // Validate that all dependencies are satisfied before resolving inputs
      this.validateBlockDependencies(block, context)

      // Resolve inputs (which will look up references to other blocks including starter)
      const inputs = this.resolver.resolveInputs(block, context)

      // Resolve agent profile: inject profile persona for agent blocks
      if (inputs.agentProfileId && block.metadata?.category === 'agents') {
        try {
          const { useAgentProfilesStore } = await import('@/stores/agent-profiles/store')
          let profile = useAgentProfilesStore.getState().profiles[inputs.agentProfileId]

          if (!profile) {
            // Fallback: fetch from API
            const res = await fetch(`/api/agent-profiles/${inputs.agentProfileId}`)
            if (res.ok) profile = await res.json()
          }

          if (profile) {
            const profilePrompt = buildPersonaSystemPrompt({
              type: profile.type,
              name: profile.name,
              systemPrompt: profile.systemPrompt,
              personality: profile.personality,
              role: profile.role,
              goal: profile.goal,
              communicationStyle: profile.communicationStyle,
              skills: Array.isArray(profile.skills) ? profile.skills : [],
              constraints: Array.isArray(profile.constraints) ? profile.constraints : [],
            })
            if (profilePrompt) inputs.systemPrompt = profilePrompt
          }
        } catch (err) {
          logger.warn('Failed to resolve agent profile in executor', { blockId, error: err })
        }
      }

      // Validate resolved inputs before execution
      const validation = validateBlockInputs(block, inputs)
      if (!validation.valid) {
        const errorMsg = formatValidationErrors(validation)
        throw new Error(
          `Input validation failed for block "${block.metadata?.name || block.id}": ${errorMsg}`
        )
      }
      if (validation.warnings.length > 0) {
        for (const warning of validation.warnings) {
          logger.warn(
            `Validation warning for "${block.metadata?.name || block.id}": [${warning.field}] ${warning.message}`
          )
        }
      }

      // Check for breakpoints before execution (if debugging)
      if (this.isDebugging) {
        try {
          const breakpointResult = await checkBreakpoint(
            context.workflowId,
            context.userId || '',
            blockId,
            context
          )
          if (breakpointResult.shouldPause) {
            logger.info('Breakpoint hit', {
              blockId,
              breakpointId: breakpointResult.breakpoint?.id,
              logOutput: breakpointResult.logOutput,
            })
            // In debug mode, breakpoints are informational - we log but continue
            // Full pause/resume functionality is handled by the debug session
          }
        } catch (breakpointError) {
          logger.warn('Failed to check breakpoint', { blockId, error: breakpointError })
        }
      }

      // Find the appropriate handler
      const handler = this.blockHandlers.find((h) => h.canHandle(block))
      if (!handler) {
        throw new Error(`No handler found for block type: ${block.metadata?.id}`)
      }

      // Execute the block
      const startTime = performance.now()
      const rawOutput = await withSpan(
        `executor.block.${block.metadata?.id || 'unknown'}`,
        async () => handler.execute(block, inputs, context),
        {
          blockId,
          blockType: block.metadata?.id || 'unknown',
          workflowId: context.workflowId,
        }
      )
      const executionTime = performance.now() - startTime

      // Get execution store state
      const executionStore = useExecutionStore.getState()

      // Remove this block from active blocks immediately after execution
      // This ensures the pulse effect stops as soon as the block completes
      logger.debug(
        `[Executor] Block ${blockId} completed, removing from active and adding to completed`
      )
      executionStore.setActiveBlocks(
        new Set(Array.from(executionStore.activeBlockIds).filter((id) => id !== blockId))
      )

      // Add to completed blocks
      executionStore.setCompletedBlocks(
        new Set([...Array.from(executionStore.completedBlockIds), blockId])
      )

      // Debug: Check store state after completion
      logger.debug(`[Executor] Store state after block ${blockId} completion:`, {
        activeBlockIds: Array.from(executionStore.activeBlockIds),
        completedBlockIds: Array.from(executionStore.completedBlockIds),
        errorBlockIds: Array.from(executionStore.errorBlockIds),
      })

      // Update block metrics
      executionStore.setBlockMetrics(blockId, {
        startTime: blockLog.startedAt,
        endTime: new Date().toISOString(),
        duration: executionTime,
        success: true,
      })

      // Update connections
      this.updateConnectionsForBlock(blockId, context, true)

      // Normalize the output
      const output = normalizeBlockOutput(rawOutput, block)

      // Update the context with the execution result
      context.blockStates.set(blockId, {
        output,
        executed: true,
        executionTime,
      })

      // Capture debug snapshot if debugging is enabled
      if (this.isDebugging) {
        try {
          await captureSnapshot(
            context,
            blockId,
            block.metadata?.name,
            block.metadata?.id,
            inputs,
            output,
            Math.round(executionTime)
          )
        } catch (snapshotError) {
          logger.warn('Failed to capture debug snapshot', { blockId, error: snapshotError })
        }
      }

      // Update the execution log
      blockLog.success = true
      blockLog.output = output
      blockLog.durationMs = Math.round(executionTime)
      blockLog.endedAt = new Date().toISOString()

      context.blockLogs.push(blockLog)
      addConsole({
        output: blockLog.output,
        durationMs: blockLog.durationMs,
        startedAt: blockLog.startedAt,
        endedAt: blockLog.endedAt,
        workflowId: context.workflowId,
        blockId: block.id,
        blockName: block.metadata?.name || 'Unnamed Block',
        blockType: block.metadata?.id || 'unknown',
      })

      return output
    } catch (error: any) {
      // Handle HITL Pause - this is not an error, it's a signal to pause the workflow
      if (error instanceof HITLPauseError) {
        logger.info('Workflow paused for HITL approval', {
          blockId,
          requestId: error.requestId,
        })

        // Create a pause output with HITL info
        const pauseOutput: NormalizedBlockOutput = {
          response: {
            hitlStatus: 'pending',
            requestId: error.requestId,
            message: 'Waiting for human approval',
            _hitlPause: true,
          },
        }

        // Update block state to indicate it's waiting
        context.blockStates.set(blockId, {
          output: pauseOutput,
          executed: false, // Mark as not executed so it can be resumed
          executionTime: 0,
        })

        // Log the pause
        blockLog.success = true // Not an error
        blockLog.output = pauseOutput
        blockLog.endedAt = new Date().toISOString()
        blockLog.durationMs =
          new Date(blockLog.endedAt).getTime() - new Date(blockLog.startedAt).getTime()
        context.blockLogs.push(blockLog)

        const addConsole = useConsoleStore.getState().addConsole
        addConsole({
          output: pauseOutput,
          durationMs: blockLog.durationMs,
          startedAt: blockLog.startedAt,
          endedAt: blockLog.endedAt,
          workflowId: context.workflowId,
          blockId: block.id,
          blockName: block.metadata?.name || 'Approval Block',
          blockType: 'approval',
        })

        // Re-throw to stop execution - the caller should handle this
        throw error
      }

      // Get execution store state
      const executionStore = useExecutionStore.getState()

      // Remove this block from active blocks if there's an error
      logger.debug(`[Executor] Block ${blockId} failed, removing from active and adding to error`)
      executionStore.setActiveBlocks(
        new Set(Array.from(executionStore.activeBlockIds).filter((id) => id !== blockId))
      )

      // Add to error blocks
      executionStore.setErrorBlocks(new Set([...Array.from(executionStore.errorBlockIds), blockId]))

      // Capture error snapshot if debugging is enabled
      if (this.isDebugging) {
        try {
          await captureSnapshot(
            context,
            blockId,
            block.metadata?.name,
            block.metadata?.id,
            undefined,
            undefined,
            undefined,
            error.message || String(error)
          )
        } catch (snapshotError) {
          logger.warn('Failed to capture error snapshot', { blockId, error: snapshotError })
        }
      }

      // Debug: Check store state after error
      logger.debug(`[Executor] Store state after block ${blockId} error:`, {
        activeBlockIds: Array.from(executionStore.activeBlockIds),
        completedBlockIds: Array.from(executionStore.completedBlockIds),
        errorBlockIds: Array.from(executionStore.errorBlockIds),
      })

      // Get last successful data and transition info
      const lastBlockState = context.blockStates.get(blockId)
      const lastOutput = lastBlockState?.output

      // Find incoming connections to determine last transition
      const incomingEdges = context.edges?.filter((edge: any) => edge.target === blockId) || []
      const lastTransition =
        incomingEdges.length > 0
          ? {
              from: incomingEdges[incomingEdges.length - 1]?.source,
              to: blockId,
              handle: incomingEdges[incomingEdges.length - 1]?.targetHandle ?? undefined,
            }
          : undefined

      // Try to get last input - may not be available if error occurred during input resolution
      let lastInput: any = undefined
      try {
        lastInput = this.resolver.resolveInputs(block, context)
      } catch {
        // If we can't resolve inputs, that's okay - the error might be in input resolution itself
        lastInput = undefined
      }

      // Update block metrics with detailed error information
      executionStore.setBlockMetrics(blockId, {
        startTime: blockLog.startedAt,
        endTime: new Date().toISOString(),
        duration: new Date(blockLog.endedAt).getTime() - new Date(blockLog.startedAt).getTime(),
        success: false,
        error: {
          message: error.message || `Error executing ${block.metadata?.id || 'unknown'} block`,
          code: error.code,
          type: error.type,
          stack: error.stack,
          blockId: blockId,
          blockName: block.metadata?.name || 'Unnamed Block',
          blockType: block.metadata?.id || 'unknown',
          lastData: lastOutput,
          lastTransition: lastTransition,
          context: {
            workflowId: context.workflowId,
            timestamp: new Date().toISOString(),
            blockConfig: block.config,
          },
        },
        lastOutput: lastOutput,
        lastInput: lastInput,
      })

      // Update connections for error
      this.updateConnectionsForBlock(blockId, context, false)

      blockLog.success = false
      blockLog.error =
        error.message ||
        `Error executing ${block.metadata?.id || 'unknown'} block: ${String(error)}`
      blockLog.endedAt = new Date().toISOString()
      blockLog.durationMs =
        new Date(blockLog.endedAt).getTime() - new Date(blockLog.startedAt).getTime()

      // Log the error even if we'll continue execution through error path
      context.blockLogs.push(blockLog)
      addConsole({
        output: {},
        error:
          error.message ||
          `Error executing ${block.metadata?.id || 'unknown'} block: ${String(error)}`,
        durationMs: blockLog.durationMs,
        startedAt: blockLog.startedAt,
        endedAt: blockLog.endedAt,
        workflowId: context.workflowId,
        blockName: block.metadata?.name || 'Unnamed Block',
        blockType: block.metadata?.id || 'unknown',
      })

      // Check for error connections and follow them if they exist
      const hasErrorPath = this.activateErrorPath(blockId, context)

      // Log the error for visibility
      logger.error(
        `Error executing block ${block.metadata?.name || blockId}:`,
        sanitizeError(error)
      )

      // Create error output with appropriate structure
      const errorOutput: NormalizedBlockOutput = {
        response: {
          error: extractErrorMessage(error),
          status: error.status || 500,
        },
        error: extractErrorMessage(error),
      }

      // Set block state with error output
      context.blockStates.set(blockId, {
        output: errorOutput,
        executed: true,
        executionTime: blockLog.durationMs,
      })

      // If there are error paths to follow, return error output instead of throwing
      if (hasErrorPath) {
        // Return the error output to allow execution to continue along error path
        return errorOutput
      }

      // Create a proper error message that is never undefined
      let errorMessage = error.message

      // Handle the specific "undefined (undefined)" case
      if (!errorMessage || errorMessage === 'undefined (undefined)') {
        errorMessage = `Error executing ${block.metadata?.id || 'unknown'} block: ${block.metadata?.name || 'Unnamed Block'}`

        // Try to get more details if possible
        if (error && typeof error === 'object') {
          if (error.code) errorMessage += ` (code: ${error.code})`
          if (error.status) errorMessage += ` (status: ${error.status})`
          if (error.type) errorMessage += ` (type: ${error.type})`
        }
      }

      throw new Error(errorMessage)
    }
  }

  /**
   * Validates that all block dependencies are satisfied before execution.
   * Checks for block references in the input parameters.
   */
  private validateBlockDependencies(block: SerializedBlock, context: ExecutionContext): void {
    const params = block.config.params || {}

    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        const blockMatches = value.match(/<([^>]+)>/g)
        if (blockMatches) {
          for (const match of blockMatches) {
            const path = match.slice(1, -1)
            const pathParts = path.split('.')
            const sourceBlockId = pathParts[0]

            // Skip if it's not a block reference (contains special characters that indicate XML)
            if (
              sourceBlockId.includes(':') ||
              sourceBlockId.includes('=') ||
              sourceBlockId.includes(' ') ||
              sourceBlockId.includes('/')
            ) {
              continue
            }

            // Find the source block using cached lookup
            const sourceBlock = this.getBlock(sourceBlockId)
            if (!sourceBlock) {
              continue // Skip if block not found (might be a variable reference)
            }

            // Check if the dependency is satisfied
            const blockState = context.blockStates.get(sourceBlockId)
            if (!blockState) {
              throw new Error(
                `Block "${block.metadata?.name || block.id}" depends on block "${sourceBlock.metadata?.name || sourceBlockId}" which has not been executed yet. Please ensure blocks are executed in the correct order.`
              )
            }
          }
        }
      }
    }
  }

  /**
   * Updates connection states for a block in the execution store
   *
   * @param blockId - ID of the block to update connections for
   * @param context - Current execution context
   * @param success - Whether the block executed successfully
   */
  private updateConnectionsForBlock(
    blockId: string,
    context: ExecutionContext,
    success: boolean
  ): void {
    // Get outgoing connections from this block
    const outgoingConnections = this.actualWorkflow.connections.filter(
      (conn) => conn.source === blockId
    )

    // Get execution store
    const executionStore = useExecutionStore.getState()

    // Update each connection
    outgoingConnections.forEach((conn) => {
      // For error connections, only activate on error
      if (conn.sourceHandle === 'error') {
        if (!success) {
          executionStore.updateConnectionState(conn.source, conn.target, {
            source: conn.source,
            target: conn.target,
            sourceHandle: conn.sourceHandle,
            targetHandle: conn.targetHandle,
            active: true,
            completed: false,
            error: false,
          })
        }
      }
      // For regular connections, only activate on success
      else {
        if (success) {
          executionStore.updateConnectionState(conn.source, conn.target, {
            source: conn.source,
            target: conn.target,
            sourceHandle: conn.sourceHandle,
            targetHandle: conn.targetHandle,
            active: true,
            completed: false,
            error: false,
            data: {
              type: 'data',
              transferTime: 0,
            },
          })
        }
      }
    })
  }

  /**
   * Activates error paths from a block that had an error.
   * Checks for connections from the block's "error" handle and adds them to the active execution path.
   *
   * @param blockId - ID of the block that had an error
   * @param context - Current execution context
   * @returns Whether there was an error path to follow
   */
  private activateErrorPath(blockId: string, context: ExecutionContext): boolean {
    // Skip for starter blocks which don't have error handles
    // Use cached block lookup for O(1) access
    const block = this.getBlock(blockId)
    if (block?.metadata?.id === 'starter' || block?.metadata?.id === 'condition') {
      return false
    }

    // Look for connections from this block's error handle
    const errorConnections = this.actualWorkflow.connections.filter(
      (conn) => conn.source === blockId && conn.sourceHandle === 'error'
    )

    if (errorConnections.length === 0) {
      return false
    }

    // Add all error connection targets to the active execution path
    for (const conn of errorConnections) {
      context.activeExecutionPath.add(conn.target)
      logger.info(`Activated error path from ${blockId} to ${conn.target}`)
    }

    return true
  }
}
