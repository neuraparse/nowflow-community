/**
 * Self-hosted code execution sandbox backed by QuickJS compiled to WebAssembly.
 *
 * Implements the `CodeRunner` contract for the Community runtime. QuickJS is a
 * separate JS engine, so user code runs in an isolate with NO access to host
 * Node.js (no `require`, no `process`, no `fs`, no host `fetch`). The escape
 * vectors that ruled out the built-in `vm` module do not apply here: there is
 * no shared V8 isolate to climb out of.
 *
 * Runtime limits:
 *   - no npm modules can be imported
 *   - no network access is provided
 *   - lower throughput than V8
 */
import { getQuickJS, type QuickJSContext, type QuickJSHandle } from 'quickjs-emscripten'
import { createLogger } from '@/lib/logs/console-logger'
import type { CodeRunner, CodeRunRequest, CodeRunResult } from './types'

const logger = createLogger('QuickJSRunner')

const DEFAULT_MEMORY_LIMIT_BYTES = 64 * 1024 * 1024 // 64 MB
const DEFAULT_STACK_SIZE_BYTES = 1 * 1024 * 1024 // 1 MB

/**
 * Rejects code that tries to bring in external modules. The sandbox has no
 * module loader by design — failing fast here gives a clearer error than the
 * runtime SyntaxError users would otherwise see.
 */
