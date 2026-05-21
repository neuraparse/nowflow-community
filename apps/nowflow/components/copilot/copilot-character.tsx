'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type { CopilotMood } from './copilot-types'

/**
 * Prefix every gradient/pattern id with a per-instance token so two Copilots
 * on the same page (e.g. the FAB and the panel header during open/close
 * crossfade) don't collide in the global SVG id namespace — the symptom of
 * that bug is one instance picking up the other's gradients and rendering
 * as a completely different-looking mascot.
 */
const GRADIENT_IDS = [
  'armFill',
  'armGlossFill',
  'bodyShellFill',
  'bodyCoreFill',
  'bodyBaseFill',
  'collarFill',
  'accentFill',
  'earShellFill',
  'earInnerFill',
  'headShellFill',
  'headLeftShadeFill',
  'headRightShadeFill',
  'muzzleFill',
  'socketFill',
  'eyeGlowFill',
  'noseFill',
  'bodyRimFill',
] as const

const CYCLING_MOODS: CopilotMood[] = [
  'idle',
  'happy',
  'curious',
  'excited',
  'thinking',
  'playful',
  'love',
  'proud',
  'confident',
  'wink',
]

const MOUTH_BY_MOOD: Record<string, string> = {
  idle: 'M10.24 13.78Q12 14.08 13.76 13.78',
  happy: 'M10.08 13.62Q12 14.44 13.92 13.62',
  excited: 'M9.94 13.52Q12 14.72 14.06 13.52',
  curious: 'M10.28 13.82Q12 14.04 13.72 13.7',
  thinking: 'M10.42 13.92Q12 13.78 13.58 13.92',
  playful: 'M10.04 13.62Q11.06 14.28 12 13.94Q12.94 14.28 13.96 13.62',
  love: 'M10.04 13.6Q12 14.58 13.96 13.6',
  proud: 'M10.14 13.58Q12 14.24 13.86 13.58',
  confident: 'M10.18 13.56Q12 14.1 13.82 13.56',
  wink: 'M10.24 13.74Q11.74 13.42 13.76 13.86',
}

const BROW_BY_MOOD: Record<string, { left: string; right: string }> = {
  idle: {
    left: 'M7.6 8.65Q8.85 7.95 10.15 8.45',
    right: 'M13.85 8.45Q15.15 7.95 16.4 8.65',
  },
  happy: {
    left: 'M7.55 8.4Q8.95 7.35 10.25 8.1',
    right: 'M13.75 8.1Q15.05 7.35 16.45 8.4',
  },
  excited: {
    left: 'M7.45 8.15Q8.95 6.95 10.35 7.8',
    right: 'M13.65 7.8Q15.05 6.95 16.55 8.15',
  },
  curious: {
    left: 'M7.55 8.55Q8.9 7.8 10.2 8.4',
    right: 'M13.8 8.3Q15.05 7.45 16.45 8.05',
  },
  thinking: {
    left: 'M7.65 8.7Q8.95 8.1 10.2 8.4',
    right: 'M13.8 8.15Q15.05 7.45 16.35 7.9',
  },
  playful: {
    left: 'M7.5 8.25Q8.95 7.2 10.25 8.05',
    right: 'M13.75 8.05Q15.05 7.2 16.5 8.25',
  },
  love: {
    left: 'M7.55 8.3Q8.9 7.35 10.2 7.95',
    right: 'M13.8 7.95Q15.1 7.35 16.45 8.3',
  },
  proud: {
    left: 'M7.6 8.35Q8.95 7.45 10.25 8.1',
    right: 'M13.75 8.1Q15.05 7.45 16.4 8.35',
  },
  confident: {
    left: 'M7.65 8.25Q8.95 7.45 10.25 8',
    right: 'M13.75 8Q15.05 7.45 16.35 8.25',
  },
  wink: {
    left: 'M7.55 8.35Q8.95 7.35 10.25 8.05',
    right: 'M13.8 8.1Q15.1 7.45 16.45 8.25',
  },
}

const EYE_SCALE_BY_MOOD: Record<string, number> = {
  idle: 1,
  happy: 1.02,
  excited: 1.06,
  curious: 1.01,
  thinking: 0.96,
  playful: 1.04,
  love: 1.05,
  proud: 1,
  confident: 0.98,
  wink: 1,
}

