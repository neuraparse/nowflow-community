'use client'

import { useMemo } from 'react'
import {
  Background,
  ConnectionLineType,
  Edge,
  EdgeTypes,
  getSmoothStepPath,
  Handle,
  Node,
  NodeProps,
  NodeTypes,
  Position,
  ReactFlow,
  ReactFlowProvider,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  ModernAgentIcon,
  ModernApiIcon,
  ModernConditionIcon,
  ModernDataIcon,
  ModernFunctionIcon,
  ModernModelIcon,
  ModernRouterIcon,
  ModernStartIcon,
} from '@/components/modern-icons'
import { hexToRgba } from '@/components/workflow/live-canvas-block-style'
import {
  getStarterBlockDisplay,
  type StarterTriggerValues,
} from '@/components/workflow/starter-trigger-presentation'
import { cn } from '@/lib/utils'
import { LoopInput } from '@/app/w/[id]/components/workflow-loop/components/loop-input/loop-input'
import { LoopLabel } from '@/app/w/[id]/components/workflow-loop/components/loop-label/loop-label'
import { createLoopNode } from '@/app/w/[id]/components/workflow-loop/workflow-loop'
import { getBlock } from '@/blocks'

interface WorkflowPreviewProps {
  workflowState: {
    blocks: Record<string, any>
    edges: Array<{
      id: string
      source: string
      target: string
      sourceHandle?: string
      targetHandle?: string
    }>
    loops: Record<string, any>
  }
  showSubBlocks?: boolean
  className?: string
  height?: string | number
  width?: string | number
  isPannable?: boolean
  defaultPosition?: { x: number; y: number }
  defaultZoom?: number
}

// Modern icon mapping matching the real HeroStyleBlock
const getIconForType = (type: string, configIcon?: any) => {
  switch (type) {
    case 'agent':
      return ModernAgentIcon
    case 'function':
      return ModernFunctionIcon
    case 'api':
      return ModernApiIcon
    case 'starter':
      return ModernStartIcon
    case 'condition':
      return ModernConditionIcon
    case 'data':
      return ModernDataIcon
    case 'model':
      return ModernModelIcon
    case 'router':
      return ModernRouterIcon
    default:
      return configIcon || ModernStartIcon
  }
}

// Shape system matching the real HeroStyleBlock's block-shapes.ts
function getPreviewShape(type: string, category: string, isUtility: boolean) {
  if (isUtility) {
    return {
      clipPath: undefined,
      borderRadius: '20px',
      paddingLeft: '12px',
      paddingRight: '12px',
    }
  }

  if (type === 'starter') {
    return {
      clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%)',
      borderRadius: '6px 0 0 6px',
      paddingLeft: '12px',
      paddingRight: '22px',
    }
  }

  if (category === 'agents') {
    return {
      clipPath: undefined,
      borderRadius: '22px',
      paddingLeft: '14px',
      paddingRight: '14px',
    }
  }

  if (category === 'tools') {
    return {
      clipPath: undefined,
      borderRadius: '6px',
      paddingLeft: '12px',
      paddingRight: '12px',
      hasLeftAccent: true,
    }
  }

  if (type === 'condition' || type === 'router') {
    return {
      clipPath: 'polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%)',
      borderRadius: '4px',
      paddingLeft: '16px',
      paddingRight: '16px',
    }
  }

  return {
    clipPath: undefined,
    borderRadius: '8px',
    paddingLeft: '12px',
    paddingRight: '12px',
  }
}

function getPreviewShadow(bgColor: string, hasLeftAccent?: boolean) {
  const accent = hasLeftAccent ? `inset 3px 0 0 ${bgColor}, ` : ''
  return `${accent}0 0 0 1px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.06)`
}

/**
 * PreviewWorkflowBlock - Renders blocks matching the modern HeroStyleBlock design
 */
