import React from 'react'
import { ArrowRight, GitCompare, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DiffVisualization } from './diff-visualization'
import type { DiffData } from './types'

interface CompareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  loading: boolean
  compareData: DiffData | null
}

export const CompareDialog = React.memo(function CompareDialog({
  open,
  onOpenChange,
  loading,
  compareData,
}: CompareDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-blue-500" />
            Version Comparison
          </DialogTitle>
          {compareData && (
            <DialogDescription className="flex items-center gap-2">
              <Badge variant="outline">v{compareData.fromVersionData.versionNumber}</Badge>
              <ArrowRight className="h-4 w-4" />
              <Badge variant="outline">v{compareData.toVersionData.versionNumber}</Badge>
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : compareData ? (
            <DiffVisualization diff={compareData.diff} summary={compareData.summary} />
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
