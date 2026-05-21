/**
 * Shared types for the pluggable code-execution layer.
 *
 * A `CodeRunner` is anything that can take a JS payload + sandbox-scoped
 * environment and return either a value or a stream of stdout, while
 * upholding a fixed set of safety invariants. The route handler does NOT
 * care which backend is running — it just calls `selectRunner().execute(...)`.
 *
 * Hard contract every runner MUST satisfy:
 *
 *   1. Host `process`, `process.env`, the Node `require`/`import` loader,
 *      Node `Buffer`, `fs`, and host `fetch` MUST NOT be reachable from
 *      user code. The only legitimate channels into the sandbox are the
 *      fields on `CodeRunRequest` (`params`, `envVars`).
 *   2. `timeoutMs` is a wall-clock bound the runner enforces itself —
 *      cooperative timeouts that depend on user code are NOT acceptable.
 *   3. Promise-returning user code is awaited before the runner resolves.
 *   4. Memory growth is bounded; runaway user code cannot OOM the host.
 *
 * Adding a new backend (Python, Docker, isolated-vm, etc.) is a single
 * file: implement `CodeRunner`, register it in `lib/code-execution/index.ts`.
 */

export interface CodeRunRequest {
  /** User-provided source code (post `{{var}}` resolution). */
  code: string
  /** Workflow params; how they're surfaced depends on `isCustomTool`. */
  params: Record<string, unknown>
  /** Workflow-scoped environment vars (NOT host `process.env`). */
  envVars: Record<string, string>
  /** Wall-clock budget. The runner aborts at this point. */
  timeoutMs: number
  /**
   * Custom-tool mode: each param is hoisted to a top-level `const`. Regular
   * Function-block mode: params are surfaced via a `params` global object.
   */
  isCustomTool: boolean
  /** Short request identifier for logging (caller's request ID). */
  requestId?: string
}

export interface CodeRunResult {
  /** Whatever the user code returned (must be JSON-serializable). */
  result: unknown
  /** Captured `console.*` output, newline-delimited. */
  stdout: string
}

export interface CodeRunner {
  /** Stable identifier for logs/metrics (kebab-case). */
  readonly id: string
  /** Human-readable name. */
  readonly name: string
  /** Short list of capabilities this runner provides, for observability. */
  readonly capabilities: {
    /** Can the runner `import`/`require` npm packages at execution time? */
    npmModules: boolean
    /** Does user code have access to network `fetch`? */
    fetch: boolean
  }
  /** Returns true if this runner can be selected in the current env. */
  isAvailable(): boolean
  /** Execute user code. Throws on infra failure OR user script throw. */
  execute(req: CodeRunRequest): Promise<CodeRunResult>
}
