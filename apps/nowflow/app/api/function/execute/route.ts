import { NextRequest, NextResponse } from 'next/server'
import { selectRunner } from '@/lib/code-execution'
import { createLogger } from '@/lib/logs/console-logger'
import { requireSessionOrInternalApiKey } from '@/lib/request-auth'

// Explicitly export allowed methods
export const dynamic = 'force-dynamic' // Disable static optimization
export const runtime = 'nodejs' // Use Node.js runtime

const logger = createLogger('FunctionExecuteAPI')
const MAX_EXECUTION_TIMEOUT_MS = 30000
const MAX_CODE_LENGTH = 100000

/**
 * Resolves workflow environment variables and tags in code.
 *
 * SECURITY: This function MUST NOT read from `process.env`. Allowing user
 * templates (`{{VAR}}`) to pull host process env would leak server secrets
 * (DB credentials, encryption keys, etc.) into user-executed code. Only
 * workflow-scoped `envVars` and request `params` are resolvable here.
 *
 * @param code - Code with variables
 * @param params - Parameters that may contain variable values
 * @param envVars - Environment variables scoped to the workflow
 * @returns Resolved code
 */
function resolveCodeVariables(
  code: string,
  params: Record<string, any>,
  envVars: Record<string, string> = {}
): string {
  let resolvedCode = code

  // Resolve environment variables with {{var_name}} syntax.
  // Priority: 1. workflow envVars, 2. params. Host `process.env` is intentionally
  // NOT consulted — see security note above.
  const envVarMatches = resolvedCode.match(/\{\{([^}]+)\}\}/g) || []
  for (const match of envVarMatches) {
    const varName = match.slice(2, -2).trim()
    const varValue =
      Object.prototype.hasOwnProperty.call(envVars, varName) && envVars[varName] !== undefined
        ? envVars[varName]
        : Object.prototype.hasOwnProperty.call(params, varName) && params[varName] !== undefined
          ? params[varName]
          : ''
    // Wrap the value in quotes to ensure it's treated as a string literal
    resolvedCode = resolvedCode.replace(match, JSON.stringify(varValue))
  }

  // Resolve tags with <tag_name> syntax
  const tagMatches = resolvedCode.match(/<([^>]+)>/g) || []
  for (const match of tagMatches) {
    const tagName = match.slice(1, -1).trim()
    const tagValue = params[tagName] || ''
    resolvedCode = resolvedCode.replace(match, tagValue)
  }

  return resolvedCode
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8)
  const startTime = Date.now()
  let stdout = ''

  try {
    const authResult = await requireSessionOrInternalApiKey(req)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const body = await req.json()

    const { code, params = {}, timeout = 5000, envVars = {}, isCustomTool = false } = body

    if (typeof code !== 'string' || code.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Code is required' }, { status: 400 })
    }

    if (code.length > MAX_CODE_LENGTH) {
      return NextResponse.json(
        { success: false, error: `Code size exceeds the ${MAX_CODE_LENGTH} character limit` },
        { status: 400 }
      )
    }

    const safeEnvVars = envVars && typeof envVars === 'object' ? envVars : {}
    const clampedTimeout = Math.min(
      Math.max(100, Number.isFinite(timeout) ? Number(timeout) : 5000),
      MAX_EXECUTION_TIMEOUT_MS
    )

    // Extract internal parameters that shouldn't be passed to the execution context
    const executionParams = { ...params }
    delete executionParams._context

    // Resolve variables in the code with workflow environment variables
    const resolvedCode = resolveCodeVariables(code, executionParams, safeEnvVars)

    // Pick a runner. The dispatcher prefers Freestyle when its key is set and
    // falls back to the self-hosted QuickJS sandbox otherwise. Operators can
    // pin via `CODE_RUNNER=<id>` for staging tests.
    const runner = selectRunner()
    logger.info(`[${requestId}] Executing via runner`, { runner: runner.id })

    let result: unknown
    try {
      const out = await runner.execute({
        code: resolvedCode,
        params: executionParams,
        envVars: safeEnvVars,
        timeoutMs: clampedTimeout,
        isCustomTool,
        requestId,
      })
      result = out.result
      stdout = out.stdout
    } catch (runnerError: any) {
      // Freestyle tags user-script throws so we still hit the normal 500 path
      // (with the script error message). Anything else is infra failure — log
      // loud, return a 503 to make it clear the request didn't run.
      if (runnerError?.__nowflowScriptError) {
        throw runnerError
      }
      logger.error(`[${requestId}] Runner failed`, {
        runner: runner.id,
        error: runnerError?.message,
        stack: runnerError?.stack,
      })
      return NextResponse.json(
        {
          error: 'Code execution unavailable',
          code: 'RUNNER_FAILED',
          runner: runner.id,
        },
        { status: 503 }
      )
    }

    const executionTime = Date.now() - startTime
    logger.info(`[${requestId}] Function executed successfully`, {
      runner: runner.id,
      executionTime,
    })

    return NextResponse.json({
      success: true,
      output: { result, stdout, executionTime },
    })
  } catch (error: any) {
    const executionTime = Date.now() - startTime
    logger.error(`[${requestId}] Function execution failed`, {
      error: error.message || 'Unknown error',
      stack: error.stack,
      executionTime,
    })

    const errorResponse = {
      success: false,
      error: error.message || 'Code execution failed',
      output: {
        result: null,
        stdout,
        executionTime,
      },
    }

    return NextResponse.json(errorResponse, { status: 500 })
  }
}
