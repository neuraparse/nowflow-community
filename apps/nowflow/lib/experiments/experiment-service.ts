import { and, desc, eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { experimentResult, workflowExperiment } from '@/db/schema'

const logger = createLogger('ExperimentService')

export interface BlockOverride {
  blockId: string
  params: Record<string, any> // Parameter overrides for the block
  enabled?: boolean // Optional: enable/disable the block
}

export interface ExperimentVariant {
  id: string
  name: string
  description?: string
  weight: number
  config: Record<string, any> // Legacy config for backward compatibility
  blockOverrides?: BlockOverride[] // Block-level parameter overrides
}

export interface ExperimentConfig {
  name: string
  description?: string
  variants: ExperimentVariant[]
  trafficSplit: Record<string, number>
  metrics: string[]
  targetSampleSize?: number
  startAt?: Date
  endAt?: Date
}

export interface ExperimentData {
  id: string
  workflowId: string
  name: string
  description: string | null
  status: 'draft' | 'running' | 'paused' | 'completed'
  variants: ExperimentVariant[]
  trafficSplit: Record<string, number>
  metrics: string[]
  winnerVariantId: string | null
  startedAt: Date | null
  endedAt: Date | null
  createdAt: Date
}

export interface ExperimentResultData {
  id: string
  experimentId: string
  variantId: string
  executionId: string
  metrics: Record<string, number>
  createdAt: Date
}

/**
 * Creates a new experiment
 */
export async function createExperiment(
  workflowId: string,
  userId: string,
  config: ExperimentConfig
): Promise<ExperimentData> {
  try {
    const experimentId = uuidv4()
    const now = new Date()

    // Normalize traffic split to sum to 100
    const totalWeight = Object.values(config.trafficSplit).reduce((a, b) => a + b, 0)
    const normalizedSplit: Record<string, number> = {}
    for (const [key, value] of Object.entries(config.trafficSplit)) {
      normalizedSplit[key] = (value / totalWeight) * 100
    }

    await db.insert(workflowExperiment).values({
      id: experimentId,
      workflowId,
      userId,
      name: config.name,
      description: config.description || null,
      status: 'draft',
      variants: config.variants,
      trafficSplit: normalizedSplit,
      metrics: config.metrics,
      targetSampleSize: config.targetSampleSize || null,
      createdAt: now,
      updatedAt: now,
    })

    logger.info('Created experiment', { experimentId, name: config.name })

    return {
      id: experimentId,
      workflowId,
      name: config.name,
      description: config.description || null,
      status: 'draft',
      variants: config.variants,
      trafficSplit: normalizedSplit,
      metrics: config.metrics,
      winnerVariantId: null,
      startedAt: null,
      endedAt: null,
      createdAt: now,
    }
  } catch (error) {
    logger.error('Failed to create experiment', { workflowId, error })
    throw error
  }
}

/**
 * Gets experiments for a workflow
 */
export async function getExperiments(workflowId: string): Promise<ExperimentData[]> {
  try {
    const experiments = await db
      .select()
      .from(workflowExperiment)
      .where(eq(workflowExperiment.workflowId, workflowId))
      .orderBy(desc(workflowExperiment.createdAt))

    return experiments.map((e: typeof workflowExperiment.$inferSelect) => ({
      id: e.id,
      workflowId: e.workflowId,
      name: e.name,
      description: e.description,
      status: e.status as ExperimentData['status'],
      variants: (e.variants as ExperimentVariant[]) || [],
      trafficSplit: (e.trafficSplit as Record<string, number>) || {},
      metrics: (e.metrics as string[]) || [],
      winnerVariantId: e.winnerVariantId,
      startedAt: e.startedAt,
      endedAt: e.endedAt,
      createdAt: e.createdAt,
    }))
  } catch (error) {
    logger.error('Failed to get experiments', { workflowId, error })
    throw error
  }
}

/**
 * Gets a specific experiment
 */
export async function getExperiment(experimentId: string): Promise<ExperimentData | null> {
  try {
    const [experiment] = await db
      .select()
      .from(workflowExperiment)
      .where(eq(workflowExperiment.id, experimentId))
      .limit(1)

    if (!experiment) return null

    return {
      id: experiment.id,
      workflowId: experiment.workflowId,
      name: experiment.name,
      description: experiment.description,
      status: experiment.status as ExperimentData['status'],
      variants: (experiment.variants as ExperimentVariant[]) || [],
      trafficSplit: (experiment.trafficSplit as Record<string, number>) || {},
      metrics: (experiment.metrics as string[]) || [],
      winnerVariantId: experiment.winnerVariantId,
      startedAt: experiment.startedAt,
      endedAt: experiment.endedAt,
      createdAt: experiment.createdAt,
    }
  } catch (error) {
    logger.error('Failed to get experiment', { experimentId, error })
    throw error
  }
}

/**
 * Starts an experiment
 */
export async function startExperiment(experimentId: string): Promise<void> {
  try {
    await db
      .update(workflowExperiment)
      .set({
        status: 'running',
        startedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(workflowExperiment.id, experimentId))

    logger.info('Started experiment', { experimentId })
  } catch (error) {
    logger.error('Failed to start experiment', { experimentId, error })
    throw error
  }
}

/**
 * Pauses an experiment
 */
export async function pauseExperiment(experimentId: string): Promise<void> {
  try {
    await db
      .update(workflowExperiment)
      .set({
        status: 'paused',
        updatedAt: new Date(),
      })
      .where(eq(workflowExperiment.id, experimentId))

    logger.info('Paused experiment', { experimentId })
  } catch (error) {
    logger.error('Failed to pause experiment', { experimentId, error })
    throw error
  }
}

/**
 * Completes an experiment
 */
export async function completeExperiment(
  experimentId: string,
  winnerVariantId?: string
): Promise<void> {
  try {
    await db
      .update(workflowExperiment)
      .set({
        status: 'completed',
        winnerVariantId: winnerVariantId || null,
        endedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(workflowExperiment.id, experimentId))

    logger.info('Completed experiment', { experimentId, winnerVariantId })
  } catch (error) {
    logger.error('Failed to complete experiment', { experimentId, error })
    throw error
  }
}

/**
 * Records an experiment result
 */
export async function recordExperimentResult(
  experimentId: string,
  variantId: string,
  executionId: string,
  metrics: {
    success?: number
    latency?: number
    cost?: number
    tokens?: number
    [key: string]: any
  }
): Promise<void> {
  try {
    await db.insert(experimentResult).values({
      id: uuidv4(),
      experimentId,
      variantId,
      executionId,
      success: metrics.success === 1,
      latencyMs: metrics.latency ? Math.round(metrics.latency) : null,
      tokenCount: metrics.tokens ? Math.round(metrics.tokens) : null,
      cost: metrics.cost?.toString() || null,
      metrics: metrics,
      createdAt: new Date(),
    })

    logger.debug('Recorded experiment result', { experimentId, variantId, executionId })
  } catch (error) {
    logger.error('Failed to record experiment result', { experimentId, error })
    throw error
  }
}

/**
 * Gets experiment results
 */
export async function getExperimentResults(experimentId: string): Promise<{
  results: ExperimentResultData[]
  summary: Record<
    string,
    { count: number; metrics: Record<string, { avg: number; min: number; max: number }> }
  >
}> {
  try {
    const results = await db
      .select()
      .from(experimentResult)
      .where(eq(experimentResult.experimentId, experimentId))
      .orderBy(desc(experimentResult.createdAt))

    // Calculate summary by variant
    const summary: Record<
      string,
      { count: number; metrics: Record<string, { avg: number; min: number; max: number }> }
    > = {}

    for (const result of results) {
      if (!summary[result.variantId]) {
        summary[result.variantId] = { count: 0, metrics: {} }
      }

      summary[result.variantId].count++

      const metrics = result.metrics as Record<string, number>
      for (const [key, value] of Object.entries(metrics)) {
        if (!summary[result.variantId].metrics[key]) {
          summary[result.variantId].metrics[key] = { avg: 0, min: Infinity, max: -Infinity }
        }

        const m = summary[result.variantId].metrics[key]
        m.avg =
          (m.avg * (summary[result.variantId].count - 1) + value) / summary[result.variantId].count
        m.min = Math.min(m.min, value)
        m.max = Math.max(m.max, value)
      }
    }

    return {
      results: results.map((r: typeof experimentResult.$inferSelect) => ({
        id: r.id,
        experimentId: r.experimentId,
        variantId: r.variantId,
        executionId: r.executionId,
        metrics: r.metrics as Record<string, number>,
        createdAt: r.createdAt,
      })),
      summary,
    }
  } catch (error) {
    logger.error('Failed to get experiment results', { experimentId, error })
    throw error
  }
}

/**
 * Selects a variant for an execution based on traffic split
 */
export function selectVariant(experiment: ExperimentData): ExperimentVariant | null {
  if (experiment.status !== 'running' || experiment.variants.length === 0) {
    return null
  }

  const random = Math.random() * 100
  let cumulative = 0

  for (const variant of experiment.variants) {
    const weight = experiment.trafficSplit[variant.id] || 0
    cumulative += weight

    if (random <= cumulative) {
      return variant
    }
  }

  // Fallback to first variant
  return experiment.variants[0]
}

/**
 * Gets the active (running) experiment for a workflow
 * Returns the first running experiment if multiple exist
 */
export async function getActiveExperiment(workflowId: string): Promise<ExperimentData | null> {
  // DB is only available server-side; skip experiment lookup when running in the browser
  if (typeof window !== 'undefined') {
    return null
  }

  try {
    const [experiment] = await db
      .select()
      .from(workflowExperiment)
      .where(
        and(eq(workflowExperiment.workflowId, workflowId), eq(workflowExperiment.status, 'running'))
      )
      .limit(1)

    if (!experiment) return null

    return {
      id: experiment.id,
      workflowId: experiment.workflowId,
      name: experiment.name,
      description: experiment.description,
      status: experiment.status as ExperimentData['status'],
      variants: (experiment.variants as ExperimentVariant[]) || [],
      trafficSplit: (experiment.trafficSplit as Record<string, number>) || {},
      metrics: (experiment.metrics as string[]) || [],
      winnerVariantId: experiment.winnerVariantId,
      startedAt: experiment.startedAt,
      endedAt: experiment.endedAt,
      createdAt: experiment.createdAt,
    }
  } catch (error) {
    logger.error('Failed to get active experiment', {
      workflowId,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

/**
 * Applies variant's block overrides to workflow state
 * Returns the modified workflow state with variant configurations applied
 */
export function applyVariantToWorkflow(
  workflowState: Record<string, any>,
  variant: ExperimentVariant
): Record<string, any> {
  if (!variant.blockOverrides || variant.blockOverrides.length === 0) {
    // No block overrides, return original state
    return workflowState
  }

  // Deep clone the workflow state to avoid mutations
  const modifiedState = JSON.parse(JSON.stringify(workflowState))
  const blocks = modifiedState.blocks || {}

  for (const override of variant.blockOverrides) {
    const block = blocks[override.blockId]
    if (!block) {
      logger.warn('Block not found for experiment override', {
        blockId: override.blockId,
        variantId: variant.id,
      })
      continue
    }

    // Apply enabled/disabled state
    if (override.enabled !== undefined) {
      block.enabled = override.enabled
    }

    // Apply parameter overrides to subBlocks
    if (override.params && block.subBlocks) {
      for (const [paramId, value] of Object.entries(override.params)) {
        if (block.subBlocks[paramId]) {
          block.subBlocks[paramId].value = value
          logger.debug('Applied experiment override', {
            blockId: override.blockId,
            paramId,
            variantId: variant.id,
          })
        }
      }
    }
  }

  return modifiedState
}

/**
 * Calculates statistical significance using a simple Z-test for proportions
 * Returns confidence level (0-1) that variant A is better than variant B
 */
export function calculateStatisticalSignificance(
  variantASuccesses: number,
  variantATotal: number,
  variantBSuccesses: number,
  variantBTotal: number
): { confidence: number; pValue: number; significant: boolean } {
  if (variantATotal === 0 || variantBTotal === 0) {
    return { confidence: 0, pValue: 1, significant: false }
  }

  const pA = variantASuccesses / variantATotal
  const pB = variantBSuccesses / variantBTotal

  // Pooled proportion
  const pPooled = (variantASuccesses + variantBSuccesses) / (variantATotal + variantBTotal)

  // Standard error
  const se = Math.sqrt(pPooled * (1 - pPooled) * (1 / variantATotal + 1 / variantBTotal))

  if (se === 0) {
    return { confidence: 0.5, pValue: 1, significant: false }
  }

  // Z-score
  const z = (pA - pB) / se

  // Calculate p-value (two-tailed)
  const pValue = 2 * (1 - normalCDF(Math.abs(z)))

  // Confidence that A is better than B
  const confidence = pA > pB ? normalCDF(z) : 1 - normalCDF(z)

  return {
    confidence,
    pValue,
    significant: pValue < 0.05, // 95% significance level
  }
}

/**
 * Standard normal cumulative distribution function
 */
function normalCDF(x: number): number {
  const a1 = 0.254829592
  const a2 = -0.284496736
  const a3 = 1.421413741
  const a4 = -1.453152027
  const a5 = 1.061405429
  const p = 0.3275911

  const sign = x < 0 ? -1 : 1
  x = Math.abs(x) / Math.sqrt(2)

  const t = 1.0 / (1.0 + p * x)
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)

  return 0.5 * (1.0 + sign * y)
}

/**
 * Updates experiment sample count and auto-completes if target reached
 */
export async function updateExperimentSampleCount(experimentId: string): Promise<boolean> {
  try {
    const experiment = await getExperiment(experimentId)
    if (!experiment || experiment.status !== 'running') {
      return false
    }

    // Count total results
    const results = await db
      .select()
      .from(experimentResult)
      .where(eq(experimentResult.experimentId, experimentId))

    const currentCount = results.length

    // Update current sample size
    await db
      .update(workflowExperiment)
      .set({
        currentSampleSize: currentCount,
        updatedAt: new Date(),
      })
      .where(eq(workflowExperiment.id, experimentId))

    // Check if target reached
    const targetSize = (experiment as any).targetSampleSize
    if (targetSize && currentCount >= targetSize) {
      logger.info('Experiment reached target sample size', {
        experimentId,
        currentCount,
        targetSize,
      })

      // Auto-determine winner based on success rate
      const summary = await calculateExperimentSummary(experimentId)
      let winnerId: string | undefined
      let bestSuccessRate = -1

      for (const [variantId, data] of Object.entries(summary)) {
        const successRate = data.metrics.success?.avg || 0
        if (successRate > bestSuccessRate) {
          bestSuccessRate = successRate
          winnerId = variantId
        }
      }

      await completeExperiment(experimentId, winnerId)
      return true // Experiment completed
    }

    return false // Not completed yet
  } catch (error) {
    logger.error('Failed to update experiment sample count', { experimentId, error })
    return false
  }
}

/**
 * Calculates summary statistics for an experiment
 */
async function calculateExperimentSummary(
  experimentId: string
): Promise<
  Record<
    string,
    { count: number; metrics: Record<string, { avg: number; min: number; max: number }> }
  >
> {
  const { summary } = await getExperimentResults(experimentId)
  return summary
}

/**
 * Gets experiment summary with statistical analysis
 */
export async function getExperimentAnalysis(experimentId: string): Promise<{
  experiment: ExperimentData | null
  summary: Record<string, { count: number; metrics: Record<string, { avg: number }> }>
  significance: Record<
    string,
    { vsControl: { confidence: number; pValue: number; significant: boolean } }
  >
  recommendedWinner: string | null
}> {
  const experiment = await getExperiment(experimentId)
  if (!experiment) {
    return { experiment: null, summary: {}, significance: {}, recommendedWinner: null }
  }

  const { summary } = await getExperimentResults(experimentId)

  // Calculate significance for each variant vs control (first variant)
  const controlId = experiment.variants[0]?.id
  const significance: Record<
    string,
    { vsControl: { confidence: number; pValue: number; significant: boolean } }
  > = {}

  let bestVariant: string | null = null
  let bestSuccessRate = -1

  for (const variant of experiment.variants) {
    const variantData = summary[variant.id]
    if (!variantData) continue

    const successRate = variantData.metrics.success?.avg || 0
    if (successRate > bestSuccessRate) {
      bestSuccessRate = successRate
      bestVariant = variant.id
    }

    if (variant.id !== controlId && controlId) {
      const controlData = summary[controlId]
      if (controlData) {
        const variantSuccesses = Math.round(
          (variantData.metrics.success?.avg || 0) * variantData.count
        )
        const controlSuccesses = Math.round(
          (controlData.metrics.success?.avg || 0) * controlData.count
        )

        significance[variant.id] = {
          vsControl: calculateStatisticalSignificance(
            variantSuccesses,
            variantData.count,
            controlSuccesses,
            controlData.count
          ),
        }
      }
    }
  }

  return {
    experiment,
    summary,
    significance,
    recommendedWinner: bestVariant,
  }
}
