'use client'

import { useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  MessageSquare,
  RefreshCw,
  UserCheck,
  XCircle,
} from 'lucide-react'
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
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { PanelEmptyState, PanelHeader, PanelLoadingSkeleton } from '../shared'

interface HITLRequest {
  id: string
  workflowId: string
  executionId: string
  blockId: string
  requestType: 'approval' | 'input' | 'review' | 'escalation'
  status: 'pending' | 'approved' | 'rejected' | 'timeout' | 'cancelled'
  title: string
  description: string | null
  data: any
  priority: 'low' | 'normal' | 'high' | 'urgent'
  timeoutAt: string | null
  createdAt: string
  respondedAt: string | null
}

interface HITLRequestsPanelProps {
  workflowId?: string
  panelWidth?: number
}

export function HITLRequestsPanel({ workflowId, panelWidth = 400 }: HITLRequestsPanelProps) {
  const [requests, setRequests] = useState<HITLRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedRequest, setSelectedRequest] = useState<HITLRequest | null>(null)
  const [responseNote, setResponseNote] = useState('')
  const [respondDialogOpen, setRespondDialogOpen] = useState(false)
  const [respondAction, setRespondAction] = useState<'approve' | 'reject'>('approve')
  const [isPolling, setIsPolling] = useState(false)
  const [viewMode, setViewMode] = useState<'pending' | 'all'>('pending')

  const isCompact = panelWidth < 400

  // Adaptive polling: 10s when there are pending requests, 30s otherwise
  const hasPending = requests.some((r) => r.status === 'pending')
  useEffect(() => {
    fetchRequests()
    const pollInterval = hasPending ? 10000 : 30000
    const interval = setInterval(() => {
      setIsPolling(true)
      fetchRequests().finally(() => setIsPolling(false))
    }, pollInterval)
    return () => clearInterval(interval)
  }, [workflowId, hasPending])

  const fetchRequests = async () => {
    try {
      const url = workflowId ? `/api/hitl/requests?workflowId=${workflowId}` : '/api/hitl/requests'
      const response = await fetch(url)
      const data = await response.json()
      if (data.success) {
        setRequests(data.data)
        setError(null)
      } else {
        setError(data.error || 'Failed to fetch requests')
      }
    } catch (err) {
      console.error('Failed to fetch HITL requests:', err)
      setError('Failed to load requests')
    } finally {
      setLoading(false)
    }
  }

  const handleRespond = async (approved: boolean) => {
    if (!selectedRequest) return

    try {
      const response = await fetch(`/api/hitl/requests/${selectedRequest.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved, note: responseNote }),
      })
      const data = await response.json()
      if (data.success) {
        setRespondDialogOpen(false)
        setResponseNote('')
        fetchRequests()
      }
    } catch (err) {
      console.error('Failed to respond to request:', err)
    }
  }

  const getPriorityStyle = (priority: string) => {
    const styles: Record<string, { badge: string; border: string }> = {
      low: {
        badge: 'bg-zinc-500/10 text-zinc-600 dark:text-white/60',
        border: 'border-l-slate-400',
      },
      normal: {
        badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
        border: 'border-l-blue-500',
      },
      high: {
        badge: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
        border: 'border-l-orange-500',
      },
      urgent: { badge: 'bg-red-500/10 text-red-600 dark:text-red-400', border: 'border-l-red-500' },
    }
    return styles[priority] || styles.normal
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
      case 'rejected':
        return <XCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
      case 'timeout':
        return <AlertTriangle className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
      default:
        return <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
    }
  }

  const pendingRequests = requests.filter((r) => r.status === 'pending')
  const completedRequests = requests.filter((r) => r.status !== 'pending')
  const displayedRequests = viewMode === 'pending' ? pendingRequests : requests

  if (loading) {
    return <PanelLoadingSkeleton showHeader variant="card" itemCount={3} />
  }

  const headerActions = (
    <div className="flex items-center gap-1">
      {isPolling && <RefreshCw className="h-3 w-3 text-muted-foreground animate-spin" />}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => fetchRequests()}
        className="silver-glass-chip h-7 w-7 rounded-xl p-0 text-muted-foreground hover:text-amber-600"
        title="Refresh"
      >
        <RefreshCw className="h-3 w-3" />
      </Button>
    </div>
  )

  // Toggle buttons for view mode
  const viewToggle = (
    <div className="silver-glass-pane flex items-center gap-1 rounded-xl p-0.5">
      <button
        onClick={() => setViewMode('pending')}
        className={`rounded-lg px-2 py-1 text-[10px] font-medium transition-colors ${
          viewMode === 'pending'
            ? 'silver-glass-chip text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        Pending {pendingRequests.length > 0 && `(${pendingRequests.length})`}
      </button>
      <button
        onClick={() => setViewMode('all')}
        className={`rounded-lg px-2 py-1 text-[10px] font-medium transition-colors ${
          viewMode === 'all'
            ? 'silver-glass-chip text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        All ({requests.length})
      </button>
    </div>
  )

  return (
    <div className="h-full flex flex-col">
      <PanelHeader
        title="HITL Requests"
        icon={UserCheck}
        count={pendingRequests.length}
        accentColor="slate"
        pulseDot={pendingRequests.length > 0}
        actions={headerActions}
        secondaryContent={viewToggle}
      />

      {/* Error state */}
      {error && (
        <div className="silver-glass-pane smoky-glass-pane mx-3 mt-2 rounded-xl border border-rose-500/[0.16] bg-rose-500/[0.05] p-2 dark:border-rose-400/[0.14] dark:bg-rose-400/[0.06]">
          <div className="flex items-center gap-2 text-xs text-rose-700 dark:text-rose-100/82">
            <AlertTriangle className="h-3 w-3 flex-shrink-0" />
            <span className="flex-1 truncate">{error}</span>
            <Button
              variant="ghost"
              size="sm"
              className="smoky-glass-chip h-5 px-2 text-[10px]"
              onClick={() => fetchRequests()}
            >
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* Single scroll area for all requests */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {displayedRequests.length === 0 ? (
          <PanelEmptyState
            icon={UserCheck}
            title={viewMode === 'pending' ? 'No pending requests' : 'No requests'}
            description={
              viewMode === 'pending'
                ? 'Requests will appear here when workflows need approval'
                : 'No HITL requests found'
            }
            accentColor="slate"
          />
        ) : (
          <ScrollArea className="h-full">
            <div className="p-3 space-y-2">
              {displayedRequests.map((request) => {
                const style = getPriorityStyle(request.priority)
                const isPending = request.status === 'pending'

                return (
                  <div
                    key={request.id}
                    className={`silver-glass-pane rounded-2xl border border-l-2 p-2.5 ${style.border} ${
                      isPending
                        ? 'bg-amber-50/30 dark:bg-amber-950/10 border-amber-200/50 dark:border-amber-900/30'
                        : 'bg-muted/20 border-border/40'
                    }`}
                  >
                    {/* Title row */}
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {!isPending && getStatusIcon(request.status)}
                          <span className="font-medium text-sm truncate">{request.title}</span>
                          <Badge className={`${style.badge} text-[10px] h-4`}>
                            {request.priority}
                          </Badge>
                          <Badge className="bg-zinc-500/10 text-zinc-600 dark:text-white/60 text-[10px] h-4">
                            {request.requestType}
                          </Badge>
                        </div>

                        {request.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                            {request.description}
                          </p>
                        )}

                        <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
                          <span>
                            {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                          </span>
                          {isPending && request.timeoutAt && (
                            <span className="text-orange-600 dark:text-orange-400">
                              Expires{' '}
                              {formatDistanceToNow(new Date(request.timeoutAt), {
                                addSuffix: true,
                              })}
                            </span>
                          )}
                          {!isPending && request.respondedAt && (
                            <span className="text-green-600 dark:text-green-400">
                              {request.status}{' '}
                              {formatDistanceToNow(new Date(request.respondedAt), {
                                addSuffix: true,
                              })}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action buttons - only for pending */}
                      {isPending && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                            onClick={() => {
                              setSelectedRequest(request)
                              setRespondAction('reject')
                              setRespondDialogOpen(true)
                            }}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            {!isCompact && <span className="ml-1 text-xs">Reject</span>}
                          </Button>
                          <Button
                            size="sm"
                            className="h-7 px-2 bg-green-600 hover:bg-green-700"
                            onClick={() => {
                              setSelectedRequest(request)
                              setRespondAction('approve')
                              setRespondDialogOpen(true)
                            }}
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            {!isCompact && <span className="ml-1 text-xs">Approve</span>}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Response Dialog */}
      <Dialog open={respondDialogOpen} onOpenChange={setRespondDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {respondAction === 'approve' ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              {respondAction === 'approve' ? 'Approve Request' : 'Reject Request'}
            </DialogTitle>
            <DialogDescription>{selectedRequest?.title}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {selectedRequest?.data && (
              <div className="p-2 rounded-lg bg-muted/50 max-h-32 overflow-auto">
                <p className="text-xs font-medium mb-1">Request Data:</p>
                <pre className="text-[10px] text-muted-foreground">
                  {JSON.stringify(selectedRequest.data, null, 2)}
                </pre>
              </div>
            )}
            <div>
              <label className="text-xs font-medium">Response Note (optional)</label>
              <Textarea
                value={responseNote}
                onChange={(e) => setResponseNote(e.target.value)}
                placeholder="Add a note..."
                className="mt-1 h-20 text-sm"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setRespondDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => handleRespond(respondAction === 'approve')}
              className={
                respondAction === 'approve'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-red-600 hover:bg-red-700'
              }
            >
              {respondAction === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
