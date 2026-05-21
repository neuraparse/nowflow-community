'use client'

import {
  type ChangeEvent,
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import Image from 'next/image'
import {
  Download,
  ExternalLink,
  Filter,
  Github,
  Globe,
  Link,
  Package,
  Plus,
  Puzzle,
  Search,
  Settings2,
  Store,
  Trash2,
  X,
} from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Switch } from '@/components/ui/switch'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('Skills')

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SkillConfigField {
  key: string
  label: string
  type: 'text' | 'password' | 'number' | 'boolean' | 'select'
  description?: string
  required?: boolean
  default?: string | number | boolean
  options?: { label: string; value: string }[]
}

interface Skill {
  id: string
  name: string
  version: string
  description: string
  author: string
  category: SkillCategory
  enabled: boolean
  icon?: string
  homepage?: string
  installedAt?: string | null
  configFields?: SkillConfigField[]
  config?: Record<string, string | number | boolean>
}

type SkillCategory =
  | 'ai'
  | 'automation'
  | 'analytics'
  | 'communication'
  | 'data'
  | 'development'
  | 'integration'
  | 'security'
  | 'utility'

type InstallSource = 'url' | 'github' | 'marketplace'

const CATEGORY_COLORS: Record<SkillCategory, string> = {
  ai: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-300 border-cyan-500/20',
  automation: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  analytics: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  communication: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
  data: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  development: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
  integration: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20',
  security: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  utility: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20',
}

const ALL_CATEGORIES: SkillCategory[] = [
  'ai',
  'automation',
  'analytics',
  'communication',
  'data',
  'development',
  'integration',
  'security',
  'utility',
]

const INSTALL_SOURCE_OPTIONS = [
  { key: 'url' as const, icon: Link, label: 'URL' },
  { key: 'github' as const, icon: Github, label: 'GitHub' },
  { key: 'marketplace' as const, icon: Store, label: 'Marketplace' },
] satisfies Array<{ key: InstallSource; icon: typeof Link; label: string }>

const EMPTY_SKILLS: Skill[] = []

const INSTALLED_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

