'use client'

import { useState } from 'react'
import { Activity, Cpu, Gauge, MemoryStick, Zap } from 'lucide-react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { useWorkflowStore } from '@/stores/workflows/workflow/store'
import { BlockContentSection } from './block-content-section'

interface BlockContentPerformanceProps {
  blockId: string
}

export function BlockContentPerformance({ blockId }: BlockContentPerformanceProps) {
  const blockType = useWorkflowStore((state) => state.blocks[blockId]?.type || '')
  const [optimizationEnabled, setOptimizationEnabled] = useState(false)
  const [parallelizationEnabled, setParallelizationEnabled] = useState(false)
  const [memoryOptimizationEnabled, setMemoryOptimizationEnabled] = useState(false)
  const [optimizationLevel, setOptimizationLevel] = useState(5)
  const [parallelThreads, setParallelThreads] = useState(2)
  const [memoryLimit, setMemoryLimit] = useState(512)

  return (
    <div className="space-y-4">
      <BlockContentSection
        title="Performance Metrics"
        icon={<Activity className="h-4 w-4" />}
        defaultOpen={true}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted/30 p-3 rounded-md border border-border/40 flex flex-col">
              <span className="text-xs text-muted-foreground">Average Execution Time</span>
              <div className="flex items-center mt-1">
                <Gauge className="h-4 w-4 text-blue-500 mr-1.5" />
                <span className="text-sm font-medium">245ms</span>
              </div>
            </div>

            <div className="bg-muted/30 p-3 rounded-md border border-border/40 flex flex-col">
              <span className="text-xs text-muted-foreground">Success Rate</span>
              <div className="flex items-center mt-1">
                <Zap className="h-4 w-4 text-green-500 mr-1.5" />
                <span className="text-sm font-medium">99.8%</span>
              </div>
            </div>

            <div className="bg-muted/30 p-3 rounded-md border border-border/40 flex flex-col">
              <span className="text-xs text-muted-foreground">Memory Usage</span>
              <div className="flex items-center mt-1">
                <MemoryStick className="h-4 w-4 text-purple-500 mr-1.5" />
                <span className="text-sm font-medium">128MB</span>
              </div>
            </div>

            <div className="bg-muted/30 p-3 rounded-md border border-border/40 flex flex-col">
              <span className="text-xs text-muted-foreground">CPU Usage</span>
              <div className="flex items-center mt-1">
                <Cpu className="h-4 w-4 text-amber-500 mr-1.5" />
                <span className="text-sm font-medium">15%</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Performance metrics are based on the last 100 executions of this block.
          </p>
        </div>
      </BlockContentSection>

      <BlockContentSection
        title="Optimization"
        icon={<Zap className="h-4 w-4" />}
        defaultOpen={false}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm">Enable Optimization</Label>
              <p className="text-xs text-muted-foreground">
                Optimize execution for better performance
              </p>
            </div>
            <Switch checked={optimizationEnabled} onCheckedChange={setOptimizationEnabled} />
          </div>

          {optimizationEnabled && (
            <div className="space-y-2 pt-2">
              <Label className="text-xs">Optimization Level</Label>
              <div className="flex items-center gap-4">
                <Slider
                  value={[optimizationLevel]}
                  min={1}
                  max={10}
                  step={1}
                  onValueChange={(value) => setOptimizationLevel(value[0])}
                  className="flex-1"
                />
                <span className="text-sm font-medium w-8 text-center">{optimizationLevel}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Higher levels may increase latency but improve throughput
              </p>
            </div>
          )}
        </div>
      </BlockContentSection>

      <BlockContentSection
        title="Parallelization"
        icon={<Cpu className="h-4 w-4" />}
        defaultOpen={false}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm">Enable Parallelization</Label>
              <p className="text-xs text-muted-foreground">Process data in parallel threads</p>
            </div>
            <Switch checked={parallelizationEnabled} onCheckedChange={setParallelizationEnabled} />
          </div>

          {parallelizationEnabled && (
            <div className="space-y-2 pt-2">
              <Label className="text-xs">Thread Count</Label>
              <div className="flex items-center gap-4">
                <Slider
                  value={[parallelThreads]}
                  min={1}
                  max={8}
                  step={1}
                  onValueChange={(value) => setParallelThreads(value[0])}
                  className="flex-1"
                />
                <span className="text-sm font-medium w-8 text-center">{parallelThreads}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Number of parallel execution threads
              </p>
            </div>
          )}
        </div>
      </BlockContentSection>

      <BlockContentSection
        title="Memory Management"
        icon={<MemoryStick className="h-4 w-4" />}
        defaultOpen={false}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm">Memory Optimization</Label>
              <p className="text-xs text-muted-foreground">Optimize memory usage</p>
            </div>
            <Switch
              checked={memoryOptimizationEnabled}
              onCheckedChange={setMemoryOptimizationEnabled}
            />
          </div>

          {memoryOptimizationEnabled && (
            <div className="space-y-2 pt-2">
              <Label className="text-xs">Memory Limit (MB)</Label>
              <div className="flex items-center gap-4">
                <Slider
                  value={[memoryLimit]}
                  min={128}
                  max={2048}
                  step={128}
                  onValueChange={(value) => setMemoryLimit(value[0])}
                  className="flex-1"
                />
                <span className="text-sm font-medium w-16 text-center">{memoryLimit}MB</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Maximum memory allocation for this block
              </p>
            </div>
          )}
        </div>
      </BlockContentSection>
    </div>
  )
}
