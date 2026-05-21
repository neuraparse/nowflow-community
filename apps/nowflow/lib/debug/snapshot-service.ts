import { and, desc, eq, sql } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { debugSession, executionSnapshot, workflowBreakpoint } from '@/db/schema'
import { BlockState, ExecutionContext } from '@/executor/types'

const logger = createLogger('SnapshotService')

export interface ExecutionSnapshotData {
  id: string
  workflowId: string
  executionId: string
  stepIndex: number
  blockStates: Record<string, BlockState>
  environmentVariables: Record<string, string>
  decisions: {
    router: Record<string, string>
    condition: Record<string, string>
  }
  loopIterations: Record<string, number>
  executedBlocks: string[]
  activeExecutionPath: string[]
  executedBlockId: string
  executedBlockName: string | null
  executedBlockType: string | null
  timestamp: Date
  durationMs: number | null
  inputData: any
  outputData: any
  error: string | null
}

export interface BreakpointData {
  id: string
  workflowId: string
  userId: string
  blockId: string
  isEnabled: boolean
  condition: string | null
  logExpression: string | null
  hitCount: number
  createdAt: Date
  updatedAt: Date
}

export interface DebugSessionData {
  id: string
  workflowId: string
  userId: string
  executionId: string | null
  status: 'active' | 'paused' | 'completed' | 'terminated'
  currentStepIndex: number
  totalSteps: number | null
  watchExpressions: string[]
  settings: {
    stepMode: 'block' | 'line'
    autoAdvance: boolean
  }
  startedAt: Date
  lastActivityAt: Date
  endedAt: Date | null
}

/**
 * Captures a snapshot of the current execution state
 */
export async function captureSnapshot(
  context: ExecutionContext,
  blockId: string,
  blockName?: string,
  blockType?: string,
  inputData?: any,
  outputData?: any,
  durationMs?: number,
  error?: string
): Promise<ExecutionSnapshotData> {
  try {
    const snapshotId = uuidv4()
    const now = new Date()

    // Get current step index
    const stepIndex = context.executedBlocks.size

    // Convert Maps to plain objects for storage
    const blockStates: Record<string, BlockState> = {}
    context.blockStates.forEach((state, id) => {
      blockStates[id] = state
    })

    const routerDecisions: Record<string, string> = {}
    context.decisions.router.forEach((target, router) => {
      routerDecisions[router] = target
    })

    const conditionDecisions: Record<string, string> = {}
    context.decisions.condition.forEach((selected, condition) => {
      conditionDecisions[condition] = selected
    })

    const loopIterations: Record<string, number> = {}
    context.loopIterations.forEach((count, loopId) => {
      loopIterations[loopId] = count
    })

    await db.insert(executionSnapshot).values({
      id: snapshotId,
      workflowId: context.workflowId,
      executionId: context.executionId || context.workflowId,
      stepIndex,
      blockStates,
      environmentVariables: context.environmentVariables,
      decisions: { router: routerDecisions, condition: conditionDecisions },
      loopIterations,
      executedBlocks: Array.from(context.executedBlocks),
      activeExecutionPath: Array.from(context.activeExecutionPath),
      executedBlockId: blockId,
      executedBlockName: blockName || null,
      executedBlockType: blockType || null,
      timestamp: now,
      durationMs: durationMs || null,
      inputData: inputData || null,
      outputData: outputData || null,
      error: error || null,
    })

    logger.debug('Captured execution snapshot', {
      snapshotId,
      workflowId: context.workflowId,
      stepIndex,
      blockId,
    })

    return {
      id: snapshotId,
      workflowId: context.workflowId,
      executionId: context.executionId || context.workflowId,
      stepIndex,
      blockStates,
      environmentVariables: context.environmentVariables,
      decisions: { router: routerDecisions, condition: conditionDecisions },
      loopIterations,
      executedBlocks: Array.from(context.executedBlocks),
      activeExecutionPath: Array.from(context.activeExecutionPath),
      executedBlockId: blockId,
      executedBlockName: blockName || null,
      executedBlockType: blockType || null,
      timestamp: now,
      durationMs: durationMs || null,
      inputData,
      outputData,
      error: error || null,
    }
  } catch (err) {
    logger.error('Failed to capture snapshot', { error: err })
    throw err
  }
}

