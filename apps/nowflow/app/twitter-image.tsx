import { ImageResponse } from 'next/og'

// Image metadata - Optimized for Twitter
export const alt = 'NowFlow Community — Workflows · Integrations · Human‑in‑the‑Loop · Data Tables'
export const size = {
  width: 1200,
  height: 600,
}

export const contentType = 'image/png'

// Image generation with 2026 modern design trends
export default async function Image() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'stretch',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        background: 'linear-gradient(135deg, #0b0f1a 0%, #0f172a 55%, #1e293b 100%)',
      }}
    >
      <div
        style={{
          padding: '56px 72px',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            width: '110px',
            height: '110px',
            borderRadius: '26px',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="72" height="72" viewBox="0 0 64 64" fill="none">
            <defs>
              <linearGradient id="tw-primary" x1="0" y1="0" x2="64" y2="64">
                <stop offset="0%" stopColor="#0f172a" />
                <stop offset="45%" stopColor="#0f766e" />
                <stop offset="100%" stopColor="#1e293b" />
              </linearGradient>
              <linearGradient id="tw-accent" x1="16" y1="16" x2="48" y2="48">
                <stop offset="0%" stopColor="#5eead4" />
                <stop offset="100%" stopColor="#38bdf8" />
              </linearGradient>
            </defs>
            <rect x="4" y="4" width="56" height="56" rx="16" fill="url(#tw-primary)" />
            <rect
              x="7"
              y="7"
              width="50"
              height="50"
              rx="14"
              stroke="rgba(255,255,255,0.18)"
              strokeWidth="1"
            />
            <path
              d="M20 44 V20 L44 44 V20"
              stroke="white"
              strokeWidth="3.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.95"
            />
            <path
              d="M20 44 V20 L44 44 V20"
              stroke="url(#tw-accent)"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.9"
            />
            <circle cx="20" cy="20" r="3.5" fill="white" opacity="0.95" />
            <circle cx="20" cy="20" r="1.8" fill="url(#tw-accent)" opacity="0.95" />
            <circle cx="44" cy="20" r="3.5" fill="white" opacity="0.95" />
            <circle cx="44" cy="20" r="1.8" fill="url(#tw-accent)" opacity="0.95" />
            <circle cx="44" cy="44" r="3.5" fill="white" opacity="0.95" />
            <circle cx="44" cy="44" r="1.8" fill="url(#tw-accent)" opacity="0.95" />
            <circle cx="20" cy="44" r="3.5" fill="white" opacity="0.95" />
            <circle cx="20" cy="44" r="1.8" fill="url(#tw-accent)" opacity="0.95" />
          </svg>
        </div>
      </div>

      <div
        style={{
          padding: '0 80px 56px 80px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            fontSize: '68px',
            fontWeight: 700,
            color: 'white',
            letterSpacing: '-0.04em',
          }}
        >
          NowFlow
        </div>
        <div
          style={{
            fontSize: '26px',
            color: 'rgba(255, 255, 255, 0.75)',
            marginTop: '10px',
          }}
        >
          Workflows · Integrations · Human‑in‑the‑Loop · Data Tables
        </div>
      </div>
    </div>,
    {
      ...size,
    }
  )
}
