import { BaseEdge, EdgeProps, getSmoothStepPath } from '@xyflow/react'

export const HeroEdge = ({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
}: EdgeProps) => {
  const isHorizontal = sourcePosition === 'right' || sourcePosition === 'left'

  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
    offset: isHorizontal ? 30 : 20,
  })

  return (
    <BaseEdge
      path={edgePath}
      style={{
        strokeWidth: 2,
        stroke: '#404040',
        strokeDasharray: '5,5',
        zIndex: 5,
        ...(style && typeof style === 'object' && !Array.isArray(style) ? style : {}),
      }}
      markerEnd={
        markerEnd ||
        (style && typeof style === 'object' && !Array.isArray(style) ? style.markerEnd : undefined)
      }
    />
  )
}
