import { eq } from 'drizzle-orm'
import { createLogger } from '@/lib/logs/console-logger'
import { persistExecutionError } from '@/lib/logs/execution-logger'
import { getOAuthToken } from '@/app/api/auth/oauth/utils'
import { db } from '@/db'
import { webhook } from '@/db/schema'
import { executeWorkflowFromPayload } from './workflow-execution'

const logger = createLogger('AirtableProcessing')

// Define an interface for AirtableChange
export interface AirtableChange {
  tableId: string
  recordId: string
  changeType: 'created' | 'updated'
  changedFields: Record<string, any> // { fieldId: newValue }
  previousFields?: Record<string, any> // { fieldId: previousValue } (optional)
}

/**
 * Process Airtable payloads
 */
export async function fetchAndProcessAirtablePayloads(
  webhookData: any,
  workflowData: any,
  requestId: string // Original request ID from the ping, used for the final execution log
) {
  // Use a prefix derived from requestId for *internal* polling logs/errors
  const internalPollIdPrefix = `poll-${requestId}`
  let currentCursor: number | null = null
  let mightHaveMore = true
  let payloadsFetched = 0 // Track total payloads fetched
  let apiCallCount = 0
  // Use a Map to consolidate changes per record ID
  const consolidatedChangesMap = new Map<string, AirtableChange>()
  let localProviderConfig = { ...((webhookData.providerConfig as Record<string, any>) || {}) } // Local copy

  // DEBUG: Log start of function execution with critical info
  logger.debug(`[${requestId}] TRACE: fetchAndProcessAirtablePayloads started`, {
    webhookId: webhookData.id,
    workflowId: workflowData.id,
    hasBaseId: !!localProviderConfig.baseId,
    hasExternalId: !!localProviderConfig.externalId,
  })

  try {
    // --- Essential IDs & Config from localProviderConfig ---
    const baseId = localProviderConfig.baseId
    const airtableWebhookId = localProviderConfig.externalId

    if (!baseId || !airtableWebhookId) {
      logger.error(
        `[${requestId}] Missing baseId or externalId in providerConfig for webhook ${webhookData.id}. Cannot fetch payloads.`
      )
      await persistExecutionError(
        workflowData.id,
        `${internalPollIdPrefix}-config-error`,
        new Error('Missing Airtable baseId or externalId in providerConfig'),
        'webhook'
      )
      return // Exit early
    }

    // --- Retrieve Stored Cursor from localProviderConfig ---
    const storedCursor = localProviderConfig.externalWebhookCursor

    // Initialize cursor in provider config if missing
    if (storedCursor === undefined || storedCursor === null) {
      logger.info(
        `[${requestId}] No cursor found in providerConfig for webhook ${webhookData.id}, initializing...`
      )
      // Update the local copy
      localProviderConfig.externalWebhookCursor = null

      // Add cursor to the database immediately to fix the configuration
      try {
        await db
          .update(webhook)
          .set({
            providerConfig: { ...localProviderConfig, externalWebhookCursor: null },
            updatedAt: new Date(),
          })
          .where(eq(webhook.id, webhookData.id))

        localProviderConfig.externalWebhookCursor = null // Update local copy too
        logger.info(`[${requestId}] Successfully initialized cursor for webhook ${webhookData.id}`)
      } catch (initError: any) {
        logger.error(`[${requestId}] Failed to initialize cursor in DB`, {
          webhookId: webhookData.id,
          error: initError.message,
          stack: initError.stack,
        })
        // Persist the error specifically for cursor initialization failure
        await persistExecutionError(
          workflowData.id,
          `${internalPollIdPrefix}-cursor-init-error`,
          initError,
          'webhook'
        )
      }
    }

    if (storedCursor && typeof storedCursor === 'number') {
      currentCursor = storedCursor
      logger.debug(
        `[${requestId}] Using stored cursor: ${currentCursor} for webhook ${webhookData.id}`
      )
    } else {
      currentCursor = null // Airtable API defaults to 1 if omitted
      logger.debug(
        `[${requestId}] No valid stored cursor for webhook ${webhookData.id}, starting from beginning`
      )
    }

    // --- Get OAuth Token ---
    let accessToken: string | null = null
    try {
      accessToken = await getOAuthToken(workflowData.userId, 'airtable')
      if (!accessToken) {
        logger.error(
          `[${requestId}] Failed to obtain valid Airtable access token. Cannot proceed.`,
          { userId: workflowData.userId }
        )
        throw new Error('Airtable access token not found.')
      }

      logger.info(`[${requestId}] Successfully obtained Airtable access token`)
    } catch (tokenError: any) {
      logger.error(
        `[${requestId}] Failed to get Airtable OAuth token for user ${workflowData.userId}`,
        {
          error: tokenError.message,
          stack: tokenError.stack,
          userId: workflowData.userId,
        }
      )
      await persistExecutionError(
        workflowData.id,
        `${internalPollIdPrefix}-token-error`,
        tokenError,
        'webhook'
      )
      return // Exit early
    }

    const airtableApiBase = 'https://api.airtable.com/v0'

    // --- Polling Loop ---
    while (mightHaveMore) {
      apiCallCount++
      // Safety break
      if (apiCallCount > 10) {
        logger.warn(`[${requestId}] Reached maximum polling limit (10 calls)`, {
          webhookId: webhookData.id,
          consolidatedCount: consolidatedChangesMap.size,
        })
        mightHaveMore = false
        break
      }

      const apiUrl = `${airtableApiBase}/bases/${baseId}/webhooks/${airtableWebhookId}/payloads`
      const queryParams = new URLSearchParams()
      if (currentCursor !== null) {
        queryParams.set('cursor', currentCursor.toString())
      }
      const fullUrl = `${apiUrl}?${queryParams.toString()}`

      logger.debug(`[${requestId}] Fetching Airtable payloads (call ${apiCallCount})`, {
        url: fullUrl,
        webhookId: webhookData.id,
      })

      try {
        const fetchStartTime = Date.now()
        const response = await fetch(fullUrl, {
          method: 'GET',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        })

        // DEBUG: Log API response time
        logger.debug(`[${requestId}] TRACE: Airtable API response received`, {
          status: response.status,
          duration: `${Date.now() - fetchStartTime}ms`,
          hasBody: true,
          apiCall: apiCallCount,
        })

        const responseBody = await response.json()

        if (!response.ok || responseBody.error) {
          const errorMessage =
            responseBody.error?.message ||
            responseBody.error ||
            `Airtable API error Status ${response.status}`
          logger.error(
            `[${requestId}] Airtable API request to /payloads failed (Call ${apiCallCount})`,
            { webhookId: webhookData.id, status: response.status, error: errorMessage }
          )
          await persistExecutionError(
            workflowData.id,
            `${internalPollIdPrefix}-api-error-${apiCallCount}`,
            new Error(`Airtable API Error: ${errorMessage}`),
            'webhook'
          )
          mightHaveMore = false
          break
        }

        const receivedPayloads = responseBody.payloads || []
        logger.debug(
          `[${requestId}] Received ${receivedPayloads.length} payloads from Airtable (call ${apiCallCount})`
        )

        // --- Process and Consolidate Changes ---
        if (receivedPayloads.length > 0) {
          payloadsFetched += receivedPayloads.length
          let changeCount = 0
          for (const payload of receivedPayloads) {
            if (payload.changedTablesById) {
              // DEBUG: Log tables being processed
              const tableIds = Object.keys(payload.changedTablesById)
              logger.debug(`[${requestId}] TRACE: Processing changes for tables`, {
                tables: tableIds,
                payloadTimestamp: payload.timestamp,
              })

              for (const [tableId, tableChangesUntyped] of Object.entries(
                payload.changedTablesById
              )) {
                const tableChanges = tableChangesUntyped as any // Assert type

                // Handle created records
                if (tableChanges.createdRecordsById) {
                  const createdCount = Object.keys(tableChanges.createdRecordsById).length
                  changeCount += createdCount
                  // DEBUG: Log created records count
                  logger.debug(
                    `[${requestId}] TRACE: Processing ${createdCount} created records for table ${tableId}`
                  )

                  for (const [recordId, recordDataUntyped] of Object.entries(
                    tableChanges.createdRecordsById
                  )) {
                    const recordData = recordDataUntyped as any // Assert type
                    const existingChange = consolidatedChangesMap.get(recordId)
                    if (existingChange) {
                      // Record was created and possibly updated within the same batch
                      existingChange.changedFields = {
                        ...existingChange.changedFields,
                        ...(recordData.cellValuesByFieldId || {}),
                      }
                      // Keep changeType as 'created' if it started as created
                    } else {
                      // New creation
                      consolidatedChangesMap.set(recordId, {
                        tableId: tableId,
                        recordId: recordId,
                        changeType: 'created',
                        changedFields: recordData.cellValuesByFieldId || {},
                      })
                    }
                  }
                }

                // Handle updated records
                if (tableChanges.changedRecordsById) {
                  const updatedCount = Object.keys(tableChanges.changedRecordsById).length
                  changeCount += updatedCount
                  // DEBUG: Log updated records count
                  logger.debug(
                    `[${requestId}] TRACE: Processing ${updatedCount} updated records for table ${tableId}`
                  )

                  for (const [recordId, recordDataUntyped] of Object.entries(
                    tableChanges.changedRecordsById
                  )) {
                    const recordData = recordDataUntyped as any // Assert type
                    const existingChange = consolidatedChangesMap.get(recordId)
                    const currentFields = recordData.current?.cellValuesByFieldId || {}

                    if (existingChange) {
                      // Existing record was updated again
                      existingChange.changedFields = {
                        ...existingChange.changedFields,
                        ...currentFields,
                      }
                      // Ensure type is 'updated' if it was previously 'created'
                      existingChange.changeType = 'updated'
                      // Do not update previousFields again
                    } else {
                      // First update for this record in the batch
                      const newChange: AirtableChange = {
                        tableId: tableId,
                        recordId: recordId,
                        changeType: 'updated',
                        changedFields: currentFields,
                      }
                      if (recordData.previous?.cellValuesByFieldId) {
                        newChange.previousFields = recordData.previous.cellValuesByFieldId
                      }
                      consolidatedChangesMap.set(recordId, newChange)
                    }
                  }
                }
                // TODO: Handle deleted records (`destroyedRecordIds`) if needed
              }
            }
          }

          // DEBUG: Log totals for this batch
          logger.debug(
            `[${requestId}] TRACE: Processed ${changeCount} changes in API call ${apiCallCount}`,
            {
              currentMapSize: consolidatedChangesMap.size,
            }
          )
        }

        const nextCursor = responseBody.cursor
        mightHaveMore = responseBody.mightHaveMore || false

        if (nextCursor && typeof nextCursor === 'number' && nextCursor !== currentCursor) {
          logger.debug(`[${requestId}] Updating cursor from ${currentCursor} to ${nextCursor}`)
          currentCursor = nextCursor

          // Follow exactly the old implementation - use awaited update instead of parallel
          const updatedConfig = { ...localProviderConfig, externalWebhookCursor: currentCursor }
          try {
            // Force a complete object update to ensure consistency in serverless env
            await db
              .update(webhook)
              .set({
                providerConfig: updatedConfig, // Use full object
                updatedAt: new Date(),
              })
              .where(eq(webhook.id, webhookData.id))

            localProviderConfig.externalWebhookCursor = currentCursor // Update local copy too
          } catch (dbError: any) {
            logger.error(`[${requestId}] Failed to persist Airtable cursor to DB`, {
              webhookId: webhookData.id,
              cursor: currentCursor,
              error: dbError.message,
            })
            await persistExecutionError(
              workflowData.id,
              `${internalPollIdPrefix}-cursor-persist-error`,
              dbError,
              'webhook'
            )
            mightHaveMore = false
            throw new Error('Failed to save Airtable cursor, stopping processing.') // Re-throw to break loop clearly
          }
        } else if (!nextCursor || typeof nextCursor !== 'number') {
          logger.warn(`[${requestId}] Invalid or missing cursor received, stopping poll`, {
            webhookId: webhookData.id,
            apiCall: apiCallCount,
            receivedCursor: nextCursor,
          })
          mightHaveMore = false
        } else if (nextCursor === currentCursor) {
          logger.debug(`[${requestId}] Cursor hasn't changed (${currentCursor}), stopping poll`)
          mightHaveMore = false // Explicitly stop if cursor hasn't changed
        }
      } catch (fetchError: any) {
        logger.error(
          `[${requestId}] Network error calling Airtable GET /payloads (Call ${apiCallCount}) for webhook ${webhookData.id}`,
          fetchError
        )
        await persistExecutionError(
          workflowData.id,
          `${internalPollIdPrefix}-fetch-error-${apiCallCount}`,
          fetchError,
          'webhook'
        )
        mightHaveMore = false
        break
      }
    }
    // --- End Polling Loop ---

    // Convert map values to array for final processing
    const finalConsolidatedChanges = Array.from(consolidatedChangesMap.values())
    logger.info(
      `[${requestId}] Consolidated ${finalConsolidatedChanges.length} Airtable changes across ${apiCallCount} API calls`
    )

    // --- Execute Workflow if we have changes (simplified - no lock check) ---
    if (finalConsolidatedChanges.length > 0) {
      try {
        // Format the input for the executor using the consolidated changes
        const input = { airtableChanges: finalConsolidatedChanges } // Use the consolidated array

        // CRITICAL EXECUTION TRACE POINT
        logger.info(
          `[${requestId}] CRITICAL_TRACE: Beginning workflow execution with ${finalConsolidatedChanges.length} Airtable changes`,
          {
            workflowId: workflowData.id,
            recordCount: finalConsolidatedChanges.length,
            timestamp: new Date().toISOString(),
            firstRecordId: finalConsolidatedChanges[0]?.recordId || 'none',
          }
        )

        // Execute using the original requestId as the executionId
        // This is the exact point in the old code where execution happens - we're matching it exactly
        await executeWorkflowFromPayload(workflowData, input, requestId, requestId)

        // COMPLETION LOG - This will only appear if execution succeeds
        logger.info(`[${requestId}] CRITICAL_TRACE: Workflow execution completed successfully`, {
          workflowId: workflowData.id,
          timestamp: new Date().toISOString(),
        })
      } catch (executionError: any) {
        // Errors logged within executeWorkflowFromPayload
        logger.error(`[${requestId}] CRITICAL_TRACE: Workflow execution failed with error`, {
          workflowId: workflowData.id,
          error: executionError.message,
          stack: executionError.stack,
          timestamp: new Date().toISOString(),
        })

        logger.error(
          `[${requestId}] Error during workflow execution triggered by Airtable polling`,
          executionError
        )
      }
    } else {
      // DEBUG: Log when no changes are found
      logger.info(`[${requestId}] TRACE: No Airtable changes to process`, {
        workflowId: workflowData.id,
        apiCallCount,
        webhookId: webhookData.id,
      })
    }
  } catch (error) {
    // Catch any unexpected errors during the setup/polling logic itself
    logger.error(
      `[${requestId}] Unexpected error during asynchronous Airtable payload processing task`,
      {
        webhookId: webhookData.id,
        workflowId: workflowData.id,
        error: (error as Error).message,
        stack: (error as Error).stack,
      }
    )
    // Persist this higher-level error
    await persistExecutionError(
      workflowData.id,
      `${internalPollIdPrefix}-processing-error`,
      error as Error,
      'webhook'
    )
  }

  // DEBUG: Log function completion
  logger.debug(`[${requestId}] TRACE: fetchAndProcessAirtablePayloads completed`, {
    totalFetched: payloadsFetched,
    totalApiCalls: apiCallCount,
    totalChanges: consolidatedChangesMap.size,
    timestamp: new Date().toISOString(),
  })
}
