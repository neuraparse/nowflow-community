import * as React from 'react'

type NowFlowLogoMarkProps = React.SVGProps<SVGSVGElement> & {
  idPrefix?: string
}

export const NowFlowLogoMark = React.forwardRef<SVGSVGElement, NowFlowLogoMarkProps>(
  ({ idPrefix = 'nowflow', ...props }, ref) => {
    const primaryGradientId = `${idPrefix}-primaryGradient`
    const accentGradientId = `${idPrefix}-accentGradient`
    const glowId = `${idPrefix}-glow`

    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 64 64"
        fill="none"
        role="img"
        aria-hidden="true"
        focusable="false"
        {...props}
      >
        <defs>
          <linearGradient
            id={primaryGradientId}
            x1="0"
            y1="0"
            x2="64"
            y2="64"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="45%" stopColor="#0f766e" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>

          <linearGradient
            id={accentGradientId}
            x1="16"
            y1="16"
            x2="48"
            y2="48"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#5eead4" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>

          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feComposite in="blur" in2="SourceGraphic" operator="over" />
          </filter>
        </defs>

        <rect x="4" y="4" width="56" height="56" rx="16" fill={`url(#${primaryGradientId})`} />

        <rect
          x="7"
          y="7"
          width="50"
          height="50"
          rx="14"
          stroke="rgba(255, 255, 255, 0.18)"
          strokeWidth="1"
          fill="none"
        />

        <g filter={`url(#${glowId})`}>
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
            stroke={`url(#${accentGradientId})`}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.9"
          />
        </g>

        <g>
          <circle cx="20" cy="20" r="3.5" fill="white" opacity="0.95" />
          <circle cx="20" cy="20" r="1.8" fill={`url(#${accentGradientId})`} opacity="0.95" />
          <circle cx="44" cy="20" r="3.5" fill="white" opacity="0.95" />
          <circle cx="44" cy="20" r="1.8" fill={`url(#${accentGradientId})`} opacity="0.95" />
          <circle cx="44" cy="44" r="3.5" fill="white" opacity="0.95" />
          <circle cx="44" cy="44" r="1.8" fill={`url(#${accentGradientId})`} opacity="0.95" />
          <circle cx="20" cy="44" r="3.5" fill="white" opacity="0.95" />
          <circle cx="20" cy="44" r="1.8" fill={`url(#${accentGradientId})`} opacity="0.95" />
        </g>
      </svg>
    )
  }
)
NowFlowLogoMark.displayName = 'NowFlowLogoMark'
