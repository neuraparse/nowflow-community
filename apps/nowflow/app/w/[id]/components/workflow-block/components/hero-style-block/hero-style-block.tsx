import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { type Connection, Handle, type NodeProps, Position } from '@xyflow/react'
import { useTheme } from 'next-themes'
import { useShallow } from 'zustand/react/shallow'
import { getLiveCanvasGlassAppearance } from '@/components/workflow/live-canvas-block-style'
import {
  getStarterBlockDisplay,
  type StarterTriggerValues,
} from '@/components/workflow/starter-trigger-presentation'
import { cn } from '@/lib/utils'
import { useAgentProfilesStore } from '@/stores/agent-profiles/store'
import { getCycleCheckEdges, wouldCreateCycle } from '@/stores/workflows/common/validators'
import { useWorkflowRegistry } from '@/stores/workflows/registry/store'
import { useSubBlockStore } from '@/stores/workflows/subblock/store'
import { useWorkflowStore } from '@/stores/workflows/workflow/store'
import { getBlock } from '@/blocks'
import { ActionBar } from '../action-bar/action-bar'
import { QuickAddUtility } from '../quick-add-utility/quick-add-utility'
import { AgentProfileBadge } from './agent-profile-badge'
import { BlockContent } from './block-content'
import { getBlockShadow, getBlockShape } from './block-shapes'
import { BlockStateBanners } from './block-state-banners'
import { ConditionHandles } from './condition-handles'
import { useValidationBanner } from './hooks/use-validation-banner'
import { EMPTY_STARTER_TRIGGER_VALUES, getIconForType } from './lib/helpers'
import { StickyNoteBlock } from './sticky-note-block'
import { type HeroStyleBlockNode } from './types'
import { UtilityBlock } from './utility-block'

