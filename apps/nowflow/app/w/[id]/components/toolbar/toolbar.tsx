'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Columns } from 'lucide-react'
import {
  ModernCloseIcon,
  ModernDragIcon,
  ModernPlusIcon,
  ModernSearchIcon,
} from '@/components/modern-toolbar-icons'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { workflowEditorTheme } from '@/lib/workflow-editor-theme'
import { useSidebarStore } from '@/stores/sidebar/store'
import {
  CATEGORY_METADATA,
  getAllBlocks,
  getBlocksByIndustryCategory,
  getBlocksByPrimaryCategory,
  INDUSTRY_CATEGORIES,
  PRIMARY_CATEGORIES,
  searchBlocks as searchBlocksEnhanced,
} from '@/blocks'
import type { IndustryCategory } from '@/blocks'
import type { BlockConfig } from '@/blocks/types'
import { ToolbarBlock } from './components/toolbar-block/toolbar-block'
import { type ToolbarTab, ToolbarTabs } from './components/toolbar-tabs/toolbar-tabs'

type ResizeDirection =
  | 'top'
  | 'right'
  | 'bottom'
  | 'left'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'

const PANEL_MIN_WIDTH = 360
const PANEL_MAX_WIDTH = 960
const PANEL_MIN_HEIGHT = 420
const PANEL_DEFAULT_HEIGHT = 720
const PANEL_MARGIN = 12

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

// Industry sub-category pills for the Integrations tab
const INTEGRATION_FILTERS: Array<{ id: IndustryCategory | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: INDUSTRY_CATEGORIES.COLLABORATION, label: 'Collaboration' },
  { id: INDUSTRY_CATEGORIES.PROJECT_MANAGEMENT, label: 'Projects' },
  { id: INDUSTRY_CATEGORIES.CRM_SALES, label: 'CRM' },
  { id: INDUSTRY_CATEGORIES.EMAIL, label: 'Email' },
  { id: INDUSTRY_CATEGORIES.MARKETING, label: 'Marketing' },
  { id: INDUSTRY_CATEGORIES.SOCIAL_MEDIA, label: 'Social' },
  { id: INDUSTRY_CATEGORIES.MESSAGING, label: 'Messaging' },
  { id: INDUSTRY_CATEGORIES.PAYMENTS, label: 'Payments' },
  { id: INDUSTRY_CATEGORIES.ACCOUNTING, label: 'Accounting' },
  { id: INDUSTRY_CATEGORIES.ANALYTICS, label: 'Analytics' },
  { id: INDUSTRY_CATEGORIES.CLOUD_SERVICES, label: 'Cloud' },
  { id: INDUSTRY_CATEGORIES.ERP_SYSTEMS, label: 'ERP' },
  { id: INDUSTRY_CATEGORIES.HR_PAYROLL, label: 'HR' },
  { id: INDUSTRY_CATEGORIES.CUSTOMER_SUPPORT, label: 'Support' },
]

