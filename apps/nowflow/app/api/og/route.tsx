import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('OGImageAPI')

export const runtime = 'nodejs'

// Dynamic OG Image Generator for sharing workflows, webhooks, etc.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Get parameters
    const type = searchParams.get('type') || 'default'
    const title = searchParams.get('title') || 'NowFlow'
    const description =
      searchParams.get('description') || 'AI-powered workflow automation for any surface'
    const icon = searchParams.get('icon') || '🚀'
    const stats = searchParams.get('stats') || ''

    return new ImageResponse(
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          overflow: 'hidden',
        }}
      >
        {/* Modern gradient background with depth */}
        <div
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            background: 'linear-gradient(135deg, #0b0f1a 0%, #0f172a 55%, #1e293b 100%)',
          }}
        />

        {/* Ambient gradient orbs for depth */}
        <div
          style={{
            position: 'absolute',
            width: '600px',
            height: '600px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(94, 234, 212, 0.35) 0%, transparent 70%)',
            top: '-200px',
            left: '-100px',
            filter: 'blur(80px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: '500px',
            height: '500px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(56, 189, 248, 0.25) 0%, transparent 70%)',
            bottom: '-150px',
            right: '-100px',
            filter: 'blur(80px)',
          }}
        />

        {/* Main content container */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '60px 80px',
          }}
        >
          {/* Top section - Logo and brand */}
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '24px' }}>
            {/* Glassmorphic logo container */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100px',
                height: '100px',
                borderRadius: '24px',
                background: 'rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.18)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
              }}
            >
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                <defs>
                  <linearGradient id="og-api-primary" x1="0" y1="0" x2="64" y2="64">
                    <stop offset="0%" stopColor="#0f172a" />
                    <stop offset="45%" stopColor="#0f766e" />
                    <stop offset="100%" stopColor="#1e293b" />
                  </linearGradient>
                  <linearGradient id="og-api-accent" x1="16" y1="16" x2="48" y2="48">
                    <stop offset="0%" stopColor="#5eead4" />
                    <stop offset="100%" stopColor="#38bdf8" />
                  </linearGradient>
                </defs>
                <rect x="4" y="4" width="56" height="56" rx="16" fill="url(#og-api-primary)" />
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
                  stroke="url(#og-api-accent)"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.9"
                />
                <circle cx="20" cy="20" r="3.5" fill="white" opacity="0.95" />
                <circle cx="20" cy="20" r="1.8" fill="url(#og-api-accent)" opacity="0.95" />
                <circle cx="44" cy="20" r="3.5" fill="white" opacity="0.95" />
                <circle cx="44" cy="20" r="1.8" fill="url(#og-api-accent)" opacity="0.95" />
                <circle cx="44" cy="44" r="3.5" fill="white" opacity="0.95" />
                <circle cx="44" cy="44" r="1.8" fill="url(#og-api-accent)" opacity="0.95" />
                <circle cx="20" cy="44" r="3.5" fill="white" opacity="0.95" />
                <circle cx="20" cy="44" r="1.8" fill="url(#og-api-accent)" opacity="0.95" />
              </svg>
            </div>

            {/* Brand name */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div
                style={{
                  fontSize: '48px',
                  fontWeight: 800,
                  color: 'white',
                  letterSpacing: '-0.03em',
                  lineHeight: 1,
                }}
              >
                NowFlow
              </div>
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: 500,
                  color: 'rgba(255, 255, 255, 0.7)',
                  letterSpacing: '0.05em',
                }}
              >
                by NowFlow
              </div>
            </div>
          </div>

          {/* Middle section - Dynamic content */}
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '-40px' }}
          >
            {/* Icon and Type Badge */}
            <div
              style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '16px' }}
            >
              <div
                style={{
                  fontSize: '48px',
                  display: 'flex',
                  flexDirection: 'row',
                }}
              >
                {icon}
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: '8px 20px',
                  borderRadius: '12px',
                  background: 'rgba(99, 102, 241, 0.2)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  fontSize: '20px',
                  fontWeight: 600,
                  color: '#a5b4fc',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}
              >
                {type}
              </div>
            </div>

            {/* Title */}
            <div
              style={{
                fontSize: '64px',
                fontWeight: 900,
                color: 'white',
                letterSpacing: '-0.04em',
                lineHeight: 1.1,
                maxWidth: '900px',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {title}
            </div>

            {/* Description */}
            <div
              style={{
                fontSize: '24px',
                fontWeight: 500,
                color: 'rgba(255, 255, 255, 0.8)',
                letterSpacing: '-0.01em',
                lineHeight: 1.4,
                maxWidth: '800px',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {description}
            </div>
          </div>

          {/* Bottom section - Stats or Features */}
          <div style={{ display: 'flex', flexDirection: 'row', gap: '16px', flexWrap: 'wrap' }}>
            {stats ? (
              stats.split('|').map((stat) => (
                <div
                  key={stat}
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: '12px 24px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    fontSize: '20px',
                    fontWeight: 600,
                    color: 'white',
                  }}
                >
                  {stat.trim()}
                </div>
              ))
            ) : (
              <>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: '12px 24px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    fontSize: '20px',
                    fontWeight: 600,
                    color: 'white',
                  }}
                >
                  🎤 Voice Commands
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: '12px 24px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    fontSize: '20px',
                    fontWeight: 600,
                    color: 'white',
                  }}
                >
                  🤖 AI Agents
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: '12px 24px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    fontSize: '20px',
                    fontWeight: 600,
                    color: 'white',
                  }}
                >
                  🔗 Extensible Integrations
                </div>
              </>
            )}
          </div>
        </div>
      </div>,
      {
        width: 1200,
        height: 630,
      }
    )
  } catch (e: unknown) {
    logger.error('Error generating OG image:', e)
    return new Response(`Failed to generate image`, {
      status: 500,
    })
  }
}
