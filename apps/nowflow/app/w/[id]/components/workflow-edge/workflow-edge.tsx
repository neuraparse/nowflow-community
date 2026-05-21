import React from 'react'
import {
  BaseEdge,
  type Edge,
  EdgeLabelRenderer,
  type EdgeProps,
  getSmoothStepPath,
} from '@xyflow/react'
import { Palette, Pencil, Type, Wand2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useWorkflowStore } from '@/stores/workflows/workflow/store'
import {
  EdgeAnimation,
  EdgeColor,
  EdgeStyle,
  EdgeThickness,
} from '@/stores/workflows/workflow/types'
import { ModernEdge } from './modern-edge/modern-edge'

type WorkflowEdgeData = Record<string, unknown> & {
  selectedEdgeId?: string
  edgeStyle?: EdgeStyle
  thickness?: EdgeThickness
  color?: EdgeColor
  animation?: EdgeAnimation
  label?: string
  onDelete?: (edgeId: string) => void
}

type WorkflowEdgeType = Edge<WorkflowEdgeData, string>

export const WorkflowEdge = React.memo(function WorkflowEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<WorkflowEdgeType>) {
  // Use modern edge by default, fallback to classic for specific cases
  const useModernEdge = true // Can be made configurable

  // Defer store subscriptions to the classic edge path only — the modern edge
  // manages its own state.  Subscribing here causes every edge to re-render
  // whenever *any* of these selectors' return values change.
  if (useModernEdge) {
    return (
      <ModernEdge
        id={id}
        source={source}
        target={target}
        sourceX={sourceX}
        sourceY={sourceY}
        targetX={targetX}
        targetY={targetY}
        sourcePosition={sourcePosition}
        targetPosition={targetPosition}
        data={data}
      />
    )
  }

  // Classic edge path — store subscriptions only needed here
  return (
    <ClassicEdge
      id={id}
      source={source}
      target={target}
      sourceX={sourceX}
      sourceY={sourceY}
      targetX={targetX}
      targetY={targetY}
      sourcePosition={sourcePosition}
      targetPosition={targetPosition}
      data={data}
    />
  )
})

