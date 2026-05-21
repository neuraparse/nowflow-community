import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('ai-interactions')
// Simple AI interactions logging (console-based for now)

export interface AIInteraction {
  id: string
  userId: string
  workflowId?: string
  sessionId: string
  userInput: string
  aiResponse: string
  actions: any[]
  context: any
  timestamp: Date
  responseTime: number
  fallbackMode: boolean
  errorMessage?: string
}

export interface AIInteractionStats {
  totalInteractions: number
  avgResponseTime: number
  fallbackRate: number
  topIntents: { intent: string; count: number }[]
  topBlockTypes: { blockType: string; count: number }[]
}

// Simple in-memory storage for development
const interactions: AIInteraction[] = []

// Save AI interaction (console logging for now)
export async function saveAIInteraction(interaction: Omit<AIInteraction, 'id'>): Promise<string> {
  try {
    const id = `ai_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    const fullInteraction: AIInteraction = {
      id,
      ...interaction,
    }

    // Store in memory
    interactions.push(fullInteraction)

    // Log to console
    logger.debug('AI Interaction Saved:', {
      id,
      userId: interaction.userId,
      sessionId: interaction.sessionId,
      userInput: interaction.userInput.substring(0, 100) + '...',
      responseTime: interaction.responseTime,
      fallbackMode: interaction.fallbackMode,
      errorMessage: interaction.errorMessage,
    })

    return id
  } catch (error) {
    logger.error('Error saving AI interaction:', error)
    throw error
  }
}

// Get AI interactions for a user
export async function getAIInteractions(
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<AIInteraction[]> {
  try {
    const userInteractions = interactions
      .filter((interaction) => interaction.userId === userId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(offset, offset + limit)

    return userInteractions
  } catch (error) {
    logger.error('Error getting AI interactions:', error)
    throw error
  }
}

// Get AI interaction statistics
export async function getAIInteractionStats(): Promise<AIInteractionStats> {
  try {
    const totalInteractions = interactions.length
    const avgResponseTime =
      totalInteractions > 0
        ? interactions.reduce((sum, i) => sum + i.responseTime, 0) / totalInteractions
        : 0
    const fallbackRate =
      totalInteractions > 0
        ? (interactions.filter((i) => i.fallbackMode).length / totalInteractions) * 100
        : 0

    return {
      totalInteractions,
      avgResponseTime: Math.round(avgResponseTime),
      fallbackRate: Math.round(fallbackRate * 100) / 100,
      topIntents: [],
      topBlockTypes: [],
    }
  } catch (error) {
    logger.error('Error getting AI interaction stats:', error)
    throw error
  }
}

// Initialize AI interactions system
export async function initializeAIInteractions() {
  try {
    logger.debug('AI interactions system initialized (in-memory mode)')
  } catch (error) {
    logger.error('Error initializing AI interactions system:', error)
    throw error
  }
}

// Auto-initialize on import
initializeAIInteractions().catch(console.error)
