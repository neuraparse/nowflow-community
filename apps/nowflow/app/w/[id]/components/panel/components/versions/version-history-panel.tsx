'use client'

import { useCallback, useMemo } from 'react'
import { AlertCircle, Filter, GitBranch, GitCompare, Plus, Settings, Upload, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { PanelEmptyState, PanelHeader, PanelLoadingSkeleton, PanelSearchBar } from '../shared'
import { AutoSaveSettingsDialog } from './auto-save-settings-dialog'
import { CompareDialog } from './compare-dialog'
import { CreateVersionDialog } from './create-version-dialog'
import { RestoreDialog } from './restore-dialog'
import type { Version, VersionHistoryPanelProps } from './types'
import { useVersionHistory } from './use-version-history'
import { VersionDetailsDialog } from './version-details-dialog'
import { VersionListItem } from './version-list-item'

export function VersionHistoryPanel({ workflowId, panelWidth = 400 }: VersionHistoryPanelProps) {
  const isCompact = panelWidth < 400
  const neutralButtonClass =
    'silver-glass-chip smoky-glass-chip h-7 rounded-[4px] border-white/[0.05] bg-white/[0.02] px-2.5 text-[10px] text-white/82 transition-all duration-200 hover:bg-white/[0.05]'
  const neutralIconButtonClass =
    'silver-glass-chip smoky-glass-chip h-7 w-7 rounded-[4px] border-white/[0.05] bg-white/[0.02] p-0 text-white/52 transition-all duration-200 hover:bg-white/[0.05] hover:text-white/84'
  const neutralDropdownClass =
    'w-56 rounded-[8px] border border-white/[0.06] bg-[#20242c] p-1 text-white/82 shadow-lg'
  const neutralDropdownItemClass =
    'rounded-[4px] text-[12px] font-logo text-white/78 focus:bg-white/[0.06] focus:text-white'

  const {
    versions,
    loading,
    error,
    selectedVersion,
    availableTags,
    compareMode,
    compareVersions,
    compareDialogOpen,
    compareLoading,
    compareData,
    restoreDialogOpen,
    restoreLoading,
    createDialogOpen,
    createLoading,
    newVersionName,
    newVersionDescription,
    newVersionSemanticBump,
    newVersionTags,
    newVersionPinned,
    newVersionReleaseNotes,
    searchQuery,
    filterChangeTypes,
    filterTags,
    filterPinned,
    settingsDialogOpen,
    autoSaveConfig,
    savingConfig,
    detailsDialogOpen,
    editingVersion,
    savingDetails,
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
    fetchAutoSaveConfig,
    handleCreateVersion,
    handleRestore,
    handleCompare,
    handleTogglePin,
    handleExport,
    handleImport,
    handleSaveAutoSaveConfig,
    handleSaveVersionDetails,
    toggleVersionSelect,
    toggleCompareMode,
    clearFilters,
  } = useVersionHistory(workflowId)

  // Memoize the active filter count to avoid recalculating on every render
  const activeFilterCount = useMemo(
    () => filterChangeTypes.length + filterTags.length + (filterPinned !== null ? 1 : 0),
    [filterChangeTypes.length, filterTags.length, filterPinned]
  )

  const handleOpenSettings = useCallback(() => {
    fetchAutoSaveConfig()
    setSettingsDialogOpen(true)
  }, [fetchAutoSaveConfig, setSettingsDialogOpen])

  const handleVersionSelect = useCallback(
    (version: Version) => {
      setEditingVersion({ ...version })
      setDetailsDialogOpen(true)
    },
    [setEditingVersion, setDetailsDialogOpen]
  )

  const handleRestoreClick = useCallback(
    (version: Version) => {
      setSelectedVersion(version)
      setRestoreDialogOpen(true)
    },
    [setSelectedVersion, setRestoreDialogOpen]
  )

  // Loading state - skeleton layout
  if (loading && versions.length === 0) {
    return <PanelLoadingSkeleton showHeader showSearch variant="card" itemCount={4} />
  }

  // Empty state
  if (versions.length === 0 && !loading) {
    return (
      <div className="h-full flex flex-col">
        <PanelHeader
          title="Versions"
          icon={GitBranch}
          count={0}
          accentColor="slate"
          pulseDot={false}
        />
        <div className="flex-1 flex items-center justify-center">
          <PanelEmptyState
            icon={GitBranch}
            title="No Versions Yet"
            description="Create a version to save a snapshot of your workflow"
            accentColor="slate"
            ctaLabel="Create First Version"
            ctaOnClick={() => setCreateDialogOpen(true)}
            ctaIcon={Plus}
          />
        </div>

        <CreateVersionDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          loading={createLoading}
          name={newVersionName}
          setName={setNewVersionName}
          description={newVersionDescription}
          setDescription={setNewVersionDescription}
          semanticBump={newVersionSemanticBump}
          setSemanticBump={setNewVersionSemanticBump}
          tags={newVersionTags}
          setTags={setNewVersionTags}
          isPinned={newVersionPinned}
          setIsPinned={setNewVersionPinned}
          releaseNotes={newVersionReleaseNotes}
          setReleaseNotes={setNewVersionReleaseNotes}
          availableTags={availableTags}
          onCreate={handleCreateVersion}
        />
      </div>
    )
  }

  const headerActions = (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={neutralIconButtonClass}
            onClick={handleOpenSettings}
          >
            <Settings className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Auto-save Settings</TooltipContent>
      </Tooltip>

      <Button
        variant="outline"
        size="sm"
        onClick={toggleCompareMode}
        className={`${neutralButtonClass} ${compareMode ? 'bg-white/[0.10] text-white shadow-none' : ''}`}
      >
        <GitCompare className="h-3 w-3" />
        {!isCompact && <span className="ml-1">Compare</span>}
      </Button>
      <Button
        size="sm"
        onClick={() => setCreateDialogOpen(true)}
        className={`${neutralButtonClass} bg-white/[0.08] text-white/90`}
      >
        <Plus className="h-3 w-3" />
        {!isCompact && <span className="ml-1">Create</span>}
      </Button>
    </>
  )

  const filterBar = (
    <div className="flex items-center gap-2">
      <PanelSearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search versions..."
        className="flex-1"
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className={neutralButtonClass}>
            <Filter className="h-3 w-3" />
            {!isCompact && <span className="ml-1">Filter</span>}
            {activeFilterCount > 0 && (
              <Badge
                variant="secondary"
                className="ml-1 h-4 border-0 bg-white/[0.08] px-1 text-[9px] text-white/86"
              >
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className={neutralDropdownClass}>
          <div className="px-2 py-1.5 text-sm font-semibold text-white/84">Change Type</div>
          {['create', 'update', 'deploy', 'restore', 'auto_save'].map((type) => (
            <DropdownMenuCheckboxItem
              key={type}
              checked={filterChangeTypes.includes(type)}
              className={neutralDropdownItemClass}
              onCheckedChange={(checked) => {
                if (checked) {
                  setFilterChangeTypes([...filterChangeTypes, type])
                } else {
                  setFilterChangeTypes(filterChangeTypes.filter((t) => t !== type))
                }
              }}
            >
              {type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ')}
            </DropdownMenuCheckboxItem>
          ))}
          <DropdownMenuSeparator />
          <div className="px-2 py-1.5 text-sm font-semibold text-white/84">Status</div>
          <DropdownMenuCheckboxItem
            checked={filterPinned === true}
            className={neutralDropdownItemClass}
            onCheckedChange={(checked) => setFilterPinned(checked ? true : null)}
          >
            Pinned only
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={clearFilters} className={neutralDropdownItemClass}>
            Clear filters
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className={neutralIconButtonClass}>
            <Upload className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="rounded-[8px] border border-white/[0.06] bg-[#20242c] p-1 text-white/82 shadow-lg"
        >
          <DropdownMenuItem asChild>
            <label className="cursor-pointer rounded-[4px] px-2 py-1.5 text-[12px] font-logo text-white/78 focus:bg-white/[0.06] focus:text-white">
              <Upload className="h-4 w-4 mr-2" />
              Import Version
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )

  return (
    <div className="h-full flex flex-col">
      <PanelHeader
        title="Versions"
        icon={GitBranch}
        count={versions.length}
        accentColor="slate"
        pulseDot={false}
        actions={headerActions}
        secondaryContent={filterBar}
      />

      {/* Error message */}
      {error && (
        <div className="silver-glass-pane smoky-glass-pane mx-4 mt-3 rounded-lg border border-rose-500/[0.16] bg-rose-500/[0.05] p-3 dark:border-rose-400/[0.14] dark:bg-rose-400/[0.06]">
          <div className="flex items-center gap-2 text-sm text-rose-700 dark:text-rose-100/82">
            <AlertCircle className="h-4 w-4" />
            {error}
            <Button
              variant="ghost"
              size="sm"
              className="smoky-glass-chip ml-auto h-6 px-2"
              onClick={() => setError(null)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Compare mode info */}
      {compareMode && (
        <div className="silver-glass-pane smoky-glass-pane mx-4 mt-3 rounded-[6px] border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-white/74">
              Select 2 versions to compare
              {compareVersions[0] && ` (${compareVersions[1] ? '2' : '1'}/2 selected)`}
            </p>
            {compareVersions[0] && compareVersions[1] && (
              <Button
                size="sm"
                onClick={handleCompare}
                className="rounded-[4px] bg-white/[0.10] text-white/92 hover:bg-white/[0.16]"
              >
                <GitCompare className="h-4 w-4 mr-1" />
                View Diff
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Version list */}
      <ScrollArea className="flex-1 px-4 py-3">
        <div className="space-y-2">
          {versions.map((version, index) => (
            <VersionListItem
              key={version.id}
              version={version}
              index={index}
              isSelected={selectedVersion?.id === version.id}
              isCompareMode={compareMode}
              isCompareSelected={compareVersions.includes(version.versionNumber)}
              availableTags={availableTags}
              onTogglePin={handleTogglePin}
              onExport={handleExport}
              onRestore={handleRestoreClick}
              onSelect={handleVersionSelect}
              onCompareToggle={toggleVersionSelect}
            />
          ))}
        </div>
      </ScrollArea>

      {/* Create Version Dialog */}
      <CreateVersionDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        loading={createLoading}
        name={newVersionName}
        setName={setNewVersionName}
        description={newVersionDescription}
        setDescription={setNewVersionDescription}
        semanticBump={newVersionSemanticBump}
        setSemanticBump={setNewVersionSemanticBump}
        tags={newVersionTags}
        setTags={setNewVersionTags}
        isPinned={newVersionPinned}
        setIsPinned={setNewVersionPinned}
        releaseNotes={newVersionReleaseNotes}
        setReleaseNotes={setNewVersionReleaseNotes}
        availableTags={availableTags}
        onCreate={handleCreateVersion}
      />

      {/* Restore Dialog */}
      <RestoreDialog
        open={restoreDialogOpen}
        onOpenChange={setRestoreDialogOpen}
        selectedVersion={selectedVersion}
        loading={restoreLoading}
        onRestore={handleRestore}
      />

      {/* Compare Dialog */}
      <CompareDialog
        open={compareDialogOpen}
        onOpenChange={setCompareDialogOpen}
        loading={compareLoading}
        compareData={compareData}
      />

      {/* Version Details Dialog */}
      <VersionDetailsDialog
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        editingVersion={editingVersion}
        setEditingVersion={setEditingVersion}
        availableTags={availableTags}
        savingDetails={savingDetails}
        onSave={handleSaveVersionDetails}
      />

      {/* Auto-Save Settings Dialog */}
      <AutoSaveSettingsDialog
        open={settingsDialogOpen}
        onOpenChange={setSettingsDialogOpen}
        autoSaveConfig={autoSaveConfig}
        setAutoSaveConfig={setAutoSaveConfig}
        savingConfig={savingConfig}
        onSave={handleSaveAutoSaveConfig}
      />
    </div>
  )
}