function PreviewWorkflowBlock({ id, data }: NodeProps<any>) {
  const { type, config, name } = data

  const starterTriggerValues = useMemo<StarterTriggerValues>(() => {
    const subBlocks = data?.blockState?.subBlocks

    return {
      startWorkflow: subBlocks?.startWorkflow?.value ?? null,
      scheduleType: subBlocks?.scheduleType?.value ?? null,
      emailProvider: subBlocks?.emailProvider?.value ?? null,
      webhookProvider: subBlocks?.webhookProvider?.value ?? null,
      formProvider: subBlocks?.formProvider?.value ?? null,
      databaseProvider: subBlocks?.databaseProvider?.value ?? null,
      fileProvider: subBlocks?.fileProvider?.value ?? null,
      calendarProvider: subBlocks?.calendarProvider?.value ?? null,
    }
  }, [data?.blockState?.subBlocks])
  const starterDisplay = useMemo(
    () => (type === 'starter' ? getStarterBlockDisplay(name, starterTriggerValues) : null),
    [name, starterTriggerValues, type]
  )
  const Icon = useMemo(
    () => starterDisplay?.Icon ?? getIconForType(type, config.icon),
    [starterDisplay, type, config.icon]
  )
  const bgColor = starterDisplay?.accentColor || config?.bgColor || '#8B5CF6'
  const displayName = starterDisplay?.displayTitle || name
  const showBrandStarterIcon = type === 'starter' && !!starterDisplay?.brandIcon
  const category = (config as any).category || ''
  const isUtility = config.isUtility || false
  const shape = getPreviewShape(type, category, isUtility)

  // Utility/helper block — compact chip design
  if (isUtility) {
    const truncatedName = name.length > 18 ? name.slice(0, 17) + '…' : name
    const utilityMeta = config.description || type

    return (
      <div className="relative" style={{ width: '148px' }}>
        {/* Target handle (left) */}
        <Handle
          type="target"
          position={Position.Left}
          id="target"
          className="!rounded-sm !border-2 !border-white dark:!border-slate-950 !shadow-sm !z-50"
          style={{
            width: '5px',
            height: '16px',
            left: '-3px',
            top: '50%',
            transform: 'translateY(-50%)',
            backgroundColor: '#60a5fa',
          }}
          isConnectable={false}
        />

        {/* Source handle (right) */}
        <Handle
          type="source"
          position={Position.Right}
          id="source"
          className="!rounded-sm !border-2 !border-white dark:!border-slate-950 !shadow-sm !z-50"
          style={{
            width: '5px',
            height: '16px',
            right: '-3px',
            top: '50%',
            transform: 'translateY(-50%)',
            backgroundColor: '#fb7185',
          }}
          isConnectable={false}
        />

        {/* Utility source handle (top) */}
        <Handle
          type="source"
          position={Position.Top}
          id="utility-source"
          style={{
            width: '10px',
            height: '4px',
            top: '-3px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: bgColor,
            border: '2px solid white',
            borderRadius: '6px',
          }}
          isConnectable={false}
        />

        {/* Chip body */}
        <div
          className="relative flex items-center gap-1.5 pl-0 pr-2 py-1.5 overflow-hidden border border-black/[0.06] dark:border-white/[0.08] bg-white/90 dark:bg-slate-950/88 shadow-[0_6px_16px_rgba(24,24,27,0.08)] dark:shadow-[0_10px_22px_rgba(0,0,0,0.24)]"
          style={{
            minWidth: '116px',
            clipPath:
              'polygon(0 0, calc(100% - 7px) 0, 100% 7px, 100% calc(100% - 7px), calc(100% - 7px) 100%, 0 100%)',
            borderRadius: 0,
          }}
        >
          {/* Internal accent tick */}
          <div
            className="absolute left-2 top-1/2 w-[2px] -translate-y-1/2 rounded-full"
            style={{
              height: '14px',
              background: `linear-gradient(180deg, ${hexToRgba(bgColor, 0.2)} 0%, ${bgColor} 52%, ${hexToRgba(bgColor, 0.26)} 100%)`,
            }}
          />

          {/* Icon badge */}
          <div
            className="ml-4 flex h-5 w-5 items-center justify-center rounded-[9px] border border-black/[0.05] dark:border-white/[0.08] flex-shrink-0"
            style={{
              background: `linear-gradient(135deg, rgba(255,255,255,0.88) 0%, ${hexToRgba(bgColor, 0.12)} 100%)`,
            }}
          >
            <Icon className="w-2.5 h-2.5 pointer-events-none" style={{ color: bgColor }} />
          </div>

          {/* Name + utility metadata */}
          <div className="flex min-w-0 flex-1 flex-col gap-0.5 pr-1">
            <span className="truncate text-[9px] font-medium leading-tight text-zinc-800 dark:text-white/90">
              {truncatedName}
            </span>
            <div className="flex items-center gap-1 min-w-0">
              <span
                className="h-1 w-1 flex-shrink-0 rounded-full"
                style={{ backgroundColor: bgColor }}
              />
              <span className="truncate text-[7px] font-medium leading-none text-zinc-500 dark:text-white/48">
                {utilityMeta}
              </span>
            </div>
          </div>
        </div>

        {/* Status dot */}
        <div className="absolute right-2 top-2 z-20">
          <div className="h-1.5 w-1.5 rounded-full border border-white/80 dark:border-slate-950 bg-zinc-300 dark:bg-white/25" />
        </div>
      </div>
    )
  }

  // Main block — shape-based design matching HeroStyleBlock
  const shadow = getPreviewShadow(bgColor, (shape as any).hasLeftAccent)

  return (
    <div className="relative" style={{ width: '180px' }}>
      {/* Input Handle (left) */}
      {type !== 'starter' && (
        <Handle
          type="target"
          position={Position.Left}
          id="target"
          className={cn(
            '!rounded-[3px]',
            '!bg-gradient-to-br from-blue-500 to-blue-600',
            '!border-2 !border-white dark:!border-slate-950',
            '!shadow-sm !z-50'
          )}
          style={{
            width: '10px',
            height: '26px',
            top: '50%',
            left: '-5px',
            transform: 'translateY(-50%)',
          }}
          isConnectable={false}
        />
      )}

      {/* Output Handle (right) */}
      {type !== 'condition' && type !== 'router' && (
        <Handle
          type="source"
          position={Position.Right}
          id="source"
          className={cn(
            '!rounded-[3px]',
            '!bg-gradient-to-br from-rose-500 to-pink-600',
            '!border-2 !border-white dark:!border-slate-950',
            '!shadow-sm !z-50'
          )}
          style={{
            width: '10px',
            height: '26px',
            top: '50%',
            right: '-5px',
            transform: 'translateY(-50%)',
          }}
          isConnectable={false}
        />
      )}

      {/* Condition block: multiple output handles */}
      {(type === 'condition' || type === 'router') && (
        <>
          <Handle
            type="source"
            position={Position.Right}
            id="condition-if"
            className={cn(
              '!rounded-[3px]',
              '!bg-gradient-to-br from-emerald-500 to-green-600',
              '!border-2 !border-white dark:!border-slate-950',
              '!shadow-sm !z-50'
            )}
            style={{
              width: '10px',
              height: '18px',
              top: '35%',
              right: '-5px',
              transform: 'translateY(-50%)',
            }}
            isConnectable={false}
          />
          <Handle
            type="source"
            position={Position.Right}
            id="condition-else"
            className={cn(
              '!rounded-[3px]',
              '!bg-gradient-to-br from-rose-500 to-red-600',
              '!border-2 !border-white dark:!border-slate-950',
              '!shadow-sm !z-50'
            )}
            style={{
              width: '10px',
              height: '18px',
              top: '65%',
              right: '-5px',
              transform: 'translateY(-50%)',
            }}
            isConnectable={false}
          />
        </>
      )}

      {/* Utility target handle (bottom) */}
      <Handle
        type="target"
        position={Position.Bottom}
        id="utility-target"
        style={{
          width: '12px',
          height: '5px',
          bottom: '-3px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#a855f7',
          border: '2px solid white',
          borderRadius: '6px',
          opacity: 0,
        }}
        isConnectable={false}
      />

      {/* Shape body — clip-path + shadow matching HeroStyleBlock */}
      <div
        className="bg-white dark:bg-slate-950"
        style={{
          clipPath: shape.clipPath,
          borderRadius: shape.borderRadius,
          paddingLeft: shape.paddingLeft,
          paddingRight: shape.paddingRight,
          paddingTop: '8px',
          paddingBottom: '8px',
          boxShadow: shadow,
          transition: 'box-shadow 0.2s ease-out',
        }}
      >
        {/* Single-row header: icon + name + status dot */}
        <div className="flex items-center gap-2">
          {/* Icon badge */}
          <div
            className="flex-shrink-0 flex items-center justify-center"
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              background: showBrandStarterIcon ? 'rgba(255,255,255,0.98)' : bgColor,
              border: showBrandStarterIcon ? '1px solid rgba(15,23,42,0.08)' : undefined,
            }}
          >
            <Icon
              className={cn(
                'pointer-events-none',
                showBrandStarterIcon ? 'w-4 h-4' : 'w-3.5 h-3.5 text-white'
              )}
            />
          </div>

          {/* Block name */}
          <span
            className="flex-1 text-[10px] font-semibold truncate text-zinc-800 dark:text-white"
            title={starterDisplay?.fullLabel || displayName}
          >
            {displayName}
          </span>

          {/* Status dot */}
          <div className="flex-shrink-0" style={{ width: 6, height: 6 }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#94a3b8' }} />
          </div>
        </div>
      </div>
    </div>
  )
}

