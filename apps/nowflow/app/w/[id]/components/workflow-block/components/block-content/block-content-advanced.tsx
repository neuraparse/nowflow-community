'use client'

import { useState } from 'react'
import { AlertTriangle, Clock, Database, Lock, Settings, Shield } from 'lucide-react'
import { Input } from '@/components/ui/input'
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

interface BlockContentAdvancedProps {
  blockId: string
}

export function BlockContentAdvanced({ blockId }: BlockContentAdvancedProps) {
  const blockType = useWorkflowStore((state) => state.blocks[blockId]?.type || '')
  const [retryEnabled, setRetryEnabled] = useState(false)
  const [cacheEnabled, setCacheEnabled] = useState(false)
  const [timeoutEnabled, setTimeoutEnabled] = useState(false)
  const [securityEnabled, setSecurityEnabled] = useState(false)
  const [retryCount, setRetryCount] = useState(3)
  const [cacheTime, setCacheTime] = useState(60)
  const [timeout, setTimeout] = useState(30)

  return (
    <div className="space-y-4">
      <BlockContentSection
        title="Error Handling"
        icon={<AlertTriangle className="h-4 w-4" />}
        defaultOpen={true}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm">Enable Retry</Label>
              <p className="text-xs text-muted-foreground">Automatically retry on failure</p>
            </div>
            <Switch checked={retryEnabled} onCheckedChange={setRetryEnabled} />
          </div>

          {retryEnabled && (
            <div className="space-y-2 pt-2">
              <Label className="text-xs">Retry Count</Label>
              <div className="flex items-center gap-4">
                <Slider
                  value={[retryCount]}
                  min={1}
                  max={10}
                  step={1}
                  onValueChange={(value) => setRetryCount(value[0])}
                  className="flex-1"
                />
                <span className="text-sm font-medium w-8 text-center">{retryCount}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Maximum number of retry attempts before failing
              </p>
            </div>
          )}
        </div>
      </BlockContentSection>

      <BlockContentSection
        title="Caching"
        icon={<Database className="h-4 w-4" />}
        defaultOpen={false}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm">Enable Caching</Label>
              <p className="text-xs text-muted-foreground">Cache results for faster execution</p>
            </div>
            <Switch checked={cacheEnabled} onCheckedChange={setCacheEnabled} />
          </div>

          {cacheEnabled && (
            <div className="space-y-2 pt-2">
              <Label className="text-xs">Cache Duration (seconds)</Label>
              <div className="flex items-center gap-4">
                <Slider
                  value={[cacheTime]}
                  min={10}
                  max={3600}
                  step={10}
                  onValueChange={(value) => setCacheTime(value[0])}
                  className="flex-1"
                />
                <span className="text-sm font-medium w-16 text-center">{cacheTime}s</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                How long to keep results in cache
              </p>
            </div>
          )}
        </div>
      </BlockContentSection>

      <BlockContentSection title="Timeout" icon={<Clock className="h-4 w-4" />} defaultOpen={false}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm">Enable Timeout</Label>
              <p className="text-xs text-muted-foreground">Limit execution time</p>
            </div>
            <Switch checked={timeoutEnabled} onCheckedChange={setTimeoutEnabled} />
          </div>

          {timeoutEnabled && (
            <div className="space-y-2 pt-2">
              <Label className="text-xs">Timeout (seconds)</Label>
              <div className="flex items-center gap-4">
                <Slider
                  value={[timeout]}
                  min={1}
                  max={300}
                  step={1}
                  onValueChange={(value) => setTimeout(value[0])}
                  className="flex-1"
                />
                <span className="text-sm font-medium w-16 text-center">{timeout}s</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Maximum execution time before cancellation
              </p>
            </div>
          )}
        </div>
      </BlockContentSection>

      <BlockContentSection
        title="Security"
        icon={<Shield className="h-4 w-4" />}
        defaultOpen={false}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm">Enhanced Security</Label>
              <p className="text-xs text-muted-foreground">Apply additional security measures</p>
            </div>
            <Switch checked={securityEnabled} onCheckedChange={setSecurityEnabled} />
          </div>

          {securityEnabled && (
            <div className="space-y-3 pt-2">
              <div className="space-y-2">
                <Label className="text-xs">Security Level</Label>
                <Select defaultValue="medium">
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select security level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low - Basic Protection</SelectItem>
                    <SelectItem value="medium">Medium - Standard Protection</SelectItem>
                    <SelectItem value="high">High - Enhanced Protection</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-xs">Encryption</Label>
                  <p className="text-xs text-muted-foreground">Encrypt data in transit</p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-xs">Access Control</Label>
                  <p className="text-xs text-muted-foreground">
                    Restrict access to authorized users
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          )}
        </div>
      </BlockContentSection>
    </div>
  )
}
