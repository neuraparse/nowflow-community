'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, Database, Globe, Loader2, Lock, Settings, Users } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { KnowledgeSourceVisibility } from '@/lib/knowledge/types'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('CreateSourceModal')

const ICON_OPTIONS = ['📄', '📚', '📁', '🔐', '📖', '📑', '🗂️', '💼', '🎯', '⚙️']

const DEFAULT_EMBEDDING_MODEL = 'ollama-nomic-embed-text'

interface CreateSourceModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  workspaceId?: string
}

export function CreateSourceModal({
  open,
  onOpenChange,
  onSuccess,
  workspaceId,
}: CreateSourceModalProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: '📄',
    visibility: 'private' as KnowledgeSourceVisibility,
    embeddingModel: DEFAULT_EMBEDDING_MODEL,
    chunkSize: 1000,
    chunkOverlap: 200,
  })

  useEffect(() => {
    if (open) {
      fetch('/api/ai/settings')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.knowledgeDefaults) {
            const d = data.knowledgeDefaults
            setFormData((prev) => ({
              ...prev,
              embeddingModel: d.embeddingModel || DEFAULT_EMBEDDING_MODEL,
              chunkSize: d.chunkSize || 1000,
              chunkOverlap: d.chunkOverlap || 200,
              visibility: d.defaultVisibility || 'private',
            }))
          }
        })
        .catch(() => {})
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) return

    setLoading(true)
    try {
      const response = await fetch('/api/knowledge/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          ...formData,
          workspaceId,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create knowledge source')
      }

      setFormData({
        name: '',
        description: '',
        icon: '📄',
        visibility: 'private',
        embeddingModel: DEFAULT_EMBEDDING_MODEL,
        chunkSize: 1000,
        chunkOverlap: 200,
      })

      onOpenChange(false)
      onSuccess()
    } catch (error: any) {
      logger.error('Failed to create knowledge source', error)
      alert(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const visibilityOptions = [
    { value: 'private' as const, icon: Lock, label: 'Private', desc: 'Only you can access' },
    { value: 'workspace' as const, icon: Users, label: 'Workspace', desc: 'Workspace members' },
    { value: 'public' as const, icon: Globe, label: 'Public', desc: 'Anyone can access' },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] rounded-[16px] p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-0">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-9 w-9 rounded-lg bg-[#4A7A68]/[0.06] dark:bg-[#94B8A6]/[0.06] flex items-center justify-center">
              <Database className="h-4 w-4 text-[#4A7A68] dark:text-[#94B8A6]" strokeWidth={1.5} />
            </div>
            <div>
              <DialogTitle className="text-[15px] font-logo font-semibold text-zinc-800 dark:text-white tracking-tight">
                Create Knowledge Source
              </DialogTitle>
              <p className="text-[12px] font-logo text-zinc-500 dark:text-white/90 mt-0.5">
                Store documents for your AI agents
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-5">
            {/* Separator */}
            <div className="h-px bg-black/[0.04] dark:bg-white/[0.04] -mx-6" />

            {/* Name and Icon */}
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-white/90 font-logo mb-1.5 block">
                  Icon
                </label>
                <Select
                  value={formData.icon}
                  onValueChange={(value) => setFormData({ ...formData, icon: value })}
                >
                  <SelectTrigger className="w-14 h-10 rounded-lg text-lg focus:ring-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg">
                    {ICON_OPTIONS.map((icon) => (
                      <SelectItem key={icon} value={icon} className="text-lg cursor-pointer">
                        {icon}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-white/90 font-logo mb-1.5 block">
                  Name <span className="text-[#4A7A68]">*</span>
                </label>
                <input
                  placeholder="e.g., Product Documentation"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="silver-glass-pane smoky-glass-pane glass-field w-full h-10 px-3 rounded-lg border-0 bg-transparent text-[13px] font-logo text-zinc-800 dark:text-white/90 placeholder:text-zinc-400 dark:placeholder:text-white/50 focus:outline-none focus:ring-0 transition-all"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-white/90 font-logo mb-1.5 block">
                Description
              </label>
              <textarea
                placeholder="Describe what this knowledge source contains..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                className="silver-glass-pane smoky-glass-pane glass-textarea w-full px-3 py-2.5 rounded-lg border-0 bg-transparent text-[13px] font-logo text-zinc-800 dark:text-white/90 placeholder:text-zinc-400 dark:placeholder:text-white/50 focus:outline-none focus:ring-0 transition-all resize-none"
              />
            </div>

            {/* Visibility */}
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-white/90 font-logo mb-2 block">
                Visibility
              </label>
              <div className="grid grid-cols-3 gap-2">
                {visibilityOptions.map((opt) => {
                  const isSelected = formData.visibility === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, visibility: opt.value })}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all text-center ${
                        isSelected
                          ? 'border-[#4A7A68]/20 bg-[#4A7A68]/[0.04] dark:border-[#94B8A6]/20 dark:bg-[#94B8A6]/[0.04]'
                          : 'border-black/[0.04] dark:border-white/[0.04] bg-transparent hover:bg-[#fafafa] dark:hover:bg-white/[0.01]'
                      }`}
                    >
                      <opt.icon
                        className={`h-3.5 w-3.5 ${
                          isSelected
                            ? 'text-[#4A7A68] dark:text-[#94B8A6]'
                            : 'text-zinc-400 dark:text-white/60'
                        }`}
                        strokeWidth={1.5}
                      />
                      <span
                        className={`text-[12px] font-logo font-medium ${
                          isSelected
                            ? 'text-[#4A7A68] dark:text-[#94B8A6]'
                            : 'text-zinc-600 dark:text-white/80'
                        }`}
                      >
                        {opt.label}
                      </span>
                      <span className="text-[10px] font-logo text-zinc-400 dark:text-white/60 leading-tight">
                        {opt.desc}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Advanced Settings */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Settings className="h-3 w-3 text-zinc-400 dark:text-white/60" strokeWidth={1.5} />
                <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-white/90 font-logo">
                  Chunking
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-zinc-500 dark:text-white/90 font-logo mb-1 block">
                    Chunk Size (tokens)
                  </label>
                  <input
                    type="number"
                    min={100}
                    max={4000}
                    value={formData.chunkSize}
                    onChange={(e) =>
                      setFormData({ ...formData, chunkSize: parseInt(e.target.value) || 1000 })
                    }
                    className="silver-glass-pane smoky-glass-pane glass-field w-full h-9 px-3 rounded-lg border-0 bg-transparent text-[13px] font-logo text-zinc-800 dark:text-white/90 focus:outline-none focus:ring-0 transition-all"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 dark:text-white/90 font-logo mb-1 block">
                    Chunk Overlap (tokens)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={1000}
                    value={formData.chunkOverlap}
                    onChange={(e) =>
                      setFormData({ ...formData, chunkOverlap: parseInt(e.target.value) || 200 })
                    }
                    className="silver-glass-pane smoky-glass-pane glass-field w-full h-9 px-3 rounded-lg border-0 bg-transparent text-[13px] font-logo text-zinc-800 dark:text-white/90 focus:outline-none focus:ring-0 transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="h-px bg-black/[0.04] dark:bg-white/[0.04]" />
          <div className="px-6 py-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="h-9 px-4 rounded-lg text-[13px] font-logo font-medium text-zinc-500 dark:text-white/60 hover:text-zinc-700 dark:hover:text-white/90 hover:bg-zinc-100 dark:hover:bg-white/[0.04] transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.name.trim()}
              className="h-9 px-4 rounded-lg bg-[#4A7A68] hover:bg-[#3d6556] text-white text-[13px] font-logo font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
                  Creating...
                </>
              ) : (
                <>
                  Create Source
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />
                </>
              )}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
