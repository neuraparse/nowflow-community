import { ImageResponse } from 'next/og'

// Image metadata
export const size = {
  width: 32,
  height: 32,
}
export const contentType = 'image/png'

// Image generation
export default function Icon() {
  return new ImageResponse(
    <svg width="32" height="32" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="icon-primary" x1="0" y1="0" x2="64" y2="64">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="45%" stopColor="#0f766e" />
          <stop offset="100%" stopColor="#1e293b" />
        </linearGradient>
        <linearGradient id="icon-accent" x1="16" y1="16" x2="48" y2="48">
          <stop offset="0%" stopColor="#5eead4" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="56" height="56" rx="16" fill="url(#icon-primary)" />
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
        stroke="url(#icon-accent)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />
      <circle cx="20" cy="20" r="3.5" fill="white" opacity="0.95" />
      <circle cx="20" cy="20" r="1.8" fill="url(#icon-accent)" opacity="0.95" />
      <circle cx="44" cy="20" r="3.5" fill="white" opacity="0.95" />
      <circle cx="44" cy="20" r="1.8" fill="url(#icon-accent)" opacity="0.95" />
      <circle cx="44" cy="44" r="3.5" fill="white" opacity="0.95" />
      <circle cx="44" cy="44" r="1.8" fill="url(#icon-accent)" opacity="0.95" />
      <circle cx="20" cy="44" r="3.5" fill="white" opacity="0.95" />
      <circle cx="20" cy="44" r="1.8" fill="url(#icon-accent)" opacity="0.95" />
    </svg>,
    {
      ...size,
    }
  )
}
