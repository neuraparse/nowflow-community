'use client'

import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface ModernIconProps {
  icon: React.ComponentType<any>
  bgColor: string
  isActive?: boolean
  isHovered?: boolean
  isSelected?: boolean
  hasError?: boolean
  isCompleted?: boolean
  isEnabled?: boolean
  temperature?: number | null
}

export function ModernIcon({
  icon: IconComponent,
  bgColor,
  isActive = false,
  isHovered = false,
  isSelected = false,
  hasError = false,
  isCompleted = false,
  isEnabled = true,
  temperature = null,
}: ModernIconProps) {
  // Icon container styling - Ultra minimal & modern
  const containerClasses = useMemo(() => {
    const baseClasses = [
      'flex items-center justify-center',
      'relative overflow-hidden',
      'transition-all duration-500 ease-out',
      'group-hover:scale-105',
      'w-12 h-12 rounded-xl', // Sharper, more minimal
    ]

    return baseClasses
  }, [])

  // Icon size - consistent for all rectangular cards
  const iconSize = 'w-7 h-7' // Standard size for all cards

  // Dynamic background and shadow based on state - Minimal & Clean
  const containerStyle = useMemo(() => {
    const baseGradient = isEnabled
      ? `linear-gradient(135deg, ${bgColor} 0%, ${bgColor}E6 100%)`
      : 'linear-gradient(135deg, #9CA3AF 0%, #6B7280 100%)'

    let boxShadow = '0 2px 8px rgba(0,0,0,0.08)'

    if (isEnabled) {
      if (temperature !== null) {
        boxShadow = `0 4px 16px ${bgColor}30, 0 2px 8px rgba(0,0,0,0.08)`
      } else {
        boxShadow = `0 3px 12px ${bgColor}20, 0 1px 4px rgba(0,0,0,0.06)`
      }
    }

    // Clean shadows for states
    if (hasError) {
      boxShadow = '0 4px 16px rgba(239, 68, 68, 0.3), 0 2px 8px rgba(239, 68, 68, 0.15)'
    } else if (isCompleted) {
      boxShadow = '0 4px 16px rgba(34, 197, 94, 0.3), 0 2px 8px rgba(34, 197, 94, 0.15)'
    } else if (isSelected) {
      boxShadow = `0 4px 16px ${bgColor}40, 0 2px 8px ${bgColor}20`
    }

    return {
      background: baseGradient,
      boxShadow,
    }
  }, [bgColor, isEnabled, temperature, hasError, isCompleted, isSelected])

  // Animation variants for the icon
  const iconVariants = {
    idle: {
      scale: 1,
      rotate: 0,
      transition: { duration: 0.3, ease: 'easeOut' },
    },
    hover: {
      scale: 1.1,
      rotate: 0,
      transition: { duration: 0.2, ease: 'easeOut' },
    },
    active: {
      scale: [1, 1.1, 1],
      rotate: [0, 3, -3, 0],
      transition: {
        duration: 2,
        ease: 'easeInOut',
        repeat: Infinity,
      },
    },
    error: {
      scale: [1, 1.2, 1],
      rotate: [0, 10, -10, 0],
      transition: {
        duration: 0.6,
        ease: 'easeInOut',
        repeat: 2,
      },
    },
    completed: {
      scale: [1, 1.15, 1],
      transition: {
        duration: 0.8,
        ease: 'easeOut',
      },
    },
  }

  // Determine current animation state
  const currentVariant = useMemo(() => {
    if (hasError) return 'error'
    if (isCompleted) return 'completed'
    if (isActive || temperature !== null) return 'active'
    if (isHovered) return 'hover'
    return 'idle'
  }, [hasError, isCompleted, isActive, isHovered, temperature])

  return (
    <motion.div
      className={cn(...containerClasses)}
      style={containerStyle}
      initial="idle"
      animate={currentVariant}
      variants={{
        idle: { scale: 1 },
        hover: { scale: 1.05 },
        active: { scale: [1, 1.02, 1] },
      }}
      transition={{ duration: 0.3 }}
    >
      {/* Icon with enhanced animations */}
      <motion.div variants={iconVariants} initial="idle" animate={currentVariant}>
        <IconComponent
          className={cn(
            'text-white drop-shadow-sm transition-all duration-300',
            iconSize,
            temperature !== null && 'animate-pulse',
            hasError && 'text-red-100',
            isCompleted && 'text-green-100',
            isSelected && 'text-purple-100'
          )}
        />
      </motion.div>

      {/* Subtle overlay for depth - Minimal */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent rounded-xl pointer-events-none" />

      {/* Minimal pulse for active states */}
      {(isActive || temperature !== null) && (
        <motion.div
          className="absolute inset-0 rounded-xl border border-white/20"
          initial={{ scale: 1, opacity: 0.6 }}
          animate={{ scale: 1.15, opacity: 0 }}
          transition={{
            duration: 2,
            ease: 'easeOut',
            repeat: Infinity,
            repeatDelay: 0.8,
          }}
        />
      )}
    </motion.div>
  )
}
