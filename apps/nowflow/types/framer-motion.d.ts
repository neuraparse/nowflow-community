// Augment framer-motion to fix SVG component types
import { ComponentType, RefObject, SVGProps } from 'react'
import { ForwardRefComponent, HTMLMotionProps, SVGMotionProps } from 'framer-motion'

declare module 'framer-motion' {
  export interface MotionProps {
    // Ref attribute
    ref?: RefObject<SVGSVGElement | SVGPathElement | SVGCircleElement | any>

    // Animation lifecycle callbacks
    onAnimationComplete?: (definition: any) => void
    onAnimationStart?: (definition: any) => void

    // SVG path attributes
    d?: string
    fill?: string
    stroke?: string
    strokeWidth?: string | number
    strokeOpacity?: string | number
    strokeLinecap?: 'butt' | 'round' | 'square'
    strokeLinejoin?: 'miter' | 'round' | 'bevel'
    strokeDasharray?: string
    strokeDashoffset?: string | number
    markerEnd?: string

    // SVG circle attributes
    cx?: string | number
    cy?: string | number
    r?: string | number
    fillOpacity?: string | number

    // Common SVG attributes
    className?: string
    style?: React.CSSProperties
    filter?: string
  }

  // Reorder components for drag-to-reorder functionality
  export interface ReorderGroupProps<V> {
    children: React.ReactNode
    values: V[]
    onReorder: (newOrder: V[]) => void
    axis?: 'x' | 'y'
    as?: keyof JSX.IntrinsicElements | ComponentType<any>
    className?: string
    style?: React.CSSProperties
  }

  export interface ReorderItemProps<V> {
    children: React.ReactNode
    value: V
    as?: keyof JSX.IntrinsicElements | ComponentType<any>
    className?: string
    style?: React.CSSProperties
    dragListener?: boolean
  }

  export const Reorder: {
    Group: <V>(props: ReorderGroupProps<V>) => JSX.Element
    Item: <V>(props: ReorderItemProps<V>) => JSX.Element
  }
}
