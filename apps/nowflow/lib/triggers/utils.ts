import { eq } from 'drizzle-orm'
import { createLogger } from '@/lib/logs/console-logger'
import {
  createOutlookSubscription,
  deleteOutlookSubscription,
} from '@/lib/triggers/outlook-subscription'
import { db } from '@/db'
import { workflow, workflowTrigger } from '@/db/schema'

const logger = createLogger('TriggerUtils')

/**
 * Update trigger statistics after execution
 */
export async function updateTriggerStats(
  triggerId: string,
  success: boolean,
  errorMessage?: string
) {
  try {
    const [trigger] = await db
      .select()
      .from(workflowTrigger)
      .where(eq(workflowTrigger.id, triggerId))
      .limit(1)

    if (!trigger) return

    const updateData: any = {
      lastTriggeredAt: new Date(),
      totalTriggers: (trigger.totalTriggers || 0) + 1,
      updatedAt: new Date(),
    }

    if (success) {
      updateData.successfulTriggers = (trigger.successfulTriggers || 0) + 1
      updateData.healthStatus = 'healthy'
      updateData.lastError = null
    } else {
      updateData.failedTriggers = (trigger.failedTriggers || 0) + 1
      updateData.lastError = errorMessage || 'Unknown error'
      updateData.healthStatus =
        trigger.failedTriggers && trigger.failedTriggers > 3 ? 'error' : 'warning'
    }

    await db.update(workflowTrigger).set(updateData).where(eq(workflowTrigger.id, triggerId))
  } catch (error) {
    logger.error(`Failed to update trigger stats for ${triggerId}`, error)
  }
}

/**
 * Check if data has been seen before (deduplication)
 */
export function hasSeenData(
  lastSeenIdentifiers: string[] | null,
  currentIdentifier: string
): boolean {
  if (!lastSeenIdentifiers || !Array.isArray(lastSeenIdentifiers)) {
    return false
  }
  return lastSeenIdentifiers.includes(currentIdentifier)
}

/**
 * Update last seen identifiers for deduplication
 */
export async function updateLastSeenIdentifiers(
  triggerId: string,
  newIdentifiers: string[],
  maxSize: number = 100
) {
  try {
    const [trigger] = await db
      .select()
      .from(workflowTrigger)
      .where(eq(workflowTrigger.id, triggerId))
      .limit(1)

    if (!trigger) return

    const lastSeenIdentifiers = (trigger.lastSeenIdentifiers as string[]) || []
    const updatedIdentifiers = [...newIdentifiers, ...lastSeenIdentifiers].slice(0, maxSize)

    await db
      .update(workflowTrigger)
      .set({
        lastSeenIdentifiers: updatedIdentifiers,
        updatedAt: new Date(),
      })
      .where(eq(workflowTrigger.id, triggerId))
  } catch (error) {
    logger.error(`Failed to update last seen identifiers for ${triggerId}`, error)
  }
}

/**
 * Extract unique identifier from data object
 */
export function extractIdentifier(data: any, identifierPath?: string): string {
  if (!identifierPath) {
    return data.id || JSON.stringify(data)
  }

  const parts = identifierPath.split('.')
  let current = data

  for (const part of parts) {
    current = current?.[part]
    if (current === undefined) {
      return JSON.stringify(data)
    }
  }

  return String(current)
}

/**
 * Calculate next polling time based on interval
 */
export function calculateNextPollTime(intervalMinutes: number): Date {
  return new Date(Date.now() + intervalMinutes * 60 * 1000)
}

/**
 * Sync trigger registration from workflow state.
 * Automatically creates/updates/deactivates triggers based on the starter block configuration.
 * Called from workflow sync and deploy routes so triggers work without requiring deployment.
 */
