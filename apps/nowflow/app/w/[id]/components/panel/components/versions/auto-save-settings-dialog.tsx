import React from 'react'
import { Check, Loader2, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import type { AutoSaveConfig } from './types'

interface AutoSaveSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  autoSaveConfig: AutoSaveConfig | null
  setAutoSaveConfig: (config: AutoSaveConfig) => void
  savingConfig: boolean
  onSave: () => void
}

export const AutoSaveSettingsDialog = React.memo(function AutoSaveSettingsDialog({
  open,
  onOpenChange,
  autoSaveConfig,
  setAutoSaveConfig,
  savingConfig,
  onSave,
}: AutoSaveSettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Auto-Save Settings
          </DialogTitle>
          <DialogDescription>
            Configure automatic version saving for this workflow.
          </DialogDescription>
        </DialogHeader>

        {autoSaveConfig ? (
          <div className="space-y-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Enable Auto-Save</Label>
                <p className="text-sm text-zinc-500 dark:text-white/50">
                  Automatically save versions periodically
                </p>
              </div>
              <Switch
                checked={autoSaveConfig.enabled}
                onCheckedChange={(checked) =>
                  setAutoSaveConfig({ ...autoSaveConfig, enabled: checked })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Save Interval: {autoSaveConfig.intervalMinutes} minutes</Label>
              <Slider
                value={[autoSaveConfig.intervalMinutes]}
                onValueChange={([value]) =>
                  setAutoSaveConfig({ ...autoSaveConfig, intervalMinutes: value })
                }
                min={1}
                max={60}
                step={1}
                disabled={!autoSaveConfig.enabled}
              />
              <p className="text-xs text-zinc-500 dark:text-white/50">
                How often to check for changes and save
              </p>
            </div>

            <div className="space-y-2">
              <Label>Max Auto-Save Versions: {autoSaveConfig.maxAutoSaveVersions}</Label>
              <Slider
                value={[autoSaveConfig.maxAutoSaveVersions]}
                onValueChange={([value]) =>
                  setAutoSaveConfig({ ...autoSaveConfig, maxAutoSaveVersions: value })
                }
                min={1}
                max={50}
                step={1}
                disabled={!autoSaveConfig.enabled}
              />
              <p className="text-xs text-zinc-500 dark:text-white/50">
                Older auto-saves will be pruned automatically
              </p>
            </div>

            <div className="space-y-2">
              <Label>Minimum Changes Threshold: {autoSaveConfig.significantChangeThreshold}</Label>
              <Slider
                value={[autoSaveConfig.significantChangeThreshold]}
                onValueChange={([value]) =>
                  setAutoSaveConfig({ ...autoSaveConfig, significantChangeThreshold: value })
                }
                min={1}
                max={20}
                step={1}
                disabled={!autoSaveConfig.enabled}
              />
              <p className="text-xs text-zinc-500 dark:text-white/50">
                Minimum number of changes required to trigger auto-save
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={savingConfig || !autoSaveConfig}>
            {savingConfig ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Save Settings
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