// Classic edge extracted to its own component so its store subscriptions
// don't cause the modern edge path to re-render.
function ClassicEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<WorkflowEdgeType>) {
  const toggleEdgeStyle = useWorkflowStore((state) => state.toggleEdgeStyle)
  const updateEdgeStyle = useWorkflowStore((state) => state.updateEdgeStyle)
  const updateEdgeThickness = useWorkflowStore((state) => state.updateEdgeThickness)
  const updateEdgeColor = useWorkflowStore((state) => state.updateEdgeColor)
  const updateEdgeAnimation = useWorkflowStore((state) => state.updateEdgeAnimation)
  const updateEdgeLabel = useWorkflowStore((state) => state.updateEdgeLabel)
  const highlightedEdgeIds = useWorkflowStore((state) => state.highlightedEdgeIds)

  // Classic edge implementation (fallback)
  const isHorizontal = sourcePosition === 'right' || sourcePosition === 'left'

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
    offset: isHorizontal ? 30 : 20,
  })

  const isSelected = id === data?.selectedEdgeId
  const edgeStyle = data?.edgeStyle || 'solid'
  const edgeThickness = data?.thickness || 'medium'
  const edgeColor = data?.color || 'default'
  const edgeAnimation = data?.animation || 'none'
  const edgeLabel = data?.label || ''

  // Check if this edge is highlighted (when hovering over connected node)
  const isHighlighted = highlightedEdgeIds.includes(id)

  // Get subtle stroke width based on thickness
  const getStrokeWidth = (
    thickness: EdgeThickness,
    isHovered = false,
    isSelected = false
  ): number => {
    const baseWidths = {
      thin: 1,
      medium: 1.5,
      thick: 2,
      'extra-thick': 2.5,
    }

    const baseWidth = baseWidths[thickness] || 1.5

    // Enhance on hover/selection
    if (isSelected) return baseWidth + 2
    if (isHovered) return baseWidth + 1
    return baseWidth
  }

  // Get subtle stroke color with hover enhancement
  const getStrokeColor = (
    color: EdgeColor,
    isSelected: boolean,
    isHighlighted: boolean
  ): string => {
    if (isSelected) return '#8b5cf6' // Purple for selected
    if (isHighlighted) return '#6366f1' // Indigo for highlighted

    // Visible default colors - always visible
    switch (color) {
      case 'blue':
        return '#94a3b8'
      case 'green':
        return '#94a3b8'
      case 'red':
        return '#94a3b8'
      case 'yellow':
        return '#94a3b8'
      case 'purple':
        return '#94a3b8'
      case 'orange':
        return '#94a3b8'
      case 'teal':
        return '#94a3b8'
      case 'pink':
        return '#94a3b8'
      case 'indigo':
        return '#94a3b8'
      case 'default':
      default:
        return '#94a3b8' // Medium gray - always visible
    }
  }

  // Get animation class based on animation
  const getAnimationClass = (animation: EdgeAnimation): string => {
    switch (animation) {
      case 'flow':
        return 'animate-flow-path'
      case 'pulse':
        return 'animate-pulse'
      case 'dash':
        return 'animate-dash'
      case 'none':
      default:
        return ''
    }
  }

  // Get stroke dash array based on edge style
  const getStrokeDashArray = (style: EdgeStyle): string => {
    switch (style) {
      case 'dashed':
        return '5,5'
      case 'dotted':
        return '2,2'
      case 'double':
        return '0,0'
      case 'wavy':
        return '0,0'
      case 'solid':
      default:
        return 'none'
    }
  }

  return (
    <>
      <BaseEdge
        path={edgePath}
        data-testid="workflow-edge"
        style={{
          strokeWidth: getStrokeWidth(edgeThickness, isHighlighted, isSelected),
          stroke: getStrokeColor(edgeColor, isSelected, isHighlighted),
          strokeDasharray: getStrokeDashArray(edgeStyle),
          zIndex: isHighlighted ? 30 : 10,
          filter:
            isSelected || isHighlighted ? 'drop-shadow(0 1px 3px rgba(0, 0, 0, 0.2))' : 'none',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', // Smooth easing
          opacity: 1, // Always fully visible
        }}
        interactionWidth={20}
      />

      {/* Special styles for double and wavy lines */}
      {edgeStyle === 'double' && (
        <BaseEdge
          path={edgePath}
          style={{
            strokeWidth: getStrokeWidth(edgeThickness, isHighlighted, isSelected) - 1,
            stroke: '#ffffff',
            zIndex: (isHighlighted ? 30 : 10) - 1,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            opacity: 1, // Always fully visible
          }}
          interactionWidth={20}
        />
      )}

      {edgeStyle === 'wavy' && (
        <BaseEdge
          path={edgePath}
          style={{
            strokeWidth: getStrokeWidth(edgeThickness, isHighlighted, isSelected),
            stroke: getStrokeColor(edgeColor, isSelected, isHighlighted),
            filter: 'url(#wavy)',
            zIndex: isHighlighted ? 30 : 10,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            opacity: 1, // Always fully visible
          }}
          interactionWidth={20}
        />
      )}

      {/* Edge Label */}
      {edgeLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'none',
              zIndex: 1000,
            }}
          >
            <div className="px-2 py-1 bg-white/80 backdrop-blur-sm rounded-md text-xs font-medium shadow-sm border border-gray-200 dark:bg-gray-800/80 dark:border-gray-700 dark:text-zinc-200">
              {edgeLabel}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}

      {/* SVG Filters for special effects */}
      <svg width="0" height="0">
        <defs>
          <filter id="wavy" x="0" y="0" width="100%" height="100%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.02"
              numOctaves="1"
              result="turbulence"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="turbulence"
              scale="10"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      {isSelected && (
        <>
          {/* Overlay directly on the edge path */}
          <BaseEdge
            path={edgePath}
            style={{
              stroke: 'transparent',
              strokeWidth: 20,
              cursor: 'pointer',
              zIndex: 999,
            }}
            interactionWidth={20}
          />

          {/* Controls directly on the edge */}
          <EdgeLabelRenderer>
            <div
              className="flex items-center justify-center absolute nodrag nopan"
              style={{
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 1000,
              }}
            >
              <div
                className="flex gap-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-md shadow-md border border-gray-200"
                style={{
                  position: 'absolute',
                  top: `${labelY}px`,
                  left: `${labelX}px`,
                  transform: 'translate(-50%, -50%)',
                  pointerEvents: 'all',
                }}
              >
                {/* Style Button */}
                <Popover>
                  <PopoverTrigger asChild>
                    <div
                      className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-[#FAFBFC] shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105"
                      style={{
                        border: '1px solid rgba(0,0,0,0.1)',
                      }}
                    >
                      <Pencil className="h-4 w-4 text-blue-500 hover:text-blue-600" />
                    </div>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="center">
                    <Tabs defaultValue="style">
                      <TabsList className="w-full">
                        <TabsTrigger value="style" className="flex-1">
                          Style
                        </TabsTrigger>
                        <TabsTrigger value="color" className="flex-1">
                          Color
                        </TabsTrigger>
                        <TabsTrigger value="thickness" className="flex-1">
                          Thickness
                        </TabsTrigger>
                        <TabsTrigger value="animation" className="flex-1">
                          Animation
                        </TabsTrigger>
                      </TabsList>

                      {/* Style Tab */}
                      <TabsContent value="style" className="p-4">
                        <div className="grid grid-cols-3 gap-2">
                          <Button
                            variant={edgeStyle === 'solid' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => updateEdgeStyle(id, 'solid')}
                            className="w-full"
                          >
                            Solid
                          </Button>
                          <Button
                            variant={edgeStyle === 'dashed' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => updateEdgeStyle(id, 'dashed')}
                            className="w-full"
                          >
                            Dashed
                          </Button>
                          <Button
                            variant={edgeStyle === 'dotted' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => updateEdgeStyle(id, 'dotted')}
                            className="w-full"
                          >
                            Dotted
                          </Button>
                          <Button
                            variant={edgeStyle === 'double' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => updateEdgeStyle(id, 'double')}
                            className="w-full"
                          >
                            Double
                          </Button>
                          <Button
                            variant={edgeStyle === 'wavy' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => updateEdgeStyle(id, 'wavy')}
                            className="w-full"
                          >
                            Wavy
                          </Button>
                        </div>
                      </TabsContent>

                      {/* Color Tab */}
                      <TabsContent value="color" className="p-4">
                        <div className="grid grid-cols-5 gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateEdgeColor(id, 'default')}
                            className={`w-full h-8 ${edgeColor === 'default' ? 'ring-2 ring-primary' : ''}`}
                            style={{ backgroundColor: '#94a3b8' }}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateEdgeColor(id, 'blue')}
                            className={`w-full h-8 ${edgeColor === 'blue' ? 'ring-2 ring-primary' : ''}`}
                            style={{ backgroundColor: '#3b82f6' }}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateEdgeColor(id, 'green')}
                            className={`w-full h-8 ${edgeColor === 'green' ? 'ring-2 ring-primary' : ''}`}
                            style={{ backgroundColor: '#22c55e' }}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateEdgeColor(id, 'red')}
                            className={`w-full h-8 ${edgeColor === 'red' ? 'ring-2 ring-primary' : ''}`}
                            style={{ backgroundColor: '#ef4444' }}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateEdgeColor(id, 'yellow')}
                            className={`w-full h-8 ${edgeColor === 'yellow' ? 'ring-2 ring-primary' : ''}`}
                            style={{ backgroundColor: '#eab308' }}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateEdgeColor(id, 'purple')}
                            className={`w-full h-8 ${edgeColor === 'purple' ? 'ring-2 ring-primary' : ''}`}
                            style={{ backgroundColor: '#a855f7' }}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateEdgeColor(id, 'orange')}
                            className={`w-full h-8 ${edgeColor === 'orange' ? 'ring-2 ring-primary' : ''}`}
                            style={{ backgroundColor: '#f97316' }}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateEdgeColor(id, 'teal')}
                            className={`w-full h-8 ${edgeColor === 'teal' ? 'ring-2 ring-primary' : ''}`}
                            style={{ backgroundColor: '#14b8a6' }}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateEdgeColor(id, 'pink')}
                            className={`w-full h-8 ${edgeColor === 'pink' ? 'ring-2 ring-primary' : ''}`}
                            style={{ backgroundColor: '#ec4899' }}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateEdgeColor(id, 'indigo')}
                            className={`w-full h-8 ${edgeColor === 'indigo' ? 'ring-2 ring-primary' : ''}`}
                            style={{ backgroundColor: '#6366f1' }}
                          />
                        </div>
                      </TabsContent>

                      {/* Thickness Tab */}
                      <TabsContent value="thickness" className="p-4">
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            variant={edgeThickness === 'thin' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => updateEdgeThickness(id, 'thin')}
                            className="w-full"
                          >
                            Thin
                          </Button>
                          <Button
                            variant={edgeThickness === 'medium' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => updateEdgeThickness(id, 'medium')}
                            className="w-full"
                          >
                            Medium
                          </Button>
                          <Button
                            variant={edgeThickness === 'thick' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => updateEdgeThickness(id, 'thick')}
                            className="w-full"
                          >
                            Thick
                          </Button>
                          <Button
                            variant={edgeThickness === 'extra-thick' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => updateEdgeThickness(id, 'extra-thick')}
                            className="w-full"
                          >
                            Extra Thick
                          </Button>
                        </div>
                      </TabsContent>

                      {/* Animation Tab */}
                      <TabsContent value="animation" className="p-4">
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            variant={edgeAnimation === 'none' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => updateEdgeAnimation(id, 'none')}
                            className="w-full"
                          >
                            None
                          </Button>
                          <Button
                            variant={edgeAnimation === 'flow' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => updateEdgeAnimation(id, 'flow')}
                            className="w-full"
                          >
                            Flow
                          </Button>
                          <Button
                            variant={edgeAnimation === 'pulse' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => updateEdgeAnimation(id, 'pulse')}
                            className="w-full"
                          >
                            Pulse
                          </Button>
                          <Button
                            variant={edgeAnimation === 'dash' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => updateEdgeAnimation(id, 'dash')}
                            className="w-full"
                          >
                            Dash
                          </Button>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </PopoverContent>
                </Popover>

                {/* Label Button */}
                <Popover>
                  <PopoverTrigger asChild>
                    <div
                      className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-[#FAFBFC] shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105"
                      style={{
                        border: '1px solid rgba(0,0,0,0.1)',
                      }}
                    >
                      <Type className="h-4 w-4 text-purple-500 hover:text-purple-600" />
                    </div>
                  </PopoverTrigger>
                  <PopoverContent className="w-60 p-4" align="center">
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Edge Label</h4>
                      <Input
                        placeholder="Enter label text"
                        value={edgeLabel}
                        onChange={(e) => updateEdgeLabel(id, e.target.value)}
                      />
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Delete button */}
                <div
                  className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-[#FAFBFC] shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105"
                  style={{
                    border: '1px solid rgba(0,0,0,0.1)',
                  }}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    if (data?.onDelete) {
                      data.onDelete(id)
                    }
                  }}
                >
                  <X className="h-5 w-5 text-red-500 hover:text-red-600" />
                </div>
              </div>
            </div>
          </EdgeLabelRenderer>
        </>
      )}
    </>
  )
}
