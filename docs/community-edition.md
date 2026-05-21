# NowFlow Community Edition

NowFlow Community is the open-source edition of NowFlow. It is scoped for local
development, self-hosted community use, and bring-your-own-key automation.

## Included

- Visual workflow building in `apps/nowflow`
- PostgreSQL schema managed by Drizzle
- Community workflow blocks and integrations
- Bring-your-own-key AI provider configuration
- Local Ollama support
- QuickJS-based JavaScript execution
- First-run `/setup` flow for creating the initial owner account

## Enterprise Boundary

The community edition intentionally does not ship managed enterprise surfaces:

- Hosted deployment, custom domains, and marketplace publishing
- Managed tenant operations, governance, and audit workflows
- Meta-build and hosted UI generation services
- Managed web-search agents, browser automation, and advanced agent ops
- Managed infrastructure profiles
- Native mobile application projects
- Enterprise support workflows and sales data collection

UI surfaces that mention enterprise capabilities should either render a community
upgrade state or send users to `NEXT_PUBLIC_ENTERPRISE_URL`, which defaults to
`https://nowflow.io`.

## Secrets Policy

Do not commit real secrets, production URLs, staging URLs, tokens, private keys,
database dumps, or customer data. Use `.env.example` for variable names only and
keep local values in `.env`.

Before publishing a community release, run:

```bash
rg -n "(BEGIN (RSA|OPENSSH|PRIVATE)|api[_-]?key|client_secret|password|token|postgres://|postgresql://|redis://|mongodb://|s3://)" \
  --hidden \
  --glob '!**/node_modules/**' \
  --glob '!**/.next/**' \
  --glob '!**/.turbo/**' \
  --glob '!**/dist/**' \
  --glob '!package-lock.json'
```

Review matches manually because many legitimate examples and tests include
placeholder words such as `token` or `example.com`.

Also confirm release archives do not include generated caches or local-only
artifacts such as `node_modules`, `.next`, `.turbo`, `*.tsbuildinfo`, database
dumps, uploads, devcontainer files, Kubernetes manifests, or native mobile
build outputs.
