'use client'

import { useEffect, useState } from 'react'
import {
  Bug,
  Circle,
  Eye,
  Pause,
  Play,
  RotateCcw,
  Square,
  StepBack,
  StepForward,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface DebugToolbarProps {
  workflowId: string
  executionId?: string
  isDebugging: boolean
  onToggleDebug: () => void
}

interface ReplayState {
  sessionId: string | null
  currentStep: number
  totalSteps: number
  isPlaying: boolean
  playbackSpeed: number
}

export function DebugToolbar({
  workflowId,
  executionId,
  isDebugging,
  onToggleDebug,
}: DebugToolbarProps) {
  const [replayState, setReplayState] = useState<ReplayState>({
    sessionId: null,
    currentStep: 0,
    totalSteps: 0,
    isPlaying: false,
    playbackSpeed: 1,
  })
  const [breakpoints, setBreakpoints] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isDebugging && workflowId) {
      fetchBreakpoints()
    }
  }, [isDebugging, workflowId])

  const fetchBreakpoints = async () => {
    try {
      const response = await fetch(`/api/workflows/${workflowId}/debug/breakpoints`)
      const data = await response.json()
      if (data.success) {
        setBreakpoints(data.data.map((b: any) => b.blockId))
      }
    } catch (error) {
      console.error('Failed to fetch breakpoints:', error)
    }
  }

  const startReplay = async () => {
    if (!executionId) return

    setLoading(true)
    try {
      const response = await fetch(`/api/workflows/${workflowId}/debug/replay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          executionId,
        }),
      })
      const data = await response.json()
      if (data.success) {
        setReplayState({
          sessionId: data.data.id,
          currentStep: 0,
          totalSteps: data.data.totalSteps,
          isPlaying: false,
          playbackSpeed: 1,
        })
      }
    } catch (error) {
      console.error('Failed to start replay:', error)
    } finally {
      setLoading(false)
    }
  }

  const stepTo = async (step: number) => {
    if (!replayState.sessionId) return

    try {
      const response = await fetch(`/api/workflows/${workflowId}/debug/replay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'step',
          sessionId: replayState.sessionId,
          targetStep: step,
        }),
      })
      const data = await response.json()
      if (data.success) {
        setReplayState((prev) => ({ ...prev, currentStep: step }))
      }
    } catch (error) {
      console.error('Failed to step:', error)
    }
  }

  const togglePlayback = () => {
    setReplayState((prev) => ({ ...prev, isPlaying: !prev.isPlaying }))
  }

  useEffect(() => {
    if (replayState.isPlaying && replayState.currentStep < replayState.totalSteps - 1) {
      const timer = setTimeout(() => {
        stepTo(replayState.currentStep + 1)
      }, 1000 / replayState.playbackSpeed)
      return () => clearTimeout(timer)
    } else if (replayState.isPlaying && replayState.currentStep >= replayState.totalSteps - 1) {
      setReplayState((prev) => ({ ...prev, isPlaying: false }))
    }
  }, [replayState.isPlaying, replayState.currentStep, replayState.playbackSpeed])

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2 p-2 bg-zinc-800 dark:bg-slate-950 border-b border-black/[0.06] dark:border-white/[0.06] text-white">
        {/* Debug Toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isDebugging ? 'default' : 'ghost'}
              size="sm"
              onClick={onToggleDebug}
              className={isDebugging ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              <Bug className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{isDebugging ? 'Exit Debug Mode' : 'Enter Debug Mode'}</TooltipContent>
        </Tooltip>

        {isDebugging && (
          <>
            <div className="w-px h-6 bg-white/[0.08]" />

            {/* Replay Controls */}
            {!replayState.sessionId ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={startReplay}
                    disabled={!executionId || loading}
                  >
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Replay
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Start Replay Session</TooltipContent>
              </Tooltip>
            ) : (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => stepTo(Math.max(0, replayState.currentStep - 1))}
                      disabled={replayState.currentStep === 0}
                    >
                      <StepBack className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Step Back</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={togglePlayback}>
                      {replayState.isPlaying ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{replayState.isPlaying ? 'Pause' : 'Play'}</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        stepTo(Math.min(replayState.totalSteps - 1, replayState.currentStep + 1))
                      }
                      disabled={replayState.currentStep >= replayState.totalSteps - 1}
                    >
                      <StepForward className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Step Forward</TooltipContent>
                </Tooltip>

                {/* Timeline Slider */}
                <div className="flex items-center gap-2 flex-1 max-w-xs">
                  <Slider
                    value={[replayState.currentStep]}
                    min={0}
                    max={replayState.totalSteps - 1}
                    step={1}
                    onValueChange={([value]) => stepTo(value)}
                    className="w-full"
                  />
                  <span className="text-xs text-white/40 whitespace-nowrap">
                    {replayState.currentStep + 1} / {replayState.totalSteps}
                  </span>
                </div>

                {/* Speed Control */}
                <select
                  value={replayState.playbackSpeed}
                  onChange={(e) =>
                    setReplayState((prev) => ({
                      ...prev,
                      playbackSpeed: parseFloat(e.target.value),
                    }))
                  }
                  className="silver-glass-pane smoky-glass-pane glass-field glass-native-select text-xs font-logo px-2 py-1 rounded border-0 bg-transparent text-zinc-200 dark:text-white"
                >
                  <option value={0.5}>0.5x</option>
                  <option value={1}>1x</option>
                  <option value={2}>2x</option>
                  <option value={4}>4x</option>
                </select>
              </>
            )}

            <div className="w-px h-6 bg-white/[0.08]" />

            {/* Breakpoints */}
            <div className="flex items-center gap-1">
              <Circle className="h-3 w-3 text-red-500 fill-red-500" />
              <span className="text-xs text-white/40">{breakpoints.length} breakpoints</span>
            </div>

            <div className="w-px h-6 bg-white/[0.08]" />

            {/* Variable Inspector Toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Eye className="h-4 w-4 mr-1" />
                  Variables
                </Button>
              </TooltipTrigger>
              <TooltipContent>Toggle Variable Inspector</TooltipContent>
            </Tooltip>
          </>
        )}

        {/* Status Badge */}
        <div className="ml-auto">
          {isDebugging && (
            <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Debug Mode</Badge>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}