// Define node types
const nodeTypes: NodeTypes = {
  heroStyleBlock: PreviewWorkflowBlock,
  loopLabel: LoopLabel,
  loopInput: LoopInput,
}

// Lightweight preview edge — clean smooth-step path with source block color
function PreviewEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  sourceHandleId,
  targetHandleId,
  data,
}: any) {
  const isUtilitySlotEdge =
    sourceHandleId === 'utility-source' || targetHandleId === 'utility-target'

  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition: isUtilitySlotEdge ? Position.Top : sourcePosition,
    targetX,
    targetY,
    targetPosition: isUtilitySlotEdge ? Position.Bottom : targetPosition,
    borderRadius: isUtilitySlotEdge ? 8 : 12,
    offset: isUtilitySlotEdge ? 16 : 20,
  })

  const edgeColor = data?.edgeColor || '#94a3b8'

  const arrowMarkerId = `preview-arrow-${id}`

  return (
    <>
      <defs>
        <marker
          id={arrowMarkerId}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={edgeColor} fillOpacity={0.7} />
        </marker>
      </defs>
      <path
        d={edgePath}
        fill="none"
        stroke={edgeColor}
        strokeWidth={2}
        strokeOpacity={0.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={isUtilitySlotEdge ? '4 3' : undefined}
        markerEnd={`url(#${arrowMarkerId})`}
        style={{
          filter: `drop-shadow(0 0 2px ${edgeColor}30)`,
        }}
      />
    </>
  )
}

