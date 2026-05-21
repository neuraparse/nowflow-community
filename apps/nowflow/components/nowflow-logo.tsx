import { type SVGProps } from 'react'
import { NowFlowLogoMark } from '@/components/branding/nowflow-logo-mark'

export function NowFlowLogo(props: SVGProps<SVGSVGElement>) {
  return <NowFlowLogoMark {...props} />
}

export function NowFlowTextLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      viewBox="0 0 120 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient
          id="nowflow-text-gradient"
          x1="44"
          y1="6"
          x2="120"
          y2="20"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#5B7B6F" />
          <stop offset="55%" stopColor="#4A7A68" />
          <stop offset="100%" stopColor="#7FA696" />
        </linearGradient>
      </defs>
      <text
        x="0"
        y="17"
        fill="currentColor"
        fontFamily="var(--font-logo, system-ui)"
        fontSize="18"
        fontWeight="500"
        letterSpacing="-0.03em"
      >
        Now
      </text>
      <text
        x="39"
        y="17"
        fill="url(#nowflow-text-gradient)"
        fontFamily="var(--font-logo, system-ui)"
        fontSize="18"
        fontWeight="500"
        letterSpacing="-0.03em"
      >
        Flow
      </text>
    </svg>
  )
}
