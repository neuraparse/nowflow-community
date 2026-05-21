'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { EdgeLabelRenderer } from '@xyflow/react'
import { motion, useAnimation } from 'framer-motion'
import { Copy, Edit3, Eye, EyeOff, Minus, Plus, Settings, Trash2, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EdgeInteractionsProps {
  edgeId: string
  edgePath: string
  labelX: number
  labelY: number
  isSelected?: boolean
  isHovered?: boolean
  onHover?: (isHovered: boolean) => void
  onClick?: () => void
  onDoubleClick?: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  onEdit?: () => void
  onDelete?: () => void
  onCopy?: () => void
  onToggleAnimation?: () => void
  onSettings?: () => void
  label?: string
  showToolbar?: boolean
  enableHaptics?: boolean
  // Hover area visualization
  showHoverArea?: boolean
  hoverAreaWidth?: number
  onToggleHoverArea?: () => void
  onHoverAreaWidthChange?: (width: number) => void
}

export const EdgeInteractions = React.memo(function EdgeInteractions({
  edgeId,
  edgePath,
  labelX,
  labelY,
  isSelected = false,
  isHovered: externalIsHovered = false,
  onHover,
  onClick,
  onDoubleClick,
  onContextMenu,
  onEdit,
  onDelete,
  onCopy,
  onToggleAnimation,
  onSettings,
  label,
  showToolbar = true,
  enableHaptics = true,
  showHoverArea = false,
  hoverAreaWidth = 50,
  onToggleHoverArea,
  onHoverAreaWidthChange,
}: EdgeInteractionsProps) {
  // Internal hover state for toolbar management
  const [internalIsHovered, setInternalIsHovered] = useState(false)
  const [isToolbarVisible, setIsToolbarVisible] = useState(false)
  const [isToolbarHovered, setIsToolbarHovered] = useState(false)
  const [lastTap, setLastTap] = useState(0)
  const [ripples, setRipples] = useState<Array<{ id: string; x: number; y: number }>>([])
  const interactionRef = useRef<SVGPathElement>(null)
  const visualPathRef = useRef<SVGPathElement>(null)
  const toolbarControls = useAnimation()
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Use internal hover state for toolbar, external for parent communication
  const isHovered = internalIsHovered || externalIsHovered

  // Haptic feedback utility
  const triggerHaptic = useCallback(
    (type: 'light' | 'medium' | 'heavy' = 'light') => {
      if (!enableHaptics || !navigator.vibrate) return

      const patterns = {
        light: [10],
        medium: [20],
        heavy: [30],
      }

      navigator.vibrate(patterns[type])
    },
    [enableHaptics]
  )

  // Show/hide toolbar with stable hover management
  useEffect(() => {
    const shouldShow = (isSelected || isHovered || isToolbarHovered) && showToolbar

    // Clear any pending hide timeout
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }

    if (shouldShow) {
      setIsToolbarVisible(true)
      toolbarControls.start({
        opacity: 1,
        scale: 1,
        y: 0,
        transition: { duration: 0.2, ease: 'easeOut' },
      })
    } else {
      // Delay hiding to prevent flickering
      hideTimeoutRef.current = setTimeout(() => {
        setIsToolbarVisible(false)
        toolbarControls.start({
          opacity: 0,
          scale: 0.9,
          y: 10,
          transition: { duration: 0.15, ease: 'easeIn' },
        })
      }, 200) // 200ms delay to allow moving to toolbar
    }

    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
      }
    }
  }, [edgeId, isSelected, isHovered, isToolbarHovered, showToolbar, toolbarControls])

  // Handle mouse interactions
  const handleMouseEnter = useCallback(() => {
    setInternalIsHovered(true)
    onHover?.(true)
    triggerHaptic('light')
  }, [onHover, triggerHaptic])

  const handleMouseLeave = useCallback(() => {
    // Immediately set hover to false, toolbar hover will keep it open
    setInternalIsHovered(false)
    onHover?.(false)
  }, [onHover])

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onClick?.()
      triggerHaptic('medium')

      // Create ripple effect
      const rect = (e.target as SVGElement).getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const rippleId = `ripple-${Date.now()}`

      setRipples((prev) => [...prev, { id: rippleId, x, y }])

      // Remove ripple after animation
      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== rippleId))
      }, 600)
    },
    [onClick, triggerHaptic]
  )

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onDoubleClick?.()
      triggerHaptic('heavy')
    },
    [onDoubleClick, triggerHaptic]
  )

  // Handle touch interactions for mobile
  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const now = Date.now()
      if (now - lastTap < 300) {
        handleDoubleClick(e as any)
      } else {
        handleClick(e as any)
      }
      setLastTap(now)
    },
    [lastTap, handleClick, handleDoubleClick]
  )

  // Context menu handler
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      onContextMenu?.(e)
      triggerHaptic('medium')
    },
    [onContextMenu, triggerHaptic]
  )

  // Toolbar action handlers
  const handleToolbarAction = useCallback(
    (action: () => void, hapticType: 'light' | 'medium' | 'heavy' = 'medium') => {
      return (e: React.MouseEvent) => {
        e.stopPropagation()
        action()
        triggerHaptic(hapticType)
      }
    },
    [triggerHaptic]
  )

  return (
    <>
      {/* Ripple effects */}
      {ripples.map((ripple) => (
        <motion.circle
          key={ripple.id}
          cx={ripple.x as any}
          cy={ripple.y as any}
          r="0"
          fill="rgba(59, 130, 246, 0.3)"
          initial={{ r: 0, opacity: 0.8 }}
          animate={{ r: 30, opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      ))}

      {/* Edge label and toolbar */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all',
            zIndex: 1000,
          }}
          className="flex flex-col items-center gap-2"
        >
          {/* Edge label */}
          {label && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-lg shadow-lg',
                'bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm',
                'border border-gray-200/50 dark:border-gray-700/50',
                'text-zinc-700 dark:text-white',
                'transition-all duration-200',
                isHovered && 'shadow-xl scale-105'
              )}
            >
              {label}
            </motion.div>
          )}

          {/* Interactive toolbar */}
          {isToolbarVisible && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={toolbarControls}
              onMouseEnter={() => setIsToolbarHovered(true)}
              onMouseLeave={() => setIsToolbarHovered(false)}
              className={cn(
                'flex items-center gap-1 p-1.5 rounded-lg shadow-xl',
                'bg-white dark:bg-gray-800 backdrop-blur-sm',
                'border-2 border-gray-300 dark:border-gray-600',
                'ring-2 ring-blue-500/20 dark:ring-blue-400/20'
              )}
            >
              {onEdit && (
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleToolbarAction(onEdit)}
                  className={cn(
                    'p-1.5 rounded-md transition-colors',
                    'hover:bg-blue-50 dark:hover:bg-blue-900/20',
                    'text-blue-600 dark:text-blue-400'
                  )}
                  title="Edit edge"
                >
                  <Edit3 size={15} />
                </motion.button>
              )}

              {onCopy && (
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleToolbarAction(onCopy)}
                  className={cn(
                    'p-1.5 rounded-md transition-colors',
                    'hover:bg-green-50 dark:hover:bg-green-900/20',
                    'text-green-600 dark:text-green-400'
                  )}
                  title="Copy edge"
                >
                  <Copy size={15} />
                </motion.button>
              )}

              {onToggleAnimation && (
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleToolbarAction(onToggleAnimation)}
                  className={cn(
                    'p-1.5 rounded-md transition-colors',
                    'hover:bg-purple-50 dark:hover:bg-purple-900/20',
                    'text-purple-600 dark:text-purple-400'
                  )}
                  title="Toggle animation"
                >
                  <Zap size={15} />
                </motion.button>
              )}

              {/* Hover Area Toggle */}
              {onToggleHoverArea && (
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleToolbarAction(onToggleHoverArea)}
                  className={cn(
                    'p-1.5 rounded-md transition-colors',
                    showHoverArea
                      ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 text-zinc-600 dark:text-white/40'
                  )}
                  title={showHoverArea ? 'Hide hover area' : 'Show hover area'}
                >
                  {showHoverArea ? <Eye size={15} /> : <EyeOff size={15} />}
                </motion.button>
              )}

              {/* Hover Area Width Controls */}
              {showHoverArea && onHoverAreaWidthChange && (
                <div className="flex items-center gap-0.5 px-1 border-l border-gray-200 dark:border-gray-700">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={handleToolbarAction(() =>
                      onHoverAreaWidthChange(Math.max(20, hoverAreaWidth - 10))
                    )}
                    className={cn(
                      'p-1 rounded-md transition-colors',
                      'hover:bg-gray-50 dark:hover:bg-gray-700/50',
                      'text-zinc-600 dark:text-white/40'
                    )}
                    title="Decrease hover area"
                  >
                    <Minus size={12} />
                  </motion.button>
                  <span className="text-xs font-mono text-zinc-600 dark:text-white/40 min-w-[2rem] text-center">
                    {hoverAreaWidth}
                  </span>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={handleToolbarAction(() =>
                      onHoverAreaWidthChange(Math.min(100, hoverAreaWidth + 10))
                    )}
                    className={cn(
                      'p-1 rounded-md transition-colors',
                      'hover:bg-gray-50 dark:hover:bg-gray-700/50',
                      'text-zinc-600 dark:text-white/40'
                    )}
                    title="Increase hover area"
                  >
                    <Plus size={12} />
                  </motion.button>
                </div>
              )}

              {onSettings && (
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleToolbarAction(onSettings)}
                  className={cn(
                    'p-1.5 rounded-md transition-colors',
                    'hover:bg-gray-50 dark:hover:bg-gray-700/50',
                    'text-zinc-600 dark:text-white/40'
                  )}
                  title="Edge settings"
                >
                  <Settings size={15} />
                </motion.button>
              )}

              {onDelete && (
                <motion.button
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleToolbarAction(onDelete, 'heavy')}
                  className={cn(
                    'p-2 rounded-md transition-all duration-200',
                    'bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40',
                    'text-red-600 dark:text-red-400',
                    'border border-red-200 dark:border-red-800',
                    'shadow-sm hover:shadow-md'
                  )}
                  title="Delete edge (Del)"
                >
                  <Trash2 size={16} />
                </motion.button>
              )}
            </motion.div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  )
})

// Hook for managing edge interaction state
export const useEdgeInteractions = (edgeId: string) => {
  const [isHovered, setIsHovered] = useState(false)
  const [isSelected, setIsSelected] = useState(false)
  const [showToolbar, setShowToolbar] = useState(true) // Always show toolbar when needed
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleHover = useCallback((hovered: boolean) => {
    // Clear any pending timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }

    if (hovered) {
      setIsHovered(true)
    } else {
      // Delay setting hover to false to prevent flickering
      hoverTimeoutRef.current = setTimeout(() => {
        setIsHovered(false)
      }, 100)
    }
  }, [])

  const handleSelect = useCallback((selected: boolean) => {
    setIsSelected(selected)
  }, [])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }
    }
  }, [])

  return {
    isHovered,
    isSelected,
    showToolbar,
    handleHover,
    handleSelect,
  }
}
