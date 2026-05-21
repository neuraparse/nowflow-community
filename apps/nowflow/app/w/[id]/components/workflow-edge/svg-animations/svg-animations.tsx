'use client'

import React, { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

interface SVGAnimationsProps {
  edgePath: string
  edgeId: string
  isActive?: boolean
  isCompleted?: boolean
  hasError?: boolean
  animationType?: 'flow' | 'pulse' | 'particles' | 'glow' | 'morphing' | 'lightning'
  color?: string
  intensity?: 'low' | 'medium' | 'high'
}

export const SVGAnimations = React.memo(function SVGAnimations({
  edgePath,
  edgeId,
  isActive = false,
  isCompleted = false,
  hasError = false,
  animationType = 'flow',
  color = '#3b82f6',
  intensity = 'medium',
}: SVGAnimationsProps) {
  const pathRef = useRef<SVGPathElement>(null)

  // Calculate path length for animations
  const pathLength = React.useMemo(() => {
    if (typeof window === 'undefined') return 0
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('d', edgePath)
    return path.getTotalLength()
  }, [edgePath])

  // Animation configurations based on intensity
  const getAnimationConfig = (type: string) => {
    const configs = {
      low: { duration: 3, particles: 2, glowSize: 2 },
      medium: { duration: 2, particles: 3, glowSize: 4 },
      high: { duration: 1.5, particles: 5, glowSize: 6 },
    }
    return configs[intensity]
  }

  const config = getAnimationConfig(animationType)

  // Flowing particles animation - using SVG animateMotion instead of CSS offset-path
  const FlowingParticles = () => (
    <>
      {[...Array(config.particles)].map((_, i) => (
        <motion.circle
          key={`particle-${i}`}
          // @ts-ignore: framer-motion types don't include r/cx/cy props in MotionProps
          r={(intensity === 'high' ? '3' : intensity === 'medium' ? '2' : '1.5') as any}
          fill={color}
          initial={{ opacity: 0 }}
          animate={{
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: config.duration,
            repeat: Infinity,
            delay: i * (config.duration / config.particles),
            ease: 'easeInOut',
          }}
        >
          <animateMotion
            dur={`${config.duration}s`}
            repeatCount="indefinite"
            begin={`${i * (config.duration / config.particles)}s`}
            // @ts-ignore: animateMotion path attribute not typed in TSX
            path={edgePath as any}
          />
        </motion.circle>
      ))}
    </>
  )

  // Pulsing glow animation
  const PulsingGlow = () => (
    <motion.path
      d={edgePath as any}
      fill="none"
      stroke={color}
      strokeWidth={config.glowSize as any}
      strokeOpacity="0.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      filter={`url(#glow-${edgeId})`}
      animate={{
        strokeOpacity: [0.3, 0.8, 0.3],
        strokeWidth: [
          config.glowSize as any,
          (config.glowSize * 1.5) as any,
          config.glowSize as any,
        ] as any,
      }}
      transition={{
        duration: config.duration,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  )

  // Lightning effect animation
  const LightningEffect = () => {
    const [lightningPath, setLightningPath] = React.useState(edgePath)

    useEffect(() => {
      if (animationType !== 'lightning') return

      const interval = setInterval(() => {
        // Create slight variations in the path for lightning effect
        const variation = Math.random() * 2 - 1
        const modifiedPath = edgePath.replace(/C/g, `C${variation},${variation} `)
        setLightningPath(modifiedPath)
      }, 100)

      return () => clearInterval(interval)
    }, [edgePath, animationType])

    return (
      <motion.path
        d={lightningPath as any}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={`url(#lightning-${edgeId})`}
        animate={{
          opacity: [0.8, 1, 0.8],
        }}
        transition={{
          duration: 0.1,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    )
  }

  // Morphing path animation
  const MorphingPath = () => {
    const [morphedPath, setMorphedPath] = React.useState(edgePath)

    useEffect(() => {
      if (animationType !== 'morphing') return

      const interval = setInterval(() => {
        // Create smooth morphing effect
        const time = Date.now() * 0.001
        const amplitude = intensity === 'high' ? 10 : intensity === 'medium' ? 5 : 2
        const frequency = 0.5

        // Add sine wave variation to the path
        const variation = Math.sin(time * frequency) * amplitude
        const modifiedPath = edgePath.replace(/(\d+),(\d+)/g, (match, x, y) => {
          const newY = parseInt(y) + variation
          return `${x},${newY}`
        })
        setMorphedPath(modifiedPath)
      }, 50)

      return () => clearInterval(interval)
    }, [edgePath, animationType, intensity])

    return (
      <motion.path
        d={morphedPath as any}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        animate={{
          strokeOpacity: [0.7, 1, 0.7],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    )
  }

  // Flowing gradient animation
  const FlowingGradient = () => (
    <>
      <defs>
        <linearGradient id={`flowing-gradient-${edgeId}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity="0">
            <animate
              attributeName="stop-opacity"
              values="0;1;0"
              dur={`${config.duration}s`}
              repeatCount="indefinite"
            />
          </stop>
          <stop offset="50%" stopColor={color} stopOpacity="1">
            <animate
              attributeName="stop-opacity"
              values="0;1;0"
              dur={`${config.duration}s`}
              repeatCount="indefinite"
              begin={`${config.duration * 0.3}s`}
            />
          </stop>
          <stop offset="100%" stopColor={color} stopOpacity="0">
            <animate
              attributeName="stop-opacity"
              values="0;1;0"
              dur={`${config.duration}s`}
              repeatCount="indefinite"
              begin={`${config.duration * 0.6}s`}
            />
          </stop>
        </linearGradient>
      </defs>
      <path
        d={edgePath}
        fill="none"
        stroke={`url(#flowing-gradient-${edgeId})`}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  )

  // Render appropriate animation based on type
  const renderAnimation = () => {
    switch (animationType) {
      case 'particles':
        return <FlowingParticles />
      case 'pulse':
        return <PulsingGlow />
      case 'lightning':
        return <LightningEffect />
      case 'morphing':
        return <MorphingPath />
      case 'flow':
      default:
        return <FlowingGradient />
    }
  }

  return (
    <g>
      {/* SVG Filters */}
      <defs>
        {/* Glow filter */}
        <filter id={`glow-${edgeId}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Lightning filter */}
        <filter id={`lightning-${edgeId}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="1 0 1 0 0  0 1 1 0 0  1 0 1 0 0  0 0 0 1 0"
          />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Render the appropriate animation */}
      {(isActive || isCompleted || hasError) && renderAnimation()}
    </g>
  )
})
