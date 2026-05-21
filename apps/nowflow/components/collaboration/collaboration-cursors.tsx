'use client'

import { useEffect, useRef, useState } from 'react'
import { useReactFlow } from '@xyflow/react'

export interface CollabCursor {
  userId: string
  name: string
  color: string
  cursor: { x: number; y: number } // In flow coordinates (not screen)
  selectedNodes?: string[]
}

interface CollaborationCursorsProps {
  cursors: CollabCursor[]
  currentUserId: string
}

const FADE_TIMEOUT = 10_000

export function CollaborationCursors({ cursors, currentUserId }: CollaborationCursorsProps) {
  const { flowToScreenPosition, getViewport } = useReactFlow()
  const [, setViewport] = useState(() => getViewport())
  const lastMovedRef = useRef<Record<string, number>>({})
  const [now, setNow] = useState(() => Date.now())

  // Track viewport changes for re-rendering cursor positions
  useEffect(() => {
    const interval = setInterval(() => {
      setViewport(getViewport())
    }, 16) // ~60fps
    return () => clearInterval(interval)
  }, [getViewport])

  // Track staleness for fade-out
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  // Update last-moved timestamps when cursors change
  useEffect(() => {
    const timestamp = Date.now()
    for (const cursor of cursors) {
      if (cursor.userId !== currentUserId) {
        lastMovedRef.current[cursor.userId] = timestamp
      }
    }
  }, [cursors, currentUserId])

  const remoteCursors = cursors.filter((c) => c.userId !== currentUserId)

  if (remoteCursors.length === 0) return null

  return (
    <div
      className="pointer-events-none absolute inset-0 z-50 overflow-hidden"
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
    >
      {remoteCursors.map((cursor) => {
        const screen = flowToScreenPosition({
          x: cursor.cursor.x,
          y: cursor.cursor.y,
        })

        const lastMoved = lastMovedRef.current[cursor.userId] ?? now
        const isStale = now - lastMoved > FADE_TIMEOUT

        return (
          <div
            key={cursor.userId}
            className="absolute left-0 top-0"
            style={{
              transform: `translate(${screen.x}px, ${screen.y}px)`,
              transition: 'transform 100ms ease-out, opacity 300ms ease',
              opacity: isStale ? 0.25 : 1,
              pointerEvents: 'none',
            }}
          >
            {/* SVG cursor arrow */}
            <svg width="16" height="20" viewBox="0 0 18 22" fill="none">
              <path
                d="M1.5 1L6.5 20L9.5 12L17 9.5L1.5 1Z"
                fill={cursor.color}
                stroke="white"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>

            {/* Name label pill */}
            <div className="ml-2 mt-0.5 whitespace-nowrap rounded border bg-background px-1.5 py-0.5 text-[10px] font-medium text-foreground shadow-sm">
              {cursor.name}
            </div>
          </div>
        )
      })}
    </div>
  )
}