function useBlink(interactive: boolean) {
  const [isBlinking, setIsBlinking] = useState(false)

  useEffect(() => {
    if (!interactive) return
    let timeout: ReturnType<typeof setTimeout>
    let unmounted = false

    const schedule = () => {
      timeout = setTimeout(
        () => {
          if (unmounted) return
          const doubleBlink = Math.random() < 0.28
          setIsBlinking(true)
          setTimeout(() => {
            setIsBlinking(false)
            if (doubleBlink) {
              setTimeout(() => {
                setIsBlinking(true)
                setTimeout(() => {
                  setIsBlinking(false)
                  schedule()
                }, 90)
              }, 110)
            } else {
              schedule()
            }
          }, 110)
        },
        2200 + Math.random() * 2200
      )
    }

    schedule()
    return () => {
      unmounted = true
      clearTimeout(timeout)
    }
  }, [interactive])

  return isBlinking
}

export function CopilotCharacter({
  size = 32,
  className = '',
  interactive = false,
  mood: externalMood,
  animate: shouldAnimate = false,
}: {
  size?: number
  className?: string
  interactive?: boolean
  mood?: CopilotMood
  animate?: boolean
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [internalMood, setInternalMood] = useState<CopilotMood>('happy')
  const [pupilOffset, setPupilOffset] = useState({ x: 0, y: 0 })
  const isBlinking = useBlink(interactive)
  const mood = externalMood || internalMood

  // React's useId generates a stable, hydration-safe unique suffix per
  // component instance. We derive each gradient's actual id+url() from it,
  // so `url(#armFill)` becomes e.g. `url(#armFill_:r12:)` and never collides.
  const uid = useId()
  const gid = useMemo(() => {
    const map: Record<string, string> = {}
    for (const name of GRADIENT_IDS) map[name] = `${name}${uid}`
    return map
  }, [uid])
  const url = (name: (typeof GRADIENT_IDS)[number]) => `url(#${gid[name]})`

  useEffect(() => {
    if (!interactive || externalMood) return
    const id = setInterval(() => {
      setInternalMood(CYCLING_MOODS[Math.floor(Math.random() * CYCLING_MOODS.length)])
    }, 3200)
    return () => clearInterval(id)
  }, [externalMood, interactive])

  useEffect(() => {
    if (!interactive) return

    const handleMouseMove = (event: MouseEvent) => {
      if (!svgRef.current) return
      const rect = svgRef.current.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const dx = (event.clientX - cx) / rect.width
      const dy = (event.clientY - cy) / rect.height
      setPupilOffset({
        x: Math.max(-0.45, Math.min(0.45, dx * 3.2)),
        y: Math.max(-0.3, Math.min(0.3, dy * 2.4)),
      })
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [interactive])

  const mouth = MOUTH_BY_MOOD[mood] ?? MOUTH_BY_MOOD.idle
  const brows = BROW_BY_MOOD[mood] ?? BROW_BY_MOOD.idle
  const eyeScale = EYE_SCALE_BY_MOOD[mood] ?? 1
  const px = interactive ? pupilOffset.x : 0
  const py = interactive ? pupilOffset.y : 0
  const leftEyeX = 9.62 + px * 0.12
  const rightEyeX = 14.38 + px * 0.12
  const eyeCenterY = 9.42 + py * 0.08
  const eyeSocketRadius = 1.66 * eyeScale
  const eyeGlowRadius = 0.82 * eyeScale
  const eyeAuraRadius = 1.02 * eyeScale

  const bodyAnim = useMemo(() => {
    if (shouldAnimate) {
      return { y: [0, -1.2, 0], rotate: [0, -3, 3, 0], scale: [1, 1.02, 1] }
    }
    if (!interactive) return undefined
    return { y: [0, -0.45, 0], rotate: [0, -1.5, 1.5, 0] }
  }, [interactive, shouldAnimate])

  const bodyTransition = useMemo(() => {
    if (!bodyAnim) return undefined
    return { duration: shouldAnimate ? 1.4 : 2.8, repeat: Infinity, ease: 'easeInOut' as const }
  }, [bodyAnim, shouldAnimate])

  return (
    <motion.div
      className={`inline-flex ${className}`}
      animate={bodyAnim as any}
      transition={bodyTransition as any}
      style={{ width: size, height: size }}
    >
      <svg ref={svgRef} width={size} height={size} viewBox="0 0 24 24" fill="none">
        <g transform="translate(12 12) scale(1.18) translate(-12 -12)">
          <circle cx="12" cy="10.9" r="9.2" fill="#C8EFFF" fillOpacity="0.12" />
          <circle cx="12" cy="10.9" r="7.4" fill="#F7FCFF" fillOpacity="0.08" />
          <ellipse cx="12" cy="21.08" rx="5.3" ry="0.88" fill="#081128" fillOpacity="0.16" />

          <path
            d="M6.92 14.42C7.2 13.46 7.98 12.74 9.08 12.48L9.44 20.72H6.96C6.3 18.54 6.28 16.3 6.92 14.42Z"
            fill={url('armFill')}
          />
          <path
            d="M17.08 14.42C16.8 13.46 16.02 12.74 14.92 12.48L14.56 20.72H17.04C17.7 18.54 17.72 16.3 17.08 14.42Z"
            fill={url('armFill')}
          />
          <path
            d="M8.42 14.12C8.42 12.88 9.42 11.88 10.66 11.88H13.34C14.58 11.88 15.58 12.88 15.58 14.12V20.72H8.42V14.12Z"
            fill={url('bodyShellFill')}
          />
          <path
            d="M9.04 13.38C9.72 12.9 10.72 12.62 12 12.62C13.28 12.62 14.28 12.9 14.96 13.38V20.72H9.04V13.38Z"
            fill={url('bodyCoreFill')}
          />
          <path
            d="M9.78 20.72C10.34 19.92 11.1 19.5 12 19.5C12.9 19.5 13.66 19.92 14.22 20.72H9.78Z"
            fill={url('bodyBaseFill')}
          />
          <ellipse cx="12" cy="13.18" rx="2.7" ry="0.48" fill={url('collarFill')} />
          <ellipse cx="12" cy="13.2" rx="2.1" ry="0.2" fill="#7AD6FF" fillOpacity="0.58" />
          <path
            d="M16.14 17.2H17.06C17.36 17.2 17.6 17.44 17.6 17.74V18.28C17.6 18.58 17.36 18.82 17.06 18.82H16.14V17.2Z"
            fill={url('accentFill')}
          />

          <circle cx="7.22" cy="4.88" r="1.44" fill={url('earShellFill')} />
          <circle cx="16.78" cy="4.88" r="1.44" fill={url('earShellFill')} />
          <circle cx="7.28" cy="4.96" r="0.84" fill={url('earInnerFill')} />
          <circle cx="16.72" cy="4.96" r="0.84" fill={url('earInnerFill')} />

          <path
            d="M5.66 9.2C5.66 5.48 8.5 2.92 12 2.92C15.5 2.92 18.34 5.48 18.34 9.2V10.12C18.34 13.94 15.46 16.86 12 16.86C8.54 16.86 5.66 13.94 5.66 10.12V9.2Z"
            fill={url('headShellFill')}
          />
          <path
            d="M7.52 3.72C8.48 3.2 9.54 2.92 10.72 2.92C9.34 3.8 8.42 5.44 8.18 7.96C7.92 10.66 8.3 13.6 9.02 16.08C7.02 15.24 5.66 13.16 5.66 10.12V9.2C5.66 6.98 6.34 5.1 7.52 3.72Z"
            fill={url('headLeftShadeFill')}
          />
          <path
            d="M18.34 9.2C18.34 6.98 17.66 5.1 16.48 3.72C15.52 3.2 14.46 2.92 13.28 2.92C14.66 3.8 15.58 5.44 15.82 7.96C16.08 10.66 15.7 13.6 14.98 16.08C16.98 15.24 18.34 13.16 18.34 10.12V9.2Z"
            fill={url('headRightShadeFill')}
          />
          <path
            d="M7.16 12.92C7.66 14.72 9.42 15.88 12 15.88C14.58 15.88 16.34 14.72 16.84 12.92C15.86 13.68 14.28 14.14 12 14.14C9.72 14.14 8.14 13.68 7.16 12.92Z"
            fill={url('muzzleFill')}
          />
          <circle cx="9.52" cy="9.28" r={eyeSocketRadius} fill={url('socketFill')} />
          <circle cx="14.48" cy="9.28" r={eyeSocketRadius} fill={url('socketFill')} />
          <circle cx="8.8" cy="7.28" r="0.16" fill="#F4D5FF" fillOpacity="0.36" />
          <circle cx="15.2" cy="7.28" r="0.16" fill="#F4D5FF" fillOpacity="0.36" />
          <path
            d={brows.left}
            stroke="#D9F7FF"
            strokeWidth="0.26"
            strokeLinecap="round"
            fill="none"
            opacity="0.7"
          />
          <path
            d={brows.right}
            stroke="#D9F7FF"
            strokeWidth="0.26"
            strokeLinecap="round"
            fill="none"
            opacity="0.7"
          />

          {isBlinking ? (
            <>
              <path
                d="M8.34 9.44Q9.58 8.86 10.78 9.44"
                stroke="#D9F7FF"
                strokeWidth="0.42"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M13.22 9.44Q14.42 8.86 15.66 9.44"
                stroke="#D9F7FF"
                strokeWidth="0.42"
                strokeLinecap="round"
                fill="none"
              />
            </>
          ) : mood === 'wink' ? (
            <>
              <circle
                cx={leftEyeX}
                cy={eyeCenterY}
                r={eyeAuraRadius}
                fill="#69D6FF"
                fillOpacity="0.18"
              />
              <circle cx={leftEyeX} cy={eyeCenterY} r={eyeGlowRadius} fill={url('eyeGlowFill')} />
              <circle
                cx={leftEyeX - 0.22 + px * 0.04}
                cy={eyeCenterY - 0.34 + py * 0.04}
                r="0.16"
                fill="#FFFFFF"
                fillOpacity="0.96"
              />
              <path
                d="M13.26 9.46Q14.44 8.9 15.58 9.46"
                stroke="#D9F7FF"
                strokeWidth="0.42"
                strokeLinecap="round"
                fill="none"
              />
            </>
          ) : (
            <>
              <circle
                cx={leftEyeX}
                cy={eyeCenterY}
                r={eyeAuraRadius}
                fill="#69D6FF"
                fillOpacity="0.18"
              />
              <circle
                cx={rightEyeX}
                cy={eyeCenterY}
                r={eyeAuraRadius}
                fill="#69D6FF"
                fillOpacity="0.18"
              />
              <circle cx={leftEyeX} cy={eyeCenterY} r={eyeGlowRadius} fill={url('eyeGlowFill')} />
              <circle cx={rightEyeX} cy={eyeCenterY} r={eyeGlowRadius} fill={url('eyeGlowFill')} />
              <circle
                cx={leftEyeX - 0.22 + px * 0.04}
                cy={eyeCenterY - 0.34 + py * 0.04}
                r="0.16"
                fill="#FFFFFF"
                fillOpacity="0.96"
              />
              <circle
                cx={rightEyeX - 0.22 + px * 0.04}
                cy={eyeCenterY - 0.34 + py * 0.04}
                r="0.16"
                fill="#FFFFFF"
                fillOpacity="0.96"
              />
            </>
          )}

          <ellipse cx="12" cy="11.76" rx="0.64" ry="0.42" fill={url('noseFill')} />
          <ellipse cx="12.16" cy="11.58" rx="0.18" ry="0.1" fill="#FFFFFF" fillOpacity="0.92" />
          <path
            d={mouth}
            stroke="#202C6C"
            strokeOpacity="0.9"
            strokeWidth="0.34"
            strokeLinecap="round"
            fill="none"
          />

          <path
            d="M7.44 17.34C8.14 15.78 9.36 14.84 11.04 14.6C10.24 15.52 9.62 17.22 9.4 20.72H7.32C7.14 19.62 7.16 18.42 7.44 17.34Z"
            fill={url('armGlossFill')}
            fillOpacity="0.48"
          />
          <path
            d="M15.56 14.6C16.84 14.84 17.86 15.76 18.22 17.04C17.92 16.54 17.26 16.18 16.52 16.14L15.56 20.72Z"
            fill={url('bodyRimFill')}
            fillOpacity="0.34"
          />
        </g>

        <defs>
          <linearGradient
            id={gid['armFill']}
            x1="6.7"
            y1="12.7"
            x2="17.3"
            y2="20.8"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#24327A" />
            <stop offset="62%" stopColor="#101E5C" />
            <stop offset="100%" stopColor="#09133A" />
          </linearGradient>
          <linearGradient
            id={gid['armGlossFill']}
            x1="7.2"
            y1="15.3"
            x2="10.8"
            y2="20.6"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#A7E8FF" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>
          <linearGradient
            id={gid['bodyShellFill']}
            x1="8.4"
            y1="11.9"
            x2="15.7"
            y2="20.8"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="48%" stopColor="#F7FBFF" />
            <stop offset="100%" stopColor="#D6E6FF" />
          </linearGradient>
          <linearGradient
            id={gid['bodyCoreFill']}
            x1="9"
            y1="12.6"
            x2="15"
            y2="20.8"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="68%" stopColor="#EEF6FF" />
            <stop offset="100%" stopColor="#CBDCFF" />
          </linearGradient>
          <linearGradient
            id={gid['bodyBaseFill']}
            x1="9.8"
            y1="19.4"
            x2="14.2"
            y2="20.9"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#23336A" />
            <stop offset="100%" stopColor="#050B1E" />
          </linearGradient>
          <linearGradient
            id={gid['collarFill']}
            x1="9.2"
            y1="12.7"
            x2="14.8"
            y2="13.8"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#081634" />
            <stop offset="50%" stopColor="#153275" />
            <stop offset="100%" stopColor="#06122B" />
          </linearGradient>
          <linearGradient
            id={gid['accentFill']}
            x1="16.1"
            y1="17.2"
            x2="17.6"
            y2="18.8"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#6AE2FF" />
            <stop offset="100%" stopColor="#4D88FF" />
          </linearGradient>
          <linearGradient
            id={gid['earShellFill']}
            x1="5.9"
            y1="3.7"
            x2="18.1"
            y2="6.3"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#F3FBFF" />
            <stop offset="74%" stopColor="#D9EAFF" />
            <stop offset="100%" stopColor="#A7C9FF" />
          </linearGradient>
          <radialGradient
            id={gid['earInnerFill']}
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(12 5.02) rotate(90) scale(1.48 6.6)"
          >
            <stop offset="0%" stopColor="#12205E" />
            <stop offset="100%" stopColor="#030814" />
          </radialGradient>
          <linearGradient
            id={gid['headShellFill']}
            x1="5.9"
            y1="3"
            x2="18.4"
            y2="16.9"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="58%" stopColor="#F7FBFF" />
            <stop offset="100%" stopColor="#D2E2FF" />
          </linearGradient>
          <linearGradient
            id={gid['headLeftShadeFill']}
            x1="5.8"
            y1="4"
            x2="9.5"
            y2="16.2"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#7DB3FF" stopOpacity="0.46" />
            <stop offset="100%" stopColor="#2449A7" stopOpacity="0.06" />
          </linearGradient>
          <linearGradient
            id={gid['headRightShadeFill']}
            x1="14.2"
            y1="4"
            x2="18.2"
            y2="16.2"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#91C4FF" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#1F3A8C" stopOpacity="0.14" />
          </linearGradient>
          <linearGradient
            id={gid['muzzleFill']}
            x1="7.2"
            y1="12.8"
            x2="16.8"
            y2="15.9"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#FFFEF8" />
            <stop offset="100%" stopColor="#F5F6EA" />
          </linearGradient>
          <linearGradient
            id={gid['socketFill']}
            x1="8"
            y1="6"
            x2="16"
            y2="12.8"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#16225C" />
            <stop offset="48%" stopColor="#20388C" />
            <stop offset="100%" stopColor="#0A1137" />
          </linearGradient>
          <radialGradient
            id={gid['eyeGlowFill']}
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(12 9.4) rotate(90) scale(0.96 0.96)"
          >
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="62%" stopColor="#F3FEFF" />
            <stop offset="100%" stopColor="#86E6FF" />
          </radialGradient>
          <linearGradient
            id={gid['noseFill']}
            x1="11.3"
            y1="11.36"
            x2="12.7"
            y2="12.24"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#1B1E46" />
            <stop offset="52%" stopColor="#263D7E" />
            <stop offset="100%" stopColor="#060916" />
          </linearGradient>
          <linearGradient
            id={gid['bodyRimFill']}
            x1="14.8"
            y1="14.6"
            x2="18.4"
            y2="20.8"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#7FC7FF" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </motion.div>
  )
}