export function Toolbar() {
  const [activeTab, setActiveTab] = useState<ToolbarTab>('core')
  const [integrationFilter, setIntegrationFilter] = useState<IndustryCategory | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [collapsed, setCollapsed] = useState(true)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [panelSize, setPanelSize] = useState({ width: 460, height: PANEL_DEFAULT_HEIGHT })
  const [gridCols, setGridCols] = useState<1 | 2>(2)

  const toolbarRef = useRef<HTMLDivElement>(null)
  const dragStartPos = useRef({ x: 0, y: 0 })
  const initialPos = useRef({ x: 0, y: 0 })
  const isDragging = useRef(false)
  const hasMoved = useRef(false)
  const resizeDirectionRef = useRef<ResizeDirection | null>(null)
  const resizeStartRef = useRef({
    mouseX: 0,
    mouseY: 0,
    x: 0,
    y: 0,
    width: 460,
    height: PANEL_DEFAULT_HEIGHT,
  })

  const { mode, isExpanded: isSidebarExpanded } = useSidebarStore()
  const isSidebarCollapsed =
    mode === 'expanded' ? !isSidebarExpanded : mode === 'collapsed' || mode === 'hover'
  const sidebarWidth = isSidebarCollapsed ? 64 : 256

  const getPanelConstraints = useCallback(() => {
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const minLeft = sidebarWidth + 8

    return {
      viewportWidth,
      viewportHeight,
      minLeft,
      minTop: PANEL_MARGIN,
      margin: PANEL_MARGIN,
      minWidth: PANEL_MIN_WIDTH,
      maxWidth: Math.max(
        PANEL_MIN_WIDTH,
        Math.min(PANEL_MAX_WIDTH, viewportWidth - minLeft - PANEL_MARGIN)
      ),
      minHeight: PANEL_MIN_HEIGHT,
      maxHeight: Math.max(PANEL_MIN_HEIGHT, viewportHeight - PANEL_MARGIN * 2),
    }
  }, [sidebarWidth])

  const handleTabChange = useCallback((tab: ToolbarTab) => {
    setActiveTab(tab)
    setIntegrationFilter('all')
  }, [])

  useEffect(() => {
    const syncToolbarBounds = () => {
      const constraints = getPanelConstraints()

      setPanelSize((prev) => {
        const nextWidth = clamp(prev.width, constraints.minWidth, constraints.maxWidth)
        const nextHeight = clamp(prev.height, constraints.minHeight, constraints.maxHeight)

        setPosition((current) => {
          if (!hasMoved.current) {
            return {
              x: constraints.minLeft + 12,
              y: 80,
            }
          }

          return {
            x: clamp(
              current.x,
              constraints.minLeft,
              constraints.viewportWidth - nextWidth - constraints.margin
            ),
            y: clamp(
              current.y,
              constraints.minTop,
              constraints.viewportHeight - nextHeight - constraints.margin
            ),
          }
        })

        if (nextWidth === prev.width && nextHeight === prev.height) {
          return prev
        }

        return { width: nextWidth, height: nextHeight }
      })
    }

    syncToolbarBounds()
    window.addEventListener('resize', syncToolbarBounds)
    return () => window.removeEventListener('resize', syncToolbarBounds)
  }, [getPanelConstraints])

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragStartPos.current = { x: e.clientX, y: e.clientY }
    initialPos.current = { ...position }
    isDragging.current = false
    hasMoved.current = false
    document.addEventListener('mousemove', handleMouseMove, { passive: true })
    document.addEventListener('mouseup', handleMouseUp)
    document.body.classList.add('cursor-grabbing', 'toolbar-dragging-active')
    if (toolbarRef.current) toolbarRef.current.classList.add('toolbar-dragging')
  }

  const handleMouseMove = (e: MouseEvent) => {
    requestAnimationFrame(() => {
      if (resizeDirectionRef.current) {
        const constraints = getPanelConstraints()
        const direction = resizeDirectionRef.current
        const start = resizeStartRef.current
        const deltaX = e.clientX - start.mouseX
        const deltaY = e.clientY - start.mouseY

        let nextX = start.x
        let nextY = start.y
        let nextWidth = start.width
        let nextHeight = start.height

        if (direction.includes('right')) {
          const maxWidthFromViewport = constraints.viewportWidth - start.x - constraints.margin
          nextWidth = clamp(
            start.width + deltaX,
            constraints.minWidth,
            Math.min(constraints.maxWidth, maxWidthFromViewport)
          )
        }

        if (direction.includes('left')) {
          const rightEdge = start.x + start.width
          const maxWidthFromViewport = rightEdge - constraints.minLeft
          nextWidth = clamp(
            start.width - deltaX,
            constraints.minWidth,
            Math.min(constraints.maxWidth, maxWidthFromViewport)
          )
          nextX = rightEdge - nextWidth
        }

        if (direction.includes('bottom')) {
          const maxHeightFromViewport = constraints.viewportHeight - start.y - constraints.margin
          nextHeight = clamp(
            start.height + deltaY,
            constraints.minHeight,
            Math.min(constraints.maxHeight, maxHeightFromViewport)
          )
        }

        if (direction.includes('top')) {
          const bottomEdge = start.y + start.height
          const maxHeightFromViewport = bottomEdge - constraints.minTop
          nextHeight = clamp(
            start.height - deltaY,
            constraints.minHeight,
            Math.min(constraints.maxHeight, maxHeightFromViewport)
          )
          nextY = bottomEdge - nextHeight
        }

        nextX = clamp(
          nextX,
          constraints.minLeft,
          constraints.viewportWidth - nextWidth - constraints.margin
        )
        nextY = clamp(
          nextY,
          constraints.minTop,
          constraints.viewportHeight - nextHeight - constraints.margin
        )

        setPanelSize({ width: nextWidth, height: nextHeight })
        setPosition({ x: nextX, y: nextY })
        return
      }

      const deltaX = e.clientX - dragStartPos.current.x
      const deltaY = e.clientY - dragStartPos.current.y
      if (Math.sqrt(deltaX * deltaX + deltaY * deltaY) > 5) {
        isDragging.current = true
        hasMoved.current = true
      }
      const constraints = getPanelConstraints()
      const vw = window.innerWidth
      const vh = window.innerHeight
      const newX = Math.max(
        constraints.minLeft,
        Math.min(
          initialPos.current.x + deltaX,
          collapsed ? vw - 70 : vw - (panelSize.width + constraints.margin)
        )
      )
      const newY = Math.max(
        constraints.minTop,
        Math.min(
          initialPos.current.y + deltaY,
          collapsed ? vh - 70 : vh - (panelSize.height + constraints.margin)
        )
      )
      setPosition({ x: newX, y: newY })
    })
  }

  const handleMouseUp = () => {
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
    document.body.classList.remove('cursor-grabbing', 'toolbar-dragging-active')
    if (toolbarRef.current) toolbarRef.current.classList.remove('toolbar-dragging')
    resizeDirectionRef.current = null
    setTimeout(() => {
      isDragging.current = false
      hasMoved.current = false
    }, 10)
  }

  const beginResize = (direction: ResizeDirection, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    resizeDirectionRef.current = direction
    resizeStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      x: position.x,
      y: position.y,
      width: panelSize.width,
      height: panelSize.height,
    }

    document.addEventListener('mousemove', handleMouseMove, { passive: true })
    document.addEventListener('mouseup', handleMouseUp)
  }

  const handleToggle = () => {
    if (!hasMoved.current && !isDragging.current && collapsed) setCollapsed(false)
  }
  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!hasMoved.current && !isDragging.current) setCollapsed(true)
  }

  const getBlocksByImprovedCategory = (category: ToolbarTab): BlockConfig[] => {
    switch (category) {
      case 'core':
        return getBlocksByPrimaryCategory(PRIMARY_CATEGORIES.CORE_FLOW).map((e) => e.block)
      case 'agents':
        return getBlocksByPrimaryCategory(PRIMARY_CATEGORIES.AGENTS).map((e) => e.block)
      case 'data':
        return getBlocksByPrimaryCategory(PRIMARY_CATEGORIES.DATA_FILES).map((e) => e.block)
      case 'integrations':
        return getBlocksByPrimaryCategory(PRIMARY_CATEGORIES.INTEGRATIONS).map((e) => e.block)
      case 'vision':
        return getBlocksByPrimaryCategory(PRIMARY_CATEGORIES.VISION_MEDIA).map((e) => e.block)
      case 'all':
        return getAllBlocks()
      default:
        return getAllBlocks()
    }
  }

  const blocks = useMemo(() => {
    let all: BlockConfig[]
    if (searchQuery.trim()) {
      all = searchBlocksEnhanced(searchQuery)
        .filter((e) => e.block.type !== 'starter' && !e.block.hideFromToolbar && !e.block.isUtility)
        .map((e) => e.block)
    } else if (activeTab === 'integrations' && integrationFilter !== 'all') {
      all = getBlocksByIndustryCategory(integrationFilter as IndustryCategory)
        .filter((e) => e.block.type !== 'starter' && !e.block.hideFromToolbar && !e.block.isUtility)
        .map((e) => e.block)
    } else {
      all = getBlocksByImprovedCategory(activeTab).filter(
        (b) => b.type !== 'starter' && !b.hideFromToolbar && !b.isUtility
      )
    }
    return all
  }, [searchQuery, activeTab, integrationFilter])

  // Grouped view for integrations "All" mode
  const integrationGroups = useMemo(() => {
    if (activeTab !== 'integrations' || integrationFilter !== 'all' || searchQuery.trim())
      return null
    return INTEGRATION_FILTERS.filter((f) => f.id !== 'all')
      .map((f) => ({
        categoryId: f.id as IndustryCategory,
        label: f.label,
        color: CATEGORY_METADATA[f.id as string]?.color ?? '#6366F1',
        blocks: getBlocksByIndustryCategory(f.id as IndustryCategory)
          .filter((e) => !e.block.hideFromToolbar && !e.block.isUtility)
          .map((e) => e.block),
      }))
      .filter((g) => g.blocks.length > 0)
  }, [activeTab, integrationFilter, searchQuery])

  // Tab label mapping
  const tabLabel: Record<ToolbarTab, string> = {
    core: 'Core Flow',
    agents: 'AI Agents',
    data: 'Data & Files',
    integrations: 'Integrations',
    vision: 'Vision & Media',
    all: 'All Blocks',
  }

  const activeLabel =
    integrationFilter !== 'all' && activeTab === 'integrations'
      ? (CATEGORY_METADATA[integrationFilter as string]?.name ?? tabLabel.integrations)
      : tabLabel[activeTab]

  const totalCount = integrationGroups
    ? integrationGroups.reduce((acc, g) => acc + g.blocks.length, 0)
    : blocks.length
  const effectiveGridCols: 1 | 2 = panelSize.width < 560 ? 1 : gridCols
  const isCompactPanel = panelSize.width < 430
  const isShortPanel = panelSize.height < 560
  const resizeHandles: Array<{ direction: ResizeDirection; className: string }> = [
    {
      direction: 'top',
      className:
        'workflow-editor-block-library-resize-handle workflow-editor-block-library-resize-handle--top absolute inset-x-5 top-0 h-2 -translate-y-1/2 cursor-ns-resize',
    },
    {
      direction: 'right',
      className:
        'workflow-editor-block-library-resize-handle workflow-editor-block-library-resize-handle--right absolute inset-y-5 right-0 w-2 translate-x-1/2 cursor-ew-resize',
    },
    {
      direction: 'bottom',
      className:
        'workflow-editor-block-library-resize-handle workflow-editor-block-library-resize-handle--bottom absolute inset-x-5 bottom-0 h-2 translate-y-1/2 cursor-ns-resize',
    },
    {
      direction: 'left',
      className:
        'workflow-editor-block-library-resize-handle workflow-editor-block-library-resize-handle--left absolute inset-y-5 left-0 w-2 -translate-x-1/2 cursor-ew-resize',
    },
    {
      direction: 'top-left',
      className:
        'workflow-editor-block-library-resize-handle workflow-editor-block-library-resize-handle--corner absolute left-0 top-0 h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize',
    },
    {
      direction: 'top-right',
      className:
        'workflow-editor-block-library-resize-handle workflow-editor-block-library-resize-handle--corner absolute right-0 top-0 h-4 w-4 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize',
    },
    {
      direction: 'bottom-left',
      className:
        'workflow-editor-block-library-resize-handle workflow-editor-block-library-resize-handle--corner absolute bottom-0 left-0 h-4 w-4 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize',
    },
    {
      direction: 'bottom-right',
      className:
        'workflow-editor-block-library-resize-handle workflow-editor-block-library-resize-handle--corner absolute bottom-0 right-0 h-4 w-4 translate-x-1/2 translate-y-1/2 cursor-nwse-resize',
    },
  ]

  // ── Collapsed state ─────────────────────────────────────────────────────────
  if (collapsed) {
    return (
      <div
        ref={toolbarRef}
        className="absolute z-20 group"
        style={{ left: `${position.x}px`, top: `${position.y}px` }}
        onMouseDown={handleMouseDown}
      >
        <div
          className={cn(
            'workflow-editor-block-library-toggle smoky-glass-panel block-library-shell flex h-11 w-11 cursor-grab items-center justify-center rounded-[12px] transition-all duration-200 hover:-translate-y-0.5 active:cursor-grabbing',
            workflowEditorTheme.toolboxShell
          )}
          onClick={handleToggle}
        >
          <ModernPlusIcon className="h-5 w-5 text-[color:var(--workflow-editor-text)] transition-transform duration-200 group-hover:rotate-90" />
        </div>
        <div
          className={cn(
            'absolute -bottom-9 left-1/2 -translate-x-1/2 px-3 py-1.5 text-[11px] font-logo font-medium opacity-0 transition-opacity duration-200 pointer-events-none whitespace-nowrap group-hover:opacity-100',
            workflowEditorTheme.toolboxTooltip
          )}
        >
          Blocks
          <div
            className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-l border-t"
            style={{
              background: 'var(--workflow-editor-bg-panel-elevated)',
              borderColor: 'var(--workflow-editor-border-soft)',
            }}
          />
        </div>
      </div>
    )
  }

  // ── Expanded panel ──────────────────────────────────────────────────────────
  return (
    <div
      ref={toolbarRef}
      className={cn(
        'workflow-editor-block-library smoky-glass-panel block-library-shell absolute z-[75] flex animate-in fade-in-0 zoom-in-95 flex-col overflow-hidden rounded-[12px] duration-200',
        isCompactPanel && 'workflow-editor-block-library--compact',
        isShortPanel && 'workflow-editor-block-library--short',
        workflowEditorTheme.toolboxShell
      )}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${panelSize.width}px`,
        height: `${panelSize.height}px`,
        willChange: 'transform',
      }}
    >
      {resizeHandles.map((handle) => (
        <div
          key={handle.direction}
          onMouseDown={(e) => beginResize(handle.direction, e)}
          className={handle.className}
          title={`Resize ${handle.direction}`}
        />
      ))}

      <div className="workflow-editor-block-library-corner-grip pointer-events-none absolute bottom-2 right-2 z-10 h-4 w-4 opacity-40 transition-opacity">
        <svg
          viewBox="0 0 10 10"
          className="text-[color:var(--workflow-editor-text-soft)]"
          fill="currentColor"
        >
          <circle cx="9" cy="9" r="1.2" />
          <circle cx="5.5" cy="9" r="1.2" />
          <circle cx="9" cy="5.5" r="1.2" />
        </svg>
      </div>

      {/* ── Header (flex-none = fixed height) ──────────────────────────────── */}
      <div
        className="workflow-editor-block-library-header flex-none flex h-12 items-center justify-between border-b border-[color:var(--workflow-editor-border-soft)] bg-transparent px-4 cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        style={{ userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'none' }}
      >
        <div
          className={cn(
            'flex items-center select-none pointer-events-none',
            isCompactPanel ? 'gap-2' : 'gap-2.5'
          )}
        >
          <div
            className={cn(
              'workflow-editor-block-library-header-icon smoky-glass-pane block-library-surface flex h-7 w-7 items-center justify-center rounded-[10px]',
              workflowEditorTheme.toolboxSurface
            )}
          >
            <ModernDragIcon className="h-3.5 w-3.5 text-[color:var(--workflow-editor-text-soft)]" />
          </div>
          <div>
            <p
              className={cn(
                'text-[13px] font-semibold font-logo leading-none',
                workflowEditorTheme.title
              )}
            >
              Blocks
            </p>
            {!isCompactPanel && (
              <p className={cn('mt-0.5 text-[10px] font-logo', workflowEditorTheme.soft)}>
                Drag or click to add
              </p>
            )}
          </div>
        </div>

        <div className={cn('flex items-center', isCompactPanel ? 'gap-1' : 'gap-1.5')}>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setGridCols((p) => (p === 2 ? 1 : 2))
            }}
            aria-label={`Switch to ${effectiveGridCols === 2 ? 'one' : 'two'} column layout`}
            className={cn(
              'workflow-editor-block-library-toolbar-button smoky-glass-chip block-library-chip flex h-7 w-7 items-center justify-center rounded-[10px]',
              workflowEditorTheme.toolboxChip,
              workflowEditorTheme.button
            )}
            title="Toggle columns"
          >
            <Columns className="h-3.5 w-3.5" strokeWidth={1.8} />
          </button>
          <button
            onClick={handleClose}
            className={cn(
              'workflow-editor-block-library-toolbar-button smoky-glass-chip block-library-chip flex h-7 w-7 items-center justify-center rounded-[10px]',
              workflowEditorTheme.toolboxChip,
              workflowEditorTheme.button,
              workflowEditorTheme.dangerButton
            )}
          >
            <ModernCloseIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── Content area (flex-1 + min-h-0 = fills remaining, scrolls correctly) */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Search (flex-none) */}
        <div
          className={cn(
            'workflow-editor-block-library-search-wrap flex-none px-3 pt-3 pb-2',
            isShortPanel && 'pb-1.5'
          )}
        >
          <div className="workflow-editor-block-library-search relative">
            <ModernSearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--workflow-editor-text-soft)]" />
            <Input
              placeholder="Search blocks…"
              className={cn(
                'workflow-editor-block-library-search-input smoky-glass-pane block-library-surface h-9 rounded-[10px] bg-transparent pl-8 pr-8 text-[12px] font-logo focus:ring-0',
                workflowEditorTheme.toolboxSurface,
                workflowEditorTheme.searchInput
              )}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setSearchQuery('')
                  e.currentTarget.blur()
                }
              }}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className={cn(
                  'workflow-editor-block-library-search-clear smoky-glass-chip block-library-chip absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-[8px]',
                  workflowEditorTheme.toolboxChip,
                  workflowEditorTheme.button
                )}
              >
                <ModernCloseIcon className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
        </div>

        {/* Tabs (flex-none) */}
        {!searchQuery && (
          <div className="flex-none">
            <ToolbarTabs activeTab={activeTab} onTabChange={handleTabChange} />
          </div>
        )}

        {/* Integration sub-category pills (flex-none) */}
        {!searchQuery && activeTab === 'integrations' && (
          <div className="flex-none px-3 pb-2">
            <div className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {INTEGRATION_FILTERS.map((filter) => {
                const isActive = integrationFilter === filter.id
                return (
                  <button
                    key={filter.id}
                    onClick={() => setIntegrationFilter(filter.id)}
                    data-active={isActive ? 'true' : 'false'}
                    className={cn(
                      'workflow-editor-block-library-filter-pill flex-shrink-0 rounded-[10px] px-2.5 py-0.5 text-[10px] font-logo font-semibold whitespace-nowrap transition-all duration-200',
                      isActive
                        ? [
                            'smoky-glass-chip block-library-chip',
                            workflowEditorTheme.toolboxChip,
                            workflowEditorTheme.button,
                            workflowEditorTheme.tabActive,
                          ]
                        : [
                            'smoky-glass-pane block-library-surface',
                            workflowEditorTheme.toolboxSurface,
                            workflowEditorTheme.button,
                          ]
                    )}
                  >
                    {filter.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Category header (flex-none) */}
        {!searchQuery && (
          <div
            className={cn(
              'workflow-editor-block-library-section-head flex-none flex items-center justify-between px-4 py-1.5',
              isCompactPanel && 'gap-y-1 flex-wrap'
            )}
          >
            <p
              className={cn(
                'workflow-editor-block-library-section-title text-[12px] font-logo font-semibold',
                workflowEditorTheme.title
              )}
            >
              {activeLabel}
            </p>
            <div className="workflow-editor-block-library-section-meta flex items-center gap-1.5">
              <div className="workflow-editor-block-library-section-dot h-1.5 w-1.5 animate-pulse rounded-full bg-white/55" />
              <span
                className={cn(
                  'workflow-editor-block-library-section-count text-[10px] font-logo tabular-nums',
                  workflowEditorTheme.soft
                )}
              >
                {totalCount} block{totalCount !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        )}

        {/* Search header (flex-none) */}
        {searchQuery && (
          <div
            className={cn(
              'workflow-editor-block-library-section-head flex-none flex items-center justify-between px-4 py-1.5',
              isCompactPanel && 'gap-y-1 flex-wrap'
            )}
          >
            <p
              className={cn(
                'workflow-editor-block-library-section-title text-[12px] font-logo font-semibold',
                workflowEditorTheme.title
              )}
            >
              {blocks.length > 0
                ? `${blocks.length} result${blocks.length !== 1 ? 's' : ''} for "${searchQuery}"`
                : `No results for "${searchQuery}"`}
            </p>
          </div>
        )}

        {/* ── ScrollArea: flex-1 + min-h-0 = the scroll fix ─────────────────── */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="workflow-editor-block-library-grid px-3 pb-16 pt-1">
            {/* Integrations grouped view */}
            {integrationGroups ? (
              <div className="space-y-5">
                {integrationGroups.map((group, groupIdx) => (
                  <div key={group.categoryId}>
                    <button
                      onClick={() => setIntegrationFilter(group.categoryId)}
                      className="w-full flex items-center gap-2 mb-2.5 group/hdr"
                    >
                      <div className="h-px flex-1 bg-[color:var(--workflow-editor-border-soft)]" />
                      <div
                        className={cn(
                          'flex items-center gap-1.5 rounded-[10px] px-2.5 py-0.5 text-[10px] font-logo font-bold uppercase tracking-wide transition-all duration-200 group-hover/hdr:opacity-80',
                          workflowEditorTheme.toolboxChip
                        )}
                      >
                        {group.label}
                        <span className={cn('font-normal opacity-70', workflowEditorTheme.soft)}>
                          {group.blocks.length}
                        </span>
                      </div>
                      <div className="h-px flex-1 bg-[color:var(--workflow-editor-border-soft)]" />
                    </button>
                    <div
                      className={`workflow-editor-block-library-grid-inner grid grid-cols-1 ${effectiveGridCols === 2 ? 'grid-cols-2' : ''} gap-2`}
                    >
                      {group.blocks.map((block, i) => (
                        <div
                          key={`${block.type}-${i}`}
                          className="animate-in fade-in-0 slide-in-from-bottom-1 h-full"
                          style={{
                            animationDelay: `${(groupIdx * 2 + i) * 25}ms`,
                            animationDuration: '300ms',
                            animationFillMode: 'both',
                          }}
                        >
                          <ToolbarBlock config={block} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : blocks.length === 0 ? (
              <EmptyState searchQuery={searchQuery} onClear={() => setSearchQuery('')} />
            ) : (
              <div
                className={`workflow-editor-block-library-grid-inner grid grid-cols-1 ${effectiveGridCols === 2 ? 'grid-cols-2' : ''} gap-2`}
              >
                {blocks.map((block, i) => (
                  <div
                    key={`${block.type}-${i}`}
                    className="animate-in fade-in-0 slide-in-from-bottom-1 h-full"
                    style={{
                      animationDelay: `${i * 35}ms`,
                      animationDuration: '300ms',
                      animationFillMode: 'both',
                    }}
                  >
                    <ToolbarBlock config={block} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function EmptyState({ searchQuery, onClear }: { searchQuery: string; onClear: () => void }) {
  return (
    <div className="text-center py-12">
      <div
        className={cn(
          'smoky-glass-pane block-library-surface mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-[10px]',
          workflowEditorTheme.toolboxSurface
        )}
      >
        <div className="h-6 w-6 rounded-lg border-2 border-dashed border-[color:var(--workflow-editor-border)]" />
      </div>
      <p className={cn('mb-1 text-[13px] font-logo font-semibold', workflowEditorTheme.title)}>
        {searchQuery ? 'No blocks found' : 'No blocks available'}
      </p>
      <p className={cn('mb-4 text-[11px] font-logo', workflowEditorTheme.soft)}>
        {searchQuery
          ? 'Try different search terms or browse a category.'
          : 'This category is currently empty.'}
      </p>
      {searchQuery && (
        <button
          onClick={onClear}
          className={cn(
            'smoky-glass-chip block-library-chip rounded-[10px] px-3 py-1.5 text-[11px] font-logo font-medium transition-all duration-200',
            workflowEditorTheme.toolboxChip,
            workflowEditorTheme.button
          )}
        >
          Clear search
        </button>
      )}
    </div>
  )
}