// Use lightweight preview edges for marketplace cards (no framer-motion overhead)
const previewEdgeTypes: EdgeTypes = {
  previewEdge: PreviewEdge,
}

function WorkflowPreviewContent({
  workflowState,
  className,
  height = '100%',
  width = '100%',
  isPannable = false,
  defaultPosition,
  defaultZoom,
}: WorkflowPreviewProps) {
  // Transform blocks and loops into ReactFlow nodes
  const nodes: Node[] = useMemo(() => {
    const nodeArray: Node[] = []

    // Add loop nodes
    Object.entries(workflowState.loops || {}).forEach(([loopId, loop]) => {
      const loopNodes = createLoopNode({
        loopId,
        loop: loop as any,
        blocks: workflowState.blocks,
      })

      if (loopNodes) {
        if (Array.isArray(loopNodes)) {
          nodeArray.push(...(loopNodes as Node[]))
        } else {
          nodeArray.push(loopNodes)
        }
      }
    })

    // Add block nodes
    Object.entries(workflowState.blocks).forEach(([blockId, block]) => {
      const blockConfig = getBlock(block.type)
      if (!blockConfig) return

      nodeArray.push({
        id: blockId,
        type: 'heroStyleBlock',
        position: block.position,
        data: {
          type: block.type,
          config: blockConfig,
          name: block.name,
          blockState: block,
          showSubBlocks: false,
        },
        draggable: false,
      })
    })

    return nodeArray
  }, [workflowState.blocks, workflowState.loops])

  // Transform edges with source block colors
  const edges: Edge[] = useMemo(() => {
    return workflowState.edges.map((edge) => {
      const sourceBlock = workflowState.blocks[edge.source]
      const sourceConfig = sourceBlock ? getBlock(sourceBlock.type) : null
      const edgeColor = sourceConfig?.bgColor || '#94a3b8'

      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        type: 'previewEdge',
        data: { edgeColor },
      }
    })
  }, [workflowState.edges, workflowState.blocks])

  return (
    <div style={{ height, width }} className={className}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={previewEdgeTypes}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        panOnScroll={false}
        panOnDrag={isPannable}
        zoomOnScroll={false}
        draggable={false}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        defaultViewport={{
          x: defaultPosition?.x ?? 0,
          y: defaultPosition?.y ?? 0,
          zoom: defaultZoom ?? 1,
        }}
        minZoom={0.05}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} size={0.5} color="rgba(0,0,0,0.06)" />
      </ReactFlow>
    </div>
  )
}

export function WorkflowPreview(props: WorkflowPreviewProps) {
  return (
    <ReactFlowProvider>
      <WorkflowPreviewContent {...props} />
    </ReactFlowProvider>
  )
}
