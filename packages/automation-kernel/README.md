# @nowflow/automation-kernel

Interface-only kernel for the NowFlow automation executor.

## Status

**Phase 0 — interface/contract surface only.**

This package currently ships only the dependency-injection provider interfaces
(`StateProvider`, `ConsoleProvider`, `SecretProvider`, `HttpProvider`,
`ExecutionStateProvider`, `ClockProvider`, `LoggerProvider`,
`ExperimentProvider`) plus a generic `HandlerRegistry` and a `BlockHandler`
contract. Minimal in-memory provider implementations are included to enable
unit tests and parallel adapter development.

The actual executor (block execution engine, resolvers, path tracker, etc.)
has **not** been migrated yet. That migration is planned for Phase 1, at which
point this package will own the full executor runtime and consume adapters via
the `ExecutorDeps` aggregate defined here.

Do not import executor logic from this package yet — it does not exist here.
Adapters and consumers should be written against the interfaces in `src/di/`.

## Layout

- `src/di/*` — DI provider interfaces
- `src/di/in-memory/*` — minimal in-memory implementations (tests/dev)
- `src/handlers/*` — `BlockHandler` contract + `HandlerRegistry`
- `src/index.ts` — public barrel
