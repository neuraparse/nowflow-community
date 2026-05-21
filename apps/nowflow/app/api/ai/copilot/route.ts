import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  callAIProvider,
  callAIProviderStreaming,
  getResolvedAIConfig,
} from '@/lib/ai/provider-service'
import { AIRequestLimitError, enforceAIRequestAccess } from '@/lib/ai/request-guards'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { getAllBlocks } from '@/blocks'
import { SYSTEM_PROMPTS } from './prompts'
import {
  buildBlockCatalog,
  buildWorkflowTools,
  formatWorkflowState,
  generateFallbackResponse,
  TOOL_CAPABLE_PROVIDERS,
  validateActions,
} from './workflow-tools'

const logger = createLogger('CopilotAPI')

const CopilotRequestSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  context: z.string().optional(),
  history: z
    .array(
      z.object({
        role: z.string(),
        content: z.string(),
      })
    )
    .optional(),
  stream: z.boolean().optional(),
  workflowState: z
    .object({
      blocks: z.record(z.string(), z.any()).optional(),
      edges: z.array(z.any()).optional(),
      subBlockValues: z.record(z.string(), z.any()).optional(),
      validationErrors: z.record(z.string(), z.any()).optional(),
      validationWarnings: z.record(z.string(), z.any()).optional(),
    })
    .passthrough()
    .optional(),
})

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }

    const parsed = CopilotRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: parsed.error.issues },
        { status: 400 }
      )
    }

    await enforceAIRequestAccess(session.user.id)

    const { message, context, history, stream, workflowState } = parsed.data

    // Get AI config (user settings -> env vars -> null)
    const config = await getResolvedAIConfig()

    if (!config) {
      return NextResponse.json({
        response: generateFallbackResponse(message ?? '', context ?? 'general'),
      })
    }

    const systemPrompt = (context && SYSTEM_PROMPTS[context]) || SYSTEM_PROMPTS.general

    // Build message history
    const messages = (history || []).map((h: { role: string; content: string }) => ({
      role: h.role as 'user' | 'assistant',
      content: h.content,
    }))

    // Build enhanced system prompt for workflow editor
    let enhancedSystemPrompt = systemPrompt
    const isWorkflowEditor = workflowState && context === 'workflow-editor'

    if (isWorkflowEditor) {
      const blockCatalog = buildBlockCatalog()
      const workflowSummary = formatWorkflowState(workflowState)

      logger.debug('Workflow state received', {
        blockCount: Object.keys(workflowState.blocks || {}).length,
        edgeCount: (workflowState.edges || []).length,
        hasSubBlockValues: !!workflowState.subBlockValues,
        subBlockValueKeys: Object.keys(workflowState.subBlockValues || {}).length,
      })

      enhancedSystemPrompt = `${systemPrompt}

## Available Block Types (${getAllBlocks().filter((b) => !b.hideFromToolbar && b.type !== 'starter').length}+ blocks)
${blockCatalog}

## Current Workflow State
${workflowSummary}
`

      // Append validation errors section when present
      if (
        workflowState.validationErrors &&
        Object.keys(workflowState.validationErrors).length > 0
      ) {
        const validationSection = Object.entries(workflowState.validationErrors)
          .map(([blockId, errors]) => {
            const blockName =
              (workflowState.blocks?.[blockId] as any)?.name ||
              (workflowState.blocks?.[blockId] as any)?.metadata?.name ||
              blockId
            const errorList = (errors as { field: string; message: string; suggestion?: string }[])
              .map((e) => `  - ${e.field}: ${e.message}${e.suggestion ? ` → ${e.suggestion}` : ''}`)
              .join('\n')
            return `Block "${blockName}" (${blockId}):\n${errorList}`
          })
          .join('\n\n')

        enhancedSystemPrompt += `\n## ⚠️ Current Validation Errors\nThe following blocks have configuration errors that will prevent workflow execution:\n\n${validationSection}\n\nWhen the user asks for help or you detect these issues, proactively offer to fix them using updateSubBlock or other tools.`
      }

      // Append validation warnings section when present
      if (
        workflowState.validationWarnings &&
        Object.keys(workflowState.validationWarnings).length > 0
      ) {
        const warningSection = Object.entries(workflowState.validationWarnings)
          .map(([blockId, warnings]) => {
            const blockName =
              (workflowState.blocks?.[blockId] as any)?.name ||
              (workflowState.blocks?.[blockId] as any)?.metadata?.name ||
              blockId
            const warningList = (
              warnings as { field: string; message: string; suggestion?: string }[]
            )
              .map((w) => `  - ${w.field}: ${w.message}${w.suggestion ? ` → ${w.suggestion}` : ''}`)
              .join('\n')
            return `Block "${blockName}" (${blockId}):\n${warningList}`
          })
          .join('\n\n')

        enhancedSystemPrompt += `\n## ⚡ Current Validation Warnings\nThese blocks have non-blocking configuration warnings. The workflow can still execute, but these may affect output quality:\n\n${warningSection}\n\nProactively suggest improvements when the user asks about these blocks.`
      }
    }

    messages.push({ role: 'user', content: message })

    // Determine if we should use function calling
    const useTools = isWorkflowEditor && TOOL_CAPABLE_PROVIDERS.has(config.provider)

    // Streaming mode (only when not using tools - tool calls need full response)
    if (stream && !useTools) {
      try {
        const aiStream = await callAIProviderStreaming({
          provider: config.provider,
          model: config.model,
          apiKey: config.apiKey,
          messages,
          systemPrompt: enhancedSystemPrompt,
          temperature: config.temperature,
          maxTokens: config.maxTokens,
          ollamaHost: config.ollamaHost,
        })

        return new Response(aiStream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        })
      } catch (error) {
        logger.error('Streaming error, falling back to non-streaming', { error })
        // Fall through to non-streaming
      }
    }

    // Non-streaming mode (or fallback)
    const workflowTools = useTools ? buildWorkflowTools() : undefined
    const effectiveMaxTokens = useTools ? Math.max(config.maxTokens, 8192) : config.maxTokens

    const result = await callAIProvider({
      provider: config.provider,
      model: config.model,
      apiKey: config.apiKey,
      messages,
      systemPrompt: enhancedSystemPrompt,
      temperature: config.temperature,
      maxTokens: effectiveMaxTokens,
      ollamaHost: config.ollamaHost,
      tools: workflowTools,
      toolChoice: useTools ? 'auto' : undefined,
    })

    // Validate actions before returning
    const validatedActions = validateActions(result.actions, workflowState)

    const response: any = { response: result.content }
    if (validatedActions && validatedActions.length > 0) {
      response.actions = validatedActions
    }

    return NextResponse.json(response)
  } catch (error) {
    if (error instanceof AIRequestLimitError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }

    logger.error('Copilot error:', error)
    return NextResponse.json({ error: 'Failed to process copilot request' }, { status: 500 })
  }
}
