import { v4 as uuidv4 } from 'uuid'
import { createLogger } from '@/lib/logs/console-logger'
import { getRedisClient } from '@/lib/redis'
import type { VoiceCommand, VoiceEntity, VoiceIntent, VoiceResponse, VoiceSession } from './types'

const logger = createLogger('VoiceService')

const SESSION_TTL = 1800 // 30 minutes
const SESSION_PREFIX = 'voice:session:'

/**
 * Voice Service
 * Handles voice command processing, intent recognition, and response generation
 */
export class VoiceService {
  /**
   * Process a voice command (from transcribed text)
   */
  async processCommand(params: {
    text: string
    userId: string
    sessionId?: string
    language?: string
  }): Promise<VoiceResponse> {
    const { text, userId, language = 'en' } = params

    // Get or create session
    const session = params.sessionId
      ? await this.getSession(params.sessionId)
      : await this.createSession(userId)

    if (!session) {
      return { text: 'Voice session not found. Please try again.' }
    }

    // Parse intent and entities
    const intent = this.recognizeIntent(text, language)
    const entities = this.extractEntities(text)

    const command: VoiceCommand = {
      id: uuidv4(),
      text,
      intent,
      entities,
      confidence: 0.8, // Base confidence
      language,
      userId,
      timestamp: new Date(),
    }

    logger.info('Voice command processed', {
      commandId: command.id,
      intent: command.intent,
      entities: command.entities.length,
      userId,
    })

    // Generate response based on intent
    const response = await this.handleIntent(command, session)

    // Update session history
    session.commandHistory.push({
      command: text,
      response: response.text,
      timestamp: new Date(),
    })
    session.lastCommandAt = new Date()

    // Keep only last 20 commands
    if (session.commandHistory.length > 20) {
      session.commandHistory = session.commandHistory.slice(-20)
    }

    await this.saveSession(session)

    return response
  }

  /**
   * Recognize intent from text
   */
  private recognizeIntent(text: string, _language: string): VoiceIntent {
    const lower = text.toLowerCase().trim()

    // Run/execute workflow
    if (
      /(?:run|start|execute|trigger|launch|begin)\s+(?:the\s+)?(?:workflow|automation|flow)/i.test(
        lower
      )
    ) {
      return 'run_workflow'
    }

    // Check status
    if (/(?:what(?:'s| is) the )?(?:status|state|progress|how(?:'s| is))/i.test(lower)) {
      return 'check_status'
    }

    // List workflows
    if (
      /(?:list|show|display|what are|get)\s+(?:my\s+)?(?:workflows|automations|flows)/i.test(lower)
    ) {
      return 'list_workflows'
    }

    // Stop workflow
    if (
      /(?:stop|cancel|abort|halt|pause|kill)\s+(?:the\s+)?(?:workflow|automation|execution|flow)/i.test(
        lower
      )
    ) {
      return 'stop_workflow'
    }

    // Get results
    if (/(?:results?|output|what (?:did|happened)|show me)/i.test(lower)) {
      return 'get_results'
    }

    // Create workflow
    if (/(?:create|make|build|new)\s+(?:a\s+)?(?:workflow|automation|flow)/i.test(lower)) {
      return 'create_workflow'
    }

    // Help
    if (/(?:help|what can|how do|commands|options)/i.test(lower)) {
      return 'help'
    }

    return 'unknown'
  }

  /**
   * Extract entities from text
   */
  private extractEntities(text: string): VoiceEntity[] {
    const entities: VoiceEntity[] = []

    // Extract workflow name (quoted or after "called/named")
    const nameMatch = text.match(
      /(?:called|named|workflow)\s+["']?([^"'\s,]+(?:\s+[^"'\s,]+)*)["']?/i
    )
    if (nameMatch) {
      entities.push({
        type: 'workflow_name',
        value: nameMatch[1].trim(),
        confidence: 0.8,
      })
    }

