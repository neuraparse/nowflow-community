'use client'

import { useCallback, useEffect, useState } from 'react'
import { FlaskConical } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { createLogger } from '@/lib/logs/console-logger'
import { cn } from '@/lib/utils'
import { useWorkflowRegistry } from '@/stores/workflows/registry/store'
import { useWorkspaces } from '@/hooks/use-workspaces'

const logger = createLogger('ResearchConsentCard')

type ConsentResponse = {
  workspaceId: string
  researchConsent: boolean
  researchConsentAt: string | null
}

export function ResearchConsentCard() {
  const activeWorkspaceId = useWorkflowRegistry((s) => s.activeWorkspaceId)
  const { workspaces } = useWorkspaces()

  const role = workspaces?.find((w) => w.id === activeWorkspaceId)?.role ?? null
  const canEdit = role === 'owner'

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [consent, setConsent] = useState(false)
  const [consentAt, setConsentAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchConsent = useCallback(async (workspaceId: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/research-consent`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: ConsentResponse = await res.json()
      setConsent(Boolean(data.researchConsent))
      setConsentAt(data.researchConsentAt)
    } catch (err) {
      logger.error('Failed to load research consent', err)
      setError('Could not load research participation status.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!activeWorkspaceId) return
    fetchConsent(activeWorkspaceId)
  }, [activeWorkspaceId, fetchConsent])

  const onToggle = async (next: boolean) => {
    if (!activeWorkspaceId || !canEdit || saving) return
    setSaving(true)
    setError(null)
    const previous = consent
    setConsent(next)
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspaceId}/research-consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consent: next }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: ConsentResponse = await res.json()
      setConsent(Boolean(data.researchConsent))
      setConsentAt(data.researchConsentAt)
    } catch (err) {
      logger.error('Failed to update research consent', err)
      setConsent(previous)
      setError('Could not update research participation. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <h4 className="font-logo text-[12px] font-medium text-zinc-800 dark:text-white">
        Research Participation
      </h4>

      <div
        className={cn(
          'silver-glass-pane flex items-start gap-3 rounded-lg bg-transparent py-3 px-4',
          loading && 'opacity-60'
        )}
      >
        <span className="bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10] p-2 rounded-lg">
          <FlaskConical className="h-4 w-4 text-[#4A7A68] dark:text-[#94B8A6]" strokeWidth={1.5} />
        </span>
        <div className="flex-1 space-y-1">
          <p className="font-logo text-[12px] font-medium text-zinc-800 dark:text-white">
            Contribute to academic research
          </p>
          <p className="text-[11px] font-logo leading-relaxed text-zinc-400 dark:text-white/40">
            When enabled, anonymized aggregate workflow telemetry from this workspace may be
            included in academic studies on human–AI collaboration. Identifiers are hashed before
            extraction and only groups of ten or more workspaces are kept; raw data never leaves our
            infrastructure. You can turn this off at any time.
          </p>
          {consentAt && (
            <p className="text-[10px] font-logo text-zinc-400/70 dark:text-white/30">
              Last updated {new Date(consentAt).toLocaleString()}
            </p>
          )}
          {!canEdit && role && (
            <p className="text-[11px] font-logo text-amber-600 dark:text-amber-400">
              Only the workspace owner can change this setting.
            </p>
          )}
          {error && <p className="text-[11px] font-logo text-red-600 dark:text-red-400">{error}</p>}
        </div>
        <Switch
          checked={consent}
          disabled={!canEdit || loading || saving}
          onCheckedChange={onToggle}
          aria-label="Contribute to academic research"
        />
      </div>
    </div>
  )
}