/**
 * Gets snapshots for an execution
 */
export async function getSnapshots(
  executionId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<{ snapshots: ExecutionSnapshotData[]; total: number }> {
  const { limit = 100, offset = 0 } = options

  try {
    const snapshots = await db
      .select()
      .from(executionSnapshot)
      .where(eq(executionSnapshot.executionId, executionId))
      .orderBy(executionSnapshot.stepIndex)
      .limit(limit)
      .offset(offset)

    const [{ count }] = await db
      .select({ count: sql`count(*)` })
      .from(executionSnapshot)
      .where(eq(executionSnapshot.executionId, executionId))

    return {
      snapshots: snapshots as ExecutionSnapshotData[],
      total: Number(count),
    }
  } catch (error) {
    logger.error('Failed to get snapshots', { executionId, error })
    throw error
  }
}

/**
 * Gets a snapshot at a specific step
 */
export async function getSnapshotAtStep(
  executionId: string,
  stepIndex: number
): Promise<ExecutionSnapshotData | null> {
  try {
    const [snapshot] = await db
      .select()
      .from(executionSnapshot)
      .where(
        and(
          eq(executionSnapshot.executionId, executionId),
          eq(executionSnapshot.stepIndex, stepIndex)
        )
      )
      .limit(1)

    return (snapshot as ExecutionSnapshotData) || null
  } catch (error) {
    logger.error('Failed to get snapshot at step', { executionId, stepIndex, error })
    throw error
  }
}

/**
 * Deletes old snapshots for an execution
 */
export async function pruneSnapshots(
  executionId: string,
  keepCount: number = 100
): Promise<number> {
  try {
    const snapshots = await db
      .select({ id: executionSnapshot.id, stepIndex: executionSnapshot.stepIndex })
      .from(executionSnapshot)
      .where(eq(executionSnapshot.executionId, executionId))
      .orderBy(desc(executionSnapshot.stepIndex))

    if (snapshots.length <= keepCount) {
      return 0
    }

    const toDelete = snapshots.slice(keepCount)
    for (const snapshot of toDelete) {
      await db.delete(executionSnapshot).where(eq(executionSnapshot.id, snapshot.id))
    }

    return toDelete.length
  } catch (error) {
    logger.error('Failed to prune snapshots', { executionId, error })
    throw error
  }
}

// ==================== BREAKPOINTS ====================

/**
 * Creates a breakpoint
 */
export async function createBreakpoint(
  workflowId: string,
  userId: string,
  blockId: string,
  options: { condition?: string; logExpression?: string } = {}
): Promise<BreakpointData> {
  try {
    const breakpointId = uuidv4()
    const now = new Date()

    await db.insert(workflowBreakpoint).values({
      id: breakpointId,
      workflowId,
      userId,
      blockId,
      isEnabled: true,
      condition: options.condition || null,
      logExpression: options.logExpression || null,
      hitCount: 0,
      createdAt: now,
      updatedAt: now,
    })

    logger.info('Created breakpoint', { breakpointId, workflowId, blockId })

    return {
      id: breakpointId,
      workflowId,
      userId,
      blockId,
      isEnabled: true,
      condition: options.condition || null,
      logExpression: options.logExpression || null,
      hitCount: 0,
      createdAt: now,
      updatedAt: now,
    }
  } catch (error) {
    logger.error('Failed to create breakpoint', { workflowId, blockId, error })
    throw error
  }
}

/**
 * Gets breakpoints for a workflow
 */
export async function getBreakpoints(
  workflowId: string,
  userId: string
): Promise<BreakpointData[]> {
  try {
    const breakpoints = await db
      .select()
      .from(workflowBreakpoint)
      .where(
        and(eq(workflowBreakpoint.workflowId, workflowId), eq(workflowBreakpoint.userId, userId))
      )

    return breakpoints as BreakpointData[]
  } catch (error) {
    logger.error('Failed to get breakpoints', { workflowId, userId, error })
    throw error
  }
}

/**
 * Updates a breakpoint
 */
export async function updateBreakpoint(
  breakpointId: string,
  updates: Partial<{
    isEnabled: boolean
    condition: string
    logExpression: string
  }>
): Promise<void> {
  try {
    await db
      .update(workflowBreakpoint)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(workflowBreakpoint.id, breakpointId))

    logger.debug('Updated breakpoint', { breakpointId })
  } catch (error) {
    logger.error('Failed to update breakpoint', { breakpointId, error })
    throw error
  }
}

