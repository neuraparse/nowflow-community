import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { OLLAMA_DEFAULT_HOST } from '@/lib/config/api-endpoints'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { settings } from '@/db/schema'

const logger = createLogger('AISettingsAPI')

interface AIModelSettings {
  selectedProvider: string
  selectedModel: string
  apiKeys: {
    openai: string
    anthropic: string
    groq: string
    together: string
  }
  ollamaHost: string
  preferences: {
    temperature: number
    maxTokens: number
    timeout: number
  }
}

// In-memory storage for development (fallback)
const userSettings = new Map<string, AIModelSettings>()

// Load AI settings from database
async function loadAISettingsFromDB(userId: string): Promise<AIModelSettings | null> {
  try {
    if (userId === 'anonymous') {
      // For anonymous users, use in-memory storage
      return userSettings.get(userId) || null
    }

    const userSettingsRecord = await db
      .select()
      .from(settings)
      .where(eq(settings.userId, userId))
      .limit(1)

    if (userSettingsRecord.length > 0) {
      const general = userSettingsRecord[0].general as any
      if (general?.aiSettings) {
        logger.debug(`Loaded AI settings from database for user ${userId}`)
        return general.aiSettings
      }
    }

    return null
  } catch (error) {
    logger.error('Failed to load AI settings from database:', error)
    return null
  }
}

// Save AI settings to database
async function saveAISettingsToDB(userId: string, aiSettings: AIModelSettings): Promise<boolean> {
  try {
    if (userId === 'anonymous') {
      // For anonymous users, use in-memory storage
      // Merge with existing API keys - preserve keys that aren't being updated
      const existingSettings = userSettings.get(userId)
      if (existingSettings) {
        const mergedSettings = {
          ...aiSettings,
          apiKeys: {
            openai: aiSettings.apiKeys.openai || existingSettings.apiKeys.openai || '',
            anthropic: aiSettings.apiKeys.anthropic || existingSettings.apiKeys.anthropic || '',
            groq: aiSettings.apiKeys.groq || existingSettings.apiKeys.groq || '',
            together: aiSettings.apiKeys.together || existingSettings.apiKeys.together || '',
          },
        }
        userSettings.set(userId, mergedSettings)
        logger.debug(`Updated anonymous user settings (preserving existing API keys)`)
      } else {
        userSettings.set(userId, aiSettings)
        logger.debug(`Created new anonymous user settings`)
      }
      return true
    }

    // Get existing settings or create new record
    const existingSettings = await db
      .select()
      .from(settings)
      .where(eq(settings.userId, userId))
      .limit(1)

    const general = existingSettings.length > 0 ? (existingSettings[0].general as any) || {} : {}
    const existingAISettings = general.aiSettings || {}

    // Merge API keys - preserve existing keys if new value is empty
    const mergedApiKeys = {
      openai: aiSettings.apiKeys.openai || existingAISettings.apiKeys?.openai || '',
      anthropic: aiSettings.apiKeys.anthropic || existingAISettings.apiKeys?.anthropic || '',
      groq: aiSettings.apiKeys.groq || existingAISettings.apiKeys?.groq || '',
      together: aiSettings.apiKeys.together || existingAISettings.apiKeys?.together || '',
    }

    general.aiSettings = {
      ...aiSettings,
      apiKeys: mergedApiKeys,
    }

    if (existingSettings.length > 0) {
      // Update existing record
      await db
        .update(settings)
        .set({
          general,
          updatedAt: new Date(),
        })
        .where(eq(settings.userId, userId))
    } else {
      // Create new record
      await db.insert(settings).values({
        id: userId,
        userId,
        general,
        updatedAt: new Date(),
      })
    }

    logger.debug(`Saved AI settings to database for user ${userId} (preserving existing API keys)`)
    return true
  } catch (error) {
    logger.error('Failed to save AI settings to database:', error)
    return false
  }
}

// Load general settings object from database
async function loadGeneralSettingsFromDB(userId: string): Promise<Record<string, any>> {
  try {
    if (userId === 'anonymous') return {}
    const records = await db.select().from(settings).where(eq(settings.userId, userId)).limit(1)
    if (records.length > 0) {
      return (records[0].general as any) || {}
    }
    return {}
  } catch (error) {
    logger.error('Failed to load general settings:', error)
    return {}
  }
}

// Save a specific key to general settings
async function saveGeneralDefaultsToDB(userId: string, key: string, value: any): Promise<boolean> {
  try {
    if (userId === 'anonymous') return false
    const existing = await db.select().from(settings).where(eq(settings.userId, userId)).limit(1)
    const general = existing.length > 0 ? (existing[0].general as any) || {} : {}
    general[key] = value
    if (existing.length > 0) {
      await db
        .update(settings)
        .set({ general, updatedAt: new Date() })
        .where(eq(settings.userId, userId))
    } else {
      await db.insert(settings).values({
        id: userId,
        userId,
        general,
        updatedAt: new Date(),
      })
    }
    return true
  } catch (error) {
    logger.error(`Failed to save ${key} to database:`, error)
    return false
  }
}

