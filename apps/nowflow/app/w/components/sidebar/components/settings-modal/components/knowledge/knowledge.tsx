'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { BookOpen, ExternalLink, Eye, EyeOff } from 'lucide-react'
import { ModernKnowledgeIcon } from '@/components/modern-settings-icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('KnowledgeSettings')

interface KnowledgeDefaults {
  embeddingModel: string
  chunkSize: number
  chunkOverlap: number
  defaultVisibility: 'private' | 'workspace' | 'public'
}

interface KnowledgeStats {
  totalSources: number
  totalDocuments: number
}

const DEFAULT_KNOWLEDGE: KnowledgeDefaults = {
  embeddingModel: 'ollama-nomic-embed-text',
  chunkSize: 1000,
  chunkOverlap: 200,
  defaultVisibility: 'private',
}

export function Knowledge() {
  const [defaults, setDefaults] = useState<KnowledgeDefaults>(DEFAULT_KNOWLEDGE)
  const [stats, setStats] = useState<KnowledgeStats>({ totalSources: 0, totalDocuments: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [isStatsLoading, setIsStatsLoading] = useState(true)
  const [openaiKey, setOpenaiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const keyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load settings from API
  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/ai/settings')
      if (response.ok) {
        const data = await response.json()
        if (data.knowledgeDefaults) {
          setDefaults({ ...DEFAULT_KNOWLEDGE, ...data.knowledgeDefaults })
        }
        // Load existing OpenAI API key
        if (data.settings?.apiKeys?.openai) {
          setOpenaiKey(data.settings.apiKeys.openai)
        }
      }
    } catch (error) {
      logger.error('Failed to load knowledge settings:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Load stats from knowledge API
  const loadStats = useCallback(async () => {
    try {
      setIsStatsLoading(true)
      const response = await fetch('/api/knowledge/sources')
      if (response.ok) {
        const data = await response.json()
        const sources = data.sources || data.data || []
        const totalDocs = sources.reduce((sum: number, s: any) => sum + (s.documentCount || 0), 0)
        setStats({ totalSources: sources.length, totalDocuments: totalDocs })
      }
    } catch (error) {
      logger.error('Failed to load knowledge stats:', error)
    } finally {
      setIsStatsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSettings()
    loadStats()
  }, [loadSettings, loadStats])

  // Debounced save
  const saveDefaults = useCallback((updated: KnowledgeDefaults) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try {
        await fetch('/api/ai/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ knowledgeDefaults: updated }),
        })
        logger.debug('Knowledge defaults saved')
      } catch (error) {
        logger.error('Failed to save knowledge defaults:', error)
      }
    }, 500)
  }, [])

  const updateDefault = <K extends keyof KnowledgeDefaults>(
    key: K,
    value: KnowledgeDefaults[K]
  ) => {
    const updated = { ...defaults, [key]: value }
    setDefaults(updated)
    saveDefaults(updated)
  }

  // Debounced save for OpenAI API key
  const saveOpenaiKey = useCallback((key: string) => {
    if (keyTimer.current) clearTimeout(keyTimer.current)
    keyTimer.current = setTimeout(async () => {
      try {
        await fetch('/api/ai/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'apiKeys.openai', value: key }),
        })
        logger.debug('OpenAI API key saved')
      } catch (error) {
        logger.error('Failed to save OpenAI API key:', error)
      }
    }, 800)
  }, [])

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-2 mb-6">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-[15px] font-logo font-semibold text-zinc-800 dark:text-white flex items-center gap-2 mb-1">
          <span className="bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10] p-1.5 rounded-lg">
            <ModernKnowledgeIcon className="h-5 w-5 text-[#4A7A68] dark:text-[#94B8A6]" />
          </span>
          Knowledge Base Settings
        </h2>
        <p className="text-[12px] font-logo text-zinc-400 dark:text-white/40 ml-9">
          Configure default settings for new knowledge sources and document processing.
        </p>
      </div>

      {/* Processing Defaults */}
      <div className="space-y-4">
        <h3 className="text-[12px] font-logo font-semibold text-zinc-800 dark:text-white">
          Processing Defaults
        </h3>
        <div className="space-y-4 ml-0.5">
          <div className="space-y-2">
            <Label className="font-logo text-[11px] text-zinc-400 dark:text-white/40">
              Default Embedding Model
            </Label>
            <Select
              value={defaults.embeddingModel}
              onValueChange={(v) => updateDefault('embeddingModel', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ollama-nomic-embed-text">
                  <span className="flex items-center gap-2">
                    System Model{' '}
                    <span className="text-[10px] text-zinc-400 dark:text-white/40">
                      Local / Free
                    </span>
                  </span>
                </SelectItem>
                <SelectItem value="openai-text-embedding-3-small">
                  <span className="flex items-center gap-2">
                    text-embedding-3-small{' '}
                    <span className="text-[10px] text-zinc-400 dark:text-white/40">API Key</span>
                  </span>
                </SelectItem>
                <SelectItem value="openai-text-embedding-3-large">
                  <span className="flex items-center gap-2">
                    text-embedding-3-large{' '}
                    <span className="text-[10px] text-zinc-400 dark:text-white/40">API Key</span>
                  </span>
                </SelectItem>
                <SelectItem value="openai-ada-002">
                  <span className="flex items-center gap-2">
                    ada-002{' '}
                    <span className="text-[10px] text-zinc-400 dark:text-white/40">API Key</span>
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            {defaults.embeddingModel.startsWith('openai-') && (
              <div className="space-y-1.5 mt-2">
                <Label className="font-logo text-[11px] text-zinc-400 dark:text-white/40">
                  OpenAI API Key
                </Label>
                <div className="relative">
                  <Input
                    type={showKey ? 'text' : 'password'}
                    placeholder="API key"
                    value={openaiKey}
                    onChange={(e) => {
                      setOpenaiKey(e.target.value)
                      saveOpenaiKey(e.target.value)
                    }}
                    className="pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-white/40 hover:text-zinc-400 dark:text-white/40 transition-colors"
                  >
                    {showKey ? (
                      <EyeOff className="h-3.5 w-3.5" strokeWidth={1.5} />
                    ) : (
                      <Eye className="h-3.5 w-3.5" strokeWidth={1.5} />
                    )}
                  </button>
                </div>
                <p className="text-[10px] text-zinc-400 dark:text-white/40">
                  Required for OpenAI embedding models
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-logo text-[11px] text-zinc-400 dark:text-white/40">
                Default Chunk Size
              </Label>
              <Input
                type="number"
                min={100}
                max={4000}
                value={defaults.chunkSize}
                onChange={(e) => {
                  const v = parseInt(e.target.value)
                  if (!isNaN(v) && v >= 100 && v <= 4000) updateDefault('chunkSize', v)
                }}
              />
              <p className="text-[10px] text-zinc-400 dark:text-white/40">100 – 4000 tokens</p>
            </div>
            <div className="space-y-2">
              <Label className="font-logo text-[11px] text-zinc-400 dark:text-white/40">
                Default Chunk Overlap
              </Label>
              <Input
                type="number"
                min={0}
                max={1000}
                value={defaults.chunkOverlap}
                onChange={(e) => {
                  const v = parseInt(e.target.value)
                  if (!isNaN(v) && v >= 0 && v <= 1000) updateDefault('chunkOverlap', v)
                }}
              />
              <p className="text-[10px] text-zinc-400 dark:text-white/40">0 – 1000 tokens</p>
            </div>
          </div>
        </div>
      </div>

      {/* Access Defaults */}
      <div className="space-y-4">
        <h3 className="text-[12px] font-logo font-semibold text-zinc-800 dark:text-white">
          Access Defaults
        </h3>
        <div className="space-y-2 ml-0.5">
          <Label className="font-logo text-[11px] text-zinc-400 dark:text-white/40">
            Default Visibility
          </Label>
          <Select
            value={defaults.defaultVisibility}
            onValueChange={(v) =>
              updateDefault('defaultVisibility', v as KnowledgeDefaults['defaultVisibility'])
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="private">Private</SelectItem>
              <SelectItem value="workspace">Workspace</SelectItem>
              <SelectItem value="public">Public</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[10px] text-zinc-400 dark:text-white/40">
            Applied when creating new knowledge sources
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="space-y-3">
        <h3 className="text-[12px] font-logo font-semibold text-zinc-800 dark:text-white">
          Overview
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="silver-glass-pane rounded-lg bg-transparent p-3">
            <p className="text-[10px] text-zinc-400 dark:text-white/40 uppercase tracking-[0.1em] mb-1">
              Sources
            </p>
            {isStatsLoading ? (
              <Skeleton className="h-6 w-10" />
            ) : (
              <p className="text-[15px] font-logo font-semibold text-zinc-800 dark:text-white">
                {stats.totalSources}
              </p>
            )}
          </div>
          <div className="silver-glass-pane rounded-lg bg-transparent p-3">
            <p className="text-[10px] text-zinc-400 dark:text-white/40 uppercase tracking-[0.1em] mb-1">
              Documents
            </p>
            {isStatsLoading ? (
              <Skeleton className="h-6 w-10" />
            ) : (
              <p className="text-[15px] font-logo font-semibold text-zinc-800 dark:text-white">
                {stats.totalDocuments}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Link to Knowledge Page */}
      <div className="rounded-lg border border-black/[0.06] dark:border-white/[0.06] bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10] p-4">
        <div className="flex items-start gap-3">
          <BookOpen
            className="h-4 w-4 text-[#4A7A68] dark:text-[#94B8A6] mt-0.5 shrink-0"
            strokeWidth={1.5}
          />
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-logo text-zinc-400 dark:text-white/40">
              Manage knowledge sources, upload documents, and configure embeddings on the Knowledge
              page.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 gap-1.5"
              onClick={() => window.open('/w/knowledge', '_blank')}
            >
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} />
              Open Knowledge Page
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
