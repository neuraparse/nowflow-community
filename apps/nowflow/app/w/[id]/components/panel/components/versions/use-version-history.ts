'use client'

import { useCallback, useEffect, useState } from 'react'
import type { AutoSaveConfig, DiffData, Version, VersionTag } from './types'

const DEFAULT_TAGS: VersionTag[] = [
  { name: 'Stable', slug: 'stable', color: '#22C55E', isDefault: true },
  { name: 'Production', slug: 'production', color: '#8B5CF6', isDefault: true },
  { name: 'Archived', slug: 'archived', color: '#6B7280', isDefault: true },
  { name: 'Draft', slug: 'draft', color: '#F59E0B', isDefault: true },
  { name: 'Reviewed', slug: 'reviewed', color: '#3B82F6', isDefault: true },
]

export function useVersionHistory(workflowId: string) {
  const [versions, setVersions] = useState<Version[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null)

  // Compare mode
  const [compareMode, setCompareMode] = useState(false)
  const [compareVersions, setCompareVersions] = useState<[number | null, number | null]>([
    null,
    null,
  ])
  const [compareDialogOpen, setCompareDialogOpen] = useState(false)
  const [compareLoading, setCompareLoading] = useState(false)
  const [compareData, setCompareData] = useState<DiffData | null>(null)

  // Restore dialog
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [restoreLoading, setRestoreLoading] = useState(false)

  // Create version dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [newVersionName, setNewVersionName] = useState('')
  const [newVersionDescription, setNewVersionDescription] = useState('')
  const [newVersionSemanticBump, setNewVersionSemanticBump] = useState<'major' | 'minor' | 'patch'>(
    'patch'
  )
  const [newVersionTags, setNewVersionTags] = useState<string[]>([])
  const [newVersionPinned, setNewVersionPinned] = useState(false)
  const [newVersionReleaseNotes, setNewVersionReleaseNotes] = useState('')

  // Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [filterChangeTypes, setFilterChangeTypes] = useState<string[]>([])
  const [filterTags, setFilterTags] = useState<string[]>([])
  const [filterPinned, setFilterPinned] = useState<boolean | null>(null)

  // Tags
  const [availableTags, setAvailableTags] = useState<VersionTag[]>(DEFAULT_TAGS)

  // Settings dialog
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)
  const [autoSaveConfig, setAutoSaveConfig] = useState<AutoSaveConfig | null>(null)
  const [savingConfig, setSavingConfig] = useState(false)

  // Version details dialog
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false)
  const [editingVersion, setEditingVersion] = useState<Version | null>(null)
  const [savingDetails, setSavingDetails] = useState(false)

  const fetchVersions = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (filterChangeTypes.length > 0) {
        params.set('changeType', filterChangeTypes.join(','))
      }
      if (filterTags.length > 0) {
        params.set('tags', filterTags.join(','))
      }
      if (filterPinned !== null) {
        params.set('isPinned', String(filterPinned))
      }
      if (searchQuery) {
        params.set('search', searchQuery)
      }

      const url = `/api/workflows/${workflowId}/versions${params.toString() ? `?${params.toString()}` : ''}`
      const response = await fetch(url)
      const data = await response.json()
      if (data.success) {
        setVersions(data.data)
      } else {
        setError(data.error || 'Failed to fetch versions')
      }
    } catch (err) {
      console.error('Failed to fetch versions:', err)
      setError('Failed to load version history')
    } finally {
      setLoading(false)
    }
  }, [workflowId, filterChangeTypes, filterTags, filterPinned, searchQuery])

  const fetchTags = useCallback(async () => {
    try {
      const response = await fetch(`/api/workflows/${workflowId}/versions/tags`)
      const data = await response.json()
      if (data.success && data.data?.allTags) {
        setAvailableTags(data.data.allTags)
      }
    } catch (err) {
      console.error('Failed to fetch tags:', err)
    }
  }, [workflowId])

  const fetchAutoSaveConfig = useCallback(async () => {
    try {
      const response = await fetch(`/api/workflows/${workflowId}/auto-save`)
      const data = await response.json()
      if (data.success) {
        setAutoSaveConfig(data.data.config)
      }
    } catch (err) {
      console.error('Failed to fetch auto-save config:', err)
    }
  }, [workflowId])

  useEffect(() => {
    fetchVersions()
    fetchTags()
  }, [workflowId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Refetch when filters change
  useEffect(() => {
    if (!loading) {
      fetchVersions()
    }
  }, [filterChangeTypes, filterTags, filterPinned, searchQuery]) // eslint-disable-line react-hooks/exhaustive-deps

  const resetCreateForm = useCallback(() => {
    setNewVersionName('')
    setNewVersionDescription('')
    setNewVersionSemanticBump('patch')
    setNewVersionTags([])
    setNewVersionPinned(false)
    setNewVersionReleaseNotes('')
  }, [])

  const handleCreateVersion = useCallback(async () => {
    try {
      setCreateLoading(true)
      const response = await fetch(`/api/workflows/${workflowId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newVersionName || undefined,
          description: newVersionDescription || undefined,
          changeType: 'update',
          semanticBump: newVersionSemanticBump,
          tags: newVersionTags,
          isPinned: newVersionPinned,
          releaseNotes: newVersionReleaseNotes || undefined,
        }),
      })
      const data = await response.json()
      if (data.success) {
        setCreateDialogOpen(false)
        resetCreateForm()
        fetchVersions()
      } else {
        setError(data.error || 'Failed to create version')
      }
    } catch (err) {
      console.error('Failed to create version:', err)
      setError('Failed to create version')
    } finally {
      setCreateLoading(false)
    }
  }, [
    workflowId,
    newVersionName,
    newVersionDescription,
    newVersionSemanticBump,
    newVersionTags,
    newVersionPinned,
    newVersionReleaseNotes,
    resetCreateForm,
    fetchVersions,
  ])

  const handleRestore = useCallback(
    async (versionNumber: number) => {
      try {
        setRestoreLoading(true)
        const response = await fetch(`/api/workflows/${workflowId}/versions/${versionNumber}`, {
          method: 'POST',
        })
        const data = await response.json()
        if (data.success) {
          setRestoreDialogOpen(false)
          setSelectedVersion(null)
          fetchVersions()
          window.location.reload()
        } else {
          setError(data.error || 'Failed to restore version')
        }
      } catch (err) {
        console.error('Failed to restore version:', err)
        setError('Failed to restore version')
      } finally {
        setRestoreLoading(false)
      }
    },
    [workflowId, fetchVersions]
  )

  const handleCompare = useCallback(async () => {
    if (!compareVersions[0] || !compareVersions[1]) return

    try {
      setCompareLoading(true)
      setCompareDialogOpen(true)
      const response = await fetch(
        `/api/workflows/${workflowId}/versions/compare?from=${compareVersions[0]}&to=${compareVersions[1]}`
      )
      const data = await response.json()
      if (data.success) {
        setCompareData(data.data)
      } else {
        setError(data.error || 'Failed to compare versions')
      }
    } catch (err) {
      console.error('Failed to compare versions:', err)
      setError('Failed to compare versions')
    } finally {
      setCompareLoading(false)
    }
  }, [workflowId, compareVersions])

  const handleTogglePin = useCallback(
    async (version: Version, e: React.MouseEvent) => {
      e.stopPropagation()
      try {
        const response = await fetch(`/api/workflows/${workflowId}/versions/${version.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isPinned: !version.isPinned }),
        })
        const data = await response.json()
        if (data.success) {
          fetchVersions()
        }
      } catch (err) {
        console.error('Failed to toggle pin:', err)
      }
    },
    [workflowId, fetchVersions]
  )

  const handleToggleLock = useCallback(
    async (version: Version, e: React.MouseEvent) => {
      e.stopPropagation()
      try {
        const response = await fetch(`/api/workflows/${workflowId}/versions/${version.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isLocked: !version.isLocked }),
        })
        const data = await response.json()
        if (data.success) {
          fetchVersions()
        }
      } catch (err) {
        console.error('Failed to toggle lock:', err)
      }
    },
    [workflowId, fetchVersions]
  )

  const handleExport = useCallback(
    async (version: Version, e: React.MouseEvent) => {
      e.stopPropagation()
      try {
        const response = await fetch(
          `/api/workflows/${workflowId}/versions/export?version=${version.versionNumber}`
        )
        if (response.ok) {
          const blob = await response.blob()
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `workflow-${workflowId}-v${version.versionNumber}-export.json`
          document.body.appendChild(a)
          a.click()
          window.URL.revokeObjectURL(url)
          document.body.removeChild(a)
        }
      } catch (err) {
        console.error('Failed to export version:', err)
        setError('Failed to export version')
      }
    },
    [workflowId]
  )

  const handleImport = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      try {
        const content = await file.text()
        const exportData = JSON.parse(content)

        const response = await fetch(`/api/workflows/${workflowId}/versions/import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(exportData),
        })
        const data = await response.json()
        if (data.success) {
          fetchVersions()
        } else {
          setError(data.error || 'Failed to import version')
        }
      } catch (err) {
        console.error('Failed to import version:', err)
        setError('Failed to import version. Make sure the file is a valid export.')
      }

      // Reset input
      e.target.value = ''
    },
    [workflowId, fetchVersions]
  )

  const handleSaveAutoSaveConfig = useCallback(async () => {
    if (!autoSaveConfig) return

    try {
      setSavingConfig(true)
      const response = await fetch(`/api/workflows/${workflowId}/auto-save`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(autoSaveConfig),
      })
      const data = await response.json()
      if (data.success) {
        setAutoSaveConfig(data.data)
      } else {
        setError(data.error || 'Failed to save settings')
      }
    } catch (err) {
      console.error('Failed to save auto-save config:', err)
      setError('Failed to save settings')
    } finally {
      setSavingConfig(false)
    }
  }, [workflowId, autoSaveConfig])

  const handleSaveVersionDetails = useCallback(async () => {
    if (!editingVersion) return

    try {
      setSavingDetails(true)
      const response = await fetch(`/api/workflows/${workflowId}/versions/${editingVersion.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingVersion.name,
          description: editingVersion.description,
          tags: editingVersion.tags,
          releaseNotes: editingVersion.releaseNotes,
        }),
      })
      const data = await response.json()
      if (data.success) {
        setDetailsDialogOpen(false)
        setEditingVersion(null)
        fetchVersions()
      } else {
        setError(data.error || 'Failed to save version')
      }
    } catch (err) {
      console.error('Failed to save version details:', err)
      setError('Failed to save version')
    } finally {
      setSavingDetails(false)
    }
  }, [workflowId, editingVersion, fetchVersions])

  const toggleVersionSelect = useCallback((versionNumber: number) => {
    setCompareVersions((prev) => {
      if (prev.includes(versionNumber)) {
        return prev.map((v) => (v === versionNumber ? null : v)) as [number | null, number | null]
      } else {
        if (!prev[0]) {
          return [versionNumber, null]
        } else if (!prev[1]) {
          return [prev[0], versionNumber]
        }
        return prev
      }
    })
  }, [])

  const toggleCompareMode = useCallback(() => {
    setCompareMode((prev) => !prev)
    setCompareVersions([null, null])
  }, [])

  const clearFilters = useCallback(() => {
    setFilterChangeTypes([])
    setFilterTags([])
    setFilterPinned(null)
    setSearchQuery('')
  }, [])

  return {
    // Data
    versions,
    loading,
    error,
    selectedVersion,
    availableTags,

    // Compare
    compareMode,
    compareVersions,
    compareDialogOpen,
    compareLoading,
    compareData,

    // Restore
    restoreDialogOpen,
    restoreLoading,

    // Create
    createDialogOpen,
    createLoading,
    newVersionName,
    newVersionDescription,
    newVersionSemanticBump,
    newVersionTags,
    newVersionPinned,
    newVersionReleaseNotes,

    // Filters
    searchQuery,
    filterChangeTypes,
    filterTags,
    filterPinned,

    // Settings
    settingsDialogOpen,
    autoSaveConfig,
    savingConfig,

    // Details
    detailsDialogOpen,
    editingVersion,
    savingDetails,

    // Setters
    setError,
    setSelectedVersion,
    setCompareDialogOpen,
    setRestoreDialogOpen,
    setCreateDialogOpen,
    setNewVersionName,
    setNewVersionDescription,
    setNewVersionSemanticBump,
    setNewVersionTags,
    setNewVersionPinned,
    setNewVersionReleaseNotes,
    setSearchQuery,
    setFilterChangeTypes,
    setFilterTags,
    setFilterPinned,
    setSettingsDialogOpen,
    setAutoSaveConfig,
    setDetailsDialogOpen,
    setEditingVersion,

    // Actions
    fetchAutoSaveConfig,
    handleCreateVersion,
    handleRestore,
    handleCompare,
    handleTogglePin,
    handleToggleLock,
    handleExport,
    handleImport,
    handleSaveAutoSaveConfig,
    handleSaveVersionDetails,
    toggleVersionSelect,
    toggleCompareMode,
    clearFilters,
  }
}