function rejectModuleImports(code: string): void {
  const importRe = /(^|\s)(import|export)\s+/m
  const requireRe = /(^|\s|=|\()require\s*\(/m
  if (importRe.test(code) || requireRe.test(code)) {
    // Tag the error so the route handler surfaces it as a 500 with the user
    // message (a user-code limitation), not as a 503 RUNNER_FAILED (an infra
    // problem the user can't fix).
    const err = new Error(
      "The Community sandbox doesn't support npm imports. Enterprise code runtime adds " +
        'hosted sandboxes with npm modules and outbound fetch.'
    ) as Error & { __nowflowScriptError?: boolean }
    err.__nowflowScriptError = true
    throw err
  }
}

/** Push a JS value across the host/QuickJS boundary as an immutable copy. */
function marshalToContext(ctx: QuickJSContext, value: unknown): QuickJSHandle {
  if (value === null) return ctx.null
  if (value === undefined) return ctx.undefined
  if (typeof value === 'string') return ctx.newString(value)
  if (typeof value === 'number') return ctx.newNumber(value)
  if (typeof value === 'boolean') return value ? ctx.true : ctx.false
  // Fall back to JSON round-trip for objects/arrays — works for any
  // JSON-serializable payload, which is what workflow params already are.
  const json = JSON.stringify(value)
  const handle = ctx.newString(json)
  const parsed = ctx.unwrapResult(
    ctx.callFunction(ctx.unwrapResult(ctx.evalCode('JSON.parse')), ctx.undefined, handle)
  )
  handle.dispose()
  return parsed
}

/**
 * Executes user JS inside an isolated QuickJS context.
 *
 * Hardening invariants enforced here:
 *   1. Wall-clock timeout via interrupt handler (cannot be disabled by user code)
 *   2. Memory limit via runtime configuration
 *   3. No `process`, `require`, `import`, Node `Buffer` or host `fetch`
 *   4. Workflow envVars are surfaced via a sandbox-scoped `env` global —
 *      NOT via `process.env`, so the existing `{{VAR}}` resolver is the only
 *      legitimate way for templates to access workflow variables.
 */
async function runInQuickJS(opts: CodeRunRequest): Promise<CodeRunResult> {
  rejectModuleImports(opts.code)

  const QuickJS = await getQuickJS()
  const runtime = QuickJS.newRuntime()
  runtime.setMemoryLimit(DEFAULT_MEMORY_LIMIT_BYTES)
  runtime.setMaxStackSize(DEFAULT_STACK_SIZE_BYTES)

  const deadline = Date.now() + opts.timeoutMs
  runtime.setInterruptHandler(() => Date.now() > deadline)

  const ctx = runtime.newContext()
  let stdout = ''

  try {
    // ----- Inject `console` (logs go to our captured `stdout` string) -----
    const consoleObj = ctx.newObject()
    const makeLogger = (prefix: string) =>
      ctx.newFunction(prefix || 'log', (...args: QuickJSHandle[]) => {
        const line = args
          .map((handle) => {
            const dumped = ctx.dump(handle)
            handle.dispose()
            return typeof dumped === 'string' ? dumped : JSON.stringify(dumped)
          })
          .join(' ')
        stdout += (prefix ? `${prefix.toUpperCase()}: ` : '') + line + '\n'
        return ctx.undefined
      })
    const logFn = makeLogger('')
    const errFn = makeLogger('error')
    const warnFn = makeLogger('warn')
    const infoFn = makeLogger('')
    ctx.setProp(consoleObj, 'log', logFn)
    ctx.setProp(consoleObj, 'error', errFn)
    ctx.setProp(consoleObj, 'warn', warnFn)
    ctx.setProp(consoleObj, 'info', infoFn)
    ctx.setProp(ctx.global, 'console', consoleObj)
    logFn.dispose()
    errFn.dispose()
    warnFn.dispose()
    infoFn.dispose()
    consoleObj.dispose()

    // ----- Inject workflow env (sandbox-scoped, NOT host process.env) -----
    const envObj = ctx.newObject()
    for (const [k, v] of Object.entries(opts.envVars)) {
      const valHandle = ctx.newString(String(v))
      ctx.setProp(envObj, k, valHandle)
      valHandle.dispose()
    }
    ctx.setProp(ctx.global, 'env', envObj)
    envObj.dispose()

    // ----- Build the user-facing wrapper -----
    let wrappedCode: string
    if (opts.isCustomTool) {
      // Custom tools get each param as a top-level `const` for ergonomic access.
      const paramDecls = Object.entries(opts.params)
        .map(([k, v]) => `const ${JSON.stringify(k).slice(1, -1)} = ${JSON.stringify(v)};`)
        .join('\n')
      wrappedCode = `(async () => {\n${paramDecls}\n${opts.code}\n})()`
    } else {
      // Regular Function block: inject `params` as a single global object.
      const paramsHandle = marshalToContext(ctx, opts.params)
      ctx.setProp(ctx.global, 'params', paramsHandle)
      paramsHandle.dispose()
      wrappedCode = `(async () => {\n${opts.code}\n})()`
    }

    // ----- Execute -----
    // `unwrapResult` returns the success handle or throws an Error built from
    // the failure handle — wrap with our own translation to keep messages tidy.
    const unwrap = (r: ReturnType<typeof ctx.evalCode>) => {
      if ('error' in r && r.error) {
        const err = ctx.dump(r.error)
        r.error.dispose()
        throw new Error(typeof err === 'string' ? err : err?.message || JSON.stringify(err))
      }
      return (r as { value: QuickJSHandle }).value
    }

    const evalHandle = unwrap(ctx.evalCode(wrappedCode))

    // The wrapper returns a Promise — pump the QuickJS event loop until settled.
    const promiseState = ctx.resolvePromise(evalHandle)
    evalHandle.dispose()
    runtime.executePendingJobs(10_000)
    const settled = await promiseState
    const valueHandle = unwrap(settled)
    const result = ctx.dump(valueHandle)
    valueHandle.dispose()

    return { result, stdout }
  } catch (error) {
    // Interrupt-handler abort surfaces as "interrupted" — translate it.
    const msg = error instanceof Error ? error.message : String(error)
    if (Date.now() > deadline) {
      throw new Error(`Execution timed out after ${opts.timeoutMs}ms`)
    }
    throw new Error(msg)
  } finally {
    try {
      ctx.dispose()
    } catch (e) {
      logger.debug('QuickJSContext dispose failed', { error: (e as Error).message })
    }
    try {
      runtime.dispose()
    } catch (e) {
      logger.debug('QuickJSRuntime dispose failed', { error: (e as Error).message })
    }
  }
}

/**
 * Public `CodeRunner` implementation. The dispatcher in `index.ts` resolves
 * this object — there is no need to call `runInQuickJS` directly from app code.
 */
export const quickjsRunner: CodeRunner = {
  id: 'quickjs',
  name: 'QuickJS (WASM, self-hosted)',
  capabilities: {
    npmModules: false,
    fetch: false,
  },
  // QuickJS-emscripten ships its own WASM bundle, so the runner is always
  // available wherever the package is installed. We could gate on Node version
  // or memory pressure here in the future; for now, "available everywhere"
  // matches reality.
  isAvailable: () => true,
  execute: runInQuickJS,
}