export const HeroStyleBlock = React.memo(function HeroStyleBlock({
  id,
  data,
  selected,
}: NodeProps<HeroStyleBlockNode>) {
  const { type, config, name, isActive, isPending, isNew, enabled = true, hasActiveHelper } = data

  // Pre-run validation error state
  const {
    validationResult,
    hasValidationError,
    hasValidationWarning,
    bannerDismissed,
    setBannerDismissed,
    warningBannerDismissed,
    setWarningBannerDismissed,
  } = useValidationBanner(id)

  // Reactive active workflow ID — used by the subBlock store selectors below.
  // Reading it via `useWorkflowRegistry.getState()` inside a Zustand selector
  // would freeze the workflowId on first call and silently return stale values
  // after the user switches workflow.
  const activeWorkflowId = useWorkflowRegistry((s) => s.activeWorkflowId)

  const starterTriggerValues = useSubBlockStore(
    useShallow((s) => {
      if (type !== 'starter') return EMPTY_STARTER_TRIGGER_VALUES

      const blockValues = activeWorkflowId ? s.workflowValues[activeWorkflowId]?.[id] : null

      return {
        startWorkflow: (blockValues?.['startWorkflow'] ?? null) as string | null,
        scheduleType: (blockValues?.['scheduleType'] ?? null) as string | null,
        emailProvider: (blockValues?.['emailProvider'] ?? null) as string | null,
        webhookProvider: (blockValues?.['webhookProvider'] ?? null) as string | null,
        formProvider: (blockValues?.['formProvider'] ?? null) as string | null,
        databaseProvider: (blockValues?.['databaseProvider'] ?? null) as string | null,
        fileProvider: (blockValues?.['fileProvider'] ?? null) as string | null,
        calendarProvider: (blockValues?.['calendarProvider'] ?? null) as string | null,
      }
    })
  )

  const starterFallbackValues = useWorkflowStore(
    useShallow((state) => {
      if (type !== 'starter') return EMPTY_STARTER_TRIGGER_VALUES

      const subBlocks = state.blocks[id]?.subBlocks

      return {
        startWorkflow: (subBlocks?.startWorkflow?.value ?? null) as string | null,
        scheduleType: (subBlocks?.scheduleType?.value ?? null) as string | null,
        emailProvider: (subBlocks?.emailProvider?.value ?? null) as string | null,
        webhookProvider: (subBlocks?.webhookProvider?.value ?? null) as string | null,
        formProvider: (subBlocks?.formProvider?.value ?? null) as string | null,
        databaseProvider: (subBlocks?.databaseProvider?.value ?? null) as string | null,
        fileProvider: (subBlocks?.fileProvider?.value ?? null) as string | null,
        calendarProvider: (subBlocks?.calendarProvider?.value ?? null) as string | null,
      }
    })
  )

  const mergedStarterTriggerValues = useMemo<StarterTriggerValues>(
    () => ({
      startWorkflow: starterTriggerValues.startWorkflow ?? starterFallbackValues.startWorkflow,
      scheduleType: starterTriggerValues.scheduleType ?? starterFallbackValues.scheduleType,
      emailProvider: starterTriggerValues.emailProvider ?? starterFallbackValues.emailProvider,
      webhookProvider:
        starterTriggerValues.webhookProvider ?? starterFallbackValues.webhookProvider,
      formProvider: starterTriggerValues.formProvider ?? starterFallbackValues.formProvider,
      databaseProvider:
        starterTriggerValues.databaseProvider ?? starterFallbackValues.databaseProvider,
      fileProvider: starterTriggerValues.fileProvider ?? starterFallbackValues.fileProvider,
      calendarProvider:
        starterTriggerValues.calendarProvider ?? starterFallbackValues.calendarProvider,
    }),
    [starterFallbackValues, starterTriggerValues]
  )

  const starterDisplay = useMemo(
    () => (type === 'starter' ? getStarterBlockDisplay(name, mergedStarterTriggerValues) : null),
    [mergedStarterTriggerValues, name, type]
  )
  const blockDisplayName = starterDisplay?.displayTitle || name

  // Get icon from config or use type-based icon
  const Icon = useMemo(
    () => starterDisplay?.Icon ?? getIconForType(type, config.icon),
    [starterDisplay, type, config.icon]
  )

  // State for name editing
  const [isEditing, setIsEditing] = useState(false)
  const [editedName, setEditedName] = useState('')

  // Utility drag hint — lights up the utility-target handle when a utility block is being dragged
  const [isUtilityDragActive, setIsUtilityDragActive] = useState(false)
  useEffect(() => {
    const onStart = () => setIsUtilityDragActive(true)
    const onEnd = () => setIsUtilityDragActive(false)
    window.addEventListener('utility-drag-start', onStart)
    window.addEventListener('utility-drag-end', onEnd)
    return () => {
      window.removeEventListener('utility-drag-start', onStart)
      window.removeEventListener('utility-drag-end', onEnd)
    }
  }, [])

  // Sidebar management
  const openRightSidebar = useWorkflowStore((state) => state.openRightSidebar)
  const updateBlockName = useWorkflowStore((state) => state.updateBlockName)
  const hostPosition = useWorkflowStore((state) => state.blocks[id]?.position)

  // Dark mode detection for sticky-note inline styles
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // For condition blocks, get condition handles (narrow selector instead of full store)
  const conditionsValue = useSubBlockStore(
    useCallback(
      (s: any) => {
        if (type !== 'condition') return null
        return activeWorkflowId
          ? (s.workflowValues[activeWorkflowId]?.[id]?.['conditions'] ?? null)
          : null
      },
      [type, id, activeWorkflowId]
    )
  )
  const conditionBlocks = useMemo(() => {
    if (type !== 'condition') return []

    try {
      // If no conditions stored yet, use default if/else structure
      if (!conditionsValue) {
        return [
          { id: `${id}-if`, title: 'if', value: '' },
          { id: `${id}-else`, title: 'else', value: '' },
        ]
      }

      const parsed = JSON.parse(conditionsValue)

      // If parse fails or empty, return default
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return [
          { id: `${id}-if`, title: 'if', value: '' },
          { id: `${id}-else`, title: 'else', value: '' },
        ]
      }

      return parsed
    } catch {
      // On error, return default if/else
      return [
        { id: `${id}-if`, title: 'if', value: '' },
        { id: `${id}-else`, title: 'else', value: '' },
      ]
    }
  }, [type, id, conditionsValue])

  // ─── Agent profile indicator (always called — rules-of-hooks compliance) ────
  const isAgentCategory = config.category === 'agents'
  const agentProfileId = useSubBlockStore(
    useShallow((s) => {
      if (!isAgentCategory || !activeWorkflowId) return ''
      return (s.workflowValues[activeWorkflowId]?.[id]?.['agentProfileId'] ?? '') as string
    })
  )

  const agentProfile = useAgentProfilesStore((s) => {
    if (!agentProfileId) return null
    return s.profiles[agentProfileId] ?? null
  })

  // Lazy-load profiles if the store is empty but a profileId is set
  useEffect(() => {
    if (isAgentCategory && agentProfileId) {
      const { profiles, loadProfiles, isLoading } = useAgentProfilesStore.getState()
      if (!profiles[agentProfileId] && !isLoading) {
        loadProfiles()
      }
    }
  }, [isAgentCategory, agentProfileId])

  // ─── Utility primary param label (always called — rules-of-hooks compliance) ─
  const dropdownSubBlock = useMemo(
    () => (config.isUtility ? config.subBlocks?.find((sb) => sb.type === 'dropdown') : null),
    [config.isUtility, config.subBlocks]
  )
  const dropdownValue = useSubBlockStore(
    useCallback(
      (s: any) => {
        if (!dropdownSubBlock) return null
        return activeWorkflowId
          ? (s.workflowValues[activeWorkflowId]?.[id]?.[dropdownSubBlock.id] ?? null)
          : null
      },
      [dropdownSubBlock, id, activeWorkflowId]
    )
  )
  const primaryParam = useMemo(() => {
    if (!dropdownSubBlock || !dropdownValue) return null
    const opts = dropdownSubBlock.options as any[]
    const match = opts?.find((o: any) => o.id === dropdownValue || o.value === dropdownValue)
    const label = match?.label ?? String(dropdownValue)
    return label.length > 14 ? label.slice(0, 13) + '…' : label
  }, [dropdownSubBlock, dropdownValue])

  // Name editing handlers
  const handleNameClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      setEditedName(blockDisplayName)
      setIsEditing(true)
    },
    [blockDisplayName]
  )

  const handleNameSubmit = useCallback(() => {
    const trimmedName = editedName.trim().slice(0, 30)
    if (trimmedName && trimmedName !== name) {
      updateBlockName(id, trimmedName)
    }
    setIsEditing(false)
  }, [editedName, name, id, updateBlockName])

  const handleNameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.stopPropagation()
      if (e.key === 'Enter') {
        handleNameSubmit()
      } else if (e.key === 'Escape') {
        setIsEditing(false)
      }
    },
    [handleNameSubmit]
  )

  // ─── Connection Validators ───────────────────────────────────────────────────
  // Prevent cross-type handle connections (utility-source ↔ regular target etc.)
  // Prevent backward connections (cycles).
  // Declared before any early returns so they are available in all branches.
  const isValidToUtilityTarget = useCallback(
    (c: Connection) => c.sourceHandle === 'utility-source',
    []
  )
  const isValidToRegularTarget = useCallback((c: Connection) => {
    if (c.sourceHandle === 'utility-source') return false
    // Prevent backward connections (cycles)
    if (c.source && c.target) {
      const edges = getCycleCheckEdges(useWorkflowStore.getState().edges)
      if (wouldCreateCycle(c.source, c.target, edges)) return false
      // Utility blocks can RECEIVE data (regular source → utility target) but
      // cannot OUTPUT via regular handles. Block utility→regular source connections.
      const blocks = useWorkflowStore.getState().blocks
      const srcConfig = blocks[c.source] ? getBlock(blocks[c.source].type) : null
      if (srcConfig?.isUtility) return false // Utility blocks cannot be source via regular handle
    }
    return true
  }, [])

  // ─── Sticky Note Block ───────────────────────────────────────────────────────
  if (type === 'sticky-note') {
    return <StickyNoteBlock id={id} name={name} enabled={enabled} isDark={isDark} />
  }

  // Pre-compute glass appearance (needed by both utility and main render paths)
  const { glassFallback, glassSurface, glassOverlay, glassInsetShadow, handleBorder } =
    getLiveCanvasGlassAppearance(isDark)

  // ─── Utility / Helper Block Mode ────────────────────────────────────────────
  if (config.isUtility) {
    return (
      <UtilityBlock
        id={id}
        type={type}
        name={name}
        config={config}
        isActive={isActive}
        isPending={isPending}
        enabled={enabled}
        isDark={isDark}
        handleBorder={handleBorder}
        primaryParam={primaryParam}
        Icon={Icon}
      />
    )
  }

  // ─── Main Render ─────────────────────────────────────────────────────────────
  // Outer div: ReactFlow bounding box + handles.
  // Inner div: clip-path shape + drop-shadow (follows shape contour).
  const bgColor = starterDisplay?.accentColor || config?.bgColor || '#8B5CF6'
  const showBrandStarterIcon = type === 'starter' && !!starterDisplay?.brandIcon
  const shape = getBlockShape(type, (config as any).category || '', config.isUtility || false)
  const blockShadow = getBlockShadow(
    bgColor,
    !!(selected || isNew),
    !!isActive,
    isDark,
    shape.hasLeftAccent
  )
  const statusColor = !enabled
    ? '#ef4444'
    : isActive
      ? '#22c55e'
      : isPending
        ? '#f59e0b'
        : '#94a3b8'
  const utilityHandleGlow = isDark ? 'rgba(168,85,247,0.35)' : 'rgba(168,85,247,0.24)'
  const previewSubtitle = isActive
    ? 'Processing...'
    : isPending
      ? 'Queued...'
      : starterDisplay?.displaySubtitle || config.description || type
  const previewSubtitleClass = isActive
    ? 'text-purple-500 font-medium'
    : isPending
      ? 'text-amber-500 font-medium'
      : isDark
        ? 'text-white/42'
        : 'text-zinc-400'

  return (
    <div
      className="workflow-drag-handle workflow-editor-block-shell relative group cursor-pointer"
      data-block-type={type}
      data-block-enabled={enabled ? 'true' : 'false'}
      data-block-selected={selected ? 'true' : 'false'}
      style={
        {
          width:
            type === 'starter'
              ? '164px'
              : type === 'condition' || type === 'router'
                ? '154px'
                : '152px',
          '--workflow-block-accent': bgColor,
        } as React.CSSProperties
      }
    >
      {/* Utility slot handle (bottom) — receives helper/utility block connections */}
      <Handle
        type="target"
        position={Position.Bottom}
        id="utility-target"
        className={cn(
          '!z-40 !cursor-crosshair',
          'transition-[opacity,box-shadow] duration-200',
          isUtilityDragActive ? '!opacity-100' : '!opacity-0 group-hover:!opacity-100'
        )}
        style={{
          width: '5px',
          height: '1.5px',
          bottom: '-2px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#a855f7',
          border: `1px solid ${handleBorder}`,
          borderRadius: '999px',
          boxShadow: isUtilityDragActive ? `0 0 10px ${utilityHandleGlow}` : 'none',
        }}
        isConnectableStart={false}
        isConnectableEnd={true}
        isValidConnection={isValidToUtilityTarget}
      />
      {/* Input Handle (left side) - Ultra stable, no position shift on hover */}
      {type !== 'starter' && (
        <Handle
          type="target"
          position={Position.Left}
          id="target"
          className={cn(
            'react-flow__handle-modern',
            '!w-[1px] !h-[6px]',
            '!rounded-full',
            '!shadow-sm',
            '!z-50 !cursor-crosshair',
            '!transition-[box-shadow,border-color] !duration-200'
          )}
          style={{
            top: '50%',
            left: `${-1 + shape.handleLeft}px`,
            transform: 'translateY(-50%)',
            transformOrigin: 'center',
            pointerEvents: 'auto',
            background: 'linear-gradient(to bottom, rgba(96,165,250,0.78), #60a5fa)',
            border: `1px solid ${handleBorder}`,
          }}
          isConnectableStart={false}
          isConnectableEnd={true}
          isValidConnection={isValidToRegularTarget}
        />
      )}
      {/* Output Handles - Different for condition blocks */}
      <ConditionHandles
        type={type}
        conditionBlocks={conditionBlocks}
        shape={shape}
        handleBorder={handleBorder}
        isValidToRegularTarget={isValidToRegularTarget}
      />

      {/* Action Bar - hover menu */}
      <ActionBar blockId={id} blockType={type} />

      {/* Quick Add Utility — only for non-utility blocks */}
      {hostPosition && <QuickAddUtility hostBlockId={id} hostBlockPosition={hostPosition} />}

      {/* Single div: filter + clip-path on SAME element avoids Firefox/Zen foreignObject bug
           where parent filter + child clip-path causes invisible rendering */}
      <div
        onClick={(e) => {
          if (
            (e.target as HTMLElement).closest('.block-name-editable') ||
            (e.target as HTMLElement).closest('.action-bar') ||
            (e.target as HTMLElement).closest('button')
          )
            return
          openRightSidebar(id)
        }}
        style={{
          clipPath: shape.clipPath,
          borderRadius: shape.borderRadius,
          filter: blockShadow.filter,
          opacity: !enabled ? 0.4 : 1,
          paddingLeft: type === 'condition' || type === 'router' ? '21px' : shape.paddingLeft,
          paddingRight:
            type === 'starter'
              ? '14px'
              : type === 'condition' || type === 'router'
                ? '14px'
                : '14px',
          paddingTop: '7px',
          paddingBottom: '7px',
          boxShadow: `${blockShadow.boxShadow}, ${glassInsetShadow}`,
          backgroundColor: glassFallback,
          backgroundImage: glassSurface,
          transition: 'filter 0.2s ease-out, opacity 0.2s ease-out',
          minHeight:
            type === 'condition' && conditionBlocks.length > 0
              ? `${conditionBlocks.length * 34 + 12}px`
              : undefined,
        }}
        className="workflow-editor-block-surface relative overflow-hidden"
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: glassOverlay }}
        />
        <div className="relative z-10">
          {/* Header: icon + title/subtitle */}
          <BlockContent
            Icon={Icon}
            bgColor={bgColor}
            blockDisplayName={blockDisplayName}
            previewSubtitle={previewSubtitle}
            previewSubtitleClass={previewSubtitleClass}
            showBrandStarterIcon={showBrandStarterIcon}
            isDark={isDark}
            enabled={enabled}
            isEditing={isEditing}
            editedName={editedName}
            setEditedName={setEditedName}
            handleNameSubmit={handleNameSubmit}
            handleNameKeyDown={handleNameKeyDown}
            handleNameClick={handleNameClick}
          />

          {/* (profile badge is rendered outside the clip-path, see below) */}

          {/* Validation banners — error + warning inline strips */}
          <BlockStateBanners
            hasValidationError={hasValidationError}
            hasValidationWarning={hasValidationWarning}
            bannerDismissed={bannerDismissed}
            warningBannerDismissed={warningBannerDismissed}
            validationResult={validationResult}
            setBannerDismissed={setBannerDismissed}
            setWarningBannerDismissed={setWarningBannerDismissed}
          />
        </div>
      </div>
      {/* close shape div */}

      {!agentProfile && !hasValidationError && (
        <span
          className={cn(
            'absolute top-0 right-0 z-20 w-2 h-2 rounded-full border border-white dark:border-[#1b1b1b]',
            (isActive || isPending) && 'animate-pulse'
          )}
          style={{ background: statusColor }}
        />
      )}

      {/* Agent profile badge — floating pill anchored top-left of block */}
      {agentProfile && <AgentProfileBadge agentProfile={agentProfile} />}

      {/* Validation error badge — persistent "!" indicator on top-right corner */}
      {hasValidationError && (
        <div
          className="absolute -top-1.5 -right-1.5 z-30 w-4 h-4 rounded-full flex items-center justify-center pointer-events-none border-2 border-white dark:border-[#1b1b1b] animate-pulse"
          style={{ background: 'rgba(245,158,11,0.95)' }}
        >
          <span className="text-white font-logo font-bold leading-none" style={{ fontSize: '9px' }}>
            !
          </span>
        </div>
      )}

      {/* Active Helper Indicator — purple sweep at bottom when a utility block is executing */}
      {hasActiveHelper && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 overflow-hidden pointer-events-none z-20">
          <div className="helper-active-sweep h-full" />
        </div>
      )}
    </div>
  )
})
