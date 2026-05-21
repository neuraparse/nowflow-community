# Contributing to NowFlow

Thanks for your interest in contributing! This guide covers the basics of getting set up, the expected pull-request flow, and our code-quality conventions.

## Setup

```bash
# 1. Install dependencies (uses npm workspaces)
npm install

# 2. Push the database schema (requires DATABASE_URL in .env)
cd apps/nowflow && npm run db:push

# 3. Seed default plans (optional but recommended)
cd apps/nowflow && npm run db:seed

# 4. Start the dev server
npm run dev          # main web app on :3000

# 5. Run the test suite
cd apps/nowflow && npm test
```

The main app lives in `apps/nowflow/`, and shared code lives in `packages/`.

## Pull Request Checklist

Before opening a PR, please run all four locally:

- [ ] `cd apps/nowflow && npm test` — Vitest passes
- [ ] `npm run format` — Prettier applied across the repo
- [ ] `npm run check-types` — Turbo type-check across all workspaces
- [ ] `npm run lint` — ESLint clean

CI runs the same checks plus `format:check` and a strict-TypeScript subset (`tsconfig.strict.json`). PRs that fail CI will not be merged.

## Commit Message Format

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>

[optional body]

[optional footer]
```

Common types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `build`, `ci`.

Examples:

- `feat(blocks): add http-poll block`
- `fix(auth): correct OAuth redirect for self-hosted setup`
- `chore(ci): add weekly security scan`

## Strict TypeScript Ratchet

We are gradually rolling out strict TypeScript. New or refactored modules should be added to the `include` array in `apps/nowflow/tsconfig.strict.json`. The `typecheck-strict` CI job enforces `--strict` over that subset; once a file is in, it cannot regress. Aim to expand the strict surface with each PR rather than disable individual rules.

## Questions?

Open an issue or start a discussion. Welcome aboard!