    // Extract workflow ID (UUID-like pattern)
    const idMatch = text.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i)
    if (idMatch) {
      entities.push({
        type: 'workflow_id',
        value: idMatch[1],
        confidence: 0.95,
      })
    }

    // Extract status keywords
    const statusMatch = text.match(/(?:running|completed|failed|pending|active|idle)/i)
    if (statusMatch) {
      entities.push({
        type: 'status',
        value: statusMatch[0].toLowerCase(),
        confidence: 0.9,
      })
    }

    // Extract time range
    const timeMatch = text.match(
      /(?:today|yesterday|last\s+(?:hour|day|week|month)|this\s+(?:week|month))/i
    )
    if (timeMatch) {
      entities.push({
        type: 'time_range',
        value: timeMatch[0].toLowerCase(),
        confidence: 0.85,
      })
    }

    return entities
  }

  /**
   * Handle recognized intent and generate response
   */
  private async handleIntent(command: VoiceCommand, session: VoiceSession): Promise<VoiceResponse> {
    switch (command.intent) {
      case 'run_workflow': {
        const workflowName = command.entities.find((e) => e.type === 'workflow_name')?.value
        const workflowId = command.entities.find((e) => e.type === 'workflow_id')?.value

        if (!workflowName && !workflowId) {
          return {
            text: 'Which workflow would you like to run? Please tell me the name or ID.',
          }
        }

        return {
          text: `Starting workflow ${workflowName || workflowId}. I'll notify you when it completes.`,
          action: {
            type: 'execute_workflow',
            workflowId: workflowId,
            params: { name: workflowName },
          },
        }
      }

      case 'check_status': {
        return {
          text: 'Let me check the status of your workflows.',
          action: { type: 'show_status' },
        }
      }

      case 'list_workflows': {
        return {
          text: 'Here are your workflows.',
          action: { type: 'show_status' },
        }
      }

      case 'stop_workflow': {
        const workflowName = command.entities.find((e) => e.type === 'workflow_name')?.value
        return {
          text: workflowName
            ? `Stopping workflow ${workflowName}.`
            : 'Which workflow would you like to stop?',
        }
      }

      case 'get_results': {
        return {
          text: 'Let me get the latest results for you.',
          action: { type: 'show_status' },
        }
      }

      case 'create_workflow': {
        return {
          text: 'I can help you create a new workflow. Let me open the editor for you.',
          action: { type: 'navigate', params: { path: '/w/new' } },
        }
      }

      case 'help': {
        return {
          text: 'You can ask me to: run a workflow, check status, list your workflows, stop a running workflow, get results, or create a new workflow. Just say what you need!',
        }
      }

      default: {
        // Check session context for follow-up
        if (session.commandHistory.length > 0) {
          return {
            text: "I'm not sure what you mean. Could you rephrase that? You can say 'help' for available commands.",
          }
        }
        return {
          text: "Hello! I'm your NowFlow voice assistant. You can ask me to run workflows, check status, or manage your automations. Say 'help' for more options.",
        }
      }
    }
  }

  // --- Session management ---

  async createSession(userId: string): Promise<VoiceSession> {
    const session: VoiceSession = {
      id: uuidv4(),
      userId,
      status: 'idle',
      lastCommandAt: new Date(),
      commandHistory: [],
      context: {},
    }
    await this.saveSession(session)
    return session
  }

  async getSession(sessionId: string): Promise<VoiceSession | null> {
    const redis = getRedisClient()
    if (!redis) return null

    try {
      const data = await redis.get(`${SESSION_PREFIX}${sessionId}`)
      return data ? JSON.parse(data) : null
    } catch {
      return null
    }
  }

  private async saveSession(session: VoiceSession): Promise<void> {
    const redis = getRedisClient()
    if (!redis) return

    try {
      await redis.set(`${SESSION_PREFIX}${session.id}`, JSON.stringify(session), 'EX', SESSION_TTL)
    } catch (error) {
      logger.error('Failed to save voice session', { error })
    }
  }
}

// Singleton
let voiceServiceInstance: VoiceService | null = null

export function getVoiceService(): VoiceService {
  if (!voiceServiceInstance) {
    voiceServiceInstance = new VoiceService()
  }
  return voiceServiceInstance
}
