import React from 'react'
import { type Connection, Handle, Position } from '@xyflow/react'
import { cn } from '@/lib/utils'

type ConditionBlock = {
  id: string
  title: string
  value: string
}

type BlockShape = {
  rightSlantRate: number
  handleRight: number
}

type ConditionHandlesProps = {
  type: string
  conditionBlocks: ConditionBlock[]
  shape: BlockShape
  handleBorder: string
  isValidToRegularTarget: (c: Connection) => boolean
}

export const ConditionHandles = React.memo(function ConditionHandles({
  type,
  conditionBlocks,
  shape,
  handleBorder,
  isValidToRegularTarget,
}: ConditionHandlesProps) {
  // Output Handles - Different for condition blocks
  if (type === 'condition' && conditionBlocks.length > 0) {
    // Condition block: render a handle for each condition
    return (
      <>
        {conditionBlocks.map((condition: any, index: number) => {
          const handleId = `condition-${condition.id}`
          const totalConditions = conditionBlocks.length
          // Calculate vertical position: distribute handles evenly
          const spacing = 100 / (totalConditions + 1)
          const topPercent = spacing * (index + 1)
          const isIfCondition = condition.title === 'if' || index === 0
          const isElseCondition = condition.title === 'else' || index === totalConditions - 1
          const handleBackground = isIfCondition
            ? 'linear-gradient(to bottom, rgba(34,197,94,0.78), #16a34a)'
            : isElseCondition
              ? 'linear-gradient(to bottom, rgba(239,68,68,0.78), #dc2626)'
              : 'linear-gradient(to bottom, rgba(245,158,11,0.78), #ea580c)'

          return (
            <React.Fragment key={handleId}>
              <Handle
                type="source"
                position={Position.Right}
                id={handleId}
                className={cn(
                  'react-flow__handle-modern',
                  '!w-[1px] !h-[5px]',
                  '!rounded-full',
                  '!shadow-sm',
                  '!z-50 !cursor-crosshair',
                  '!transition-[box-shadow,border-color] !duration-200'
                )}
                style={{
                  top: `${topPercent}%`,
                  right: `${shape.rightSlantRate * topPercent - 1}px`,
                  transform: 'translateY(-50%)',
                  transformOrigin: 'center',
                  pointerEvents: 'auto',
                  background: handleBackground,
                  border: `1px solid ${handleBorder}`,
                }}
                isConnectableStart={true}
                isConnectableEnd={false}
                isValidConnection={isValidToRegularTarget}
              />
            </React.Fragment>
          )
        })}
      </>
    )
  }

  // Normal block: single output handle
  return (
    <Handle
      type="source"
      position={Position.Right}
      id="source"
      className={cn(
        'react-flow__handle-modern',
        '!w-[1px] !h-[6px]',
        '!rounded-full',
        '!shadow-sm',
        '!z-50 !cursor-crosshair',
        '!transition-[box-shadow,border-color] !duration-200'
      )}
      style={{
        top: '50%',
        right: `${-1 + shape.handleRight}px`,
        transform: 'translateY(-50%)',
        transformOrigin: 'center',
        pointerEvents: 'auto',
        background: 'linear-gradient(to bottom, rgba(251,113,133,0.78), #fb7185)',
        border: `1px solid ${handleBorder}`,
      }}
      isConnectableStart={true}
      isConnectableEnd={false}
      isValidConnection={isValidToRegularTarget}
    />
  )
})