// Get AI model settings for user
export async function GET(request: NextRequest) {
  try {
    let userId = 'anonymous'

    // Try to get authenticated user
    try {
      const session = await getSession()
      userId = session?.user?.id || 'anonymous'
    } catch (authError) {
      logger.debug('Auth not available, using anonymous user')
    }

    // Load general settings for knowledge defaults
    const generalSettings = await loadGeneralSettingsFromDB(userId)

    // Get user settings from database first, fallback to defaults
    let userAISettings = await loadAISettingsFromDB(userId)

    if (!userAISettings) {
      userAISettings = {
        selectedProvider: 'ollama',
        selectedModel: '',
        apiKeys: {
          openai: '',
          anthropic: '',
          groq: '',
          together: '',
        },
        ollamaHost: OLLAMA_DEFAULT_HOST,
        preferences: {
          temperature: 0.7,
          maxTokens: 1000,
          timeout: 30,
        },
      }
    }

    // Return settings with actual API keys (user is viewing their own settings)
    return NextResponse.json({
      status: 'success',
      settings: userAISettings,
      userId,
      managedOverride: false,
      knowledgeDefaults: generalSettings.knowledgeDefaults || null,
    })
  } catch (error) {
    logger.error('Error getting AI settings:', error)

    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// Save AI model settings for user
export async function POST(request: NextRequest) {
  try {
    let userId = 'anonymous'

    // Try to get authenticated user
    try {
      const session = await getSession()
      userId = session?.user?.id || 'anonymous'
    } catch (authError) {
      logger.debug('Auth not available, using anonymous user')
    }

    const body = await request.json()
    const { settings } = body

    if (!settings) {
      return NextResponse.json(
        {
          status: 'error',
          error: 'Settings are required',
        },
        { status: 400 }
      )
    }

    // Validate settings structure
    const requiredFields = [
      'selectedProvider',
      'selectedModel',
      'apiKeys',
      'ollamaHost',
      'preferences',
    ]
    for (const field of requiredFields) {
      if (!(field in settings)) {
        return NextResponse.json(
          {
            status: 'error',
            error: `Missing required field: ${field}`,
          },
          { status: 400 }
        )
      }
    }

    // Save settings to database
    const saveSuccess = await saveAISettingsToDB(userId, settings)

    if (!saveSuccess) {
      throw new Error('Failed to save settings to database')
    }

    logger.debug(`AI settings saved for user ${userId}:`, {
      provider: settings.selectedProvider,
      model: settings.selectedModel,
      hasOpenAIKey: !!settings.apiKeys.openai,
      hasAnthropicKey: !!settings.apiKeys.anthropic,
      hasGroqKey: !!settings.apiKeys.groq,
      hasTogetherKey: !!settings.apiKeys.together,
      ollamaHost: settings.ollamaHost,
    })

    return NextResponse.json({
      status: 'success',
      message: 'Settings saved successfully',
      userId,
    })
  } catch (error) {
    logger.error('Error saving AI settings:', error)

    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// Update specific setting
export async function PATCH(request: NextRequest) {
  try {
    let userId = 'anonymous'

    // Try to get authenticated user
    try {
      const session = await getSession()
      userId = session?.user?.id || 'anonymous'
    } catch (authError) {
      logger.debug('Auth not available, using anonymous user')
    }

    const body = await request.json()

    // Handle knowledgeDefaults
    if (body.knowledgeDefaults !== undefined) {
      try {
        await saveGeneralDefaultsToDB(userId, 'knowledgeDefaults', body.knowledgeDefaults)
        return NextResponse.json({
          status: 'success',
          message: 'Defaults updated successfully',
          userId,
        })
      } catch (error) {
        logger.error('Error saving defaults:', error)
        return NextResponse.json(
          { status: 'error', error: 'Failed to save defaults' },
          { status: 500 }
        )
      }
    }

    const { key, value } = body

    if (!key) {
      return NextResponse.json(
        {
          status: 'error',
          error: 'Setting key is required',
        },
        { status: 400 }
      )
    }

    // Get current settings from database
    let currentSettings = await loadAISettingsFromDB(userId)

    if (!currentSettings) {
      currentSettings = {
        selectedProvider: 'ollama',
        selectedModel: '',
        apiKeys: {
          openai: '',
          anthropic: '',
          groq: '',
          together: '',
        },
        ollamaHost: OLLAMA_DEFAULT_HOST,
        preferences: {
          temperature: 0.7,
          maxTokens: 1000,
          timeout: 30,
        },
      }
    }

    // Update specific setting
    if (key.includes('.')) {
      // Handle nested keys like 'apiKeys.openai' or 'preferences.temperature'
      const [parentKey, childKey] = key.split('.')
      if (
        parentKey in currentSettings &&
        typeof currentSettings[parentKey as keyof AIModelSettings] === 'object'
      ) {
        ;(currentSettings[parentKey as keyof AIModelSettings] as any)[childKey] = value
      }
    } else {
      // Handle top-level keys
      ;(currentSettings as any)[key] = value
    }

    // Save updated settings to database
    const saveSuccess = await saveAISettingsToDB(userId, currentSettings)

    if (!saveSuccess) {
      throw new Error('Failed to save updated settings to database')
    }

    logger.debug(
      `AI setting updated for user ${userId}: ${key} = ${typeof value === 'string' && key.includes('apiKey') ? '***' : value}`
    )

    return NextResponse.json({
      status: 'success',
      message: 'Setting updated successfully',
      userId,
    })
  } catch (error) {
    logger.error('Error updating AI setting:', error)

    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// Get current active model settings for AI workflow
export async function PUT(_request: NextRequest) {
  try {
    let userId = 'anonymous'

    // Try to get authenticated user
    try {
      const session = await getSession()
      userId = session?.user?.id || 'anonymous'
    } catch (authError) {
      logger.debug('Auth not available, using anonymous user')
    }

    // Get user settings from database
    const userAISettings = await loadAISettingsFromDB(userId)

    if (!userAISettings) {
      return NextResponse.json(
        {
          status: 'error',
          error: 'No settings found for user',
        },
        { status: 404 }
      )
    }

    // Return settings for AI workflow use (including API keys for internal use)
    return NextResponse.json({
      status: 'success',
      settings: userAISettings,
      userId,
    })
  } catch (error) {
    logger.error('Error getting AI settings for workflow:', error)

    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
