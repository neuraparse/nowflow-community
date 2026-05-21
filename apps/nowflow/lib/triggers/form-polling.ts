import { eq } from 'drizzle-orm'
import { createLogger } from '@/lib/logs/console-logger'
import { refreshAccessTokenIfNeeded } from '@/app/api/auth/oauth/utils'
import { db } from '@/db'
import { workflowTrigger } from '@/db/schema'

const logger = createLogger('FormPolling')

export interface FormTriggerConfig {
  provider: 'google_forms' | 'typeform' | 'jotform' | 'ms_forms' | 'custom'
  credentialId: string
  formId: string
}

export interface FormResponse {
  responseId: string
  submittedAt: string
  answers: Record<string, any>
  formId: string
  provider: string
}

/**
 * Execute form polling - check for new form responses
 */
export async function executeFormPolling(
  trigger: typeof workflowTrigger.$inferSelect,
  userId: string
): Promise<{ hasNewData: boolean; newData?: FormResponse[] }> {
  const config = trigger.config as FormTriggerConfig

  if (!config.credentialId || !config.formId) {
    logger.warn(`Form trigger ${trigger.id} missing credential or formId`)
    return { hasNewData: false }
  }

  switch (config.provider) {
    case 'google_forms':
      return pollGoogleForms(trigger, config, userId)
    default:
      logger.warn(`Form provider ${config.provider} not yet supported for polling`)
      return { hasNewData: false }
  }
}

/**
 * Poll Google Forms for new responses
 */
async function pollGoogleForms(
  trigger: typeof workflowTrigger.$inferSelect,
  config: FormTriggerConfig,
  userId: string
): Promise<{ hasNewData: boolean; newData?: FormResponse[] }> {
  const requestId = `form-${trigger.id.slice(0, 8)}`

  try {
    const accessToken = await refreshAccessTokenIfNeeded(config.credentialId, userId, requestId)
    if (!accessToken) {
      throw new Error('Failed to get access token for Google Forms')
    }

    // Build the URL with timestamp filter if we have a lastPolledAt
    let url = `https://forms.googleapis.com/v1/forms/${config.formId}/responses`
    if (trigger.lastPolledAt) {
      const timestamp = trigger.lastPolledAt.toISOString()
      url += `?filter=timestamp >= ${timestamp}`
    }

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Google Forms API error ${response.status}: ${errorText}`)
    }

    const data = await response.json()
    const responses: any[] = data.responses || []

    if (responses.length === 0) {
      await db
        .update(workflowTrigger)
        .set({ lastPolledAt: new Date() })
        .where(eq(workflowTrigger.id, trigger.id))
      return { hasNewData: false }
    }

    // Dedup using response IDs
    const lastSeenIdentifiers = (trigger.lastSeenIdentifiers as string[]) || []
    const newResponses = responses.filter((r) => !lastSeenIdentifiers.includes(r.responseId))

    if (newResponses.length === 0) {
      await db
        .update(workflowTrigger)
        .set({ lastPolledAt: new Date() })
        .where(eq(workflowTrigger.id, trigger.id))
      return { hasNewData: false }
    }

    // Update dedup state
    const newIds = newResponses.map((r) => r.responseId)
    const updatedIdentifiers = [...newIds, ...lastSeenIdentifiers].slice(0, 100)

    await db
      .update(workflowTrigger)
      .set({
        lastSeenIdentifiers: updatedIdentifiers,
        lastPolledAt: new Date(),
      })
      .where(eq(workflowTrigger.id, trigger.id))

    // Transform responses
    const formResponses: FormResponse[] = newResponses.map((r) => ({
      responseId: r.responseId,
      submittedAt: r.lastSubmittedTime || r.createTime || new Date().toISOString(),
      answers: transformGoogleFormAnswers(r.answers || {}),
      formId: config.formId,
      provider: 'google_forms',
    }))

    logger.info(`[${requestId}] Found ${formResponses.length} new form responses`)
    return { hasNewData: true, newData: formResponses }
  } catch (error: any) {
    logger.error(`[${requestId}] Google Forms polling error`, error)

    await db
      .update(workflowTrigger)
      .set({
        lastError: error.message,
        failedTriggers: (trigger.failedTriggers || 0) + 1,
        healthStatus: trigger.failedTriggers && trigger.failedTriggers > 3 ? 'error' : 'warning',
      })
      .where(eq(workflowTrigger.id, trigger.id))

    throw error
  }
}

/**
 * Transform Google Forms answer format to a simpler key-value structure
 */
function transformGoogleFormAnswers(answers: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {}

  for (const [questionId, answer] of Object.entries(answers)) {
    if (answer.textAnswers) {
      const values = answer.textAnswers.answers?.map((a: any) => a.value) || []
      result[questionId] = values.length === 1 ? values[0] : values
    } else if (answer.fileUploadAnswers) {
      result[questionId] =
        answer.fileUploadAnswers.answers?.map((a: any) => ({
          fileId: a.fileId,
          fileName: a.fileName,
          mimeType: a.mimeType,
        })) || []
    } else {
      result[questionId] = answer
    }
  }

  return result
}