export async function syncTriggerFromWorkflowState(
  workflowId: string,
  workflowState: any
): Promise<void> {
  try {
    if (!workflowState?.blocks) return

    // Find the starter block
    const starterBlock = Object.values(workflowState.blocks).find(
      (block: any) => block.type === 'starter'
    ) as any

    if (!starterBlock) return

    const triggerType = starterBlock.subBlocks?.startWorkflow?.value
    const needsTriggerRecord = [
      'email',
      'polling',
      'form',
      'database',
      'file',
      'calendar',
    ].includes(triggerType)

    // Check existing trigger
    const [existingTrigger] = await db
      .select()
      .from(workflowTrigger)
      .where(eq(workflowTrigger.workflowId, workflowId))
      .limit(1)

    if (!needsTriggerRecord) {
      // Deactivate existing trigger if trigger type changed to manual/webhook/etc
      if (existingTrigger && existingTrigger.isActive) {
        // Clean up Microsoft Graph subscription if it exists
        const existingConfig = existingTrigger.config as any
        if (existingConfig?.outlookSubscription?.subscriptionId) {
          const [workflowRecord] = await db
            .select({ userId: workflow.userId })
            .from(workflow)
            .where(eq(workflow.id, workflowId))
            .limit(1)

          if (workflowRecord) {
            deleteOutlookSubscription(
              existingConfig.outlookSubscription.subscriptionId,
              existingConfig.credentialId,
              workflowRecord.userId
            ).catch((err) =>
              logger.error(
                `Failed to delete Outlook subscription for trigger ${existingTrigger.id}`,
                err
              )
            )
          }
        }

        await db
          .update(workflowTrigger)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(workflowTrigger.id, existingTrigger.id))
        logger.info(
          `Deactivated trigger for workflow ${workflowId} (type changed to ${triggerType})`
        )
      }
      return
    }

    // Get workflow userId for subscription management
    const [workflowRecord] = await db
      .select({ userId: workflow.userId })
      .from(workflow)
      .where(eq(workflow.id, workflowId))
      .limit(1)

    if (!workflowRecord) {
      logger.error(`Workflow ${workflowId} not found, cannot sync trigger`)
      return
    }

    // Helper: deactivate existing trigger when config is incomplete (credential missing, type changed, etc.)
    // This prevents stale triggers from continuing to fire after the user switches types or removes credentials.
    const deactivateIfIncomplete = async (reason: string) => {
      if (existingTrigger && existingTrigger.isActive) {
        await db
          .update(workflowTrigger)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(workflowTrigger.id, existingTrigger.id))
        logger.info(`Deactivated trigger for workflow ${workflowId} (${reason})`)
      }
    }

    if (triggerType === 'email') {
      const emailProvider = starterBlock.subBlocks?.emailProvider?.value || 'gmail'
      const emailCredential =
        emailProvider === 'outlook'
          ? starterBlock.subBlocks?.emailOutlookCredential?.value
          : starterBlock.subBlocks?.emailCredential?.value
      const emailFolder = starterBlock.subBlocks?.emailFolder?.value || 'INBOX'
      const emailFilter = starterBlock.subBlocks?.emailFilter?.value || ''
      const pollingInterval = parseInt(
        starterBlock.subBlocks?.emailPollingInterval?.value || '5',
        10
      )

      if (!emailCredential) {
        await deactivateIfIncomplete('email credential missing')
        logger.debug(`Email trigger for workflow ${workflowId} has no credential yet, skipping`)
        return
      }

      const emailConfig: any = {
        provider: emailProvider,
        credentialId: emailCredential,
        folder: emailFolder,
        filter: emailFilter,
      }

      if (existingTrigger) {
        // Check if credential or provider changed
        const oldConfig = existingTrigger.config as any
        const credentialChanged = oldConfig?.credentialId !== emailCredential
        const providerChanged = oldConfig?.provider !== emailProvider

        // Preserve existing outlookSubscription across autosaves
        // so we don't lose track of the active Graph subscription
        const preservedConfig = {
          ...emailConfig,
          ...(oldConfig?.outlookSubscription && !credentialChanged && !providerChanged
            ? { outlookSubscription: oldConfig.outlookSubscription }
            : {}),
        }

        const updateData: any = {
          triggerType: 'email',
          provider: emailProvider,
          config: preservedConfig,
          pollingInterval,
          nextPollAt: existingTrigger.isActive
            ? existingTrigger.nextPollAt
            : new Date(Date.now() + pollingInterval * 60 * 1000),
          isActive: true,
          updatedAt: new Date(),
        }

        if (credentialChanged || providerChanged) {
          // Different account/provider - reset dedup and poll time
          updateData.lastSeenIdentifiers = []
          updateData.lastPolledAt = null
          updateData.nextPollAt = new Date(Date.now() + 10 * 1000)
          logger.info(
            `Email credential/provider changed for workflow ${workflowId}, resetting polling state`
          )

          // Delete old Outlook subscription if exists
          if (oldConfig?.outlookSubscription?.subscriptionId) {
            deleteOutlookSubscription(
              oldConfig.outlookSubscription.subscriptionId,
              oldConfig.credentialId,
              workflowRecord.userId
            ).catch((err) => logger.error('Failed to delete old subscription', err))
          }
        }

        await db
          .update(workflowTrigger)
          .set(updateData)
          .where(eq(workflowTrigger.id, existingTrigger.id))

        const triggerId = existingTrigger.id
        logger.info(`Updated email trigger for workflow ${workflowId} (provider: ${emailProvider})`)

        // For Outlook: create webhook subscription ONLY if none exists yet or credential changed
        if (
          emailProvider === 'outlook' &&
          (credentialChanged || providerChanged || !oldConfig?.outlookSubscription)
        ) {
          createOutlookSubscription(triggerId, emailCredential, workflowRecord.userId, emailFolder)
            .then(async (sub) => {
              if (sub) {
                // Webhook mode active — read fresh config to avoid overwriting concurrent changes
                const [fresh] = await db
                  .select({ config: workflowTrigger.config })
                  .from(workflowTrigger)
                  .where(eq(workflowTrigger.id, triggerId))
                  .limit(1)
                const freshConfig = (fresh?.config as any) || emailConfig

                await db
                  .update(workflowTrigger)
                  .set({
                    config: { ...freshConfig, outlookSubscription: sub },
                    nextPollAt: null, // Disable polling, webhook handles it
                  })
                  .where(eq(workflowTrigger.id, triggerId))
                logger.info(`Outlook webhook subscription active for workflow ${workflowId}`)
              } else {
                logger.info(
                  `Outlook webhook subscription failed for ${workflowId}, using polling fallback`
                )
              }
            })
            .catch((err) => logger.error('Subscription creation error', err))
        }
      } else {
        const { v4: uuidv4 } = await import('uuid')
        const triggerId = uuidv4()

        await db.insert(workflowTrigger).values({
          id: triggerId,
          workflowId,
          triggerType: 'email',
          provider: emailProvider,
          config: emailConfig,
          pollingInterval,
          nextPollAt: new Date(Date.now() + pollingInterval * 60 * 1000),
          isActive: true,
        })
        logger.info(`Created email trigger for workflow ${workflowId} (provider: ${emailProvider})`)

        // For Outlook: try to create webhook subscription (non-blocking)
        if (emailProvider === 'outlook') {
          createOutlookSubscription(triggerId, emailCredential, workflowRecord.userId, emailFolder)
            .then(async (sub) => {
              if (sub) {
                // Read fresh config to avoid overwriting concurrent changes
                const [fresh] = await db
                  .select({ config: workflowTrigger.config })
                  .from(workflowTrigger)
                  .where(eq(workflowTrigger.id, triggerId))
                  .limit(1)
                const freshConfig = (fresh?.config as any) || emailConfig

                await db
                  .update(workflowTrigger)
                  .set({
                    config: { ...freshConfig, outlookSubscription: sub },
                    nextPollAt: null,
                  })
                  .where(eq(workflowTrigger.id, triggerId))
                logger.info(`Outlook webhook subscription active for workflow ${workflowId}`)
              } else {
                logger.info(
                  `Outlook webhook subscription failed for ${workflowId}, using polling fallback`
                )
              }
            })
            .catch((err) => logger.error('Subscription creation error', err))
        }
      }
    } else if (triggerType === 'polling') {
      const pollingUrl = starterBlock.subBlocks?.pollingUrl?.value
      const pollingMethod = starterBlock.subBlocks?.pollingMethod?.value || 'GET'
      const pollingInterval = parseInt(starterBlock.subBlocks?.pollingInterval?.value || '5', 10)

      if (!pollingUrl) {
        await deactivateIfIncomplete('polling URL missing')
        logger.debug(`Polling trigger for workflow ${workflowId} has no URL yet, skipping`)
        return
      }

      const pollingConfig = {
        url: pollingUrl,
        method: pollingMethod,
        identifierPath: starterBlock.subBlocks?.pollingIdentifierPath?.value || '',
      }

      if (existingTrigger) {
        const oldConfig = existingTrigger.config as any
        const urlChanged = oldConfig?.url !== pollingUrl

        const updateData: any = {
          triggerType: 'polling',
          provider: null,
          config: pollingConfig,
          pollingInterval,
          nextPollAt: existingTrigger.isActive
            ? existingTrigger.nextPollAt
            : new Date(Date.now() + pollingInterval * 60 * 1000),
          isActive: true,
          updatedAt: new Date(),
        }

        if (urlChanged || existingTrigger.triggerType !== 'polling') {
          updateData.lastSeenIdentifiers = []
          updateData.lastPolledAt = null
          updateData.nextPollAt = new Date(Date.now() + 10 * 1000)
          logger.info(
            `Polling URL/type changed for workflow ${workflowId}, resetting polling state`
          )
        }

        await db
          .update(workflowTrigger)
          .set(updateData)
          .where(eq(workflowTrigger.id, existingTrigger.id))
        logger.info(`Updated polling trigger for workflow ${workflowId}`)
      } else {
        const { v4: uuidv4 } = await import('uuid')
        await db.insert(workflowTrigger).values({
          id: uuidv4(),
          workflowId,
          triggerType: 'polling',
          provider: null,
          config: pollingConfig,
          pollingInterval,
          nextPollAt: new Date(Date.now() + pollingInterval * 60 * 1000),
          isActive: true,
        })
        logger.info(`Created polling trigger for workflow ${workflowId}`)
      }
    } else if (triggerType === 'form') {
      const formProvider = starterBlock.subBlocks?.formProvider?.value || 'google_forms'
      const formCredential = starterBlock.subBlocks?.formCredential?.value
      const formId = starterBlock.subBlocks?.formId?.value
      const pollingInterval = parseInt(
        starterBlock.subBlocks?.formPollingInterval?.value || '5',
        10
      )

      if (!formCredential) {
        await deactivateIfIncomplete('form credential missing')
        logger.debug(`Form trigger for workflow ${workflowId} has no credential yet, skipping`)
        return
      }

      const formConfig = {
        provider: formProvider,
        credentialId: formCredential,
        formId: formId || '',
      }

      if (existingTrigger) {
        const oldConfig = existingTrigger.config as any
        const credentialChanged = oldConfig?.credentialId !== formCredential
        const configChanged = oldConfig?.formId !== formId || oldConfig?.provider !== formProvider

        const updateData: any = {
          triggerType: 'form',
          provider: formProvider,
          config: formConfig,
          pollingInterval,
          nextPollAt: existingTrigger.isActive
            ? existingTrigger.nextPollAt
            : new Date(Date.now() + pollingInterval * 60 * 1000),
          isActive: true,
          updatedAt: new Date(),
        }

        if (credentialChanged || configChanged || existingTrigger.triggerType !== 'form') {
          updateData.lastSeenIdentifiers = []
          updateData.lastPolledAt = null
          updateData.nextPollAt = new Date(Date.now() + 10 * 1000)
        }

        await db
          .update(workflowTrigger)
          .set(updateData)
          .where(eq(workflowTrigger.id, existingTrigger.id))
        logger.info(`Updated form trigger for workflow ${workflowId} (provider: ${formProvider})`)
      } else {
        const { v4: uuidv4 } = await import('uuid')
        await db.insert(workflowTrigger).values({
          id: uuidv4(),
          workflowId,
          triggerType: 'form',
          provider: formProvider,
          config: formConfig,
          pollingInterval,
          nextPollAt: new Date(Date.now() + pollingInterval * 60 * 1000),
          isActive: true,
        })
        logger.info(`Created form trigger for workflow ${workflowId} (provider: ${formProvider})`)
      }
    } else if (triggerType === 'database') {
      const dbProvider = starterBlock.subBlocks?.databaseProvider?.value || 'google_sheets'
      // Get the credential from the correct provider-specific field
      let dbCredential: string | undefined
      if (dbProvider === 'airtable') {
        dbCredential = starterBlock.subBlocks?.databaseAirtableCredential?.value
      } else if (dbProvider === 'notion') {
        dbCredential = starterBlock.subBlocks?.databaseNotionCredential?.value
      } else {
        dbCredential = starterBlock.subBlocks?.databaseCredential?.value
      }
      const dbResource = starterBlock.subBlocks?.databaseResource?.value
      const dbTriggerOn = starterBlock.subBlocks?.databaseTriggerType?.value || 'insert'
      const pollingInterval = parseInt(
        starterBlock.subBlocks?.databasePollingInterval?.value || '5',
        10
      )

      if (!dbCredential) {
        await deactivateIfIncomplete('database credential missing')
        logger.debug(`Database trigger for workflow ${workflowId} has no credential yet, skipping`)
        return
      }

      const dbConfig = {
        provider: dbProvider,
        credentialId: dbCredential,
        resourceId: dbResource || '',
        triggerOn: dbTriggerOn,
      }

      if (existingTrigger) {
        const oldConfig = existingTrigger.config as any
        const credentialChanged = oldConfig?.credentialId !== dbCredential
        const configChanged =
          oldConfig?.resourceId !== dbResource || oldConfig?.provider !== dbProvider

        const updateData: any = {
          triggerType: 'database',
          provider: dbProvider,
          config: dbConfig,
          pollingInterval,
          nextPollAt: existingTrigger.isActive
            ? existingTrigger.nextPollAt
            : new Date(Date.now() + pollingInterval * 60 * 1000),
          isActive: true,
          updatedAt: new Date(),
        }

        if (credentialChanged || configChanged || existingTrigger.triggerType !== 'database') {
          updateData.lastSeenIdentifiers = []
          updateData.lastPolledAt = null
          updateData.nextPollAt = new Date(Date.now() + 10 * 1000)
        }

        await db
          .update(workflowTrigger)
          .set(updateData)
          .where(eq(workflowTrigger.id, existingTrigger.id))
        logger.info(`Updated database trigger for workflow ${workflowId} (provider: ${dbProvider})`)
      } else {
        const { v4: uuidv4 } = await import('uuid')
        await db.insert(workflowTrigger).values({
          id: uuidv4(),
          workflowId,
          triggerType: 'database',
          provider: dbProvider,
          config: dbConfig,
          pollingInterval,
          nextPollAt: new Date(Date.now() + pollingInterval * 60 * 1000),
          isActive: true,
        })
        logger.info(`Created database trigger for workflow ${workflowId} (provider: ${dbProvider})`)
      }
    } else if (triggerType === 'file') {
      const fileProvider = starterBlock.subBlocks?.fileProvider?.value || 'google_drive'
      // Get the credential from the correct provider-specific field
      let fileCredential: string | undefined
      if (fileProvider === 'onedrive') {
        fileCredential = starterBlock.subBlocks?.fileOneDriveCredential?.value
      } else {
        fileCredential = starterBlock.subBlocks?.fileCredential?.value
      }
      const filePath = starterBlock.subBlocks?.filePath?.value
      const fileTriggerOn = starterBlock.subBlocks?.fileTriggerType?.value || 'created'
      const fileFilter = starterBlock.subBlocks?.fileFilter?.value || ''
      const pollingInterval = parseInt(
        starterBlock.subBlocks?.filePollingInterval?.value || '5',
        10
      )

      if (!fileCredential) {
        await deactivateIfIncomplete('file credential missing')
        logger.debug(`File trigger for workflow ${workflowId} has no credential yet, skipping`)
        return
      }

      const fileConfig = {
        provider: fileProvider,
        credentialId: fileCredential,
        folderPath: filePath || '',
        triggerOn: fileTriggerOn,
        fileFilter,
      }

      if (existingTrigger) {
        const oldConfig = existingTrigger.config as any
        const credentialChanged = oldConfig?.credentialId !== fileCredential
        const configChanged =
          oldConfig?.folderPath !== filePath || oldConfig?.provider !== fileProvider

        const updateData: any = {
          triggerType: 'file',
          provider: fileProvider,
          config: fileConfig,
          pollingInterval,
          nextPollAt: existingTrigger.isActive
            ? existingTrigger.nextPollAt
            : new Date(Date.now() + pollingInterval * 60 * 1000),
          isActive: true,
          updatedAt: new Date(),
        }

        if (credentialChanged || configChanged || existingTrigger.triggerType !== 'file') {
          updateData.lastSeenIdentifiers = []
          updateData.lastPolledAt = null
          updateData.nextPollAt = new Date(Date.now() + 10 * 1000)
        }

        await db
          .update(workflowTrigger)
          .set(updateData)
          .where(eq(workflowTrigger.id, existingTrigger.id))
        logger.info(`Updated file trigger for workflow ${workflowId} (provider: ${fileProvider})`)
      } else {
        const { v4: uuidv4 } = await import('uuid')
        await db.insert(workflowTrigger).values({
          id: uuidv4(),
          workflowId,
          triggerType: 'file',
          provider: fileProvider,
          config: fileConfig,
          pollingInterval,
          nextPollAt: new Date(Date.now() + pollingInterval * 60 * 1000),
          isActive: true,
        })
        logger.info(`Created file trigger for workflow ${workflowId} (provider: ${fileProvider})`)
      }
    } else if (triggerType === 'calendar') {
      const calProvider = starterBlock.subBlocks?.calendarProvider?.value || 'google_calendar'
      // Get the credential from the correct provider-specific field
      let calCredential: string | undefined
      if (calProvider === 'outlook_calendar') {
        calCredential = starterBlock.subBlocks?.calendarOutlookCredential?.value
      } else {
        calCredential = starterBlock.subBlocks?.calendarCredential?.value
      }
      const calendarId = starterBlock.subBlocks?.calendarId?.value
      const calTriggerOn = starterBlock.subBlocks?.calendarTriggerType?.value || 'created'
      const minutesBefore = starterBlock.subBlocks?.calendarMinutesBefore?.value
      const pollingInterval = parseInt(
        starterBlock.subBlocks?.calendarPollingInterval?.value || '5',
        10
      )

      if (!calCredential) {
        await deactivateIfIncomplete('calendar credential missing')
        logger.debug(`Calendar trigger for workflow ${workflowId} has no credential yet, skipping`)
        return
      }

      const calConfig = {
        provider: calProvider,
        credentialId: calCredential,
        calendarId: calendarId || 'primary',
        triggerOn: calTriggerOn,
        minutesBefore: minutesBefore ? parseInt(minutesBefore, 10) : undefined,
      }

      if (existingTrigger) {
        const oldConfig = existingTrigger.config as any
        const credentialChanged = oldConfig?.credentialId !== calCredential
        const configChanged =
          oldConfig?.calendarId !== calendarId || oldConfig?.provider !== calProvider

        const updateData: any = {
          triggerType: 'calendar',
          provider: calProvider,
          config: calConfig,
          pollingInterval,
          nextPollAt: existingTrigger.isActive
            ? existingTrigger.nextPollAt
            : new Date(Date.now() + pollingInterval * 60 * 1000),
          isActive: true,
          updatedAt: new Date(),
        }

        if (credentialChanged || configChanged || existingTrigger.triggerType !== 'calendar') {
          updateData.lastSeenIdentifiers = []
          updateData.lastPolledAt = null
          updateData.nextPollAt = new Date(Date.now() + 10 * 1000)
        }

        await db
          .update(workflowTrigger)
          .set(updateData)
          .where(eq(workflowTrigger.id, existingTrigger.id))
        logger.info(
          `Updated calendar trigger for workflow ${workflowId} (provider: ${calProvider})`
        )
      } else {
        const { v4: uuidv4 } = await import('uuid')
        await db.insert(workflowTrigger).values({
          id: uuidv4(),
          workflowId,
          triggerType: 'calendar',
          provider: calProvider,
          config: calConfig,
          pollingInterval,
          nextPollAt: new Date(Date.now() + pollingInterval * 60 * 1000),
          isActive: true,
        })
        logger.info(
          `Created calendar trigger for workflow ${workflowId} (provider: ${calProvider})`
        )
      }
    }
  } catch (error) {
    logger.error(`Failed to sync trigger for workflow ${workflowId}`, error)
  }
}