function formatInstalledDate(value?: string | null) {
  if (!value) {
    return 'recently'
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? 'recently' : INSTALLED_DATE_FORMATTER.format(date)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function SkillsComponent() {
  const { isSectionActive, rootRef } = useSettingsSectionVisibility()
  const [skills, setSkills] = useState<Skill[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasLoadedSkills, setHasLoadedSkills] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const [categoryFilter, setCategoryFilter] = useState<SkillCategory | 'all'>('all')
  const fetchRequestIdRef = useRef(0)

  // Install dialog
  const [installDialogOpen, setInstallDialogOpen] = useState(false)
  const [installSource, setInstallSource] = useState<InstallSource>('url')
  const [installUrl, setInstallUrl] = useState('')
  const [isInstalling, setIsInstalling] = useState(false)

  // Config dialog
  const [configDialogOpen, setConfigDialogOpen] = useState(false)
  const [configuringSkill, setConfiguringSkill] = useState<Skill | null>(null)
  const [configValues, setConfigValues] = useState<Record<string, string | number | boolean>>({})
  const [isSavingConfig, setIsSavingConfig] = useState(false)

  // Uninstall dialog
  const [uninstallDialogOpen, setUninstallDialogOpen] = useState(false)
  const [uninstallingSkillId, setUninstallingSkillId] = useState<string | null>(null)

  // Toggling
  const [togglingSkillId, setTogglingSkillId] = useState<string | null>(null)

  // ---------- Data fetching ----------

  const fetchSkills = useCallback(async (signal?: AbortSignal) => {
    const requestId = ++fetchRequestIdRef.current

    setIsLoading(true)
    try {
      const response = await fetch('/api/skills', { signal })
      if (signal?.aborted || requestId !== fetchRequestIdRef.current) {
        return
      }

      if (response.ok) {
        const data = await response.json()
        if (signal?.aborted || requestId !== fetchRequestIdRef.current) {
          return
        }

        setSkills(data.skills ?? [])
        setHasLoadedSkills(true)
      } else {
        logger.error('Failed to fetch skills', { status: response.status })
      }
    } catch (error) {
      if (signal?.aborted) {
        return
      }

      logger.error('Error fetching skills:', error)
    } finally {
      if (!signal?.aborted && requestId === fetchRequestIdRef.current) {
        setIsLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    if (!isSectionActive || hasLoadedSkills) {
      return
    }

    const controller = new AbortController()
    void fetchSkills(controller.signal)

    return () => {
      controller.abort()
    }
  }, [fetchSkills, hasLoadedSkills, isSectionActive])

  // ---------- Filtered list ----------

  const searchableSkills = useMemo(
    () =>
      skills.map((skill) => ({
        skill,
        searchText: `${skill.name} ${skill.description} ${skill.author}`.toLowerCase(),
      })),
    [skills]
  )

  const filteredSkills = useMemo(() => {
    if (!isSectionActive) {
      return EMPTY_SKILLS
    }

    let result = searchableSkills

    if (categoryFilter !== 'all') {
      result = result.filter(({ skill }) => skill.category === categoryFilter)
    }

    const q = deferredSearchQuery.trim().toLowerCase()

    if (q) {
      result = result.filter(({ searchText }) => searchText.includes(q))
    }

    return result.map(({ skill }) => skill)
  }, [searchableSkills, deferredSearchQuery, categoryFilter, isSectionActive])

  // ---------- Install ----------

  const handleInstall = useCallback(async () => {
    if (!installUrl.trim()) return

    setIsInstalling(true)
    try {
      const response = await fetch('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: installSource, url: installUrl.trim() }),
      })

      if (response.ok) {
        await fetchSkills()
        setInstallDialogOpen(false)
        setInstallUrl('')
        logger.info('Skill installed successfully')
      } else {
        const data = await response.json().catch(() => ({}))
        logger.error('Failed to install skill:', data)
      }
    } catch (error) {
      logger.error('Error installing skill:', error)
    } finally {
      setIsInstalling(false)
    }
  }, [fetchSkills, installSource, installUrl])

  const closeInstallDialog = useCallback(() => {
    setInstallDialogOpen(false)
    setInstallUrl('')
  }, [])

  const openInstallDialog = useCallback(() => {
    setInstallDialogOpen(true)
  }, [])

  // ---------- Toggle ----------

  const handleToggle = useCallback(async (skill: Skill) => {
    setTogglingSkillId(skill.id)
    const newEnabled = !skill.enabled

    // Optimistic update
    setSkills((prev) => prev.map((s) => (s.id === skill.id ? { ...s, enabled: newEnabled } : s)))

    try {
      const response = await fetch(`/api/skills?id=${skill.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newEnabled }),
      })

      if (!response.ok) {
        // Revert on failure
        setSkills((prev) =>
          prev.map((s) => (s.id === skill.id ? { ...s, enabled: !newEnabled } : s))
        )
        logger.error('Failed to toggle skill')
      }
    } catch (error) {
      setSkills((prev) => prev.map((s) => (s.id === skill.id ? { ...s, enabled: !newEnabled } : s)))
      logger.error('Error toggling skill:', error)
    } finally {
      setTogglingSkillId(null)
    }
  }, [])

  // ---------- Configure ----------

  const openConfig = useCallback((skill: Skill) => {
    setConfiguringSkill(skill)
    setConfigValues(skill.config ?? {})
    setConfigDialogOpen(true)
  }, [])

  const closeConfig = useCallback(() => {
    setConfigDialogOpen(false)
    setConfiguringSkill(null)
    setConfigValues({})
  }, [])

  const handleConfigValueChange = useCallback((key: string, value: string | number | boolean) => {
    setConfigValues((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleSaveConfig = useCallback(async () => {
    if (!configuringSkill) return

    setIsSavingConfig(true)
    try {
      const response = await fetch(`/api/skills?id=${configuringSkill.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: configValues }),
      })

      if (response.ok) {
        setSkills((prev) =>
          prev.map((s) => (s.id === configuringSkill.id ? { ...s, config: configValues } : s))
        )
        setConfigDialogOpen(false)
        setConfiguringSkill(null)
        logger.info('Skill configuration saved')
      } else {
        logger.error('Failed to save skill config')
      }
    } catch (error) {
      logger.error('Error saving skill config:', error)
    } finally {
      setIsSavingConfig(false)
    }
  }, [configuringSkill, configValues])

  // ---------- Uninstall ----------

  const requestUninstall = useCallback((skillId: string) => {
    setUninstallingSkillId(skillId)
    setUninstallDialogOpen(true)
  }, [])

  const handleUninstall = useCallback(async () => {
    if (!uninstallingSkillId) return

    try {
      const response = await fetch(`/api/skills?id=${uninstallingSkillId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setSkills((prev) => prev.filter((s) => s.id !== uninstallingSkillId))
        logger.info('Skill uninstalled')
      } else {
        logger.error('Failed to uninstall skill')
      }
    } catch (error) {
      logger.error('Error uninstalling skill:', error)
    } finally {
      setUninstallDialogOpen(false)
      setUninstallingSkillId(null)
    }
  }, [uninstallingSkillId])

  const clearFilters = useCallback(() => {
    setSearchQuery('')
    setCategoryFilter('all')
  }, [])

  const clearSearch = useCallback(() => {
    setSearchQuery('')
  }, [])

  const handleCategoryFilterChange = useCallback((val: string) => {
    setCategoryFilter(val as SkillCategory | 'all')
  }, [])

  const handleSearchChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value)
  }, [])

  // ---------- Render ----------

  const uninstallingSkill = useMemo(
    () => skills.find((s) => s.id === uninstallingSkillId),
    [skills, uninstallingSkillId]
  )

  return (
    <div ref={rootRef} className="p-5 space-y-4">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-[15px] font-logo font-semibold text-zinc-800 dark:text-white flex items-center gap-2">
            <span className="bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10] p-1.5 rounded-lg">
              <Puzzle className="h-5 w-5 text-[#4A7A68] dark:text-[#94B8A6]" strokeWidth={1.5} />
            </span>
            Skills & Integrations
            {skills.length > 0 && (
              <span className="text-xs font-normal bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10] text-[#4A7A68] dark:text-[#94B8A6] px-2 py-0.5 rounded-full">
                {skills.length}
              </span>
            )}
          </h2>
          <Button size="sm" onClick={openInstallDialog} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
            Install Skill
          </Button>
        </div>
        <p className="text-[12px] font-logo text-zinc-400 dark:text-white/40 mb-4 ml-9">
          Install, configure, and manage skills from the marketplace or custom sources.
        </p>
      </div>

      {/* Search & Filter Bar */}
      {!isLoading && skills.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 dark:text-white/40"
              strokeWidth={1.5}
            />
            <Input
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search skills..."
              className="h-8 pl-9 text-[13px] font-logo"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:text-white/40 dark:hover:text-white/60 transition-colors"
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
            )}
          </div>
          <Select value={categoryFilter} onValueChange={handleCategoryFilterChange}>
            <SelectTrigger className="h-8 w-[160px] text-[13px] font-logo focus:ring-0">
              <Filter
                className="h-3.5 w-3.5 mr-1.5 text-zinc-400 dark:text-white/40"
                strokeWidth={1.5}
              />
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {ALL_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat} className="capitalize">
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Skills List */}
      {isLoading ? (
        <div className="space-y-3">
          <SkillCardSkeleton />
          <SkillCardSkeleton />
          <SkillCardSkeleton />
        </div>
      ) : skills.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="h-12 w-12 rounded-full bg-black/[0.04] dark:bg-white/[0.04] flex items-center justify-center mb-3">
            <Package className="h-6 w-6 text-zinc-400 dark:text-white/40" strokeWidth={1.5} />
          </div>
          <h4 className="text-[15px] font-logo font-medium text-zinc-800 dark:text-white mb-2">
            No skills installed
          </h4>
          <p className="text-[12px] font-logo text-zinc-400 dark:text-white/40 mb-4 max-w-sm">
            Skills extend your workflows with powerful integrations and automations. Install your
            first skill to get started.
          </p>
          <Button onClick={openInstallDialog} className="gap-1.5">
            <Plus className="h-4 w-4" strokeWidth={1.5} />
            Install your first skill
          </Button>
        </div>
      ) : filteredSkills.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <Search className="h-8 w-8 text-zinc-300 dark:text-white/20 mb-3" strokeWidth={1.5} />
          <p className="text-[13px] font-logo text-zinc-400 dark:text-white/40">
            No skills match your search.
          </p>
          <button
            type="button"
            onClick={clearFilters}
            className="text-[12px] font-logo text-[#4A7A68] dark:text-[#94B8A6] hover:underline mt-1"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSkills.map((skill) => (
            <SkillCard
              key={skill.id}
              isToggling={togglingSkillId === skill.id}
              onConfigure={openConfig}
              onRequestUninstall={requestUninstall}
              onToggle={handleToggle}
              skill={skill}
            />
          ))}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Install Skill Dialog                                               */}
      {/* ----------------------------------------------------------------- */}
      <Dialog open={installDialogOpen} onOpenChange={setInstallDialogOpen}>
        <DialogContent className="sm:max-w-[440px] rounded-[16px]">
          <DialogHeader>
            <DialogTitle className="text-[15px] font-logo font-semibold text-zinc-800 dark:text-white flex items-center gap-2">
              <Download className="h-4 w-4 text-[#4A7A68] dark:text-[#94B8A6]" strokeWidth={1.5} />
              Install Skill
            </DialogTitle>
            <DialogDescription className="sr-only">
              Install a skill from a package URL, GitHub repository, or marketplace identifier.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Source selector */}
            <div className="space-y-2">
              <Label className="text-[12px] font-logo">Install from</Label>
              <div className="grid grid-cols-3 gap-2">
                {INSTALL_SOURCE_OPTIONS.map(({ key, icon: Icon, label }) => (
                  <InstallSourceButton
                    key={key}
                    icon={Icon}
                    label={label}
                    onSelect={setInstallSource}
                    selected={installSource === key}
                    source={key}
                  />
                ))}
              </div>
            </div>

            {/* Input field */}
            <div className="space-y-2">
              <Label className="text-[12px] font-logo">
                {installSource === 'url'
                  ? 'Skill Package URL'
                  : installSource === 'github'
                    ? 'GitHub Repository'
                    : 'Marketplace Skill ID'}
              </Label>
              <Input
                value={installUrl}
                onChange={(e) => setInstallUrl(e.target.value)}
                placeholder={
                  installSource === 'url'
                    ? 'https://example.com/skill-package.tar.gz'
                    : installSource === 'github'
                      ? 'owner/repo or https://github.com/owner/repo'
                      : 'Search the marketplace...'
                }
                className="h-9 text-[13px] font-logo"
              />
              {installSource === 'github' && (
                <p className="text-[11px] font-logo text-zinc-400 dark:text-white/30">
                  Provide a GitHub repository in the format{' '}
                  <code className="font-mono text-[10px] bg-black/[0.04] dark:bg-white/[0.06] px-1 py-0.5 rounded">
                    owner/repo
                  </code>{' '}
                  or a full URL.
                </p>
              )}
              {installSource === 'marketplace' && (
                <p className="text-[11px] font-logo text-zinc-400 dark:text-white/30 flex items-center gap-1">
                  <Globe className="h-3 w-3" strokeWidth={1.5} />
                  Browse the full marketplace at{' '}
                  <a href="#" className="text-[#4A7A68] dark:text-[#94B8A6] hover:underline">
                    marketplace.nowflow.dev
                  </a>
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={closeInstallDialog}
              className="silver-glass-button font-logo text-[13px] border-black/[0.06] dark:border-white/[0.08]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleInstall}
              disabled={!installUrl.trim() || isInstalling}
              className="gap-1.5 font-logo text-[13px]"
            >
              {isInstalling ? (
                <>
                  <Download className="h-3.5 w-3.5 animate-bounce" strokeWidth={1.5} />
                  Installing...
                </>
              ) : (
                <>
                  <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Install
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ----------------------------------------------------------------- */}
      {/* Configure Skill Dialog                                             */}
      {/* ----------------------------------------------------------------- */}
      <Dialog
        open={configDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeConfig()
            return
          }

          setConfigDialogOpen(open)
        }}
      >
        <DialogContent className="sm:max-w-[440px] rounded-[16px]">
          <DialogHeader>
            <DialogTitle className="text-[15px] font-logo font-semibold text-zinc-800 dark:text-white flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-[#4A7A68] dark:text-[#94B8A6]" strokeWidth={1.5} />
              Configure {configuringSkill?.name}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Configure the selected skill fields and save the changes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            {configuringSkill?.configFields?.map((field) => (
              <ConfigFieldControl
                key={field.key}
                field={field}
                onChange={handleConfigValueChange}
                value={configValues[field.key]}
              />
            ))}

            {(!configuringSkill?.configFields || configuringSkill.configFields.length === 0) && (
              <div className="text-center py-6">
                <p className="text-[12px] font-logo text-zinc-400 dark:text-white/40">
                  This skill has no configurable options.
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={closeConfig}
              className="silver-glass-button font-logo text-[13px] border-black/[0.06] dark:border-white/[0.08]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveConfig}
              disabled={isSavingConfig}
              className="font-logo text-[13px]"
            >
              {isSavingConfig ? 'Saving...' : 'Save Configuration'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ----------------------------------------------------------------- */}
      {/* Uninstall Confirmation                                             */}
      {/* ----------------------------------------------------------------- */}
      <AlertDialog open={uninstallDialogOpen} onOpenChange={setUninstallDialogOpen}>
        <AlertDialogContent className="rounded-2xl border-red-300/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[15px] font-logo font-semibold">
              Uninstall Skill
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] font-logo">
              Are you sure you want to uninstall{' '}
              <span className="font-medium text-zinc-700 dark:text-white/80">
                {uninstallingSkill?.name}
              </span>
              ? This will remove the skill and all its configuration. Workflows using this skill may
              stop working correctly.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-logo text-[13px]">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUninstall}
              className="workflow-editor-settings-danger-action smoky-glass-chip rounded-[10px] border border-rose-500/[0.18] bg-rose-500/[0.08] font-logo text-[13px] text-rose-700 transition-all duration-200 hover:bg-rose-500/[0.12] dark:border-rose-400/[0.16] dark:bg-rose-400/[0.1] dark:text-rose-100"
            >
              Uninstall
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export const Skills = memo(SkillsComponent)

function useSettingsSectionVisibility() {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [isSectionActive, setIsSectionActive] = useState(false)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const section = root.closest<HTMLElement>('.community-ui-settings-section')
    const visibilityTarget = section ?? root.parentElement

    const updateVisibility = () => {
      const nextIsActive = visibilityTarget ? !visibilityTarget.classList.contains('hidden') : true
      setIsSectionActive((current) => (current === nextIsActive ? current : nextIsActive))
    }

    updateVisibility()

    if (!visibilityTarget || typeof MutationObserver === 'undefined') {
      return
    }

    const observer = new MutationObserver(updateVisibility)
    observer.observe(visibilityTarget, {
      attributeFilter: ['class', 'hidden', 'style'],
      attributes: true,
    })

    return () => {
      observer.disconnect()
    }
  }, [])

  return { isSectionActive, rootRef }
}

interface SkillCardProps {
  skill: Skill
  isToggling: boolean
  onConfigure: (skill: Skill) => void
  onRequestUninstall: (skillId: string) => void
  onToggle: (skill: Skill) => void
}

const SkillCard = memo(function SkillCard({
  skill,
  isToggling,
  onConfigure,
  onRequestUninstall,
  onToggle,
}: SkillCardProps) {
  const installedDate = useMemo(() => formatInstalledDate(skill.installedAt), [skill.installedAt])

  const handleToggle = useCallback(() => {
    onToggle(skill)
  }, [onToggle, skill])

  const handleConfigure = useCallback(() => {
    onConfigure(skill)
  }, [onConfigure, skill])

  const handleRequestUninstall = useCallback(() => {
    onRequestUninstall(skill.id)
  }, [onRequestUninstall, skill.id])

  return (
    <div className="silver-glass-pane group flex items-start justify-between rounded-xl bg-transparent py-2.5 px-3 transition-all duration-200">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <span className="bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10] p-2 rounded-lg mt-0.5 shrink-0 flex items-center justify-center">
          {skill.icon ? (
            <Image
              src={skill.icon}
              alt=""
              width={16}
              height={16}
              unoptimized
              loading="lazy"
              className="h-4 w-4 rounded-sm object-contain"
            />
          ) : (
            <Puzzle className="h-4 w-4 text-[#4A7A68] dark:text-[#94B8A6]" strokeWidth={1.5} />
          )}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-logo text-[13px] text-zinc-800 dark:text-white font-medium">
              {skill.name}
            </p>
            <span className="text-[10px] font-logo text-zinc-400 dark:text-white/30 font-mono">
              v{skill.version}
            </span>
            <Badge
              variant="outline"
              className={`text-[10px] font-logo px-1.5 py-0 h-[18px] capitalize border whitespace-nowrap shrink-0 ${CATEGORY_COLORS[skill.category]}`}
            >
              {skill.category}
            </Badge>
          </div>
          <p className="text-[11px] font-logo text-zinc-400 dark:text-white/40 mt-0.5 line-clamp-1">
            {skill.description}
          </p>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-[10px] font-logo text-zinc-400 dark:text-white/30">
              by {skill.author}
            </span>
            <span className="text-[10px] text-zinc-300 dark:text-white/10">|</span>
            <span className="text-[10px] text-zinc-400 dark:text-white/30">
              Installed {installedDate}
            </span>
            {skill.homepage && (
              <>
                <span className="text-[10px] text-zinc-300 dark:text-white/10">|</span>
                <a
                  href={skill.homepage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-logo text-[#4A7A68] dark:text-[#94B8A6] hover:underline flex items-center gap-0.5"
                >
                  Homepage
                  <ExternalLink className="h-2.5 w-2.5" strokeWidth={1.5} />
                </a>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-3">
        <Switch
          checked={skill.enabled}
          onCheckedChange={handleToggle}
          disabled={isToggling}
          className="data-[state=checked]:bg-[#4A7A68] dark:data-[state=checked]:bg-[#94B8A6]"
        />
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          {skill.configFields && skill.configFields.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleConfigure}
              title="Configure"
            >
              <Settings2
                className="h-3.5 w-3.5 text-zinc-400 dark:text-white/40"
                strokeWidth={1.5}
              />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 hover:text-red-500"
            onClick={handleRequestUninstall}
            title="Uninstall"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
          </Button>
        </div>
      </div>
    </div>
  )
})

interface InstallSourceButtonProps {
  source: InstallSource
  icon: typeof Link
  label: string
  selected: boolean
  onSelect: (source: InstallSource) => void
}

const InstallSourceButton = memo(function InstallSourceButton({
  source,
  icon: Icon,
  label,
  selected,
  onSelect,
}: InstallSourceButtonProps) {
  const handleSelect = useCallback(() => {
    onSelect(source)
  }, [onSelect, source])

  return (
    <button
      type="button"
      onClick={handleSelect}
      className={`silver-glass-pane flex flex-col items-center gap-1.5 rounded-xl border bg-transparent p-3 text-[12px] font-logo transition-all duration-200 ${
        selected
          ? 'border-[#4A7A68]/30 bg-[#4A7A68]/[0.05] text-[#4A7A68] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] dark:border-[#94B8A6]/30 dark:bg-[#94B8A6]/[0.08] dark:text-[#94B8A6]'
          : 'border-black/[0.06] text-zinc-500 hover:bg-black/[0.025] dark:border-white/[0.08] dark:text-white/40 dark:hover:bg-white/[0.04]'
      }`}
    >
      <Icon className="h-4 w-4" strokeWidth={1.5} />
      {label}
    </button>
  )
})

interface ConfigFieldControlProps {
  field: SkillConfigField
  value: string | number | boolean | undefined
  onChange: (key: string, value: string | number | boolean) => void
}

const ConfigFieldControl = memo(function ConfigFieldControl({
  field,
  value,
  onChange,
}: ConfigFieldControlProps) {
  const handleBooleanChange = useCallback(
    (checked: boolean) => {
      onChange(field.key, checked)
    },
    [field.key, onChange]
  )

  const handleSelectChange = useCallback(
    (nextValue: string) => {
      onChange(field.key, nextValue)
    },
    [field.key, onChange]
  )

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange(field.key, field.type === 'number' ? Number(event.target.value) : event.target.value)
    },
    [field.key, field.type, onChange]
  )

  return (
    <div className="space-y-1.5">
      <Label className="text-[12px] font-logo flex items-center gap-1">
        {field.label}
        {field.required && <span className="text-red-400 text-[10px]">*</span>}
      </Label>
      {field.description && (
        <p className="text-[11px] font-logo text-zinc-400 dark:text-white/30">
          {field.description}
        </p>
      )}

      {field.type === 'boolean' ? (
        <Switch checked={!!value} onCheckedChange={handleBooleanChange} />
      ) : field.type === 'select' && field.options ? (
        <Select value={String(value ?? field.default ?? '')} onValueChange={handleSelectChange}>
          <SelectTrigger className="h-9 text-[13px] font-logo focus:ring-0">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          type={
            field.type === 'password' ? 'password' : field.type === 'number' ? 'number' : 'text'
          }
          value={String(value ?? field.default ?? '')}
          onChange={handleInputChange}
          placeholder={`Enter ${field.label.toLowerCase()}...`}
          className="h-9 text-[13px] font-logo"
        />
      )}
    </div>
  )
})

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function SkillCardSkeleton() {
  return (
    <div className="silver-glass-pane flex items-start justify-between rounded-xl bg-transparent py-2.5 px-3">
      <div className="flex items-start gap-3">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-[18px] w-16 rounded-full" />
          </div>
          <Skeleton className="h-3 w-52 mb-1.5" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="h-2.5 w-28" />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-11 rounded-full" />
        <Skeleton className="h-7 w-7 rounded-lg" />
        <Skeleton className="h-7 w-7 rounded-lg" />
      </div>
    </div>
  )
}