/**
 * Deletes a breakpoint
 */
export async function deleteBreakpoint(breakpointId: string): Promise<void> {
  try {
    await db.delete(workflowBreakpoint).where(eq(workflowBreakpoint.id, breakpointId))
    logger.debug('Deleted breakpoint', { breakpointId })
  } catch (error) {
    logger.error('Failed to delete breakpoint', { breakpointId, error })
    throw error
  }
}

/**
 * Checks if execution should pause at a breakpoint
 */
export async function checkBreakpoint(
  workflowId: string,
  userId: string,
  blockId: string,
  context: ExecutionContext
): Promise<{ shouldPause: boolean; breakpoint?: BreakpointData; logOutput?: string }> {
  try {
    const [breakpoint] = await db
      .select()
      .from(workflowBreakpoint)
      .where(
        and(
          eq(workflowBreakpoint.workflowId, workflowId),
          eq(workflowBreakpoint.userId, userId),
          eq(workflowBreakpoint.blockId, blockId),
          eq(workflowBreakpoint.isEnabled, true)
        )
      )
      .limit(1)

    if (!breakpoint) {
      return { shouldPause: false }
    }

    // Check condition if specified
    if (breakpoint.condition) {
      try {
        const conditionMet = evaluateCondition(breakpoint.condition, context)
        if (!conditionMet) {
          return { shouldPause: false }
        }
      } catch (err) {
        logger.warn('Breakpoint condition evaluation failed', {
          breakpointId: breakpoint.id,
          error: err,
        })
      }
    }

    // Increment hit count
    await db
      .update(workflowBreakpoint)
      .set({
        hitCount: (breakpoint.hitCount || 0) + 1,
        updatedAt: new Date(),
      })
      .where(eq(workflowBreakpoint.id, breakpoint.id))

    // Evaluate log expression if specified
    let logOutput: string | undefined
    if (breakpoint.logExpression) {
      try {
        logOutput = evaluateLogExpression(breakpoint.logExpression, context)
      } catch (err) {
        logOutput = `Error: ${err}`
      }
    }

    return {
      shouldPause: true,
      breakpoint: breakpoint as BreakpointData,
      logOutput,
    }
  } catch (error) {
    logger.error('Failed to check breakpoint', { workflowId, blockId, error })
    return { shouldPause: false }
  }
}

/**
 * Safe expression evaluator - parses simple expressions without using eval/Function
 * Supports: property access, comparisons, boolean operators, literals
 */
function safeEvaluate(expression: string, context: Record<string, any>): any {
  // Tokenize the expression
  const tokens = tokenize(expression)
  if (tokens.length === 0) return undefined

  // Parse and evaluate
  return parseExpression(tokens, context)
}

