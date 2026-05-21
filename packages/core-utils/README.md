Purpose

@nowflow/core-utils hosts the L1 primitives for the NowFlow monorepo. These are small, dependency-free utilities used across apps and packages (logging, error taxonomy, secret redaction, retry).

Scope

- L1 only. No business logic, no runtime dependencies.
- Stable API. Breaking changes require coordinated updates across all consumers.
- Safe for both server and edge runtimes.

Exports

- Logger / createLogger(module) — structured console logger.
- NowFlowError, BudgetExhaustedError, ValidationError, AuthError — canonical error classes with machine-readable codes.
- redactSecrets(obj, keys?) — deep redaction of sensitive fields.
- retry(fn, options) — exponential-backoff retry helper.
