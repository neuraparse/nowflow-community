import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Authentication | NowFlow Docs',
  description: 'Identity flows, sessions, and provider setup for NowFlow.',
}

const authPatterns = [
  {
    title: 'Email and OTP',
    description: 'Passwordless or OTP flows with recovery and verification steps.',
  },
  {
    title: 'Managed identity',
    description: 'Enterprise identity providers, claim mapping, and role sync are upgrade paths.',
  },
  {
    title: 'Social providers',
    description: 'Microsoft, Google, and custom OAuth provider integrations.',
  },
  {
    title: 'Service tokens',
    description: 'Machine-to-machine access for automation and integrations.',
  },
]

const sessionModel = [
  'Short-lived access tokens with refresh rotation.',
  'HTTP-only cookies for browser sessions.',
  'Server-side validation for privileged actions.',
  'Idle timeout and forced re-authentication controls.',
]

const providerChecklist = [
  'Register OAuth apps and set approved redirect URIs.',
  'Configure client IDs, secrets, and required scopes.',
  'Map provider access to workspace roles where supported.',
  'Test login, logout, and token refresh flows.',
]

const troubleshooting = [
  'Redirect URI mismatch or trailing slash errors.',
  'Clock skew causing early token expiration.',
  'Missing scopes or consent not granted.',
  'Blocked third-party cookies in embedded browsers.',
]

const securityBestPractices = [
  'Enable MFA for privileged roles.',
  'Limit token TTL for admin accounts.',
  'Rotate client secrets and revoke stale tokens.',
  'Monitor suspicious login attempts and device changes.',
]

export default function AuthenticationPage() {
  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-7 sm:p-9">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-300 dark:text-white/12 font-logo">
          Operations
        </p>
        <h1 className="mt-3 text-2xl sm:text-3xl font-logo font-light text-zinc-800 dark:text-white tracking-tight leading-[1.15]">
          <span className="font-serif italic text-[#4A7A68] dark:text-[#8CB09C]">
            Authentication
          </span>
        </h1>
        <p className="mt-3 text-[13px] text-zinc-400 dark:text-white/40 font-logo leading-relaxed">
          Configure identity flows, session handling, and provider integrations for secure access
          control.
        </p>
      </div>

      <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-7 sm:p-9">
        <h2 className="text-lg font-logo font-semibold text-zinc-800 dark:text-white tracking-tight">
          Supported auth patterns
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {authPatterns.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-5"
            >
              <h3 className="text-[14px] font-semibold text-zinc-800 dark:text-white font-logo">
                {item.title}
              </h3>
              <p className="mt-2 text-[13px] text-zinc-400 dark:text-white/40 font-logo leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-7 sm:p-9">
        <h2 className="text-lg font-logo font-semibold text-zinc-800 dark:text-white tracking-tight">
          Session model
        </h2>
        <div className="mt-4 grid gap-3 text-[13px] text-zinc-400 dark:text-white/40 font-logo leading-relaxed md:grid-cols-2">
          {sessionModel.map((item) => (
            <div
              key={item}
              className="rounded-xl border border-black/[0.04] dark:border-white/[0.04] bg-[#fafafa] dark:bg-white/[0.01] px-4 py-3"
            >
              {item}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-7 sm:p-9">
        <h2 className="text-lg font-logo font-semibold text-zinc-800 dark:text-white tracking-tight">
          Provider setup checklist
        </h2>
        <ol className="mt-4 grid gap-3 text-[13px] text-zinc-400 dark:text-white/40 font-logo leading-relaxed">
          {providerChecklist.map((item) => (
            <li
              key={item}
              className="rounded-xl border border-black/[0.04] dark:border-white/[0.04] bg-[#fafafa] dark:bg-white/[0.01] px-4 py-3"
            >
              {item}
            </li>
          ))}
        </ol>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-7 sm:p-9">
          <h2 className="text-lg font-logo font-semibold text-zinc-800 dark:text-white tracking-tight">
            Troubleshooting
          </h2>
          <ul className="mt-4 grid gap-3 text-[13px] text-zinc-400 dark:text-white/40 font-logo leading-relaxed">
            {troubleshooting.map((item) => (
              <li
                key={item}
                className="rounded-xl border border-black/[0.04] dark:border-white/[0.04] bg-[#fafafa] dark:bg-white/[0.01] px-4 py-3"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-7 sm:p-9">
          <h2 className="text-lg font-logo font-semibold text-zinc-800 dark:text-white tracking-tight">
            Security best practices
          </h2>
          <ul className="mt-4 grid gap-3 text-[13px] text-zinc-400 dark:text-white/40 font-logo leading-relaxed">
            {securityBestPractices.map((item) => (
              <li
                key={item}
                className="rounded-xl border border-black/[0.04] dark:border-white/[0.04] bg-[#fafafa] dark:bg-white/[0.01] px-4 py-3"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