function tokenize(expr: string): string[] {
  const tokens: string[] = []
  let i = 0
  const len = expr.length

  while (i < len) {
    // Skip whitespace
    if (/\s/.test(expr[i])) {
      i++
      continue
    }

    // String literals
    if (expr[i] === '"' || expr[i] === "'") {
      const quote = expr[i]
      let str = ''
      i++
      while (i < len && expr[i] !== quote) {
        if (expr[i] === '\\' && i + 1 < len) {
          str += expr[i + 1]
          i += 2
        } else {
          str += expr[i]
          i++
        }
      }
      i++ // skip closing quote
      tokens.push(JSON.stringify(str))
      continue
    }

    // Numbers
    if (/[0-9]/.test(expr[i]) || (expr[i] === '-' && /[0-9]/.test(expr[i + 1] || ''))) {
      let num = ''
      if (expr[i] === '-') {
        num = '-'
        i++
      }
      while (i < len && /[0-9.]/.test(expr[i])) {
        num += expr[i]
        i++
      }
      tokens.push(num)
      continue
    }

    // Operators (multi-char first)
    const multiChar = ['===', '!==', '==', '!=', '<=', '>=', '&&', '||']
    let foundMulti = false
    for (const op of multiChar) {
      if (expr.slice(i, i + op.length) === op) {
        tokens.push(op)
        i += op.length
        foundMulti = true
        break
      }
    }
    if (foundMulti) continue

    // Single char operators and punctuation
    if (/[<>!+\-*/%().\[\],]/.test(expr[i])) {
      tokens.push(expr[i])
      i++
      continue
    }

    // Identifiers (including keywords like true, false, null)
    if (/[a-zA-Z_$]/.test(expr[i])) {
      let id = ''
      while (i < len && /[a-zA-Z0-9_$]/.test(expr[i])) {
        id += expr[i]
        i++
      }
      tokens.push(id)
      continue
    }

    // Unknown character - skip
    i++
  }

  return tokens
}

function parseExpression(tokens: string[], context: Record<string, any>): any {
  let pos = 0

  function peek(): string | undefined {
    return tokens[pos]
  }

  function consume(): string {
    return tokens[pos++]
  }

  function parseOr(): any {
    let left = parseAnd()
    while (peek() === '||') {
      consume()
      const right = parseAnd()
      left = left || right
    }
    return left
  }

  function parseAnd(): any {
    let left = parseEquality()
    while (peek() === '&&') {
      consume()
      const right = parseEquality()
      left = left && right
    }
    return left
  }

  function parseEquality(): any {
    let left = parseComparison()
    while (peek() === '==' || peek() === '!=' || peek() === '===' || peek() === '!==') {
      const op = consume()
      const right = parseComparison()
      if (op === '==' || op === '===') left = left === right
      else left = left !== right
    }
    return left
  }

  function parseComparison(): any {
    let left = parseAdditive()
    while (peek() === '<' || peek() === '>' || peek() === '<=' || peek() === '>=') {
      const op = consume()
      const right = parseAdditive()
      if (op === '<') left = left < right
      else if (op === '>') left = left > right
      else if (op === '<=') left = left <= right
      else left = left >= right
    }
    return left
  }

  function parseAdditive(): any {
    let left = parseMultiplicative()
    while (peek() === '+' || peek() === '-') {
      const op = consume()
      const right = parseMultiplicative()
      left = op === '+' ? left + right : left - right
    }
    return left
  }

  function parseMultiplicative(): any {
    let left = parseUnary()
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const op = consume()
      const right = parseUnary()
      if (op === '*') left = left * right
      else if (op === '/') left = left / right
      else left = left % right
    }
    return left
  }

  function parseUnary(): any {
    if (peek() === '!') {
      consume()
      return !parseUnary()
    }
    if (peek() === '-') {
      consume()
      return -parseUnary()
    }
    return parseMemberAccess()
  }

  function parseMemberAccess(): any {
    let obj = parsePrimary()

    while (peek() === '.' || peek() === '[') {
      if (peek() === '.') {
        consume()
        const prop = consume()
        obj = obj?.[prop]
      } else {
        consume() // [
        const idx = parseOr()
        if (peek() === ']') consume()
        obj = obj?.[idx]
      }
    }

    return obj
  }

  function parsePrimary(): any {
    const token = peek()

    if (token === '(') {
      consume()
      const result = parseOr()
      if (peek() === ')') consume()
      return result
    }

    if (token === undefined) return undefined

    consume()

    // Literals
    if (token === 'true') return true
    if (token === 'false') return false
    if (token === 'null') return null
    if (token === 'undefined') return undefined

    // Number
    if (/^-?[0-9.]+$/.test(token)) {
      return parseFloat(token)
    }

    // String literal
    if (token.startsWith('"') || token.startsWith("'")) {
      try {
        return JSON.parse(token)
      } catch {
        return token.slice(1, -1)
      }
    }

    // Identifier - look up in context
    return context[token]
  }

  return parseOr()
}

/**
 * Evaluates a breakpoint condition safely
 */
function evaluateCondition(condition: string, context: ExecutionContext): boolean {
  try {
    // Create evaluation context
    const evalContext: Record<string, any> = {
      blockStates: Object.fromEntries(context.blockStates),
      loopIterations: Object.fromEntries(context.loopIterations),
      env: context.environmentVariables,
    }

    const result = safeEvaluate(condition, evalContext)
    return Boolean(result)
  } catch {
    return false
  }
}

/**
 * Evaluates a log expression safely
 */
function evaluateLogExpression(expression: string, context: ExecutionContext): string {
  try {
    const evalContext: Record<string, any> = {
      blockStates: Object.fromEntries(context.blockStates),
      loopIterations: Object.fromEntries(context.loopIterations),
      env: context.environmentVariables,
    }

    const result = safeEvaluate(expression, evalContext)
    return typeof result === 'string' ? result : JSON.stringify(result)
  } catch (err) {
    return `Error evaluating expression: ${err}`
  }
}

// ==================== DEBUG SESSIONS ====================

/**
 * Creates a debug session
 */
export async function createDebugSession(
  workflowId: string,
  userId: string,
  settings?: { stepMode?: 'block' | 'line'; autoAdvance?: boolean }
): Promise<DebugSessionData> {
  try {
    const sessionId = uuidv4()
    const now = new Date()

    await db.insert(debugSession).values({
      id: sessionId,
      workflowId,
      userId,
      status: 'active',
      currentStepIndex: 0,
      watchExpressions: [],
      settings: {
        stepMode: settings?.stepMode ?? 'block',
        autoAdvance: settings?.autoAdvance ?? false,
      },
      startedAt: now,
      lastActivityAt: now,
    })

    logger.info('Created debug session', { sessionId, workflowId })

    return {
      id: sessionId,
      workflowId,
      userId,
      executionId: null,
      status: 'active',
      currentStepIndex: 0,
      totalSteps: null,
      watchExpressions: [],
      settings: {
        stepMode: settings?.stepMode ?? 'block',
        autoAdvance: settings?.autoAdvance ?? false,
      },
      startedAt: now,
      lastActivityAt: now,
      endedAt: null,
    }
  } catch (error) {
    logger.error('Failed to create debug session', { workflowId, error })
    throw error
  }
}

/**
 * Gets active debug session for a workflow
 */
export async function getActiveDebugSession(
  workflowId: string,
  userId: string
): Promise<DebugSessionData | null> {
  try {
    const [session] = await db
      .select()
      .from(debugSession)
      .where(
        and(
          eq(debugSession.workflowId, workflowId),
          eq(debugSession.userId, userId),
          eq(debugSession.status, 'active')
        )
      )
      .limit(1)

    return (session as DebugSessionData) || null
  } catch (error) {
    logger.error('Failed to get active debug session', { workflowId, error })
    throw error
  }
}

/**
 * Updates debug session
 */
export async function updateDebugSession(
  sessionId: string,
  updates: Partial<{
    executionId: string
    status: 'active' | 'paused' | 'completed' | 'terminated'
    currentStepIndex: number
    totalSteps: number
    watchExpressions: string[]
    settings: any
  }>
): Promise<void> {
  try {
    await db
      .update(debugSession)
      .set({
        ...updates,
        lastActivityAt: new Date(),
        ...(updates.status === 'completed' || updates.status === 'terminated'
          ? { endedAt: new Date() }
          : {}),
      })
      .where(eq(debugSession.id, sessionId))

    logger.debug('Updated debug session', { sessionId })
  } catch (error) {
    logger.error('Failed to update debug session', { sessionId, error })
    throw error
  }
}

/**
 * Ends a debug session
 */
export async function endDebugSession(
  sessionId: string,
  status: 'completed' | 'terminated' = 'completed'
): Promise<void> {
  try {
    await db
      .update(debugSession)
      .set({
        status,
        endedAt: new Date(),
        lastActivityAt: new Date(),
      })
      .where(eq(debugSession.id, sessionId))

    logger.info('Ended debug session', { sessionId, status })
  } catch (error) {
    logger.error('Failed to end debug session', { sessionId, error })
    throw error
  }
}
